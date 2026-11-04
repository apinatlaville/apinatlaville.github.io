/**
 * Aperçu LaTeX : Safari compacte \\left+\\frac, Chrome inchangé, données jamais réécrites.
 * Usage: node scripts/test-latex-stretchy.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { checkBootCacheVersion } from './_cache-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'latex-test.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const quickSrc = fs.readFileSync(path.join(root, 'anki-quick.js'), 'utf8');
const cloudSrc = fs.existsSync(path.join(root, 'cloud.js'))
  ? fs.readFileSync(path.join(root, 'cloud.js'), 'utf8') : '';
const pioSrc = fs.existsSync(path.join(root, 'profiles-io.js'))
  ? fs.readFileSync(path.join(root, 'profiles-io.js'), 'utf8') : '';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

function loadNorm(nav) {
  const sandbox = {
    window: { __BOOT_CACHE_V: '1', __bootCacheV: '1' },
    navigator: nav,
    document: {
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return { setAttribute() {}, style: {}, shadowRoot: null }; },
      head: { appendChild() {} }
    },
    console, Date, Math, JSON, String, Array, Object, Error, parseInt, isNaN, setTimeout, clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'latex-test.js' });
  return sandbox.window;
}

const THERMO = 'C_V=\\left(\\frac{\\partial U}{\\partial T}\\right)_V';
const DFRAC = '\\left(\\dfrac{\\partial H}{\\partial T}\\right)_P';
const FLAT = '\\left\\{ y\\in E \\right\\}';
const NESTED = '\\left(\\frac{a}{\\frac{b}{c}}\\right)';

console.log('=== Données : aperçu seulement ===\n');
assert(checkBootCacheVersion(root).ok, 'cache __BOOT_CACHE_V défini');
assert(/uniquement latexToMarkup|aperçu uniquement/.test(src), 'commentaire : pas d’écriture carte');
assert(!/normalizeStretchyDelims/.test(appSrc + quickSrc + cloudSrc + pioSrc),
  'save / cloud / Rapide ne réécrivent pas le LaTeX');
assert(!/reponse\s*=\s*[^;]*latexToMarkup/.test(appSrc + quickSrc),
  'card.reponse n’est jamais = latexToMarkup(...)');
assert(/isSafariStretchyFracBug\(\) && latexBodyHasSimpleFrac/.test(src),
  'compactage \\bigl limité à Safari + fraction simple');

console.log('\n=== Chrome / Node (affichage historique) ===\n');
const chrome = loadNorm({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  vendor: 'Google Inc.'
});
assert(chrome._isSafariStretchyFracBug() === false, 'Chrome Windows ≠ Safari');
assert(chrome.normalizeStretchyDelims(THERMO) === THERMO,
  'Chrome : C_V=\\left(\\frac{∂U}{∂T}\\right)_V inchangé');
assert(chrome.normalizeStretchyDelims(DFRAC) === DFRAC
  || /\\left\(/.test(chrome.normalizeStretchyDelims(DFRAC)),
  'Chrome : dfrac garde \\left (pas \\bigl)');
assert(/\\bigl\\{/.test(chrome.normalizeStretchyDelims(FLAT)),
  'ensemble plat : \\bigl comme avant (tous navigateurs)');
assert(/\\left\(/.test(chrome.normalizeStretchyDelims(NESTED)) && /\\rule\{0pt\}/.test(chrome.normalizeStretchyDelims(NESTED)),
  'fractions imbriquées : Size4 inchangé');
assert(chrome.normalizeStretchyDelims('E=mc^2') === 'E=mc^2', 'sans \\left : inchangé');
const face = chrome.formatCardFaceHtml('\\(' + THERMO + '\\)');
assert(typeof face === 'string' && face.indexOf('latex-lab-preview-math') !== -1,
  'formatCardFaceHtml produit du HTML, ne mute pas la source');

console.log('\n=== Safari Mac ===\n');
const safari = loadNorm({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15',
  vendor: 'Apple Computer, Inc.'
});
assert(safari._isSafariStretchyFracBug() === true, 'Safari Mac détecté');
const sThermo = safari.normalizeStretchyDelims(THERMO);
assert(/\\bigl\(/.test(sThermo) && /\\bigr\)_V/.test(sThermo),
  'Safari : fraction simple → \\bigl, indice _V collé');
assert(!/\\left\(/.test(sThermo), 'Safari : plus de SVG \\left sur cette formule');
assert(/\\left\(/.test(safari.normalizeStretchyDelims(NESTED)),
  'Safari : matrices / frac imbriquées toujours en \\left');
assert(/\\bigl\\{/.test(safari.normalizeStretchyDelims(FLAT)),
  'Safari : ensemble plat toujours \\bigl');

console.log('\n=== iOS Chrome (pas le bug Safari) ===\n');
const crios = loadNorm({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  vendor: 'Apple Computer, Inc.'
});
assert(crios._isSafariStretchyFracBug() === false, 'CriOS n’est pas traité comme Safari');
assert(crios.normalizeStretchyDelims(THERMO) === THERMO, 'CriOS : \\left conservé');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
