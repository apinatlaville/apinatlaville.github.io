/**
 * Groupes Rapide — navigation fil d’Ariane.
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

console.log('=== Rapide : groupes fil d’Ariane ===\n');

assert(/quickGroups:\s*\[\]/.test(dataSrc), 'emptyData.quickGroups');
assert(/D\.quickGroups/.test(algoSrc) && /migrateData/.test(algoSrc), 'migrateData initialise quickGroups');
assert(/cours-bc-bar|cours-bc-tile|cours-bc-page/.test(quickSrc), 'UI fil d’Ariane (crumbs + tuiles)');
assert(/quickArianeReset|quickArianePickGroup|quickArianeManageGroups/.test(quickSrc), 'navigation Ariane Rapide');
assert(/Choisir un groupe/.test(quickSrc), 'écran racine : tuiles groupes');
assert(/Gérer les groupes/.test(quickSrc), 'tuile gérer les groupes');
assert(!/qkFltGroup|Par groupe|quickSetViewBy|quickSetCardGroup/.test(quickSrc), 'plus de toggles/dropdowns groupes');
assert(!/qk-group-assign|groupAssignControl/.test(quickSrc), 'plus de select groupe sur carte');
assert(/id="quickGroup"/.test(appSrc), 'champ Groupe dans le modal création');
assert(/groupId/.test(appSrc) && /editingQuickId/.test(appSrc), 'sauvegarde + édition groupId');
assert(/groupId:'QG-VOC'|groupId: 'QG-VOC'|groupId: "QG-VOC"/.test(demoSrc), 'démo assigne des groupes');
assert(/quickGroups:/.test(demoSrc), 'démo définit quickGroups');
assert(/quick-bc-page|cours-bc-tile--manage/.test(cssSrc), 'styles fil d’Ariane Rapide');
assert(/__BOOT_CACHE_V\s*=\s*'20260830a'/.test(indexSrc), 'cache 20260830a');

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
        { id: 'QG-VOC', name: 'Vocabulaire', color: '#e07ab3', order: 0 },
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

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
