/**
 * Couleur / renommage matière & classeur — IDs stables.
 * Usage: node scripts/test-mat-cl-edit.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function assert(c, m) { if (c) { passed++; console.log(' ✓', m); } else { failed++; console.error(' ✗', m); } }

function loadDataJs() {
  const store = new Map();
  const env = {
    document: { getElementById: () => null },
    COLORS: ['#5b8df7', '#f0c060', '#50d890', '#f06060'],
    newColor: '#5b8df7',
    newColorCl: '#5b8df7',
    D: {
      matieres: [
        { id: 'PHYS', label: 'PHYS', name: 'Physique', color: '#5b8df7' },
        { id: 'MATH', label: 'MATH', name: 'Maths', color: '#f0c060' }
      ],
      classeurs: [
        { id: 'CL-ABC12', name: 'Classeur A', icon: 'folder', color: '#5b8df7', maxInter: 12, interNames: {} }
      ],
      cours: [
        { uid: 'PH-8X2', title: 'Optique', mat: 'PHYS', cl: 'CL-ABC12', type: 'COURS' },
        { uid: 'MA-1', title: 'Suites', mat: 'MATH', cl: 'CL-ABC12', type: 'COURS' }
      ],
      exercices: [],
      devoirs: [],
      settings: {}
    },
    isSystemMatiere: (id) => id === 'UNTRI',
    isSystemClasseur: (id) => id === 'NONCL',
    escHtml: (s) => String(s == null ? '' : s),
    iconLabel: (a, b) => b || a,
    iconHtml: () => '',
    renderClasseurIcon: () => '',
    normalizeClasseurIcon: (k) => (k === 'book' || String(k || '').indexOf('book') === 0) ? 'book' : 'folder',
    CL_ICON_CHOICES: [
      { id: 'folder', label: 'Dossier', icon: 'folder' },
      { id: 'book', label: 'Classeur', icon: 'book' }
    ],
    save: () => { env._saved = true; },
    renderCours: () => {},
    renderClasseurs: () => {},
    renderMatieres: null,
    renderDashboard: () => {},
    renderNotes: () => {},
    hydrateIcons: () => {},
    $: (id) => {
      if (!env._els[id]) {
        env._els[id] = {
          value: '',
          style: {},
          classList: { add() {}, remove() {}, toggle() {} },
          innerHTML: ''
        };
      }
      return env._els[id];
    },
    _els: {},
    _saved: false,
    localStorage: {
      getItem: (k) => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    }
  };
  env.window = env;
  const code = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
  vm.runInNewContext(code, { window: env, document: env.document, console, Math, Date, JSON, Object, Array, String, Number, Error, parseInt, isNaN: Number.isNaN }, { filename: 'data.js' });
  return env;
}

const env = loadDataJs();

console.log('Matière / classeur — couleur & renommage');

// Création matière avec couleur
env.newColor = '#f06060';
env.$('nMlbl').value = 'INFO';
env.$('nMname').value = 'Informatique';
env.addMat();
const info = env.D.matieres.find((m) => m.id === 'INFO');
assert(!!info && info.color === '#f06060', 'création matière prend la couleur choisie');
assert(info.id === 'INFO' && info.label === 'INFO', 'id matière = code 4 lettres');

// Création classeur avec couleur
env.newColorCl = '#50d890';
env.newIconCl = 'book';
env.$('nClNm').value = 'Classeur Vert';
env.addCl();
const clNew = env.D.classeurs.find((c) => c.name === 'Classeur Vert');
assert(!!clNew && clNew.color === '#50d890', 'création classeur prend la couleur choisie');
assert(clNew.icon === 'book', 'création classeur icône livre/classeur');
assert(/^CL-/.test(clNew.id), 'id classeur auto CL-…');

// Édition matière : nom + couleur, id fixe
env.currentEditMatId = 'PHYS';
env.editMatColor = '#b06af7';
env.$('eMatNm').value = 'Physique PC*';
env.saveMatEdit();
const phys = env.D.matieres.find((m) => m.id === 'PHYS');
assert(phys.name === 'Physique PC*' && phys.color === '#b06af7', 'édition matière nom+couleur');
assert(phys.id === 'PHYS' && phys.label === 'PHYS', 'id matière inchangé');
assert(env.D.cours.find((c) => c.uid === 'PH-8X2').mat === 'PHYS', 'cours toujours lié par id PHYS');

// Édition classeur : nom + couleur + icône, id fixe
env.currentEditClId = 'CL-ABC12';
env.editClColor = '#f06ab0';
env.editClIcon = 'folder';
env.$('eClNm').value = 'Classeur Phys Renommé';
env.$('eClMax').value = '12';
env.saveClEdit();
const cl = env.D.classeurs.find((c) => c.id === 'CL-ABC12');
assert(cl.name === 'Classeur Phys Renommé' && cl.color === '#f06ab0', 'édition classeur nom+couleur');
assert(cl.icon === 'folder', 'édition classeur icône dossier');
assert(cl.id === 'CL-ABC12', 'id classeur inchangé');
assert(env.D.cours.every((c) => c.cl === 'CL-ABC12' || c.cl !== 'CL-ABC12'), 'liens cours.cl stables');
assert(env.D.cours.filter((c) => c.cl === 'CL-ABC12').length === 2, '2 cours toujours sur le même id classeur');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
