/**
 * Vérifie les correctifs d’audit (secondaire, gardes, eval lock, merge révision).
 * Usage: node scripts/test-audit-fixes.mjs
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

const data = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const scanner = fs.readFileSync(path.join(root, 'scanner.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const anki = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

console.log('[1] confirmInit / saveMove — patch secondaire');
assert(/confirmInit[\s\S]*canSecondaryPatch[\s\S]*saveSecondaryPatch/.test(data), 'confirmInit utilise saveSecondaryPatch');
assert(/saveMove[\s\S]*canSecondaryPatch[\s\S]*saveSecondaryPatch/.test(data), 'saveMove utilise saveSecondaryPatch');
assert(/confirmInit[\s\S]*Promise\.resolve\(window\.save\(\)\)/.test(data), 'confirmInit attend save()');
assert(/saveMove[\s\S]*Promise\.resolve\(window\.save\(\)\)/.test(data), 'saveMove attend save()');
assert(/confirmInit[\s\S]*Impossible d.enregistrer l.initialisation/.test(data), 'confirmInit alerte en échec');

console.log('[2] scanner — gardes + confirmPrintSuccess secondaire');
assert(/markOnePrinted[\s\S]*!Array\.isArray\(window\.D\.cours\)/.test(scanner), 'markOnePrinted garde D.cours');
assert(/renderPrintGrid[\s\S]*!Array\.isArray\(window\.D\.cours\)/.test(scanner), 'renderPrintGrid garde D.cours');
assert(/confirmPrintSuccess[\s\S]*canSecondaryPatch[\s\S]*saveSecondaryPatch/.test(scanner), 'confirmPrintSuccess patch secondaire');
assert(/String\(c\.title \|\| ''\)\.substring\(0,\s*35\)/.test(scanner), 'title impression safe');

console.log('[3] renderClasseurs / renderMatieres');
assert(/String\(a\.inter \|\| ''\)\.localeCompare\(String\(b\.inter \|\| ''\)\)/.test(data), 'tri inter null-safe');
assert(/renderClasseurs[\s\S]*!Array\.isArray\(window\.D\.classeurs\)/.test(data), 'renderClasseurs garde D');
assert(/renderMatieres[\s\S]*!Array\.isArray\(window\.D\.matieres\)/.test(data), 'renderMatieres garde D');

console.log('[4] save primaire — merge révision');
assert(/remoteRev > localBase/.test(app), 'détecte révision cloud en avance');
assert(/Merge révision cloud/.test(app), 'log merge révision');
assert(/statOrder/.test(app) || /pending:\s*0,\s*printed:\s*1,\s*active:\s*2/.test(app), 'merge stat pipeline');

console.log('[5] evalCardV2 — anti double-clic');
assert(/if \(S\._evalBusy\) return/.test(anki), 'eval refuse si busy');
assert(/S\._evalBusy = true/.test(anki), 'eval pose le lock');
assert(/S\._evalBusy = false/.test(anki), 'lock relâché');
assert(/ankiV2SkipCard[\s\S]*S\._evalBusy/.test(anki), 'skip respecte le lock');

console.log('[6] cache');
assert(/__BOOT_CACHE_V\s*=\s*'20260726j'/.test(index), 'cache bump 20260726j');

console.log('\n=== Résultat audit fixes ===');
console.log(`passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
