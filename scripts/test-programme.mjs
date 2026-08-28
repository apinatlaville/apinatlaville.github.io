/**
 * Tests Programme — chapitres logiques phase 1 + phase 2
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
const labSrc = read('programme-browse.js');
const dataSrc = read('data.js');

assert(/programme:\s*\{[^}]*pane:\s*'paneProgramme'/.test(navSrc), 'nav-config enregistre programme');
assert(/tabs:\s*\[[^\]]*['\"]programme['\"]/.test(navSrc), 'Programme dans groupe Organisation');
assert(/programmeBrowse/.test(navSrc), 'Fil d’Ariane enregistré');
assert(/label:\s*'Organisation'[\s\S]*?programmeBrowse/.test(navSrc), 'Fil d’Ariane dans Organisation');
assert(/id="paneProgramme"/.test(indexSrc), 'paneProgramme dans index.html');
assert(/id="paneProgrammeBrowse"/.test(indexSrc), 'pane Fil d’Ariane dans index.html');
assert(/id="fChapitre"/.test(indexSrc), 'select chapitre dans modal document');
assert(/programme:\s*\[['\"]programme\.js['\"]\]/.test(bootSrc), 'bundle programme.js');
assert(/programmeBrowse:\s*\[['\"]programme-browse\.js['\"]\]/.test(bootSrc), 'bundle Fil d’Ariane');
assert(/loadParallel\([\s\S]*programme\.js/.test(bootSrc), 'programme.js au boot');
assert(/case 'programme'/.test(appSrc), 'app.js onShow programme');
assert(/case 'programmeBrowse'/.test(appSrc), 'app.js onShow Fil d’Ariane');
assert(/ensureChapitreOrders\(\)/.test(appSrc), 'ensureChapitreOrders au boot');
assert(/window\.renderProgramme\s*=/.test(progSrc), 'API renderProgramme');
assert(/window\.createChapitre\s*=/.test(progSrc), 'API createChapitre');
assert(/window\.bulkCreateChapitresFromIntercalaires\s*=/.test(progSrc), 'API bulk inter');
assert(/window\.createCoursUniteForChapitre\s*=/.test(progSrc), 'API createCoursUniteForChapitre');
assert(/window\.proposeChapitreLink\s*=/.test(progSrc), 'API proposeChapitreLink');
assert(/window\.unlinkCoursFromChapitre\s*=/.test(progSrc), 'API unlinkCoursFromChapitre');
assert(/window\.resolveChapitreCoursUid\s*=/.test(progSrc), 'API resolveChapitreCoursUid');
assert(/window\.renderProgrammeBrowse\s*=/.test(labSrc), 'API renderProgrammeBrowse');
assert(/progBrowsePlayChapter|progSearchAttachOrphan|progSearchBcMat|prog-bc-bar/.test(labSrc), 'navigation Fil d’Ariane + actions');
assert(/cours-chap-badge/.test(read('style.css')), 'badge chapitre Base Doc');
assert(/buildCockpitChapterOptions|listChapitres/.test(read('anki-app-v2.js')), 'Synchrotron tri chapitres Programme');
assert(!/renderTree|renderColumns|renderFiltered|A — Arbre|C — Colonnes|D — Filtres/.test(labSrc), 'variantes labo retirées');
assert(/chap-prefix/.test(read('style.css')), 'styles Chap. prefix');
assert(/programme-wiz-body|programme-wiz-modal\.card-type-surface/.test(read('style.css')), 'modal wizard scrollable');
assert(/programme-unite-opt/.test(read('style.css')), 'option cours unité wizard');
assert(/progWizSkipInter|Sans intercalaire|optionnel/.test(progSrc), 'wizard : intercalaire optionnel');
assert(/programmeWizFormSetCl/.test(progSrc), 'wizard form set classeur optionnel');
assert(/prev\.chapitreId|chapitreId/.test(dataSrc) && /updateChapitreDropdown/.test(dataSrc), 'saveCours / dropdown chapitre');
assert(/cours-chap-badge/.test(dataSrc), 'badge chapitre sur cartes Base Doc');
assert(/__BOOT_CACHE_V\s*=\s*'20260827c'/.test(indexSrc), 'cache 20260827c');

console.log('\n=== Modèle de données ===\n');
assert(/chapitres:\s*\[\]/.test(read('data.js')), 'emptyData.chapitres');
assert(/defaultAnnee/.test(read('data.js')), 'defaultAnnee sur classeurs emptyData');

let _uidSeq = 0;
function loadProgramme() {
  _uidSeq = 0;
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
        ],
        exercices: [],
        devoirs: []
      },
      escHtml: (s) => String(s),
      iconLabel: (_, t) => t,
      iconHtml: () => '',
      localDateISO: () => '2026-08-25',
      isSystemMatiere: () => false,
      isSystemClasseur: () => false,
      genUid: function (mat) {
        _uidSeq += 1;
        const pref = String(mat || 'XX').substring(0, 2).toUpperCase();
        return pref + '-U' + String(_uidSeq).padStart(2, '0');
      }
    },
    console, Date, JSON, Object, Array, Math, String, Number, Boolean, Set, Map, Promise
  };
  vm.createContext(sandbox);
  /* generateChapitreId / genUid live in programme + app — stub generate via programme after load */
  vm.runInContext(fs.readFileSync(path.join(root, 'programme.js'), 'utf8'), sandbox);
  return sandbox.window;
}

