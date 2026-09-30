/**
 * Garde-fous journal d’erreurs (appErrors / recordAppError / onerror).
 * Usage: node scripts/test-error-logging.mjs
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

const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, 'core-utils.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloudSrc = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const scannerSrc = fs.readFileSync(path.join(root, 'scanner.js'), 'utf8');
const ankiSrc = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(root, 'ui-components.js'), 'utf8');

console.log('=== Wiring capture ===\n');
assert(/window\.appErrors = window\.appErrors \|\| \[\]/.test(indexSrc)
  || /window\.appErrors = \[\]/.test(indexSrc), 'index : appErrors initialisé tôt');
assert(/window\.onerror = function/.test(indexSrc), 'index : onerror global');
// onerror doit être déclaré AVANT boot-profiler pour que le wrap fonctionne
{
  const onerrorAt = indexSrc.indexOf('window.onerror = function');
  const profilerAt = indexSrc.indexOf("addJs('boot-profiler.js')");
  assert(onerrorAt > 0 && profilerAt > 0 && onerrorAt < profilerAt,
    'onerror avant boot-profiler (chaînage)');
}
assert(/unhandledrejection/.test(indexSrc), 'index : filet unhandledrejection précoce');
assert(/__appRejectionHandlerReady/.test(appSrc), 'app.js : flag anti double-log rejection');
assert(/throw e;/.test(appSrc.match(/initAppAfterAuth[\s\S]*?\};/)?.[0] || ''),
  'initAppAfterAuth propage l’échec (pas de swallow)');

console.log('\n=== Pas de push brut appErrors ===\n');
assert(!/appErrors\.push\(/.test(appSrc.replace(/recordAppError[\s\S]*?appErrors\.push/, '')),
  'app.js : plus de push direct hors recordAppError');
// Plus simple : les seuls push directs connus doivent avoir disparu
assert(!/window\.appErrors\.push\(\{ time: new Date\(\)\.toLocaleTimeString\(\), msg: "Erreur Init:/.test(appSrc),
  'app.js : Erreur Init via recordAppError');
assert(!/window\.appErrors\.push\(\{ time:[\s\S]*Erreur JsBarcode/.test(scannerSrc),
  'scanner.js : JsBarcode via recordAppError');
assert(/recordAppError\('Erreur JsBarcode:/.test(scannerSrc), 'scanner JsBarcode → recordAppError');
assert(/recordAppError\(\s*"Erreur d'accès à la caméra:/.test(scannerSrc)
  || /recordAppError\(\s*"Erreur d'accès à la caméra:/.test(scannerSrc)
  || /recordAppError\(\s*[\s\S]*accès à la caméra/.test(scannerSrc),
  'scanner caméra → recordAppError');

console.log('\n=== Chemins critiques journalisés ===\n');
assert(/recordAppError\('Init échouée :/.test(cloudSrc), 'cloud : init échouée');
assert(/recordAppError\([\s\S]*app\.js n'a pas chargé/.test(cloudSrc), 'cloud : timeout app.js');
assert(/recordAppError\(msg, 'cloud\.js'/.test(cloudSrc), 'cloud : auth Firebase');
assert(/recordAppError\([\s\S]*Firebase indisponible/.test(cloudSrc), 'cloud : Firebase down');
assert(/recordAppError\('Erreur Init:/.test(appSrc), 'app : Erreur Init');
assert(/recordAppError\('Init bloquée :/.test(appSrc), 'app : Init bloquée');
assert(/recordAppError\([\s\S]*File sauvegarde:/.test(appSrc), 'app : file save');
assert(/recordAppError\([\s\S]*Synchrotron eval/.test(ankiSrc), 'anki : eval');
assert(/recordAppError\([\s\S]*Synchrotron undo/.test(ankiSrc), 'anki : undo');
assert(/recordAppError\([\s\S]*Synchrotron skip/.test(ankiSrc), 'anki : skip');
assert(/entry\.lineno/.test(uiSrc), 'uiLogEntry affiche lineno');

console.log('\n=== Runtime recordAppError ===\n');
{
  const sandbox = {
    window: { appErrors: [] },
    document: {
      getElementById() { return null; }
    },
    console: { log() {}, warn() {}, error() {} },
    Date, String, clearTimeout, setTimeout
  };
  sandbox.window.window = sandbox.window;
  // Extraire recordAppError + dépendances minimales
  const fnMatch = coreSrc.match(/window\.recordAppError = function[\s\S]*?return entry;\n  \};/);
  assert(!!fnMatch, 'recordAppError extractible');
  if (fnMatch) {
    vm.runInNewContext(
      'window.showToast = function(){};\n' +
      'window.renderErrorLogs = function(){ window._rendered = (window.appErrors||[]).length; };\n' +
      fnMatch[0],
      sandbox
    );
    sandbox.window.recordAppError('boom', 'test.js', { lineno: 42, toast: true });
    assert(sandbox.window.appErrors.length === 1, 'runtime : 1 entrée');
    assert(sandbox.window.appErrors[0].msg === 'boom', 'runtime : msg');
    assert(sandbox.window.appErrors[0].source === 'test.js', 'runtime : source');
    assert(sandbox.window.appErrors[0].lineno === 42, 'runtime : lineno');
    assert(sandbox.window._rendered === 1, 'runtime : renderErrorLogs appelé');
  }
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
