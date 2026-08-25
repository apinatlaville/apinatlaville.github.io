/**
 * Tests audit robustesse LaTeX / anti-wipe / secondaire.
 * Usage: node scripts/test-audit-robustesse.mjs
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

const coreSrc = fs.readFileSync(path.join(root, 'core-utils.js'), 'utf8');
const latexSrc = fs.readFileSync(path.join(root, 'latex-test.js'), 'utf8');
const quickLatexSrc = fs.readFileSync(path.join(root, 'anki-quick-latex.js'), 'utf8');
const quickSrc = fs.readFileSync(path.join(root, 'anki-quick.js'), 'utf8');
const appV2Src = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');
const cardUiSrc = fs.readFileSync(path.join(root, 'anki-card-ui.js'), 'utf8');
const bootSrc = fs.readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
const dataSrc = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const dsSrc = fs.readFileSync(path.join(root, 'device-session.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

console.log('=== LaTeX centralisé ===\n');
assert(/window\.formatCardFaceHtml\s*=/.test(coreSrc), 'formatCardFaceHtml dans core-utils (toujours dispo)');
assert(/parseLatexInlineForEditor/.test(latexSrc), 'parseLatexInlineForEditor partagé');
assert(/id:\s*'vecteurs'/.test(latexSrc), 'palette Vecteurs dédiée');
assert(/normalizeVectorLatex/.test(latexSrc), 'normalisation \\vec multi-caractères');
assert(/overrightarrow/.test(latexSrc), 'raccourcis vecteur \\overrightarrow');
assert(/latexBuildInline\(getTextBefore/.test(latexSrc) || /buildFullExport[\s\S]*latexBuildInline/.test(latexSrc),
  'buildFullExport réutilise latexBuildInline');
assert(!/latexToMarkup\(tex\)/.test(quickSrc),
  'anki-quick ne ré-implémente plus le replace XSS');
assert(/formatSessFace|formatCardFaceHtml/.test(appV2Src), 'session/dock utilisent format face LaTeX');
assert(/_editorsReady/.test(quickLatexSrc) && /disabled/.test(quickLatexSrc),
  'Appliquer désactivé tant que MathLive pas prêt');
assert(/gen !== _mountGen/.test(quickLatexSrc), 'anti-race re-ouverture popup LaTeX');
assert(/abortOpen|Impossible de charger/.test(quickLatexSrc), 'échec chargement n’ouvre pas un éditeur vide');
const qlMatch = bootSrc.match(/quickLatex:\s*\[([^\]]*)\]/);
assert(qlMatch && /latex-test\.js/.test(qlMatch[1]) && /anki-quick-latex\.js/.test(qlMatch[1])
  && !/anki-app-v2\.js/.test(qlMatch[1]),
  'bundle quickLatex sans anki-app-v2 superflu');

console.log('\n=== formatCardFaceHtml comportement ===\n');
{
  const sandbox = {
    window: {},
    console,
    String, Array, Object, Math, Error, RegExp, Date, JSON, Number, Boolean,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    document: {
      body: { classList: { contains: function () { return false; }, add: function () {}, remove: function () {} } },
      documentElement: { classList: { add: function () {}, remove: function () {} } },
      getElementById: function () { return null; }
    }
  };
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(coreSrc, sandbox);
  const fmt = sandbox.window.formatCardFaceHtml;
  assert(typeof fmt === 'function', 'API formatCardFaceHtml');
  assert(fmt('hello') === 'hello', 'texte simple');
  assert(fmt('<b>x</b>').includes('&lt;b&gt;'), 'texte HTML échappé');
  const mixed = fmt('avant \\(a+b\\) après <script>');
  assert(mixed.includes('latex-lab-preview-math'), 'formule wrappée');
  assert(mixed.includes('&lt;script&gt;'), 'texte après formule échappé (anti-XSS)');
  assert(!mixed.includes('<script>'), 'pas de balise script brute');
  const multi = fmt('\\(a\\) et \\(b\\)');
  assert((multi.match(/latex-lab-preview-math/g) || []).length === 2, 'multi-formules');
}

console.log('\n=== Création carte / secondaire ===\n');
assert(/Promise\.resolve\(window\.save\(\)\)/.test(appV2Src)
  || /return Promise\.resolve\(window\.save/.test(appV2Src),
  'quickAddAnkiCard attend save()');
assert(/SECONDARY_READ_ONLY/.test(appV2Src) && /matieres\)\s*\?\s*window\.D\.matieres/.test(appV2Src)
  || /\(mats\[0\]/.test(appV2Src),
  'quickAddAnkiCard null-safe + refuse secondaire');
assert(/refuseSecondaryFullMutation/.test(dsSrc), 'helper refuseSecondaryFullMutation');
assert(/refuseSecondaryFullMutation/.test(dataSrc) && /editCours/.test(dataSrc),
  'editCours/delCours gardés secondaire');
assert(/refuseSecondaryFullMutation/.test(cardUiSrc), 'openCardTypePicker / openCardCreate gardés');
assert(/Module Anki non chargé/.test(cardUiSrc),
  'fallback Rapide = alerte module manquant');
const oq = cardUiSrc.slice(cardUiSrc.indexOf('window.openQuickCardCreate'));
const oqEnd = oq.indexOf('window.openQuickModeChooser');
const oqBody = oqEnd > 0 ? oq.slice(0, oqEnd) : oq.slice(0, 800);
assert(!/openCardTypePicker\(window\._cardCreateOpts/.test(oqBody),
  'openQuickCardCreate ne reboucle plus sur le type picker');
assert(/consultation \(pas de création/.test(indexSrc), 'hint Base Doc secondaire clarifié');
assert(/__BOOT_CACHE_V\s*=\s*'20260825a'/.test(indexSrc), 'cache 20260825a');
assert(/throw err/.test(latexSrc) && /MathLive indisponible/.test(latexSrc),
  'échec MathLive propage ready (anti-wipe Appliquer)');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
