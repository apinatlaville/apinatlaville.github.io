/**
 * Groupes Rapide — navigation fil d’Ariane + dossiers par matière.
 * Usage: node scripts/test-anki-quick-groups.mjs
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
const dataSrc = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const demoSrc = fs.readFileSync(path.join(root, 'demo-data.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

console.log('=== Rapide : dossiers fil d’Ariane ===\n');

assert(/quickGroups:\s*\[\]/.test(dataSrc), 'emptyData.quickGroups');
assert(/D\.quickGroups/.test(algoSrc) && /migrateData/.test(algoSrc), 'migrateData initialise quickGroups');
assert(/mat:\s*g\.mat/.test(algoSrc), 'migrate quickGroups mat');
assert(/cours-bc-bar|cours-bc-tile|cours-bc-page/.test(quickSrc), 'UI fil d’Ariane (crumbs + tuiles)');
assert(/quickArianeReset|quickArianePickGroup|quickOpenCreateFolder/.test(quickSrc), 'navigation Ariane Rapide');
assert(/Choisir un dossier/.test(quickSrc), 'écran racine : tuiles dossiers');
assert(/quick-group-section|groupsByMat|quickGroupsByMat/.test(quickSrc), 'dossiers triés par matière');
assert(/btnQuickCreateFolder|Créer un dossier/.test(quickSrc), 'création dossier dans menu Créer');
assert(/btnQuickManageFolders|Gérer les dossiers/.test(quickSrc), 'gestion dossiers dans menu Créer');
assert(!/cours-bc-tile--manage/.test(quickSrc), 'plus de tuile gérer sur l’écran racine');
assert(/qk-color-dots|quickPickGroupColor/.test(quickSrc), 'pastilles couleur (sans select)');
assert(!/qk-group-color/.test(quickSrc), 'plus de select couleur scrollable');
assert(!/qkFltGroup|Par groupe|quickSetViewBy|quickSetCardGroup/.test(quickSrc), 'plus de toggles/dropdowns groupes');
assert(!/qk-group-assign|groupAssignControl/.test(quickSrc), 'plus de select groupe sur carte');
assert(/id="quickGroup"/.test(appSrc), 'champ Dossier dans le modal création');
assert(/quickRefreshGroupSelect/.test(appSrc), 'filtre dossiers par matière au modal');
assert(/groupId/.test(appSrc) && /editingQuickId/.test(appSrc), 'sauvegarde + édition groupId');
assert(/groupId:'QG-VOC'|groupId: 'QG-VOC'|groupId: "QG-VOC"/.test(demoSrc), 'démo assigne des groupes');
assert(/mat:\s*'ANGL'|mat:\s*"ANGL"/.test(demoSrc), 'démo quickGroups avec matière');
assert(/quickGroups:/.test(demoSrc), 'démo définit quickGroups');
assert(/quick-bc-page|qk-groups-sections|qk-color-dot|cours-bc-tile--manage/.test(cssSrc), 'styles Rapide (dossiers + fil d\'Ariane)');
assert(/__BOOT_CACHE_V\s*=\s*'20260831d'/.test(indexSrc), 'cache 20260831d');

const sandbox = {
  window: {
    D: {
      settings: {},
      exercices: [
        { id: 'Y-AAA', mat: 'ANGL', profil: 'ANGLAIS', question: 'a', statut: 'actif', groupId: 'QG-VOC' },
        { id: 'Y-BBB', mat: 'ANGL', profil: 'ANGLAIS', question: 'b', statut: 'actif' }
      ],
      matieres: [{ id: 'ANGL', label: 'ANGL', name: 'Anglais', color: '#e07ab3' }],
      cours: [],
      quickGroups: [
        { id: 'QG-VOC', name: 'Vocabulaire', color: '#e07ab3', order: 0, mat: 'ANGL' },
        { id: '', name: 'bad' },
        { id: 'QG-X', name: '  ' }
      ]
    },
    escHtml: (s) => String(s == null ? '' : s)
  },
  console, Date, JSON, Object, Array, String, Number, Math, Error, parseInt, isNaN
};
sandbox.globalThis = sandbox;
vm.runInNewContext(algoSrc, sandbox, { filename: 'anki-algo.js' });
sandbox.window.AnkiAlgo.migrateData(sandbox.window.D);
assert(Array.isArray(sandbox.window.D.quickGroups), 'après migrate : quickGroups array');
assert(sandbox.window.D.quickGroups.length === 1 && sandbox.window.D.quickGroups[0].id === 'QG-VOC',
  'migrate filtre groupes invalides');
assert(sandbox.window.D.quickGroups[0].mat === 'ANGL', 'migrate conserve mat');

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
