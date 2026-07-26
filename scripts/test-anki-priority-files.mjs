/**
 * Preuves : files d’urgence X- / Y- séparées (échelles non comparables).
 * Usage: node scripts/test-anki-priority-files.mjs
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
    cours: []
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'anki-algo.js'), 'utf8'), sandbox, { filename: 'anki-algo.js' });
  vm.runInNewContext(fs.readFileSync(path.join(root, 'anki-algo-v2.js'), 'utf8'), sandbox, { filename: 'anki-algo-v2.js' });
  return sandbox.window.AnkiAlgoV2;
}

const V2 = loadAlgos();
const today = V2.todayISO();

function cardX(over) {
  return Object.assign({
    id: 'X-TEST1',
    type: 'exercice',
    statut: 'actif',
    importance: 3,
    ease: 2.5,
    repetitions: 5,
    intervalle: 10,
    dateProchaineRevision: today,
    mat: 'PHYS'
  }, over || {});
}

function cardY(over) {
  return Object.assign({
    id: 'Y-TEST1',
    type: 'exercice',
    profil: 'rapide',
    statut: 'actif',
    importance: 5,
    ease: 1.5,
    repetitions: 1,
    intervalle: 1,
    dateProchaineRevision: V2.addDays(today, -10),
    mat: 'PHYS'
  }, over || {});
}

console.log('=== Files urgence X- / Y- ===\n');

{
  console.log('[1] cardKind');
  assert(V2.cardKind(cardX()) === 'main', 'X- → main');
  assert(V2.cardKind(cardY()) === 'quick', 'Y- → quick');
}

{
  console.log('[2] scores séparés');
  const x = V2.priorityScore(cardX({ dateProchaineRevision: V2.addDays(today, -2) }), today);
  const y = V2.priorityScoreQuick(cardY(), today);
  assert(x.file === 'main', 'prioX file=main');
  assert(y.file === 'quick', 'prioY file=quick');
  assert(x.priority >= 10000, 'prioX overdue ≥ 10000');
  assert(y.priority >= 1000 && y.priority < 5000, 'prioY overdue dans échelle Y (~1k–5k)');
  assert(typeof V2.priorityScoreQuick === 'function', 'API priorityScoreQuick');
}

{
  console.log('[3] scoreForKind route');
  assert(V2.scoreForKind(cardX()).file === 'main', 'route X');
  assert(V2.scoreForKind(cardY()).file === 'quick', 'route Y');
  const yVia = V2.scoreSession(cardY());
  const yDirect = V2.priorityScoreQuick(cardY());
  assert(Math.abs(yVia.total - yDirect.priority) < 0.01, 'scoreSession → prioY');
}

{
  console.log('[4] getCandidates n’inclut pas les Y-');
  const mix = [
    cardX({ id: 'X-A', dateProchaineRevision: V2.addDays(today, -1) }),
    cardY({ id: 'Y-A' }),
    cardX({ id: 'X-B', importance: 5 })
  ];
  const cands = V2.getCandidates(mix);
  assert(cands.every(x => V2.cardKind(x.card) === 'main'), 'candidates = X- only');
  assert(cands.length === 2, '2 candidates X-');
  const q = V2.getQuickCandidates(mix);
  assert(q.length === 1 && q[0].card.id === 'Y-A', 'quick candidates = Y- only');
}

{
  console.log('[5] buildSession trie Y- avec prioY');
  const yLow = cardY({
    id: 'Y-LOW',
    importance: 1,
    ease: 2.7,
    repetitions: 10,
    dateProchaineRevision: today
  });
  const yHigh = cardY({
    id: 'Y-HIGH',
    importance: 5,
    ease: 1.3,
    repetitions: 1,
    dateProchaineRevision: V2.addDays(today, -5)
  });
  const x = cardX({
    id: 'X-MID',
    importance: 3,
    dateProchaineRevision: today,
    tempsCible: 10
  });
  // Durées courtes pour Y
  yLow.tempsCible = 1;
  yHigh.tempsCible = 1;
  const sess = V2.buildSession([x, yLow, yHigh], { sessionMinutes: 60, pullForward: true });
  const yIds = sess.cartes.filter(c => V2.cardKind(c) === 'quick').map(c => c.id);
  assert(yIds.includes('Y-HIGH'), 'Y-HIGH dans session');
  if (yIds.includes('Y-LOW') && yIds.includes('Y-HIGH')) {
    assert(yIds.indexOf('Y-HIGH') < yIds.indexOf('Y-LOW'), 'Y-HIGH avant Y-LOW dans la file tissée/extra');
  } else {
    assert(true, 'au moins Y-HIGH packée (budget)');
  }
  // Une Y- overdue ne doit pas avoir été scorée comme X- (régression : même API)
  const scWrong = V2.priorityScore(yHigh, today);
  const scRight = V2.priorityScoreQuick(yHigh, today);
  assert(scWrong.priority > scRight.priority * 2, 'même carte : prioX-échelle ≠ prioY (si scorée à tort en X)');
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
