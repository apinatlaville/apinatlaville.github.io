/**
 * Onglet Révisions : câblage + post-its par matière.
 * Usage: node scripts/test-revisions.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { checkBootCacheVersion } from './_cache-version.mjs';

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

console.log('=== Câblage onglet Révisions ===\n');
const navSrc = read('nav-config.js');
const indexSrc = read('index.html');
const bootSrc = read('boot-loader.js');
const appSrc = read('app.js');
const pioSrc = read('profiles-io.js');
const dataSrc = read('data.js');
const jsSrc = read('revision-notes.js');
const cssSrc = read('revision-notes.css');

assert(/revisions:\s*\{[^}]*pane:\s*'paneRevisions'/.test(navSrc), 'nav-config enregistre revisions');
assert(/label:\s*'Révisions'/.test(navSrc), 'libellé Révisions (pas Notes)');
assert(/tabs:\s*\[[^\]]*['\"]revisions['\"]/.test(navSrc), 'Révisions dans un groupe nav');
assert(/id="paneRevisions"/.test(indexSrc), 'paneRevisions dans index.html');
assert(/id="paneNotes"/.test(indexSrc), 'onglet Notes existant conservé');
assert(/revision-notes\.css/.test(indexSrc), 'CSS chargé');
assert(/revisions:\s*\[['\"]revision-notes\.js['\"]\]/.test(bootSrc), 'bundle lazy revision-notes.js');
assert(/case 'revisions'/.test(appSrc), 'app.js onShow revisions');
assert(/revisionNotes:\s*\[\]/.test(dataSrc), 'emptyData.revisionNotes');
assert(/D\.revisionNotes/.test(appSrc), 'initApp initialise revisionNotes');
assert(/prefix:\s*'rn:'/.test(pioSrc), 'famille tombstone rn:');
assert(/id:\s*'revisions'/.test(pioSrc), 'section import/export revisions');
assert(/id:\s*'notes'/.test(pioSrc), 'section notes/rangs conservée');
assert(/window\.renderRevisions\s*=/.test(jsSrc), 'API renderRevisions');
assert(/À réviser/.test(jsSrc) && /À consolider/.test(jsSrc), 'deux listes à réviser / à consolider');
assert(/sticky-note/.test(read('icons.js')), 'icône sticky-note');
assert(/rev-note/.test(cssSrc), 'styles post-it');
assert(checkBootCacheVersion(root).ok, 'cache __BOOT_CACHE_V défini');

console.log('\n=== Modèle + API ===\n');

function loadApi() {
  const env = {
    D: {
      matieres: [
        { id: 'PHYS', name: 'Physique', color: '#5b8df7', enabled: true },
        { id: 'MATH', name: 'Mathématiques', color: '#f0c060', enabled: true }
      ],
      revisionNotes: [],
      cours: [], exercices: [], devoirs: []
    },
    saveCalls: 0
  };
  env.listSelectableMatieres = function () { return env.D.matieres; };
  env.save = function () { env.saveCalls++; return Promise.resolve(); };
  env.escHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const sandbox = { window: env, document: { getElementById() { return null; } }, console, Date, Math, JSON, String, Array, Object };
  sandbox.window = env;
  vm.runInNewContext(jsSrc, sandbox, { filename: 'revision-notes.js' });
  return env;
}

const env = loadApi();
const api = env._revisionNotesApi;
assert(!!api, 'API interne exposée pour tests');
const n1 = api.createNote('PHYS', 'Optique');
assert(n1 && /^RN-/.test(n1.id), 'post-it avec id RN-');
assert(n1.mat === 'PHYS' && n1.title === 'Optique', 'matière + titre');
assert(env.D.revisionNotes.length === 1, 'stocké dans D.revisionNotes');
const it = api.addItem(n1, 'review', 'Formules de lentilles');
assert(it && /^RI-/.test(it.id) && it.done === false, 'item à réviser');
api.addItem(n1, 'consolidate', 'Exercice TD3');
assert(n1.review.length === 1 && n1.consolidate.length === 1, 'deux listes distinctes');
assert(api.createNote('PHYS', '   ').title === 'Sans titre', 'titre vide → Sans titre');

console.log('\n=== Anti-wipe Lot 1 ===\n');
const pioCode = pioSrc;
const pioEnv = {
  emptyData: { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [], chapitres: [], quickGroups: [], revisionNotes: [] },
  localStorage: { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); return true; }, removeItem(k) { this._m.delete(k); } }
};
pioEnv.safeLocalGet = (k) => pioEnv.localStorage.getItem(k);
pioEnv.safeLocalSet = (k, v) => { pioEnv.localStorage.setItem(k, v); return true; };
pioEnv.safeLocalRemove = (k) => pioEnv.localStorage.removeItem(k);
const pioBox = { window: pioEnv, console, Date, JSON, Object, Array, String, Number, Math, Set, Map, Error };
vm.runInNewContext(pioCode, pioBox, { filename: 'profiles-io.js' });
const PIO = pioEnv.ProfilesIO;
const onlyNotes = {
  settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [],
  revisionNotes: [{ id: 'RN-1', mat: 'PHYS', title: 'Optique', review: [], consolidate: [] }]
};
assert(PIO.isEffectivelyEmptyProfile(onlyNotes) === false, 'post-its seuls ≠ coquille de création');
assert(PIO.hasUserContent(onlyNotes) === true, 'hasUserContent : post-its comptent');
assert(PIO.hasCourseCardContent(onlyNotes) === false, 'hasCourseCardContent : post-its ≠ cours/cartes');
const rich = { settings: {}, matieres: [], classeurs: [], cours: [{ uid: 'X1' }], exercices: [], devoirs: [] };
assert(PIO.writeLocalProfileData('default', rich) === true, 'écriture riche');
assert(PIO.writeLocalProfileData('default', onlyNotes) === false, 'post-its seuls n’écrasent pas des cours');
assert(PIO.readLocalProfileData('default').cours[0].uid === 'X1', 'cours conservés');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