{
  const w = loadProgramme();
  assert(w.D.classeurs[0].defaultAnnee === 1, 'defaultAnnee classeur A = 1');
  assert(w.D.classeurs[1].defaultAnnee === 2, 'defaultAnnee classeur B = 2');

  const r1 = w.createChapitre({
    mat: 'PHYS', cl: 'A', inter: '01', annee: 1, title: 'Méca', createUnite: false
  });
  assert(r1.ok, 'createChapitre ok');
  assert(r1.chapitre.title === 'Méca', 'titre sans préfixe Chap.');
  assert(/^[A-Z]{2}-[A-Z0-9]{3}$/.test(r1.chapitre.id), 'id même format que Base Doc (PH-A1B)');
  assert(!/^CH-/.test(r1.chapitre.id) || r1.chapitre.id.indexOf('CH-') === 0 && r1.chapitre.mat === 'CHIM',
    'pas de préfixe CH- chapitre (sauf matière CHIM)');
  assert(r1.chapitre.mat === 'PHYS' ? /^PH-/.test(r1.chapitre.id) : true, 'préfixe matière PHYS = PH');
  assert(!r1.unite, 'sans createUnite : pas de cours unité');

  const free = w.createChapitre({
    mat: 'PHYS', annee: 1, title: 'Sans lien', createUnite: false
  });
  assert(free.ok && free.chapitre.title === 'Sans lien', 'createChapitre sans cl/inter');
  assert(!free.chapitre.cl && !free.chapitre.inter, 'cl/inter vides si non fournis');

  const bad = w.updateChapitre(r1.chapitre.id, { annee: 2 });
  assert(!bad.ok, 'annee immuable après création');

  const ok = w.updateChapitre(r1.chapitre.id, { title: 'Méca renommée', notes: 'test' });
  assert(ok.ok && ok.chapitre.title === 'Méca renommée', 'update titre/notes ok');

  assert(w.formatChapitreLabel({ title: 'X' }, true).includes('chap-prefix'), 'préfixe HTML Chap.');

  w.D.classeurs[0].interNames['01'] = 'NOM MODIFIÉ';
  const bulk = w.bulkCreateChapitresFromIntercalaires({
    mat: 'MATH', cl: 'B', annee: 2, inters: ['01'], createUnite: false
  });
  assert(bulk.created.length === 1, 'bulk 1 chapitre');
  assert(bulk.created[0].title === 'Algèbre', 'nom copié à la création depuis inter');

  w.D.classeurs[1].interNames['01'] = 'Autre nom';
  const ch = w.D.chapitres.find(c => c.id === bulk.created[0].id);
  assert(ch && ch.title === 'Algèbre', 'pas de sync après renommage inter');

  const orphans = w.getUnattachedCoursDocs();
  assert(orphans.length === 1 && orphans[0].uid === 'PH-1', 'non rattachés sans chapitreId');

  assert(!w.D.cours.some(c => c.chapitreId && c.chapitreId !== 'PH-Z9X' && c.uid !== 'PH-2'),
    'pas de migration auto cours');

  w.createChapitre({ mat: 'PHYS', cl: 'A', inter: '04', annee: 1, title: 'Optique', createUnite: false });
  var phys1 = w.listChapitres({ mat: 'PHYS', annee: 1 });
  assert(phys1.length === 3, '3 chapitres PHYS 1ère');
  assert(phys1[0].title === 'Méca renommée', 'ordre initial : premier créé');
  var moved = w.moveChapitre(phys1[0].id, 1);
  assert(moved.ok, 'moveChapitre ok');
  phys1 = w.listChapitres({ mat: 'PHYS', annee: 1 });
  assert(phys1[1].title === 'Méca renommée', 'ordre après descente');
  var blocked = w.moveChapitre(phys1[phys1.length - 1].id, 1);
  assert(!blocked.ok, 'moveChapitre bloqué en bas');

  var dnd = w.reorderChapitresInGroup('PHYS', 1, [phys1[1].id, phys1[0].id, phys1[2].id]);
  assert(dnd.ok, 'reorderChapitresInGroup ok');
  phys1 = w.listChapitres({ mat: 'PHYS', annee: 1 });
  assert(phys1[0].title === 'Méca renommée', 'ordre après DnD');
}

