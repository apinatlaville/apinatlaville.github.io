/**
 * Re-vérif comportementale des correctifs d’audit.
 * Usage: node scripts/test-audit-fixes.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

const dataSrc = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const scannerSrc = fs.readFileSync(path.join(root, 'scanner.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const ankiSrc = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/** Simule le merge stat-only extrait de app.js */
function mergeStatOnly(localCours, remoteCours) {
  const remoteByUid = Object.create(null);
  remoteCours.forEach(function (rc) {
    if (rc && rc.uid) remoteByUid[rc.uid] = rc;
  });
  const statOrder = { pending: 0, printed: 1, active: 2 };
  localCours.forEach(function (lc) {
    const rc = remoteByUid[lc.uid];
    if (!rc || !rc.stat || rc.stat === lc.stat) return;
    if ((statOrder[rc.stat] || 0) > (statOrder[lc.stat] || 0)) lc.stat = rc.stat;
  });
  return localCours;
}

console.log('[1] Merge révision — ne pas écraser cl/inter du Principal');
{
  const local = [
    { uid: 'A', cl: 'CL-NEW', inter: '03', stat: 'active' }, // Principal a déplacé
    { uid: 'B', cl: 'CL-1', inter: '01', stat: 'printed' }
  ];
  const remote = [
    { uid: 'A', cl: 'CL-OLD', inter: '01', stat: 'active' }, // cloud périmé sur A
    { uid: 'B', cl: 'CL-1', inter: '01', stat: 'active' }   // secondaire a scanné B
  ];
  mergeStatOnly(local, remote);
  assert(local[0].cl === 'CL-NEW' && local[0].inter === '03', 'DocA : déplacement Principal conservé');
  assert(local[1].stat === 'active', 'DocB : stat secondaire (printed→active) fusionné');
  assert(!/lc\.cl = rc\.cl/.test(appSrc), 'plus de merge cl/inter aveugle dans app.js');
  assert(/stat only/.test(appSrc), 'commentaire merge stat-only présent');
}

console.log('[2] Merge — n’adopte pas un stat moins avancé');
{
  const local = [{ uid: 'X', cl: 'C', inter: '01', stat: 'active' }];
  const remote = [{ uid: 'X', cl: 'C', inter: '01', stat: 'pending' }];
  mergeStatOnly(local, remote);
  assert(local[0].stat === 'active', 'stat local plus avancé conservé');
}

console.log('[3] confirmInit — rollback + garde secondaire');
{
  assert(/prevStat/.test(dataSrc) && /c\.stat = prevStat/.test(dataSrc), 'confirmInit rollback prevStat');
  assert(/canFullSave[\s\S]*SECONDARY_READ_ONLY/.test(dataSrc), 'confirmInit refuse sans muter si !canFullSave');
  assert(/Document introuvable dans le cloud/.test(dataSrc), 'confirmInit rejette uid cloud absent');

  let restored = null;
  const sandbox = {
    window: {
      D: { cours: [{ uid: 'U1', stat: 'printed' }] },
      $: () => null,
      iconLabel: (i, t) => t,
      sysAlert() {},
      renderCours: () => {},
      renderDashboard: () => {},
      closeLocPopup: () => {},
      DeviceSession: {
        canSecondaryPatch: () => false,
        canFullSave: () => true
      },
      save: () => Promise.reject(new Error('localStorage save failed'))
    },
    console: { warn() {}, error() {}, log() {} }
  };
  sandbox.window.window = sandbox.window;
  const m = dataSrc.match(/window\.confirmInit = function\(uid\) \{[\s\S]*?\n\};/);
  assert(!!m, 'confirmInit extractible');
  vm.runInNewContext(m[0], sandbox);
  sandbox.window.confirmInit('U1');
  await new Promise((r) => setTimeout(r, 30));
  restored = sandbox.window.D.cours[0].stat;
  assert(restored === 'printed', 'après échec save, stat restauré à printed');
}

