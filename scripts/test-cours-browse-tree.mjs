/**
 * Tests Base Doc : arbre matière → classeur → intercalaire + Fil d’Ariane.
 * Usage: node scripts/test-cours-browse-tree.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}

function loadDataJs() {
  const code = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
  const document = {
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() {
      return {
        style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute() {},
        appendChild() {},
        addEventListener() {},
        querySelectorAll() { return []; },
        querySelector() { return null; }
      };
    }
  };
  const window = {
    document,
    D: null,
    escHtml: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    iconHtml: () => '',
    iconBtn: () => '',
    iconEditDeletePair: () => '',
    renderClasseurIcon: () => '',
    statusLabel: (_c, t) => t,
    colorWithAlpha: (c) => c,
    intensifyColor: (c) => c,
    recordAppError: () => {},
    getInterName: (cl, inter) => {
      const ns = String(inter || '').padStart(2, '0');
      const n = cl && cl.interNames && cl.interNames[ns];
      return n ? (ns + ' — ' + n) : ns;
    },
    $: (id) => document.getElementById(id)
  };
  window.window = window;
  const ctx = { window, document, console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return window;
}

console.log('\n=== Base Doc browse tree ===\n');

const w = loadDataJs();
w.D = {
  settings: { showInitWarn: true },
  matieres: [
    { id: 'PHYS', label: 'PHYS', name: 'Physique', color: '#5b8df7' },
    { id: 'MATH', label: 'MATH', name: 'Mathématiques', color: '#f0c060' }
  ],
  classeurs: [
    { id: 'A', name: 'Classeur A', icon: 'book-blue', color: '#5b8df7', interNames: { '01': 'Meca' } },
    { id: 'B', name: 'Classeur B', icon: 'book-orange', color: '#f0c060', interNames: {} },
    { id: 'SHARED', name: 'Classeur Partagé', icon: 'folder', color: '#888', interNames: {} }
  ],
  cours: [
    { uid: 'P1', title: 'Cinématique', mat: 'PHYS', cl: 'A', inter: '01', type: 'COURS', stat: 'active' },
    { uid: 'P2', title: 'Dynamique', mat: 'PHYS', cl: 'A', inter: '02', type: 'TD', stat: 'active' },
    { uid: 'P3', title: 'Optique', mat: 'PHYS', cl: 'SHARED', inter: '01', type: 'COURS', stat: 'pending' },
    { uid: 'M1', title: 'Algèbre', mat: 'MATH', cl: 'B', inter: '01', type: 'COURS', stat: 'active' },
    { uid: 'M2', title: 'Analyse', mat: 'MATH', cl: 'SHARED', inter: '02', type: 'FICHE', stat: 'printed' }
  ]
};

assert(typeof w.buildCoursBrowseTree === 'function', 'buildCoursBrowseTree exposé');
assert(typeof w.setCoursBrowseMode === 'function', 'setCoursBrowseMode exposé');
assert(typeof w.toggleCoursTreeNode === 'function', 'toggleCoursTreeNode exposé');
assert(typeof w.renderCoursArianeHtml === 'function', 'renderCoursArianeHtml exposé');
assert(w.coursBrowseMode === 'tree', 'mode par défaut = tree');
assert(Object.keys(w.coursExpanded || {}).length === 0, 'classeurs/inter repliés par défaut');
assert(w.isCoursTreeExpanded('m:PHYS') === true, 'matières toujours considérées ouvertes');

const tree = w.buildCoursBrowseTree(w.D.cours);
assert(tree.length === 2, '2 matières dans l’arbre');
assert(tree[0].id === 'MATH' && tree[1].id === 'PHYS', 'matières triées par nom (Math puis Phys)');
assert(tree.find(m => m.id === 'PHYS').count === 3, 'Physique : 3 docs');
assert(tree.find(m => m.id === 'MATH').count === 2, 'Maths : 2 docs');

const phys = tree.find(m => m.id === 'PHYS');
assert(phys.classeurs.length === 2, 'Physique : 2 classeurs (A + SHARED)');
assert(phys.classeurs.every(c => ['A', 'SHARED'].includes(c.id)), 'Physique n’a que A et SHARED');
assert(!phys.classeurs.some(c => c.id === 'B'), 'Physique n’affiche pas le classeur Maths B');

const math = tree.find(m => m.id === 'MATH');
assert(math.classeurs.some(c => c.id === 'SHARED'), 'Maths a aussi le classeur SHARED');
assert(math.classeurs.some(c => c.id === 'B'), 'Maths a le classeur B');

const sharedPhys = phys.classeurs.find(c => c.id === 'SHARED');
const sharedMath = math.classeurs.find(c => c.id === 'SHARED');
assert(sharedPhys.count === 1 && sharedPhys.inters[0].cours[0].uid === 'P3', 'SHARED sous Phys : uniquement P3');
assert(sharedMath.count === 1 && sharedMath.inters[0].cours[0].uid === 'M2', 'SHARED sous Math : uniquement M2');

const allUids = [];
tree.forEach(m => m.classeurs.forEach(c => c.inters.forEach(i => i.cours.forEach(x => allUids.push(x.uid)))));
assert(allUids.length === 5, 'chaque cours apparaît une seule fois au total');
assert(new Set(allUids).size === 5, 'uids uniques dans l’arbre');

const aNode = phys.classeurs.find(c => c.id === 'A');
assert(aNode.inters.length === 2, 'Classeur A : 2 intercalaires');
assert(aNode.inters[0].id === '01' && aNode.inters[1].id === '02', 'intercalaires triés');

w.toggleCoursTreeNode('m:PHYS');
assert(w.isCoursTreeExpanded('m:PHYS') === true, 'toggle matière ignoré — reste ouverte');
w.toggleCoursTreeNode('c:PHYS|A');
assert(w.isCoursTreeExpanded('c:PHYS|A') === true, 'déplier classeur A');
w.toggleCoursTreeNode('c:PHYS|A');
assert(w.isCoursTreeExpanded('c:PHYS|A') === false, 'replier classeur A');

w.setCoursBrowseMode('ariane');
assert(w.coursBrowseMode === 'ariane', 'bascule mode Fil d’Ariane');
w.setCoursBrowseMode('mat');
assert(w.coursBrowseMode === 'ariane', 'alias mat → ariane');
w.setCoursBrowseMode('tree');
assert(w.coursBrowseMode === 'tree', 'retour mode arbre');

const htmlTree = w.renderCoursBrowseHtml(w.D.cours, 'tree');
assert(htmlTree.includes('cours-tree') && htmlTree.includes('Physique'), 'HTML arbre contient Physique');
assert(htmlTree.includes('Classeur A') && htmlTree.includes('Classeur Partagé'), 'matière ouverte : classeurs visibles');
assert(htmlTree.includes('is-locked'), 'en-tête matière verrouillé ouvert');
assert(!htmlTree.includes('Cinématique'), 'cartes encore cachées (classeurs repliés)');
w.coursExpanded['c:PHYS|A'] = true;
w.coursExpanded['i:PHYS|A|01'] = true;
const htmlOpen = w.renderCoursBrowseHtml(w.D.cours, 'tree');
assert(htmlOpen.includes('Cinématique'), 'après expand cl→inter : carte visible');
assert(htmlOpen.includes('Classeur A'), 'en-tête classeur visible');

console.log('\n=== Fil d’Ariane Base Doc ===\n');
w.coursExpanded = Object.create(null);
w.coursAriane = { mat: '', cl: '', inter: '' };
const htmlBc0 = w.renderCoursBrowseHtml(w.D.cours, 'ariane');
assert(htmlBc0.includes('cours-bc-bar') && htmlBc0.includes('Base Doc'), 'niveau 0 : barre Fil d’Ariane');
assert(htmlBc0.includes('Physique') && htmlBc0.includes('Mathématiques'), 'niveau 0 : tuiles matières');
assert(!htmlBc0.includes('Cinématique'), 'niveau 0 : pas encore de cartes docs');
assert(!htmlBc0.includes('cours-tree-hdr--cl'), 'Fil d’Ariane : pas d’en-têtes arbre classeur');

w.coursArianePickMat('PHYS');
assert(w.coursAriane.mat === 'PHYS' && !w.coursAriane.cl, 'pick matière PHYS');
const htmlBc1 = w.renderCoursArianeHtml(w.D.cours);
assert(htmlBc1.includes('Classeur A') && htmlBc1.includes('Classeur Partagé'), 'niveau 1 : classeurs Physique');
assert(htmlBc1.includes('coursArianePickCl'), 'niveau 1 : actions classeur');

w.coursArianePickCl('A');
const htmlBc2 = w.renderCoursArianeHtml(w.D.cours);
assert(htmlBc2.includes('coursArianePickInter'), 'niveau 2 : intercalaires');
assert(htmlBc2.includes('01') || htmlBc2.includes('Meca'), 'niveau 2 : inter 01');

w.coursArianePickInter('01');
const htmlBc3 = w.renderCoursArianeHtml(w.D.cours);
assert(htmlBc3.includes('Cinématique'), 'niveau 3 : carte document');
assert(htmlBc3.includes('uid-badge') || htmlBc3.includes('P1'), 'niveau 3 : uid visible');

w.coursArianeReset();
assert(!w.coursAriane.mat && !w.coursAriane.cl && !w.coursAriane.inter, 'reset Fil d’Ariane');

const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(/data-browse="ariane"/.test(indexSrc) && /Fil d.Ariane/.test(indexSrc), 'toggle Fil d’Ariane dans HTML');
assert(/btnCoursBrowseTree/.test(indexSrc) && /Arbre/.test(indexSrc), 'toggle Arbre conservé');
assert(/__BOOT_CACHE_V\s*=\s*'20260831d'/.test(indexSrc), 'cache 20260831d');
assert(/cours-bc-bar/.test(fs.readFileSync(path.join(root, 'style.css'), 'utf8')), 'styles Fil d’Ariane Base Doc');

console.log('\n=== Résultat ===');
console.log(`passed=${passed} failed=${failed}`);
if (failed) {
  console.error(failures.join('\n'));
  process.exit(1);
}
