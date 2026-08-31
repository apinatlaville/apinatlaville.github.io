/**
 * Smoke fonctionnel — vérifie les briques métier du site (pas seulement les gardes audit).
 * Usage: node scripts/test-functional-smoke.mjs
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

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

console.log('=== Boot / navigation / modules ===\n');
const index = read('index.html');
const nav = read('nav-config.js');
const boot = read('boot-loader.js');

assert(/APP_TAB_REGISTRY|APP_NAV_GROUPS/.test(nav), 'nav-config expose registre onglets');
assert(/cours|ankiV2|flashcards|home|notes|print|settings|programme/.test(nav), 'onglets métier présents');
assert(/bootLoadApplication|loadParallel|cours-wizard/.test(boot), 'boot-loader charge app + wizard');
assert(/device-session|profiles-io|anki-algo-v2|anki-app-v2/.test(boot), 'boot charge sync + Anki');
assert(/__BOOT_CACHE_V\s*=\s*'20260831b'/.test(index), 'cache version définie');

console.log('\n=== Programme / chapitres ===\n');
assert(/paneProgramme|renderProgramme/.test(read('programme.js')), 'module programme.js');
assert(/programmeBrowse|renderProgrammeBrowse|prog-bc-bar|progBrowsePlayChapter/.test(read('programme-browse.js')), 'Fil d’Ariane programme');
assert(/chapitres:\s*\[\]/.test(read('data.js')), 'D.chapitres dans emptyData');
assert(/loginOverlay|activeProfileChip|deviceSessionPanel/.test(index), 'UI auth / profil / device');
assert(/ovCoursWizard|ovAnkiSession|ovQuickCreate|ovQuickLatex/.test(index)
  || /ovCours|ovAnkiSession|quick/.test(index), 'overlays création / session présents');

console.log('\n=== DeviceSession — gardes (static + adversarial suite) ===\n');
{
  const ds = read('device-session.js');
  assert(/function claimPrimary/.test(ds), 'claimPrimary défini');
  assert(/Promise\.reject\(err\)/.test(ds), 'writeHub rejette les erreurs');
  assert(/effectiveRole = CONFIG\.ROLES\.SECONDARY/.test(ds)
    && /needsRoleChoice = true/.test(ds), 'fail-closed secondary');
  assert(/_lastCloudConfirmedRevision/.test(ds), 'watchUserData révise confirmed');
  assert(/canFullSave/.test(ds) && /canSecondaryPatch/.test(ds), 'API rôles exposée');
  assert(/refuseSecondaryFullMutation/.test(ds), 'refuseSecondaryFullMutation global');
}

console.log('\n=== Anki — session, includeNew, devoirs, reorder ===\n');

function loadAlgo() {
  const sandbox = {
    window: { D: { settings: {}, exercices: [], devoirs: [], cours: [], matieres: [] } },
    console, Date, JSON, Object, Array, Math, String, Number, Boolean, Set, Map, Promise
  };
  vm.createContext(sandbox);
  vm.runInContext(read('anki-algo.js'), sandbox);
  vm.runInContext(read('anki-algo-v2.js'), sandbox);
  return sandbox.window;
}

{
  const w = loadAlgo();
  const V2 = w.AnkiAlgoV2;
  const today = V2.todayISO();
  w.D.exercices = [
    {
      id: 'X-A1', type: 'exercice', statut: 'actif', titre: 'Actif', mat: 'MATH',
      tempsCible: 60, ease: 2.5, intervalle: 1, repetitions: 1, importance: 3,
      profil: 'COURS', dateProchaineRevision: today
    },
    {
      id: 'X-R1', type: 'exercice', statut: 'reservoir', titre: 'Res', mat: 'MATH',
      tempsCible: 60, ease: 2.5, intervalle: 0, repetitions: 0, importance: 3, profil: 'COURS'
    },
    {
      id: 'Y-Q1', type: 'exercice', statut: 'actif', titre: 'Quick', mat: 'ANG',
      tempsCible: 30, ease: 2.5, intervalle: 0, repetitions: 0, importance: 3,
      profil: 'ANGLAIS', dateProchaineRevision: today
    }
  ];
  w.D.devoirs = [{
    id: 'W-D1', type: 'devoir', statut: 'actif', titre: 'DM', mat: 'MATH',
    tempsCible: 15 * 60, dateLimite: V2.addDays(today, 1), dateProchaineRevision: today
  }];

  const planAuto = V2.buildSession(
    w.D.exercices.concat(w.D.devoirs),
    { sessionMinutes: 90, includeNew: 1, marge: 0.99 }
  );
  assert(planAuto.cartes.length >= 2, 'buildSession produit une file');
  assert(planAuto.cartes.some(c => c.id === 'X-R1'), 'includeNew tire le réservoir');
  assert(!planAuto.cartes.some(c => c._devoirChunkOf === 'W-D1' || String(c.id).startsWith('W')),
    'devoir absent de la file Synchrotron');
  assert(planAuto.countDevoir === 0, 'countDevoir = 0');

  // DnD parents uniques (X-/Y- seulement)
  const queueIds = ['X-A1', 'Y-Q1', 'X-A1'];
  const parents = [];
  const seenP = new Set();
  const base = (id) => String(id).split('#')[0];
  queueIds.forEach(id => {
    const b = base(id);
    if (!seenP.has(b)) { seenP.add(b); parents.push(b); }
  });
  assert(parents[0] === 'X-A1' && parents.includes('Y-Q1') && parents.length === 2,
    'DnD → selectionOrder parents uniques');

  // Reorder manualOrder
  const cartes = [w.D.exercices[0], w.D.exercices[2]];
  const byId = {};
  cartes.forEach(c => { byId[c.id] = c; });
  const reordered = [];
  const seen = new Set();
  const wantOrder = ['Y-Q1', 'X-A1'];
  wantOrder.forEach(id => {
    if (byId[id] && !seen.has(id)) { reordered.push(byId[id]); seen.add(id); }
  });
  cartes.forEach(c => { if (!seen.has(c.id)) reordered.push(c); });
  assert(reordered[0].id === 'Y-Q1', 'reorder conservé');
  assert(reordered.some(c => c.id === 'X-A1'), 'X reste dans la file après reorder');

  // Activation réservoir
  assert(V2.isReservoir(w.D.exercices[1]) === true, 'X-R1 est réservoir');
  V2.activateFromReservoir(w.D.exercices[1]);
  assert(w.D.exercices[1].statut === 'actif', 'activateFromReservoir → actif');
  assert(w.D.exercices[1].dateProchaineRevision === today, 'réservoir activé dû aujourd’hui');

  // Eval interval
  const card = Object.assign({}, w.D.exercices[0]);
  const out = V2.computeNextInterval(card, 9, 60);
  assert(out && out.dateProchaineRevision && out.intervalle >= 0, 'computeNextInterval après bonne note');
  const outFail = V2.computeNextInterval(card, 2, 60);
  assert(outFail && outFail.dateProchaineRevision, 'computeNextInterval après échec');
}

console.log('\n=== Base Doc / data safety hooks ===\n');
{
  const dataSrc = read('data.js');
  const appSrc = read('app.js');
  const wizSrc = read('cours-wizard.js');
  assert(/function saveCours|saveCours\s*=/.test(dataSrc) || /saveCours/.test(dataSrc), 'saveCours présent');
  assert(/refuseSecondaryFullMutation/.test(dataSrc), 'CRUD cours gardé secondaire');
  assert(/mergeRemoteCoursPatches/.test(appSrc), 'merge cloud cours');
  assert(/captureCoursPlacementBase/.test(appSrc), 'baseline placement');
  assert(/openCoursWizard/.test(wizSrc), 'wizard création cours');
  assert(/coursWizardDeleteCreated[\s\S]*Promise\.resolve\(window\.save\(\)\)/.test(wizSrc),
    'delete wizard catch save');
  assert(/buildCoursBrowseTree/.test(read('data.js')) && /setCoursBrowseMode/.test(read('data.js')),
    'arbre Base Doc (buildCoursBrowseTree)');
}

console.log('\n=== Correctifs audit — encore en place ===\n');
{
  const ds = read('device-session.js');
  const anki = read('anki-app-v2.js');
  const quick = read('anki-quick.js');
  assert(/Promise\.reject\(err\)/.test(ds), 'writeHub reject');
  assert(/Fail-closed|ne jamais s.auto-proclamer PRIMARY|SECONDARY[\s\S]*needsRoleChoice/.test(ds),
    'claimPrimary fail-closed');
  assert(/_lastCloudConfirmedRevision/.test(ds), 'watch révision');
  assert(/function cardBaseId/.test(anki), 'cardBaseId');
  assert(/selectionOrder = parents\.filter|seenP\.has\(b\)/.test(anki),
    'DnD manuel normalise parents');
  assert(/S\.manualOrder\.forEach\(id => \{\s*if \(byId\[id\]/.test(anki)
    || /byId\[id\] && !seen\.has\(id\)/.test(anki),
    'manual plan respecte reorder chunk');
  assert(/refuseSecondaryFullMutation[\s\S]*sessionIsLive/.test(anki)
    || /ankiV2SetQuickQueue[\s\S]*refuseSecondaryFullMutation[\s\S]*sessionIsLive/.test(anki),
    'quick queue secondaire avant conflit');
  assert(/evalCardV2 save:[\s\S]*nextCard\(true\)/.test(anki), 'eval anti double-notation');
  assert(/rEl\.onkeydown =/.test(anki), 'bindEnter onkeydown');
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
