/**
 * Due ce soir : Recto ↔ verso (2 faces) + SRS overdue/active (pas « bientôt »).
 * Usage: node scripts/test-anki-quick-bidir.mjs
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

const quickSrc = fs.readFileSync(path.join(root, 'anki-quick.js'), 'utf8');
const algoSrc = fs.readFileSync(path.join(root, 'anki-algo.js'), 'utf8');
const algoV2Src = fs.readFileSync(path.join(root, 'anki-algo-v2.js'), 'utf8');

console.log('=== Due Rapide : recto/verso + SRS ===\n');

console.log('· source');
assert(/isEligibleTonight\(c, ref, false\)/.test(quickSrc),
  'Due ce soir appelle isEligibleTonight sans pullForward');
assert(!/isEligibleTonight\(c, ref, pull\)/.test(quickSrc),
  'Due ce soir n’utilise plus pullForward pour le pool');
assert(/expandDuePresentations/.test(quickSrc) && /DRILL\.expandBidir/.test(quickSrc),
  'Due expand les présentations bidirectionnelles');
assert(/_drillKey/.test(quickSrc) && /#v' : '#r'/.test(quickSrc),
  'faces Due portent une clé de présentation éphémère');
assert(/maybeApplyMergedSrs/.test(quickSrc) && /worseDrillVerdict/.test(quickSrc),
  'SRS Due fusionne les faces (pire verdict)');
assert(/Due ce soir : les cartes apparaissent en recto et en verso/.test(quickSrc),
  'texte option dossier : Due = les deux sens');
assert(checkBootCacheVersion(root).ok, 'cache __BOOT_CACHE_V bien formé');

function loadAlgos() {
  const sandbox = {
    window: {},
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Math,
    Promise,
    Error,
    parseInt,
    isNaN,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  sandbox.window.D = {
    settings: { algoV2: { horizon: '1y', pullForward: true, margeBudget: 0.92, sessionMinDefault: 90 } },
    exercices: [],
    matieres: [],
    cours: [],
    quickGroups: []
  };
  vm.runInNewContext(algoSrc, sandbox, { filename: 'anki-algo.js' });
  vm.runInNewContext(algoV2Src, sandbox, { filename: 'anki-algo-v2.js' });
  return sandbox;
}

function loadQuick(groups, exercices) {
  const sandbox = {
    window: {
      D: {
        settings: {},
        exercices: exercices || [],
        matieres: [{ id: 'ANGL', label: 'ANGL', name: 'Anglais', color: '#e07ab3' }],
        cours: [],
        quickGroups: groups || []
      },
      escHtml: (s) => String(s == null ? '' : s),
      iconLabel: (i, t) => String(t || i || ''),
      iconHtml: () => '',
      hydrateIcons: () => {}
    },
    document: {
      getElementById: () => null,
      createElement: () => ({ className: '', innerHTML: '', classList: { add() {}, remove() {}, contains() { return true; } } }),
      addEventListener: () => {},
      body: { appendChild() {} },
      fonts: { ready: Promise.resolve() }
    },
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Math,
    Promise,
    Error,
    parseInt,
    isNaN,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  sandbox.window.document = sandbox.document;
  vm.runInNewContext(quickSrc, sandbox, { filename: 'anki-quick.js' });
  return sandbox.window;
}

console.log('\n· expansion Due');
const groups = [
  { id: 'QG-BIDIR', name: 'Vocab', mat: 'ANGL', bidirectional: true },
  { id: 'QG-UNI', name: 'Formules', mat: 'ANGL', bidirectional: false }
];
const cards = [
  { id: 'Y-1', groupId: 'QG-BIDIR', question: 'cat', reponse: 'chat', statut: 'actif' },
  { id: 'Y-2', groupId: 'QG-UNI', question: 'F = ma', reponse: 'Newton', statut: 'actif' },
  { id: 'Y-3', groupId: 'QG-BIDIR', question: 'dog', reponse: '', statut: 'actif' },
  { id: 'Y-4', question: 'sans dossier', reponse: 'x', statut: 'actif' }
];
const W = loadQuick(groups, cards);
const expanded = W.quickDrillExpandBidir(cards);
assert(expanded.length === 5, 'bidir+verso → 2 faces, verso vide / non-bidir / sans dossier → 1');
const keys = expanded.map((c) => c._drillKey || c.id).sort();
assert(keys.indexOf('Y-1#r') >= 0 && keys.indexOf('Y-1#v') >= 0, 'Y-1 a recto et verso');
assert(expanded.filter((c) => c.id === 'Y-2').length === 1 && !expanded.find((c) => c.id === 'Y-2')._drillKey,
  'dossier non bidir non dupliqué');
assert(expanded.filter((c) => c.id === 'Y-3').length === 1, 'verso vide : une seule face');
assert(W.quickDrillWorseVerdict('ok', 'bad') === 'bad'
  && W.quickDrillWorseVerdict('ok', 'mid') === 'mid'
  && W.quickDrillWorseVerdict('mid', 'bad') === 'bad',
  'pire verdict : bad > mid > ok');

console.log('\n· éligibilité Due (SRS)');
const algoBox = loadAlgos();
const V2 = algoBox.window.AnkiAlgoV2;
const today = V2.todayISO();
const yLearn = {
  id: 'Y-SRS1',
  statut: 'actif',
  profil: 'ANGLAIS',
  repetitions: 0,
  intervalle: 0,
  ease: 2.3,
  dateProchaineRevision: today
};
const afterBon = Object.assign({}, yLearn, { id: 'Y-BON' }, V2.computeNextInterval(yLearn, 9, null));
assert(afterBon.dateProchaineRevision > today, 'Bon : prochaine date après aujourd’hui');
assert(V2.windowState(afterBon, today) === 'soon', 'Bon en apprentissage → soon (demain)');
assert(V2.isEligibleTonight(afterBon, today, true) === true, 'Synchrotron pullForward garde soon');
assert(V2.isEligibleTonight(afterBon, today, false) === false, 'Due Rapide : Bon sort de Due');

const afterFail = Object.assign({}, yLearn, { id: 'Y-FAIL' }, V2.computeNextInterval(yLearn, 2, null));
assert(afterFail.dateProchaineRevision <= today, 'Raté : encore dû aujourd’hui');
assert(V2.isEligibleTonight(afterFail, today, false) === true, 'Due Rapide : Raté reste dû');

const soonCard = {
  id: 'Y-SOON',
  statut: 'actif',
  profil: 'ANGLAIS',
  repetitions: 0,
  intervalle: 1,
  ease: 2.3,
  dateProchaineRevision: V2.addDays(today, 1)
};
assert(V2.isEligibleTonight(soonCard, today, true) === true, 'soon encore éligible avec pullForward');
assert(V2.isEligibleTonight(soonCard, today, false) === false, 'soon hors Due Rapide');

const dueToday = Object.assign({}, yLearn, { id: 'Y-DUE', dateProchaineRevision: today });
const W2 = loadQuick(groups, [afterBon, afterFail, soonCard, dueToday]);
W2.AnkiAlgoV2 = V2;
const due = W2.quickGetSynchrotronYDueCards();
const dueIds = due.map((c) => c.id).sort();
assert(dueIds.indexOf('Y-BON') < 0, 'carte Bon absente du pool Due');
assert(dueIds.indexOf('Y-SOON') < 0, 'carte soon absente du pool Due');
assert(dueIds.indexOf('Y-FAIL') >= 0, 'carte Raté dans le pool Due');
assert(dueIds.indexOf('Y-DUE') >= 0, 'carte due aujourd’hui dans le pool');

console.log('\n· migrateData conserve bidirectional');
const migBox = loadAlgos();
migBox.window.D.quickGroups = [
  { id: 'QG-VOC', name: 'Vocabulaire', mat: 'ANGL', color: '#e07ab3', order: 0, bidirectional: true },
  { id: 'QG-UNI', name: 'Sans', mat: 'ANGL', color: '#888', order: 1 }
];
migBox.window.AnkiAlgo.migrateData(migBox.window.D);
const gBidir = migBox.window.D.quickGroups.find((g) => g.id === 'QG-VOC');
const gUni = migBox.window.D.quickGroups.find((g) => g.id === 'QG-UNI');
assert(gBidir && gBidir.bidirectional === true, 'migrate conserve Recto ↔ verso');
assert(gUni && !gUni.bidirectional, 'migrate n’invente pas bidirectional');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
