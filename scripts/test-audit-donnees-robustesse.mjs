/**
 * Audit données / robustesse — claim Primary fail-closed, cockpit W-#n,
 * includeNew V2, gardes secondaire, requeue stats.
 * Usage: node scripts/test-audit-donnees-robustesse.mjs
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

const dsSrc = fs.readFileSync(path.join(root, 'device-session.js'), 'utf8');
const ankiSrc = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const algoV2Src = fs.readFileSync(path.join(root, 'anki-algo-v2.js'), 'utf8');
const quickSrc = fs.readFileSync(path.join(root, 'anki-quick.js'), 'utf8');
const wizSrc = fs.readFileSync(path.join(root, 'cours-wizard.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

console.log('=== DeviceSession anti faux-PRIMARY ===\n');
assert(/Promise\.reject\(err\)/.test(dsSrc) && /presence write/.test(dsSrc),
  'writeHub rejette en cas d’échec (pas de faux succès)');
assert(/ne jamais s’auto-proclamer PRIMARY|Fail-closed : ne jamais/.test(dsSrc)
  || /Fail-closed : ne jamais s.auto-proclamer PRIMARY/.test(dsSrc),
  'claimPrimary fail-closed documenté');
assert(!/claimPrimary:[\s\S]*?effectiveRole = CONFIG\.ROLES\.PRIMARY[\s\S]*?safeWritePresence/.test(dsSrc)
  && /claimPrimary:[\s\S]*?effectiveRole = CONFIG\.ROLES\.SECONDARY/.test(dsSrc),
  'claimPrimary catch ne force plus PRIMARY');
assert(/_claimInFlight = false;\s*emit\(\);/.test(dsSrc.replace(/\s+/g, ' '))
  || /_claimInFlight = false;\n\s*emit\(\);/.test(dsSrc),
  'claimPrimary then ne force plus PRIMARY après attempt');
// Explicit: after retries, set SECONDARY
assert(/tryNo < 3[\s\S]*effectiveRole = CONFIG\.ROLES\.SECONDARY/.test(dsSrc),
  'après 3 essais échoués → SECONDARY');
assert(/watchUserData[\s\S]*_lastCloudConfirmedRevision/.test(dsSrc),
  'watchUserData met à jour _lastCloudConfirmedRevision');
assert(/watchUserData[\s\S]*captureCoursPlacementBase/.test(dsSrc),
  'watchUserData capture baseline cl/inter');

console.log('\n=== Cockpit W- / includeNew ===\n');
assert(/function cardBaseId/.test(ankiSrc), 'helper cardBaseId');
assert(/function setEffectiveIdsFromPlan/.test(ankiSrc), 'helper setEffectiveIdsFromPlan');
assert(/excludedIds\.has\(cardBaseId\(c\.id\)\)/.test(ankiSrc), 'exclude filtre par id parent');
assert(/chunksDevoirTonight[\s\S]*forced: true[\s\S]*selectedIds|isManualTab[\s\S]*chunksDevoirTonight/.test(ankiSrc),
  'mode manuel : W- → bouts');
assert(/includeNew[\s\S]*isReservoir|isReservoir[\s\S]*includeNew/.test(algoV2Src),
  'buildSession V2 honore includeNew (réservoir)');
assert(/ankiIncludeNew !== undefined \? settings\.ankiIncludeNew : 0/.test(ankiSrc),
  'défaut includeNew = 0 (aligné UI)');

console.log('\n=== Secondaire / save / stats ===\n');
assert(/refuseSecondaryFullMutation[\s\S]*ankiV2RecalDates|ankiV2RecalDates[\s\S]*refuseSecondaryFullMutation/.test(ankiSrc),
  'ankiV2RecalDates : garde secondaire');
assert(/refuseSecondaryFullMutation[\s\S]*ankiV2RebuildPieces|ankiV2RebuildPieces[\s\S]*refuseSecondaryFullMutation/.test(ankiSrc),
  'ankiV2RebuildPieces : garde secondaire');
assert(/refuseSecondaryFullMutation[\s\S]*ankiV2AdjustNext|ankiV2AdjustNext[\s\S]*refuseSecondaryFullMutation/.test(ankiSrc),
  'ankiV2AdjustNext : garde secondaire');
assert(/refuseSecondaryFullMutation[\s\S]*ankiV2UndoLastEval|ankiV2UndoLastEval[\s\S]*refuseSecondaryFullMutation/.test(ankiSrc),
  'ankiV2UndoLastEval : garde secondaire');
assert(/refuseSecondaryFullMutation[\s\S]*ankiV2UpdateTemps|ankiV2UpdateTemps[\s\S]*refuseSecondaryFullMutation/.test(ankiSrc),
  'ankiV2UpdateTemps : garde secondaire');
assert(/ankiV2SetQuickQueue[\s\S]*refuseSecondaryFullMutation[\s\S]*sessionIsLive/.test(ankiSrc),
  'ankiV2SetQuickQueue : secondaire avant conflit session');
assert(/stats\.total = \(S\.stats\.total \|\| 0\) \+ 1/.test(ankiSrc),
  'fail requeue incrémente total (évite done>total)');
assert(/persistSession\(\)\)\.then\(function \(\) \{\s*nextCard/.test(ankiSrc)
  || /persistSession\(\)\)\.then\(function \(\) \{\n\s*nextCard/.test(ankiSrc),
  'evalCardV2 attend persist avant nextCard');
assert(/return Promise\.resolve\(typeof window\.save/.test(ankiSrc),
  'persistSession retourne la Promise save');
assert(/evalCardV2 save:[\s\S]*nextCard\(true\)/.test(ankiSrc),
  'evalCardV2 : avance quand même si save échoue (anti double-notation)');
assert(/switchToSecondary:[\s\S]*getStatus\(\)/.test(dsSrc),
  'switchToSecondary catch : ne bloque pas l’UI');
assert(/r\.onkeydown =/.test(quickSrc), 'bindEnter : onkeydown (pas de stack listeners)');
assert(/coursWizardDeleteCreated[\s\S]*Promise\.resolve\(window\.save\(\)\)/.test(wizSrc),
  'wizard delete catch save errors');
assert(/__BOOT_CACHE_V\s*=\s*'20260820d'/.test(indexSrc), 'cache 20260820d');

// ── Runtime : includeNew + cardBaseId cockpit ──
console.log('\n=== Runtime includeNew / chunks ===\n');

function loadAlgo() {
  const sandbox = {
    window: { D: { settings: {}, exercices: [], devoirs: [], cours: [] } },
    console, Date, JSON, Object, Array, Math, String, Number, Boolean, Set, Map, Promise
  };
  sandbox.window.D = sandbox.window.D;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'anki-algo.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'anki-algo-v2.js'), 'utf8'), sandbox);
  return sandbox.window;
}

const w = loadAlgo();
const V2 = w.AnkiAlgoV2;
const today = V2.todayISO();

const reservoir = [];
for (let i = 0; i < 4; i++) {
  reservoir.push({
    id: 'X-RES' + i,
    type: 'exercice',
    statut: 'reservoir',
    titre: 'Res ' + i,
    mat: 'MATH',
    tempsCible: 60,
    ease: 2.5,
    intervalle: 0,
    repetitions: 0,
    importance: 3,
    profil: 'COURS'
  });
}
const active = [{
  id: 'X-ACT1',
  type: 'exercice',
  statut: 'actif',
  titre: 'Actif',
  mat: 'MATH',
  tempsCible: 60,
  ease: 2.5,
  intervalle: 1,
  repetitions: 1,
  importance: 3,
  profil: 'COURS',
  dateProchaineRevision: today
}];

w.D.exercices = active.concat(reservoir);
w.D.settings = { ankiIncludeNew: 2, margeBudget: 0.99 };

const plan0 = V2.buildSession(w.D.exercices, { sessionMinutes: 90, includeNew: 0 });
assert(!plan0.cartes.some(c => c.id && c.id.startsWith('X-RES')),
  'includeNew=0 : pas de réservoir');

const plan2 = V2.buildSession(w.D.exercices, { sessionMinutes: 90, includeNew: 2 });
const resIn = plan2.cartes.filter(c => String(c.id).startsWith('X-RES'));
assert(resIn.length === 2, 'includeNew=2 : 2 cartes réservoir dans la file (' + resIn.length + ')');

const dm = {
  id: 'W-DM1',
  type: 'devoir',
  statut: 'actif',
  titre: 'DM test',
  mat: 'MATH',
  _morceauxTotal: 3,
  _morceauxFaits: 0,
  _tempsRestantMin: 60,
  _dureeTotaleMin: 60,
  tempsCible: 20 * 60,
  dateLimite: V2.addDays(today, 2),
  dateProchaineRevision: today
};
const chunks = V2.chunksDevoirTonight(dm, today, 1e9, { forced: true });
assert(chunks.length >= 1, 'chunksDevoirTonight produit des bouts');
assert(chunks.every(c => c.id.indexOf('#') > 0 && c._devoirChunkOf === 'W-DM1'),
  'bouts ont id W-xxx#n et _devoirChunkOf');
assert(String(chunks[0].id).split('#')[0] === 'W-DM1', 'cardBaseId(chunk) = parent');

// Exclude parent doit retirer tous les bouts (simulation filtre cockpit)
const excluded = new Set(['W-DM1']);
const afterExclude = chunks.filter(c => !excluded.has(String(c.id).split('#')[0]));
assert(afterExclude.length === 0, 'exclude parent retire tous les bouts W-xxx#n');

// includeNew sous budget serré + beaucoup d’actifs overdue : réservoir quand même pris
const manyActive = [];
for (let i = 0; i < 8; i++) {
  manyActive.push({
    id: 'X-OLD' + i,
    type: 'exercice',
    statut: 'actif',
    titre: 'Old ' + i,
    mat: 'MATH',
    tempsCible: 600,
    ease: 2.5,
    intervalle: 1,
    repetitions: 3,
    importance: 5,
    profil: 'COURS',
    dateProchaineRevision: V2.addDays(today, -3)
  });
}
w.D.exercices = manyActive.concat(reservoir);
const planTight = V2.buildSession(w.D.exercices, { sessionMinutes: 30, includeNew: 2, marge: 0.99 });
const resTight = planTight.cartes.filter(c => String(c.id).startsWith('X-RES'));
assert(resTight.length === 2, 'includeNew sous budget serré : 2 réservoir prioritaires (' + resTight.length + ')');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
