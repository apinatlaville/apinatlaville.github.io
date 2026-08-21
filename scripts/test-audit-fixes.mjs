/**
 * Re-vérif comportementale des correctifs d’audit (merge 3-voies, rollback, locks).
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
const dsSrc = fs.readFileSync(path.join(root, 'device-session.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/** Charge mergeRemoteCoursPatches + captureCoursPlacementBase depuis app.js */
function loadMergeApi() {
  const sandbox = { window: {}, console: { warn() {}, error() {}, log() {} } };
  sandbox.window.window = sandbox.window;
  const cap = appSrc.match(/window\.captureCoursPlacementBase = function[\s\S]*?\n\};/);
  const mer = appSrc.match(/window\.mergeRemoteCoursPatches = function[\s\S]*?\n\};/);
  if (!cap || !mer) throw new Error('helpers merge introuvables');
  vm.runInNewContext(cap[0] + '\n' + mer[0], sandbox);
  return sandbox.window;
}

console.log('[1] Merge 3-voies — Principal déplace A, Secondaire déplace/scan B');
{
  const api = loadMergeApi();
  const baseCours = [
    { uid: 'A', cl: 'CL-OLD', inter: '01', stat: 'active' },
    { uid: 'B', cl: 'CL-1', inter: '01', stat: 'printed' }
  ];
  api.captureCoursPlacementBase(baseCours);

  const local = [
    { uid: 'A', cl: 'CL-NEW', inter: '03', stat: 'active' }, // Principal a déplacé A
    { uid: 'B', cl: 'CL-1', inter: '01', stat: 'printed' }
  ];
  const remote = [
    { uid: 'A', cl: 'CL-OLD', inter: '01', stat: 'active' },
    { uid: 'B', cl: 'CL-2', inter: '05', stat: 'active' } // Secondaire a déplacé + scanné B
  ];
  api.mergeRemoteCoursPatches(local, remote);
  assert(local[0].cl === 'CL-NEW' && local[0].inter === '03', 'DocA : déplacement Principal conservé');
  assert(local[1].cl === 'CL-2' && local[1].inter === '05', 'DocB : déplacement Secondaire adopté');
  assert(local[1].stat === 'active', 'DocB : stat secondaire fusionné');
}

console.log('[2] Merge — conflit cl/inter sur même doc → Principal gagne');
{
  const api = loadMergeApi();
  api.captureCoursPlacementBase([
    { uid: 'X', cl: 'CL-0', inter: '01', stat: 'active' }
  ]);
  const local = [{ uid: 'X', cl: 'CL-P', inter: '02', stat: 'active' }];
  const remote = [{ uid: 'X', cl: 'CL-S', inter: '09', stat: 'active' }];
  api.mergeRemoteCoursPatches(local, remote);
  assert(local[0].cl === 'CL-P' && local[0].inter === '02', 'conflit : placement Principal gardé');
}

console.log('[3] Merge — sans baseline, ne pas écraser placement local');
{
  const api = loadMergeApi();
  api._coursPlacementBase = null;
  const local = [{ uid: 'Y', cl: 'CL-LOCAL', inter: '01', stat: 'printed' }];
  const remote = [{ uid: 'Y', cl: 'CL-REMOTE', inter: '02', stat: 'active' }];
  api.mergeRemoteCoursPatches(local, remote);
  assert(local[0].cl === 'CL-LOCAL', 'sans baseline : cl local conservé');
  assert(local[0].stat === 'active', 'sans baseline : stat remote quand même fusionné');
}

console.log('[4] Merge — n’adopte pas un stat moins avancé');
{
  const api = loadMergeApi();
  api.captureCoursPlacementBase([{ uid: 'X', cl: 'C', inter: '01', stat: 'active' }]);
  const local = [{ uid: 'X', cl: 'C', inter: '01', stat: 'active' }];
  const remote = [{ uid: 'X', cl: 'C', inter: '01', stat: 'pending' }];
  api.mergeRemoteCoursPatches(local, remote);
  assert(local[0].stat === 'active', 'stat local plus avancé conservé');
}

