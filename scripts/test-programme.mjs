/**
 * Tests Programme — chapitres logiques phase 1
 * Usage: node scripts/test-programme.mjs
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

console.log('=== Wiring onglet Programme ===\n');
const navSrc = read('nav-config.js');
const indexSrc = read('index.html');
const bootSrc = read('boot-loader.js');
const appSrc = read('app.js');
const progSrc = read('programme.js');
const labSrc = read('programme-search-test.js');

assert(/programme:\s*\{[^}]*pane:\s*'paneProgramme'/.test(navSrc), 'nav-config enregistre programme');
assert(/tabs:\s*\[[^\]]*['\"]programme['\"]/.test(navSrc), 'Programme dans groupe Organisation');
assert(/programmeSearchTest/.test(navSrc), 'Fil d’Ariane enregistré');
assert(/label:\s*'Organisation'[\s\S]*?programmeSearchTest/.test(navSrc), 'Fil d’Ariane dans Organisation');
assert(/id="paneProgramme"/.test(indexSrc), 'paneProgramme dans index.html');
assert(/id="paneProgrammeSearchTest"/.test(indexSrc), 'pane Fil d’Ariane dans index.html');
assert(/programme:\s*\[['\"]programme\.js['\"]\]/.test(bootSrc), 'bundle programme.js');
assert(/programmeSearchTest:\s*\[['\"]programme\.js['\"],\s*['\"]programme-search-test\.js['\"]\]/.test(bootSrc), 'bundle Fil d’Ariane');
assert(/case 'programme'/.test(appSrc), 'app.js onShow programme');
assert(/case 'programmeSearchTest'/.test(appSrc), 'app.js onShow Fil d’Ariane');
assert(/window\.renderProgramme\s*=/.test(progSrc), 'API renderProgramme');
assert(/window\.createChapitre\s*=/.test(progSrc), 'API createChapitre');
assert(/window\.bulkCreateChapitresFromIntercalaires\s*=/.test(progSrc), 'API bulk inter');
assert(/window\.renderProgrammeSearchTest\s*=/.test(labSrc), 'API renderProgrammeSearchTest');
assert(/progSearchBcMat|prog-bc-bar/.test(labSrc), 'navigation Fil d’Ariane');
assert(!/renderTree|renderColumns|renderFiltered|A — Arbre|C — Colonnes|D — Filtres/.test(labSrc), 'variantes labo retirées');
assert(/chap-prefix/.test(read('style.css')), 'styles Chap. prefix');
assert(/programme-wiz-body|programme-wiz-modal\.card-type-surface/.test(read('style.css')), 'modal wizard scrollable');
assert(/programme-phase2-hint/.test(read('style.css')), 'hint phase 2 sans checkbox');
assert(/__BOOT_CACHE_V\s*=\s*'20260826l'/.test(indexSrc), 'cache 20260826l');

console.log('\n=== Modèle de données ===\n');
assert(/chapitres:\s*\[\]/.test(read('data.js')), 'emptyData.chapitres');
assert(/defaultAnnee/.test(read('data.js')), 'defaultAnnee sur classeurs emptyData');

function loadProgramme() {
  const sandbox = {
    window: {
      D: {
        matieres: [
          { id: 'PHYS', label: 'PHYS', name: 'Physique', color: '#5b8df7' },
          { id: 'MATH', label: 'MATH', name: 'Mathématiques', color: '#f0c060' }
        ],
        classeurs: [
          { id: 'A', name: 'Phys A', maxInter: 4, defaultAnnee: 1, interNames: { '01': 'Méca', '02': 'Thermo' } },
          { id: 'B', name: 'Maths B', maxInter: 4, defaultAnnee: 2, interNames: { '01': 'Algèbre' } }
        ],
        chapitres: [],
        cours: [
          { uid: 'PH-1', title: 'Doc 1', mat: 'PHYS', cl: 'A', inter: '01' },
          { uid: 'PH-2', title: 'Doc 2', mat: 'PHYS', cl: 'A', inter: '02', chapitreId: 'PH-Z9X' }
        ]
      },
      escHtml: (s) => String(s),
      iconLabel: (_, t) => t,
      iconHtml: () => '',
      localDateISO: () => '2026-08-25',
      isSystemMatiere: () => false,
      isSystemClasseur: () => false
    },
    document: { getElementById: () => null },
    console
  };
  sandbox.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(progSrc, sandbox);
  return sandbox.window;
}

{
  const w = loadProgramme();
  assert(w.getClasseurDefaultAnnee('A') === 1, 'defaultAnnee classeur A = 1');
  assert(w.getClasseurDefaultAnnee('B') === 2, 'defaultAnnee classeur B = 2');

  const r1 = w.createChapitre({ mat: 'PHYS', cl: 'A', inter: '01', annee: 1, title: 'Mécanique' });
  assert(r1.ok && r1.chapitre.annee === 1, 'createChapitre ok');
  assert(r1.chapitre.title === 'Mécanique', 'titre sans préfixe Chap.');
  assert(/^[A-Z]{2}-[A-Z0-9]{3}$/.test(r1.chapitre.id), 'id même format que Base Doc (PH-A1B)');
  assert(!/^CH-/.test(r1.chapitre.id) || r1.chapitre.id.indexOf('CH-') === 0 && r1.chapitre.mat === 'CHIM',
    'pas de préfixe CH- chapitre (sauf matière CHIM)');
  assert(r1.chapitre.mat === 'PHYS' ? /^PH-/.test(r1.chapitre.id) : true, 'préfixe matière PHYS = PH');

  const bad = w.updateChapitre(r1.chapitre.id, { annee: 2 });
  assert(!bad.ok, 'annee immuable après création');

  const ok = w.updateChapitre(r1.chapitre.id, { title: 'Méca renommée', notes: 'test' });
  assert(ok.ok && ok.chapitre.title === 'Méca renommée', 'update titre/notes ok');

  assert(w.formatChapitreLabel({ title: 'X' }, true).includes('chap-prefix'), 'préfixe HTML Chap.');

  w.D.classeurs[0].interNames['01'] = 'NOM MODIFIÉ';
  const bulk = w.bulkCreateChapitresFromIntercalaires({
    mat: 'MATH', cl: 'B', annee: 2, inters: ['01']
  });
  assert(bulk.created.length === 1, 'bulk 1 chapitre');
  assert(bulk.created[0].title === 'Algèbre', 'nom copié à la création depuis inter');

  w.D.classeurs[1].interNames['01'] = 'Autre nom';
  const ch = w.D.chapitres.find(c => c.id === bulk.created[0].id);
  assert(ch && ch.title === 'Algèbre', 'pas de sync après renommage inter');

  const orphans = w.getUnattachedCoursDocs();
  assert(orphans.length === 1 && orphans[0].uid === 'PH-1', 'non rattachés sans chapitreId');

  const stub = w.proposeChapitreLink('PH-1');
  assert(stub.stub && !stub.ok, 'proposeChapitreLink stub phase 1');

  assert(!w.D.cours.some(c => c.chapitreId && c.chapitreId !== 'PH-Z9X'), 'pas de migration auto cours');

  w.createChapitre({ mat: 'PHYS', cl: 'A', inter: '04', annee: 1, title: 'Optique' });
  var phys1 = w.listChapitres({ mat: 'PHYS', annee: 1 });
  assert(phys1.length === 2, '2 chapitres PHYS 1ère');
  assert(phys1[0].title === 'Méca renommée', 'ordre initial : premier créé');
  var moved = w.moveChapitre(phys1[0].id, 1);
  assert(moved.ok, 'moveChapitre ok');
  phys1 = w.listChapitres({ mat: 'PHYS', annee: 1 });
  assert(phys1[1].title === 'Méca renommée', 'ordre après descente');
  var blocked = w.moveChapitre(phys1[1].id, 1);
  assert(!blocked.ok, 'moveChapitre bloqué en bas');

  var dnd = w.reorderChapitresInGroup('PHYS', 1, [phys1[1].id, phys1[0].id]);
  assert(dnd.ok, 'reorderChapitresInGroup ok');
  phys1 = w.listChapitres({ mat: 'PHYS', annee: 1 });
  assert(phys1[0].title === 'Méca renommée', 'ordre après DnD');
}

console.log('\n=== demo-data ===\n');
const demoSrc = read('demo-data.js');
assert(/chapitres:\s*\[/.test(demoSrc), 'demo chapitres présents');
assert(/defaultAnnee:\s*1/.test(demoSrc), 'demo defaultAnnee');
assert(!/chapitreId:/.test(demoSrc.split('cours:')[1]?.split('exercices:')[0] || ''), 'demo cours sans chapitreId forcé');

console.log('\n=== ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed ? 1 : 0);