console.log('[3b] confirmInit — échec cloud (local OK) ne rollback pas');
{
  let alerts = [];
  const sandbox = {
    window: {
      D: { cours: [{ uid: 'U1', stat: 'printed' }] },
      $: () => null,
      iconLabel: (i, t) => t,
      sysAlert(msg, title) { alerts.push({ msg, title }); },
      renderCours: () => {},
      renderDashboard: () => {},
      closeLocPopup: () => {},
      DeviceSession: {
        canSecondaryPatch: () => false,
        canFullSave: () => true
      },
      save: () => Promise.reject(new Error('Firestore unavailable'))
    },
    console: { warn() {}, error() {}, log() {} }
  };
  sandbox.window.window = sandbox.window;
  const m = dataSrc.match(/window\.confirmInit = function\(uid\) \{[\s\S]*?\n\};/);
  vm.runInNewContext(m[0], sandbox);
  await new Promise((resolve) => {
    sandbox.window.sysAlert = function (msg, title) {
      alerts.push({ msg, title });
      resolve();
    };
    sandbox.window.confirmInit('U1');
    setTimeout(resolve, 50);
  });
  assert(sandbox.window.D.cours[0].stat === 'active', 'échec cloud : mutation conservée');
  assert(alerts.some(a => /succès|Succès/i.test(String(a.title) + a.msg)), 'échec cloud : toast succès local');
}

console.log('[4] confirmInit — !canFullSave ne mute pas');
{
  const sandbox = {
    window: {
      D: { cours: [{ uid: 'U1', stat: 'printed' }] },
      $: () => null,
      iconLabel: (i, t) => t,
      alerts: [],
      sysAlert(msg) { this.alerts.push(msg); },
      DeviceSession: {
        canSecondaryPatch: () => false,
        canFullSave: () => false
      },
      save: () => { throw new Error('save ne doit pas être appelé'); }
    },
    console: { warn() {}, error() {}, log() {} }
  };
  sandbox.window.window = sandbox.window;
  const m = dataSrc.match(/window\.confirmInit = function\(uid\) \{[\s\S]*?\n\};/);
  vm.runInNewContext(m[0], sandbox);
  sandbox.window.confirmInit('U1');
  assert(sandbox.window.D.cours[0].stat === 'printed', 'stat inchangé si secondaire sans patch');
  assert(sandbox.window.alerts.length === 1, 'alerte échec affichée');
}

console.log('[5] saveMove / confirmPrintSuccess — patterns');
assert(/prev = \{ cl:/.test(dataSrc) && /c\.cl = prev\.cl/.test(dataSrc), 'saveMove rollback cl/inter/stat');
assert(/prevByUid/.test(scannerSrc), 'confirmPrintSuccess rollback stats');
assert(/canFullSave[\s\S]*SECONDARY_READ_ONLY/.test(scannerSrc), 'confirmPrintSuccess refuse !canFullSave');
assert(/Document introuvable dans le cloud/.test(dataSrc), 'saveMove rejette uid absent');

console.log('[6] evalCardV2 — lock + catch');
assert(/if \(S\._evalBusy\) return/.test(ankiSrc), 'eval refuse si busy');
assert(/catch \(err\) \{\s*S\._evalBusy = false/.test(ankiSrc), 'eval relâche lock sur exception');
assert(/ankiV2AbandonActiveSession[\s\S]*S\._evalBusy = false/.test(ankiSrc), 'abandon clear busy');
assert(/abortAnkiV2Session = function[\s\S]*S\._evalBusy = false/.test(ankiSrc), 'abort clear busy');

console.log('[7] Gardes + cache');
assert(/String\(a\.inter \|\| ''\)\.localeCompare/.test(dataSrc), 'tri inter null-safe');
assert(/String\(c\.title \|\| ''\)\.substring/.test(scannerSrc), 'title impression safe');
assert(/__BOOT_CACHE_V\s*=\s*'20260726j'/.test(indexSrc), 'cache 20260726j');

console.log('\n=== Résultat re-vérif audit ===');
console.log(`passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