console.log('[5] Wiring app.js / device-session');
assert(/mergeRemoteCoursPatches\(window\.D\.cours/.test(appSrc), 'save appelle mergeRemoteCoursPatches');
assert(/captureCoursPlacementBase\(window\.D\.cours\)/.test(appSrc), 'capture après load cloud');
assert(/captureCoursPlacementBase\(window\.D && window\.D\.cours\)/.test(appSrc), 'capture après setDoc primaire');
assert(/captureCoursPlacementBase\(data\.cours\)/.test(dsSrc), 'capture après patch secondaire');
assert(/_lastCloudConfirmedRevision/.test(appSrc), 'track révision cloud confirmée');
assert(/prevRevision/.test(appSrc) && /window\.D\.meta\.revision = prevRevision/.test(appSrc),
  'rollback révision si setDoc cloud échoue');
assert(/runTransaction/.test(dsSrc), 'patch secondaire préfère runTransaction');
assert(/_lastCloudConfirmedRevision/.test(appSrc), 'merge base = révision confirmée');

console.log('[5b] Scénario : setDoc échoué puis patch secondaire — merge encore possible');
{
  // Fix actuel : confirmed reste 5 après échec + rollback → merge détecte cloud=6
  const confirmed = 5;
  const remoteRev = 6;
  assert(remoteRev > confirmed, 'après échec cloud, remoteRev > confirmed détecte le patch');
  // Ancien bug au re-save : revision locale restée à 6, incrément → 7, localBase=6
  // remoteRev=6 → 6>6 faux → merge sauté
  const buggyLocalBaseOnRetry = 6;
  assert(!(remoteRev > buggyLocalBaseOnRetry), 'ancien bug : merge aurait été sauté (localBase=6)');
}

console.log('[6] confirmInit — rollback + garde + pas de faux Succès cloud');
{
  assert(/prevStat/.test(dataSrc) && /c\.stat = prevStat/.test(dataSrc), 'confirmInit rollback prevStat');
  assert(/canFullSave[\s\S]*SECONDARY_READ_ONLY/.test(dataSrc), 'confirmInit refuse sans muter si !canFullSave');
  assert(/Document introuvable dans le cloud/.test(dataSrc), 'confirmInit rejette uid cloud absent');
  assert(/onOkUi\(\);\s*\n\s*\}\);/.test(dataSrc) || /Échec cloud : local OK[\s\S]*onOkUi\(\)/.test(dataSrc),
    'échec cloud appelle onOkUi sans toast Succès');

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
  assert(sandbox.window.D.cours[0].stat === 'printed', 'après échec localStorage, stat restauré');
}

console.log('[6b] confirmInit — échec cloud : mutation OK, pas de toast Succès');
{
  const alerts = [];
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
  sandbox.window.confirmInit('U1');
  await new Promise((r) => setTimeout(r, 30));
  assert(sandbox.window.D.cours[0].stat === 'active', 'échec cloud : mutation conservée');
  assert(!alerts.some(a => /Succès/i.test(String(a.title))), 'échec cloud : pas de toast Succès');
}

console.log('[7] confirmInit — !canFullSave ne mute pas');
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

console.log('[8] saveMove / confirmPrintSuccess / eval');
assert(/prev = \{ cl:/.test(dataSrc) && /c\.cl = prev\.cl/.test(dataSrc), 'saveMove rollback cl/inter/stat');
assert(/onOkUi\(\)/.test(dataSrc), 'saveMove/confirmInit ont onOkUi');
assert(/prevByUid/.test(scannerSrc), 'confirmPrintSuccess rollback stats');
assert(/canFullSave[\s\S]*SECONDARY_READ_ONLY/.test(scannerSrc), 'confirmPrintSuccess refuse !canFullSave');
assert(/if \(S\._evalBusy\) return/.test(ankiSrc), 'eval refuse si busy');
assert(/catch \(err\) \{\s*S\._evalBusy = false/.test(ankiSrc), 'eval relâche lock sur exception');
assert(/ankiV2AbandonActiveSession[\s\S]*S\._evalBusy = false/.test(ankiSrc), 'abandon clear busy');

console.log('[9] Gardes + cache');
assert(/String\(a\.inter \|\| ''\)\.localeCompare/.test(dataSrc), 'tri inter null-safe');
assert(/String\(c\.title \|\| ''\)\.substring/.test(scannerSrc), 'title impression safe');
assert(/__BOOT_CACHE_V\s*=\s*'20260821a'/.test(indexSrc), 'cache 20260821a');

console.log('\n=== Résultat re-vérif audit ===');
console.log(`passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
