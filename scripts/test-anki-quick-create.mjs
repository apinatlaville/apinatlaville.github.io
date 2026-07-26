/**
 * Tests légers création carte rapide (sans durée, chapitre, helpers LaTeX).
 * Usage: node scripts/test-anki-quick-create.mjs
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

const quickSrc = fs.readFileSync(path.join(root, 'anki-quick.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const algoSrc = fs.readFileSync(path.join(root, 'anki-algo.js'), 'utf8');
const latexSrc = fs.readFileSync(path.join(root, 'anki-quick-latex.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const navSrc = fs.readFileSync(path.join(root, 'nav-config.js'), 'utf8');

console.log('=== Carte rapide : LaTeX + chapitre − durée ===\n');

assert(!/id="qkTemps"/.test(quickSrc), 'form Rapide : pas de champ durée');
assert(!/id="quickTempsMin"/.test(appSrc), 'modal : pas de champ durée');
assert(/qkCours|quickCoursSelected/.test(quickSrc + appSrc), 'lien chapitre présent');
assert(/quickOpenLatex|ankiV2QuickOpenLatex|openQuickLatexCard/.test(quickSrc + appSrc + latexSrc), 'entrée LaTeX');
assert(/paneQuickLatex/.test(indexSrc) && /quickLatex/.test(navSrc), 'page quickLatex enregistrée');
assert(/QUICK_DEFAULT_SEC\s*=\s*30/.test(algoSrc), 'durée packing Y- = 30s');
assert(/cardKind\(c\) === 'quick'/.test(algoSrc), 'cardDuration branche quick');

const sandbox = {
  window: { D: { settings: {}, exercices: [], matieres: [], cours: [] }, escHtml: (s) => String(s) },
  console, Date, JSON, Object, Array, String, Number, Math, Error, parseInt, isNaN
};
sandbox.globalThis = sandbox;
vm.runInNewContext(algoSrc, sandbox, { filename: 'anki-algo.js' });
const A = sandbox.window.AnkiAlgo;
assert(A.cardDuration({ id: 'Y-ABC', statut: 'actif' }) === 30, 'Y- sans tempsCible → 30s');
assert(A.cardDuration({ id: 'Y-ABC', tempsCible: 45 }) === 45, 'Y- tempsCible respecté si présent');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
