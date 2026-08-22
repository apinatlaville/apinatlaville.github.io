/**
 * Tests Agenda dédié hors Synchrotron (sans découpage).
 * Usage: node scripts/test-agenda.mjs
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

const navSrc = fs.readFileSync(path.join(root, 'nav-config.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bootSrc = fs.readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const agendaSrc = fs.readFileSync(path.join(root, 'agenda.js'), 'utf8');
const ankiSrc = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const algoV2Src = fs.readFileSync(path.join(root, 'anki-algo-v2.js'), 'utf8');

console.log('=== Wiring onglet Agenda ===\n');
assert(/agenda:\s*\{[^}]*pane:\s*'paneAgenda'/.test(navSrc), 'nav-config enregistre agenda');
assert(/tabs:\s*\[[^\]]*['\"]agenda['\"]/.test(navSrc), 'Agenda dans groupe Navigation');
assert(/id="paneAgenda"/.test(indexSrc), 'paneAgenda dans index.html');
assert(/agenda:\s*\[['\"]agenda\.js['\"]\]/.test(bootSrc), 'bundle agenda.js');
assert(/case 'agenda'/.test(appSrc), 'app.js onShow agenda');
assert(/window\.renderAgenda\s*=/.test(agendaSrc), 'API renderAgenda');
assert(/window\.agendaOpenModal\s*=/.test(agendaSrc), 'API agendaOpenModal');
assert(/window\.agendaMarkDone\s*=/.test(agendaSrc), 'API agendaMarkDone');
assert(/window\.migrateDevoirsLegacy\s*=/.test(agendaSrc), 'migration legacy');
assert(!/data-anki-v2-view="agenda"/.test(ankiSrc), 'plus de sous-onglet Agenda Synchrotron');
assert(!/Re-découper les devoirs/.test(ankiSrc), 'bouton Re-découper retiré');
assert(!/seuilDevoirForce/.test(ankiSrc) || /seuilDevoirForce/.test(ankiSrc) === false
  || !/<label>Seuil devoir forcé/.test(ankiSrc), 'réglage seuilDevoirForce retiré de l’UI');

console.log('\n=== buildSession sans W- ===\n');
{
  const sandbox = {
    window: { D: { settings: {}, exercices: [], devoirs: [] } },
    console, Date, JSON, Object, Array, Math, String, Number, Boolean, Set, Map, Promise,
    parseInt, parseFloat, isNaN
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'anki-algo.js'), 'utf8'), sandbox);
  vm.runInContext(algoV2Src, sandbox);
  const V2 = sandbox.window.AnkiAlgoV2;
  const today = V2.todayISO();
  const x = {
    id: 'X-T1', type: 'exercice', statut: 'actif', titre: 'X', mat: 'MATH',
    tempsCible: 120, ease: 2.5, intervalle: 0, repetitions: 0, importance: 3,
    profil: 'COURS', dateProchaineRevision: today
  };
  const w = {
    id: 'W-T1', type: 'devoir', statut: 'actif', titre: 'DM', mat: 'MATH',
    tempsCible: 1800, dateLimite: V2.addDays(today, 1), dateProchaineRevision: today,
    _morceauxTotal: 4, _morceauxFaits: 0, _tempsRestantMin: 90
  };
  const plan = V2.buildSession([x, w], { sessionMinutes: 120, includeNew: 0, marge: 0.99 });
  assert(plan.cartes.every(c => !String(c.id).startsWith('W') && !c._devoirChunkOf),
    'aucune carte W- / bout dans la file');
  assert(plan.countDevoir === 0, 'countDevoir = 0');
  assert(plan.cartes.some(c => c.id === 'X-T1'), 'X- toujours planifiée');
  assert(!/forcedFirst|devoirsForces|Phase 0/.test(algoV2Src.match(/V2\.buildSession[\s\S]*?V2\.forecastSchedule/)?.[0] || ''),
    'buildSession sans Phase 0 (source)');
}

console.log('\n=== Migration legacy ===\n');
{
  const sandbox = {
    window: {
      D: {
        exercices: [{ id: 'X-1', type: 'exo' }, { id: 'W-m1', type: 'devoir-morceau', _morceauOf: 'W-1' }],
        devoirs: [{
          id: 'W-1', type: 'devoir', statut: 'actif',
          _morceauxTotal: 3, _morceauxFaits: 1, _sessionMinMin: 25, _tempsRestantMin: 40
        }]
      },
      escHtml: (s) => String(s),
      AnkiAlgoV2: { todayISO: () => '2026-08-22', genExoUid: (k) => k + '-NEW' }
    },
    console, Date, JSON, Object, Array, Math, String, Number, Boolean, Set, Map, Promise,
    parseInt, parseFloat, isNaN, document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {} }),
      body: { appendChild() {} }
    },
    localStorage: {
      _d: {},
      getItem(k) { return this._d[k] || null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; }
    }
  };
  sandbox.window.window = sandbox.window;
  sandbox.localStorage.setItem('ankiV2Session', JSON.stringify({
    queue: ['W-1#0', 'X-1', 'W-2'], current: 'W-1#1'
  }));
  vm.createContext(sandbox);
  vm.runInContext(agendaSrc, sandbox);
  const changed = sandbox.window.migrateDevoirsLegacy();
  assert(changed === true, 'migration détecte des changements');
  assert(!(sandbox.window.D.exercices || []).some(c => c.type === 'devoir-morceau'),
    'devoir-morceau purgés');
  assert(sandbox.window.D.devoirs[0]._morceauxTotal == null, '_morceaux* retirés');
  const sess = JSON.parse(sandbox.localStorage.getItem('ankiV2Session'));
  assert(!sess.queue.some(id => String(id).startsWith('W') || String(id).includes('#')),
    'file session sans W-/#n');
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
