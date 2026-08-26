/**
 * Audit site entier — garde-fous statiques (secondaire, save, XSS onclick).
 * Usage: node scripts/test-audit-site.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

const dataSrc = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const ankiSrc = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const scannerSrc = fs.readFileSync(path.join(root, 'scanner.js'), 'utf8');
const cardUiSrc = fs.readFileSync(path.join(root, 'anki-card-ui.js'), 'utf8');
const dsSrc = fs.readFileSync(path.join(root, 'device-session.js'), 'utf8');
const quickSrc = fs.readFileSync(path.join(root, 'anki-quick.js'), 'utf8');
const wizSrc = fs.readFileSync(path.join(root, 'cours-wizard.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

console.log('=== Secondaire / save ===\n');
assert(/saveSecondaryPatch[\s\S]*confirmInit/.test(dataSrc) || /confirmInit[\s\S]*saveSecondaryPatch/.test(dataSrc),
  'confirmInit : patch secondaire');
assert(/saveSecondaryPatch[\s\S]*saveMove/.test(dataSrc) || /saveMove[\s\S]*saveSecondaryPatch/.test(dataSrc),
  'saveMove : patch secondaire');
assert(/refuseSecondaryFullMutation[\s\S]*saveCours/.test(dataSrc) || /saveCours[\s\S]*refuseSecondaryFullMutation/.test(dataSrc),
  'saveCours : garde secondaire');
assert(/refuseSecondaryFullMutation[\s\S]*addMat/.test(dataSrc), 'addMat : garde secondaire');
assert(/refuseSecondaryFullMutation[\s\S]*evalCardV2/.test(ankiSrc), 'evalCardV2 : refuse secondaire');
assert(/S\._evalBusy/.test(ankiSrc), 'evalCardV2 : lock anti double-clic');
assert(/refuseSecondaryFullMutation[\s\S]*ankiV2SaveExo/.test(ankiSrc), 'ankiV2SaveExo : garde secondaire');
assert(/ankiV2SaveExo[\s\S]*Promise\.resolve\(window\.save\(\)\)/.test(ankiSrc), 'ankiV2SaveExo : await save');
assert(/canFullSave[\s\S]*shiftProgramIfMissedDaily/.test(ankiSrc), 'shiftProgram : skip secondaire');
assert(/renderCours[\s\S]*watchUserData|watchUserData[\s\S]*renderCours/.test(dsSrc),
  'secondaire : refresh UI après snapshot');

console.log('\n=== XSS onclick / chargement ===\n');
assert(/confirmInit\('\$\{window\.escapeJsStr/.test(dataSrc), 'doLocate confirmInit : escapeJsStr');
assert(!/confirmInit\('\$\{window\.escHtml/.test(dataSrc), 'confirmInit : plus escHtml dans onclick');
assert(/toggleSel\('\$\{window\.escapeJsStr/.test(scannerSrc), 'scanner toggleSel : escapeJsStr');
assert(/doLocate\('\$\{window\.escapeJsStr/.test(appSrc), 'dashboard/notes : escapeJsStr doLocate');
assert(!/ensureScriptsForTab\('ankiV2'\)\.then\(go\)\.catch\(go\)/.test(cardUiSrc), 'FAB : plus catch(go)');
assert(!/\.catch\(function \(\) \{ run\(\); \}\)/.test(appSrc), 'invokeOpenCardTypePicker : plus catch(run)');

console.log('\n=== DeviceSession auth ===\n');
assert(/deviceUserIdEarly = \(!window\.isLocalMode && user && user\.sub\)/.test(appSrc),
  'DeviceSession.start avec user.sub même si cloud pending');

console.log('\n=== UX / logique ===\n');
assert(/total: quickOnly\.length/.test(ankiSrc), 'ankiV2SetQuickQueue : total correct');
assert(/n’est pas abandonnée|n'est pas abandonnée/.test(ankiSrc), 'session conflict : copy corrigée');
assert(/__BOOT_CACHE_V\s*=\s*'20260826m'/.test(indexSrc), 'cache 20260826m');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
