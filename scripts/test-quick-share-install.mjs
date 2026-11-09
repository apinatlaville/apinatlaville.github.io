/**
 * Partage : un pack propriétaire ne doit pas passer « non installé »
 * à cause d’un vieux clone, ni se faire écraser par un autre dossier
 * (cartes en moins).
 * Usage: node scripts/test-quick-share-install.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { checkBootCacheVersion } from './_cache-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}

function makeStore() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(k); },
    _map: map
  };
}

function loadQuickShare(env) {
  const sandbox = {
    window: env,
    localStorage: env.localStorage,
    document: { getElementById() { return null; }, querySelectorAll() { return []; } },
    console, Date, JSON, Object, Array, String, Number, Math, Promise, Set, Map,
    setTimeout, clearTimeout, Error
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'quick-share.js'), 'utf8'),
    sandbox,
    { filename: 'quick-share.js' }
  );
  return env.QuickShare;
}

function card(id, groupId, n) {
  return {
    id,
    groupId,
    contentId: 'c-' + n,
    titre: 'q' + n,
    question: 'q' + n,
    reponse: 'r' + n,
    profil: 'ANGLAIS',
    tempsCible: 30,
    importance: 3
  };
}

function envScreenshot() {
  const env = {
    localStorage: makeStore(),
    isLocalMode: true,
    D: {
      settings: {},
      matieres: [{ id: 'MATH', name: 'Maths' }],
      quickGroups: [
        {
          id: 'QG-FOURIER',
          name: 'Analyse de Fourier',
          mat: 'MATH',
          shared: { packId: 'P-P5U85F38A', installedVersion: 1, imported: false }
        },
        {
          id: 'QG-VEC',
          name: 'Analyse Vectorielle',
          mat: 'MATH',
          shared: {
            packId: 'P-P5U85F38A',
            installedVersion: 3,
            publishedVersion: 3,
            imported: false
          }
        }
      ],
      exercices: [
        card('Y-F01', 'QG-FOURIER', 1),
        card('Y-V01', 'QG-VEC', 2)
      ]
    },
    save() { return Promise.resolve({ local: true }); }
  };
  env.localStorage.setItem('active_mode', 'local');
  return env;
}

const PACK_META = {
  packId: 'P-P5U85F38A',
  name: 'Analyse Vectorielle',
  latestVersion: 3,
  cardCount: 18,
  sourceGroupId: 'QG-VEC',
  createdBy: { uid: 'local', name: 'Anel' }
};

function testRankingPrefersPublisherFolder() {
  console.log('\n· catalogue : pas le premier clone v1, le dossier publié à jour');
  const env = envScreenshot();
  const QS = loadQuickShare(env);
  const found = QS.findLocalGroupForPack('P-P5U85F38A', null, '', PACK_META);
  assert(found && found.id === 'QG-VEC', 'trouve Analyse Vectorielle (v3), pas Fourier (v1)');
  const first = env.D.quickGroups[0];
  assert(first.id === 'QG-FOURIER', 'Fourier est bien en premier dans la liste (piège .find)');
  const idx = QS.installedByPackIndex([PACK_META]);
  assert(idx['P-P5U85F38A'] && idx['P-P5U85F38A'].id === 'QG-VEC', 'index catalogue = Vectorielle');
}

async function testFourierDoesNotNagUpdate() {
  console.log('\n· Fourier v1 : pas d’Update si Vectorielle est déjà à la dernière');
  const env = envScreenshot();
  env.QuickShare = null;
  const QS = loadQuickShare(env);
  const origGetMeta = QS.getMeta;
  QS.getMeta = async function (packId) {
    if (packId === 'P-P5U85F38A') return PACK_META;
    return origGetMeta.call(QS, packId);
  };
  const stF = await QS.getGroupShareState('QG-FOURIER');
  const stV = await QS.getGroupShareState('QG-VEC');
  assert(stF.linked && stF.updateAvailable === false, 'Fourier ne demande pas l’Update (pack déjà à jour ailleurs)');
  assert(stV.linked && stV.updateAvailable === false, 'Vectorielle à jour, pas d’Update');
}

function testSourceFolderWinsWithoutShared() {
  console.log('\n· sourceGroupId gagne même si le dossier publié n’a plus le lien shared');
  const env = envScreenshot();
  env.D.quickGroups[1].shared = null;
  const QS = loadQuickShare(env);
  const found = QS.findLocalGroupForPack('P-P5U85F38A', null, '', PACK_META);
  assert(found && found.id === 'QG-VEC', 'source Vectorielle choisie sans shared.packId');
}

function seedLocalPack(env, meta, versions) {
  env.localStorage.setItem('mes_cours_shared_packs_v1', JSON.stringify({
    packs: {
      [meta.packId]: { meta: Object.assign({ visibility: 'public', schema: 2 }, meta), versions }
    }
  }));
}

async function testGhostPublishCreatesNewPack() {
  console.log('\n· publier depuis un autre dossier (ghost link) → nouveau pack, pas une v4 plus petite');
  const env = envScreenshot();
  env.D.quickGroups[1].shared = {
    packId: 'P-P5U85F38A',
    installedVersion: 0,
    imported: false,
    localDirty: true
  };
  const fourierMeta = {
    packId: 'P-P5U85F38A',
    name: 'Analyse de Fourier',
    latestVersion: 1,
    cardCount: 20,
    sourceGroupId: 'QG-FOURIER',
    createdBy: { uid: 'local', name: 'Anel' },
    lastPublishedBy: { uid: 'local', name: 'Anel' },
    createdAt: '2026-09-19T13:24:00.000Z',
    updatedAt: '2026-09-19T13:24:00.000Z'
  };
  seedLocalPack(env, fourierMeta, {
    1: {
      version: 1,
      cards: Array.from({ length: 20 }, (_, i) => ({
        contentId: 'old' + i, question: 'fq' + i, reponse: 'fr' + i, profil: 'ANGLAIS', tempsCible: 30, importance: 3
      }))
    }
  });
  env.D.exercices = [
    card('Y-V01', 'QG-VEC', 1),
    card('Y-V02', 'QG-VEC', 2),
    card('Y-V03', 'QG-VEC', 3)
  ];
  const QS = loadQuickShare(env);
  assert(QS.wouldOverwriteOtherFolder(env.D.quickGroups[1], fourierMeta) === true,
    'Vectorielle n’est pas la source vivante du pack Fourier');
  const result = await QS.publishGroup('QG-VEC');
  assert(result.detached === true, 'publication détachée (nouveau pack)');
  assert(result.meta.packId !== 'P-P5U85F38A', 'le pack Fourier n’est pas réécrit');
  assert(result.version === 1, 'nouveau pack en v1');
  const still = await QS.getMeta('P-P5U85F38A');
  assert(still && Number(still.latestVersion) === 1 && Number(still.cardCount) === 20,
    'pack Fourier inchangé (20 cartes, v1)');
  assert(env.D.quickGroups[0].shared.packId === 'P-P5U85F38A'
    && Number(env.D.quickGroups[0].shared.installedVersion) === 1,
    'dossier Fourier toujours installé v1');
}

async function testNameReuseBlockedWhenOtherSourceLives() {
  console.log('\n· même nom catalogue : pas de réécriture si un autre dossier est la source');
  const env = envScreenshot();
  env.D.quickGroups[1].shared = null;
  env.D.quickGroups[1].name = 'Analyse de Fourier';
  env.D.exercices = [card('Y-V01', 'QG-VEC', 1), card('Y-V02', 'QG-VEC', 2)];
  const fourierMeta = {
    packId: 'P-P5U85F38A',
    name: 'Analyse de Fourier',
    latestVersion: 1,
    cardCount: 20,
    sourceGroupId: 'QG-FOURIER',
    createdBy: { uid: 'local', name: 'Anel' },
    lastPublishedBy: { uid: 'local', name: 'Anel' }
  };
  seedLocalPack(env, fourierMeta, {
    1: { version: 1, cards: [{ contentId: 'x', question: 'q', reponse: 'r', profil: 'ANGLAIS', tempsCible: 30, importance: 3 }] }
  });
  const QS = loadQuickShare(env);
  const result = await QS.publishGroup('QG-VEC');
  assert(result.meta.packId !== 'P-P5U85F38A', 'nom identique ≠ voler le pack du dossier source');
}

function testImportIdsAreLong() {
  console.log('\n· ids dossier import : 6 chars (anti ghost sourceGroupId)');
  const src = fs.readFileSync(path.join(root, 'quick-share.js'), 'utf8');
  assert(!/genCode\('QG-',\s*3/.test(src), 'plus de genCode QG- 3 caractères');
  assert(/genCode\('QG-',\s*6/.test(src) || /quickGenGroupId/.test(src),
    'imports utilisent 6 caractères / quickGenGroupId');
}

function testCacheBumped() {
  console.log('\n· cache boot');
  const chk = checkBootCacheVersion(root);
  assert(chk.ok, 'window.__BOOT_CACHE_V bien formé et lu par boot-loader');
}

async function main() {
  console.log('=== Partage : install propriétaire / anti-écrasement ===');
  testRankingPrefersPublisherFolder();
  await testFourierDoesNotNagUpdate();
  testSourceFolderWinsWithoutShared();
  await testGhostPublishCreatesNewPack();
  await testNameReuseBlockedWhenOtherSourceLives();
  testImportIdsAreLong();
  testCacheBumped();
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) console.error('Échecs:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
