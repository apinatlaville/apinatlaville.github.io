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
assert(/label:\s*'Post-it'/.test(navSrc), 'libellé Post-it (pas Notes)');
assert(/label:\s*'Navigation'[\s\S]*?['\"]revisions['\"]/.test(navSrc), 'Post-it dans le groupe Navigation');
assert(!/label:\s*'Organisation',\s*\n\s*tabs:\s*\[[^\]]*revisions/.test(navSrc), 'Post-it hors Organisation');
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
assert(/À réviser absolument/.test(jsSrc) && /À revoir/.test(jsSrc) && /À consolider/.test(jsSrc) && /À voir/.test(jsSrc), 'groupes de couleur');
assert(/rev-table/.test(jsSrc) && /open-mat/.test(jsSrc), 'tableau matières × groupes en entrée');
assert(/back-board/.test(jsSrc), 'retour au tableau');
assert(/data-fc-skip/.test(jsSrc), 'cases à cocher hors toggles iOS (data-fc-skip)');
assert(/class="bp rev-add"/.test(jsSrc) === false, 'bouton Post-it sans classe .bp pleine largeur');
assert(/sticky-note/.test(read('icons.js')), 'icône sticky-note');
assert(/rev-note/.test(cssSrc) && /rev-table/.test(cssSrc), 'styles tableau + post-it');
assert(/data-group="urgent"/.test(cssSrc) && /p-urgent/.test(cssSrc), 'couleurs de groupe');
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
assert(n1.group === 'autre', 'groupe par défaut Autre');
assert(env.D.revisionNotes.length === 1, 'stocké dans D.revisionNotes');
const it = api.addItem(n1, 'review', 'Formules de lentilles');
assert(it && /^RI-/.test(it.id) && it.done === false, 'item à réviser');
api.addItem(n1, 'Exercice TD3');
assert(n1.review.length === 2, 'liste d’items sur le post-it');
assert(api.noteGroup({ review: [{ id: 'x', text: 'a', done: false }] }) === 'revoir', 'groupe inféré (ancien post-it sans group)');
assert(api.noteGroup({ consolidate: [{ id: 'y', text: 'b', done: false }] }) === 'consolider', 'groupe inféré consolider');
n1.group = 'urgent';
assert(api.noteGroup(n1) === 'urgent', 'groupe À réviser absolument');
assert(api.createNote('PHYS', '   ').title === 'Sans titre', 'titre vide → Sans titre');
assert(api.getActiveMat() === null, 'entrée = tableau (pas une matière)');

console.log('\n=== Texte conservé au changement de type ===\n');
assert(typeof api.applyNoteEdits === 'function' && typeof api.setNoteGroup === 'function', 'API harvest / setNoteGroup');
assert(/addEventListener\('input'/.test(jsSrc), 'sync live du texte (input)');
assert(/applyGroupInPlace/.test(jsSrc), 'changement de type en place (pas de rebuild)');
assert(!/act === 'set-group'[\s\S]{0,400}render\(\);/.test(jsSrc), 'set-group ne reconstruit pas le post-it');

const nKeep = api.createNote('MATH', 'Mécanique');
const itKeep = api.addItem(nKeep, 'review', 'Théorème énergie cinétique');
api.applyNoteEdits(nKeep, {
  title: 'Mécanique du point',
  items: [{ id: itKeep.id, text: 'TEC + forces' }],
  add: 'Moment cinétique'
});
assert(api.setNoteGroup(nKeep, 'urgent') === true, 'setNoteGroup accepte urgent');
assert(nKeep.title === 'Mécanique du point', 'titre encore dans le modèle après le type');
assert(nKeep.review.some((x) => x.text === 'TEC + forces'), 'item édité conservé');
assert(nKeep.review.some((x) => x.text === 'Moment cinétique'), 'ligne + Ajouter conservée');
assert(nKeep.group === 'urgent', 'groupe urgent appliqué sans perdre le texte');
assert(nKeep.review.length === 2, 'deux lignes sur le post-it');

const fakeAttrs = { 'data-id': nKeep.id, 'data-group': 'urgent' };
const fakeDots = api.GROUPS.map((g) => {
  const st = { on: g.id === 'urgent', pressed: g.id === 'urgent' ? 'true' : 'false', gid: g.id };
  return {
    classList: { toggle(name, on) { if (name === 'is-on') st.on = !!on; } },
    getAttribute(n) { return n === 'data-group' ? st.gid : st.pressed; },
    setAttribute(n, v) { if (n === 'aria-pressed') st.pressed = v; },
    _st: st
  };
});
const fakeLabel = { textContent: 'À réviser absolument' };
const fakeEl = {
  getAttribute(k) { return fakeAttrs[k]; },
  setAttribute(k, v) { fakeAttrs[k] = v; },
  querySelector(sel) { return sel === '.rev-group-label' ? fakeLabel : null; },
  querySelectorAll(sel) { return sel === '.rev-gdot' ? fakeDots : []; }
};
api.applyGroupInPlace(fakeEl, 'voir');
assert(fakeAttrs['data-group'] === 'voir', 'data-group mis à jour sans innerHTML');
assert(fakeLabel.textContent === 'À voir', 'libellé de groupe mis à jour');
assert(fakeDots.find((d) => d._st.gid === 'voir')._st.on === true, 'pastille À voir active');
assert(fakeDots.filter((d) => d._st.on).length === 1, 'une seule pastille active');
assert(nKeep.title === 'Mécanique du point' && nKeep.review.length === 2, 'DOM groupe : texte intact');

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
