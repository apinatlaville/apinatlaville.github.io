/**
 * Safari : \\left autour d’une fraction simple ne doit plus produire
 * des parenthèses SVG géantes (indice _V décroché).
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

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

console.log('=== Délimiteurs stretchy (Safari / fraction simple) ===\n');

assert(checkBootCacheVersion(root).ok, 'cache __BOOT_CACHE_V défini');
assert(/latexBodyHasSimpleFrac\(rawBody\) \|\| latexBodyIsFlat\(rawBody\)/.test(src),
  'fraction simple passe par \\bigl/\\bigr avant \\left SVG');
assert(/Safari étire les SVG/.test(src), 'commentaire Safari présent');

const sandbox = {
  window: { __BOOT_CACHE_V: '1', __bootCacheV: '1' },
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { setAttribute() {}, style: {}, shadowRoot: null }; },
    head: { appendChild() {} }
  },
  console, Date, Math, JSON, String, Array, Object, Error, parseInt, isNaN, setTimeout, clearTimeout
};
sandbox.window = Object.assign(sandbox.window, {});
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'latex-test.js' });
const n = sandbox.window.normalizeStretchyDelims;
assert(typeof n === 'function', 'normalizeStretchyDelims exposé');

const thermo = n('C_V=\\left(\\frac{\\partial U}{\\partial T}\\right)_V');
assert(/\\bigl\(/.test(thermo) && /\\bigr\)_V/.test(thermo),
  'C_V=(∂U/∂T)_V → \\bigl/\\bigr, indice collé');
assert(!/\\left\(/.test(thermo) && !/\\right\)/.test(thermo),
  'plus de \\left SVG sur cette formule');

const dfrac = n('\\left(\\dfrac{\\partial H}{\\partial T}\\right)_P');
assert(/\\bigl\(/.test(dfrac) && /\\bigr\)_P/.test(dfrac),
  'dfrac simple : aussi \\bigl (Safari)');

const flat = n('\\left\\{ y\\in E \\right\\}');
assert(/\\bigl\\{/.test(flat) && /\\bigr\\}/.test(flat),
  'ensemble plat : toujours \\bigl');

const nested = n('\\left(\\frac{a}{\\frac{b}{c}}\\right)');
assert(/\\left\(/.test(nested) && /\\rule\{0pt\}/.test(nested),
  'fractions imbriquées : Size4 + rule (inchangé)');

const untouched = n('E=mc^2');
assert(untouched === 'E=mc^2', 'sans \\left : inchangé');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
