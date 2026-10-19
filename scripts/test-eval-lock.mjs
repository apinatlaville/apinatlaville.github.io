/**
 * Verrou de notation commun Rapide / Synchrotron (anki-app-v2.js S._evalBusy, anki-quick.js).
 * Usage: node scripts/test-eval-lock.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const v2 = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const quick = fs.readFileSync(path.join(root, 'anki-quick.js'), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}

function sliceBetween(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Bloc introuvable : ' + start);
  return src.slice(a, b);
}

console.log('=== Verrou de notation Rapide / Synchrotron ===\n');

console.log('· structure');
assert(/window\.ankiV2EvalBusy = function \(\) \{\s*return !!S\._evalBusy;/.test(v2), 'ankiV2EvalBusy expose S._evalBusy');
assert(/window\.ankiV2ApplyStandaloneEval = function[^{]*\{\s*if \(S\._evalBusy\) return \{ ok: false, error: 'EVAL_BUSY' \};/.test(v2),
  'ApplyStandaloneEval refuse si une notation Synchrotron est en cours');
assert(/window\.ankiV2RevertStandaloneEval = function[^{]*\{\s*if \(S\._evalBusy\) return \{ ok: false, error: 'EVAL_BUSY' \};/.test(v2),
  'RevertStandaloneEval refuse si une notation est en cours');
assert(/function holdEvalBusyUntilSaved\(result\)/.test(v2), 'verrou tenu jusqu’à la sauvegarde locale');
  assert(/revertStandaloneEvalNow\(id, \{ silent: true \}\)/.test(v2), 'replacePrevious passe par la version interne (pas d’auto-blocage)');
assert(/window\.evalCardV2 = function \(qScore\) \{\s*if \(!S\.current\) return;\s*if \(S\._evalBusy\) return;/.test(v2),
  'evalCardV2 (Synchrotron) garde le même verrou');
const applyDrill = sliceBetween(quick, 'function applyDrillSrs(c, verdict)', 'function revertDrillSrs(');
const iBusy = applyDrill.indexOf("res.error === 'EVAL_BUSY'");
const iFallback = applyDrill.indexOf('applyDrillSrsLocal(c, verdict, replacePrevious)');
assert(iBusy > 0 && iFallback > iBusy, 'Rapide : pas de repli local qui contournerait le verrou');
assert(/window\.quickDrillUndo = function \(\) \{\s*if \(typeof window\.ankiV2EvalBusy === 'function' && window\.ankiV2EvalBusy\(\)\)/.test(quick),
  'Rapide : annulation bloquée pendant une notation Synchrotron');

console.log('\n· comportement (code réel des enveloppes)');
const wrappers = sliceBetween(v2, 'window.ankiV2EvalBusy = function', 'function applyStandaloneEvalNow(')
  + sliceBetween(v2, 'window.ankiV2RevertStandaloneEval = function', 'function revertStandaloneEvalNow(');
const calls = [];
const sandbox = {
  window: {},
  S: { _evalBusy: false },
  Promise,
  applyStandaloneEvalNow(id, q) {
    calls.push(['apply', id, q, sandbox.S._evalBusy]);
    if (q === 'boom') throw new Error('boom');
    return { ok: true };
  },
  revertStandaloneEvalNow(id) {
    calls.push(['revert', id, sandbox.S._evalBusy]);
    return { ok: true };
  }
};
vm.createContext(sandbox);
vm.runInContext(wrappers, sandbox);
const W = sandbox.window;
const tick = () => new Promise((r) => setTimeout(r, 0));

assert(W.ankiV2EvalBusy() === false, 'libre au départ');
let r = W.ankiV2ApplyStandaloneEval('Y-1', 7, {});
assert(r.ok && calls.length === 1 && calls[0][3] === true, 'note Rapide : verrou tenu pendant l’écriture');
assert(sandbox.S._evalBusy === true, 'verrou encore tenu tant que la sauvegarde n’est pas confirmée');
await tick();
assert(sandbox.S._evalBusy === false, 'verrou relâché après la sauvegarde');

let releaseSave;
sandbox.window.save = () => new Promise((res) => { releaseSave = res; });
r = W.ankiV2ApplyStandaloneEval('Y-2', 8, {});
assert(r.ok && sandbox.S._evalBusy === true, 'verrou tenu tant que save() n’a pas répondu');
const blocked = W.ankiV2ApplyStandaloneEval('Y-3', 9, {});
assert(!blocked.ok && blocked.error === 'EVAL_BUSY', 'deuxième note Rapide refusée pendant la sauvegarde de la première');
releaseSave({ local: true });
await tick();
assert(sandbox.S._evalBusy === false, 'verrou relâché une fois save() résolu');
delete sandbox.window.save;

sandbox.S._evalBusy = true;
r = W.ankiV2ApplyStandaloneEval('Y-1', 7, {});
assert(!r.ok && r.error === 'EVAL_BUSY' && calls.filter((c) => c[0] === 'apply').length === 2, 'note Rapide refusée pendant une note Synchrotron');
r = W.ankiV2RevertStandaloneEval('Y-1', {});
assert(!r.ok && r.error === 'EVAL_BUSY' && calls.filter((c) => c[0] === 'revert').length === 0, 'annulation Rapide refusée pendant une note Synchrotron');
assert(sandbox.S._evalBusy === true, 'le verrou Synchrotron n’est pas relâché par un refus');
sandbox.S._evalBusy = false;

try { W.ankiV2ApplyStandaloneEval('Y-1', 'boom', {}); } catch (e) { /* attendu */ }
assert(sandbox.S._evalBusy === false, 'verrou relâché même après une erreur');

r = W.ankiV2RevertStandaloneEval('Y-1', {});
assert(r.ok && calls[calls.length - 1][0] === 'revert' && calls[calls.length - 1][2] === true, 'annulation Rapide : verrou tenu pendant la restauration');
assert(sandbox.S._evalBusy === true, 'verrou tenu jusqu’à la sauvegarde de l’annulation');
await tick();
assert(sandbox.S._evalBusy === false, 'verrou relâché après l’annulation');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed) {
  console.log('Échecs:');
  failures.forEach((f) => console.log(' -', f));
}
process.exit(failed ? 1 : 0);
