/**
 * Audit site entier — garde-fous statiques (secondaire, save, XSS onclick).
 * Usage: node scripts/test-audit-site.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkBootCacheVersion } from './_cache-version.mjs';
import { sliceBlock } from './_src-slice.mjs';

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
const saveExoBody = sliceBlock(ankiSrc, 'window.ankiV2SaveExo = function');
assert(/Promise\.resolve\(window\.save\([^)]*\)\)\.then\(function \(\) \{[\s\S]*?classList\.add\('hidden'\)[\s\S]*?\}\)\.catch\(function \(err\) \{[\s\S]*?showFormError\(/.test(saveExoBody),
  'ankiV2SaveExo : await save (modal fermé seulement après save, erreur affichée sinon)');
{
  // L'appel auto a été retiré de renderAnkiV2 (103fe72) ; s'il revient, il doit rester gardé par canFullSave.
  const calls = [...ankiSrc.matchAll(/shiftProgramIfMissedDaily\(/g)];
  const unguarded = calls.filter(m => !/canFullSave/.test(ankiSrc.slice(Math.max(0, m.index - 600), m.index)));
  assert(unguarded.length === 0, 'shiftProgram : skip secondaire (' + calls.length + ' appel(s), ' + unguarded.length + ' non gardé(s))');
}
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
assert(checkBootCacheVersion(root).ok, 'cache __BOOT_CACHE_V défini (8 chiffres + lettres) et lu par boot-loader');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
