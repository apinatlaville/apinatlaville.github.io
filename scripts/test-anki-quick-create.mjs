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
assert(!/id="qkQ"/.test(quickSrc), 'plus de formulaire inline Question/recto');
assert(!/class="quick-create"/.test(quickSrc), 'plus de bloc création inline');
assert(/btnQuickCreateMenu|quickCreateMenu/.test(quickSrc), 'bouton Créer type Base Doc');
assert(/btnQuickCreateSingle/.test(quickSrc) && /btnQuickCreateBatch/.test(quickSrc), 'menu Créer une / à la suite');
assert(!/id="quickTempsMin"/.test(appSrc), 'modal : pas de champ durée');
assert(/quickCoursSelected/.test(appSrc), 'lien chapitre dans le modal');
assert(/quickOpenLatex|ankiV2QuickOpenLatex|openQuickLatexCard/.test(quickSrc + appSrc + latexSrc), 'entrée LaTeX');
assert(/ovQuickLatex|restoreOverlay|mountLatexEasyEditor/.test(latexSrc), 'popup LaTeX Easy (pas navigation onglet)');
assert(/restoreOverlay:\s*'ovQuickCreate'/.test(appSrc), 'FAB Rapide restaure ovQuickCreate');
assert(/mountLatexEasyEditor/.test(fs.readFileSync(path.join(root, 'latex-test.js'), 'utf8')), 'API mountLatexEasyEditor lab');
assert(/paneQuickLatex/.test(indexSrc) && /quickLatex/.test(navSrc), 'bundle quickLatex toujours enregistré');
assert(/__BOOT_CACHE_V\s*=\s*'20260827c'/.test(indexSrc), 'cache 20260827c');

const cardUiSrc = fs.readFileSync(path.join(root, 'anki-card-ui.js'), 'utf8');
assert(/openCardTypePicker\(\)/.test(cardUiSrc), 'FAB ouvre le type picker');
assert(/pickCardType|devoir.*main.*quick|card-type-picker/.test(cardUiSrc), 'choix Devoir / Principale / Rapide');
assert(/openQuickCardCreate[\s\S]*_cardCreateOpts[\s\S]*ankiV2OpenQuickModal/.test(cardUiSrc),
  'Rapide conserve coursId/mat via _cardCreateOpts');
assert(/window\.D && window\.D\.cours/.test(cardUiSrc), 'type picker garde D null-safe');
assert(/dataset\.cardTypePickerBound/.test(cardUiSrc), 'FAB listener lié une seule fois');
assert(/_quickCreateMode\s*===\s*'batch'|mode === 'batch'/.test(appSrc), 'mode batch carte rapide');
assert(!/intercalaire/.test(cardUiSrc), 'pas d’intercalaire dans le menu cartes');
assert(/ankiV2CloseQuickModal|Créer la suivante|Terminer/.test(appSrc), 'batch : Terminer / suivante');
assert(/QUICK_DEFAULT_SEC\s*=\s*30/.test(algoSrc), 'durée packing Y- = 30s');
assert(/cardKind\(c\) === 'quick'/.test(algoSrc), 'cardDuration branche quick');
assert(/ankiV2OpenQuickModal/.test(quickSrc) && /ensureAnkiUi/.test(quickSrc), 'Créer charge Anki UI puis ouvre le modal');
assert(/openQuickCardCreate/.test(quickSrc), 'fallback openQuickCardCreate');
assert(/function renderCoursLinkUI/.test(appSrc), 'renderCoursLinkUI défini (lien chapitre modal)');
assert(/ankiV2CoursLinkSearch/.test(appSrc) && /ankiV2CoursLinkToggle/.test(appSrc), 'API recherche/toggle cours liés');

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