console.log('\n=== Phase 2 — unité + rattachement ===\n');
{
  const w = loadProgramme();
  const withU = w.createChapitre({
    mat: 'PHYS', cl: 'A', inter: '01', annee: 1, title: 'Méca', createUnite: true
  });
  assert(withU.ok && withU.unite, 'createChapitre + unité');
  assert(withU.unite.title === 'Méca', 'unité même titre');
  assert(withU.unite.chapitreId === withU.chapitre.id, 'unité.chapitreId');
  assert(withU.unite.role === 'unite' && withU.unite.isUnite, 'unité role');
  assert(withU.unite.uid !== withU.chapitre.id, 'uid unité ≠ id chapitre');
  assert(withU.chapitre.coursUniteUid === withU.unite.uid, 'coursUniteUid sur chapitre');
  assert(w.resolveChapitreCoursUid(withU.chapitre.id) === withU.unite.uid, 'resolveChapitreCoursUid');

  const again = w.createCoursUniteForChapitre(withU.chapitre);
  assert(again.ok && again.already && again.cours.uid === withU.unite.uid, 'unité idempotente');

  const noU = w.createChapitre({
    mat: 'PHYS', cl: 'A', inter: '02', annee: 1, title: 'Thermo', createUnite: false
  });
  assert(noU.ok && !noU.unite, 'createUnite false → pas d’unité');
  assert(!w.D.cours.some(c => c.chapitreId === noU.chapitre.id && w.isCoursUnite(c)),
    'pas d’unité pour Thermo');

  const bulkU = w.bulkCreateChapitresFromIntercalaires({
    mat: 'MATH', cl: 'B', annee: 2, inters: ['01'], createUnite: true
  });
  assert(bulkU.created.length === 1, 'bulk + unité : 1 chapitre');
  assert(!!bulkU.created[0].coursUniteUid, 'bulk chapitre a coursUniteUid');
  assert(w.D.cours.filter(c => w.isCoursUnite(c)).length === 2, '2 unités au total (Méca + Algèbre)');

  const link = w.proposeChapitreLink('PH-1', withU.chapitre.id);
  assert(link.ok && link.cours.chapitreId === withU.chapitre.id, 'proposeChapitreLink ok');
  assert(w.getUnattachedCoursDocs().length === 0, 'plus d’orphelins après rattache');

  const badChap = w.proposeChapitreLink('PH-1', 'NOPE');
  assert(!badChap.ok, 'chapitre inexistant → échec');

  const badMat = w.proposeChapitreLink('PH-2', bulkU.created[0].id);
  /* PH-2 is PHYS, bulk chap is MATH */
  assert(!badMat.ok, 'matière incompatible → échec');

  const unlink = w.unlinkCoursFromChapitre('PH-1');
  assert(unlink.ok && !unlink.cours.chapitreId, 'unlink ok');
  assert(w.getUnattachedCoursDocs().some(c => c.uid === 'PH-1'), 'PH-1 redevient orphelin');

  w.proposeChapitreLink('PH-1', withU.chapitre.id);
  const del = w.deleteChapitre(withU.chapitre.id);
  assert(del.ok, 'deleteChapitre ok');
  assert(del.removedUniteUid === withU.unite.uid, 'delete retire l’unité');
  assert(!w.D.cours.some(c => c.uid === withU.unite.uid), 'unité absente après delete');
  const ph1 = w.D.cours.find(c => c.uid === 'PH-1');
  assert(ph1 && !ph1.chapitreId, 'papier détaché après delete chapitre');
}

console.log('\n=== demo-data ===\n');
const demoSrc = read('demo-data.js');
assert(/chapitres:\s*\[/.test(demoSrc), 'demo chapitres présents');
assert(/defaultAnnee:\s*1/.test(demoSrc), 'demo defaultAnnee');
assert(/role:\s*'unite'|isUnite:\s*true/.test(demoSrc), 'demo cours unités');
assert(/coursUniteUid:/.test(demoSrc), 'demo chapitres → coursUniteUid');
assert(/chapitreId:\s*'PH-M3K'/.test(demoSrc), 'demo docs papier rattachés');
assert(/chapitres:\s*\[[\s\S]*PH-M3K/.test(demoSrc), 'demo PC* chapitres');

console.log('\n=== ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed ? 1 : 0);
