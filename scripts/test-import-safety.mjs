/**
 * Imports sans perte : retour arrière de l’import Partage (quick-share.js)
 * et copie automatique « Annuler le dernier import » (profiles-io.js).
 * Usage: node scripts/test-import-safety.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0));

function makeStore() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(k); },
    _map: map
  };
}

function baseD() {
  return {
    settings: {}, matieres: [{ id: 'ANGL', name: 'Anglais' }], classeurs: [], cours: [{ uid: 'AN-AAA', title: 'Doc' }],
    exercices: [
      { id: 'Y-AAA', groupId: 'QG-AAA', contentId: 'c1', titre: 'cat', question: 'cat', reponse: 'chat', profil: 'ANGLAIS', tempsCible: 30, importance: 3, historique: [{ date: '2026-10-01', qScore: 7 }], repetitions: 2 },
      { id: 'Y-BBB', groupId: 'QG-AAA', contentId: 'c2', titre: 'dog', question: 'dog', reponse: 'chien', profil: 'ANGLAIS', tempsCible: 30, importance: 3, historique: [], repetitions: 0 },
      { id: 'X-ZZZ', titre: 'autre', question: 'q', reponse: 'r', historique: [] }
    ],
    devoirs: [],
    quickGroups: [{ id: 'QG-AAA', name: 'Vocab', mat: 'ANGL', shared: { packId: 'P1', installedVersion: 1, imported: true } }],
    meta: { revision: 5 }
  };
}

function versionDoc() {
  return {
    version: 2,
    name: 'Vocab v2',
    cards: [
      { contentId: 'c1', titre: 'cat', question: 'cat', reponse: 'CHAT (modifié)', profil: 'ANGLAIS', tempsCible: 30, importance: 3 },
      { contentId: 'c3', titre: 'bird', question: 'bird', reponse: 'oiseau', profil: 'ANGLAIS', tempsCible: 30, importance: 3 }
    ]
  };
}

function loadQuickShare(env) {
  const sandbox = {
    window: env, localStorage: env.localStorage, document: { getElementById() { return null; }, querySelectorAll() { return []; } },
    console, Date, JSON, Object, Array, String, Number, Math, Promise, Set, Map, setTimeout, clearTimeout, Error
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'quick-share.js'), 'utf8'), sandbox, { filename: 'quick-share.js' });
  return env.QuickShare;
}

function quickEnv(saveImpl) {
  const env = {
    localStorage: makeStore(),
    D: baseD(),
    _events: [],
    _backups: [],
    _toasts: [],
    recordDataEvent(code, detail) { env._events.push({ code, detail }); },
    showToast(msg) { env._toasts.push(msg); },
    ProfilesIO: { createAutoBackup(label) { env._backups.push(label); return true; } },
    save: saveImpl
  };
  return env;
}

async function testRollbackOnSaveFailure() {
  console.log('\n· import Partage : sauvegarde refusée → retour à l’état exact d’avant');
  const env = quickEnv(() => Promise.reject(new Error('localStorage save failed')));
  const QS = loadQuickShare(env);
  const before = JSON.stringify(env.D);
  QS.applyVersionToGroup('QG-AAA', versionDoc(), { packId: 'P1', deleteRemoved: true });
  assert(env.D.exercices.some((c) => c.reponse === 'CHAT (modifié)'), 'import appliqué en mémoire avant confirmation');
  await tick(5);
  assert(JSON.stringify(env.D) === before, 'données identiques à l’avant-import après échec de sauvegarde');
  assert(env._events.some((e) => e.code === 'IMPORT_ROLLBACK'), 'événement IMPORT_ROLLBACK');
  assert(env._toasts.some((t) => /annulé/i.test(t)), 'message affiché à l’utilisateur');
  assert(env._backups.length === 1, 'copie automatique créée avant l’import');
}

async function testRollbackOnException() {
  console.log('\n· import Partage : erreur en cours d’import → retour arrière');
  const env = quickEnv(() => Promise.resolve({ local: true }));
  env.AnkiAlgoV2 = { genExoUid() { throw new Error('boom'); } };
  const QS = loadQuickShare(env);
  const before = JSON.stringify(env.D);
  let err = null;
  try { QS.applyVersionToGroup('QG-AAA', versionDoc(), { packId: 'P1', deleteRemoved: true }); } catch (e) { err = e; }
  assert(!!err && /boom/.test(err.message), 'erreur remontée à l’appelant');
  assert(JSON.stringify(env.D) === before, 'cartes et dossier restaurés à l’identique');
}

async function testSuccessKeepsImport() {
  console.log('\n· import Partage réussi : conservé, progression gardée');
  let saveOpts = null;
  const env = quickEnv((o) => { saveOpts = o; return Promise.resolve({ local: true }); });
  const QS = loadQuickShare(env);
  QS.applyVersionToGroup('QG-AAA', versionDoc(), { packId: 'P1', deleteRemoved: false });
  await tick(5);
  const cat = env.D.exercices.find((c) => c.id === 'Y-AAA');
  assert(cat.reponse === 'CHAT (modifié)' && cat.historique.length === 1 && cat.repetitions === 2, 'mise à jour du texte, SRS intact');
  assert(env.D.exercices.some((c) => c.contentId === 'c3'), 'carte ajoutée conservée');
  assert(env.D.exercices.some((c) => c.id === 'Y-BBB'), 'carte absente du pack conservée (pas de suppression demandée)');
  assert(saveOpts && saveOpts.waitCloud === false, 'attend la confirmation locale (waitCloud:false)');
  assert(!env._events.some((e) => e.code === 'IMPORT_ROLLBACK'), 'aucun retour arrière');
}

function loadPIO(store, D) {
  const env = {
    localStorage: store,
    safeLocalGet: (k) => store.getItem(k),
    safeLocalSet: (k, v) => { store.setItem(k, v); return true; },
    safeLocalRemove: (k) => { store.removeItem(k); return true; },
    isLocalMode: true,
    emptyData: { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [], meta: {} },
    D,
    _events: [],
    _saved: 0
  };
  env.recordDataEvent = (code, detail) => { env._events.push({ code, detail }); };
  env.save = () => { env._saved++; store.setItem('backup_local_cours__default', JSON.stringify(env.D)); return Promise.resolve({ local: true }); };
  const sandbox = { window: env, console, Date, JSON, Object, Array, String, Number, Math, Promise, setTimeout, clearTimeout, Error, Set, Map };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'profiles-io.js'), 'utf8'), sandbox, { filename: 'profiles-io.js' });
  return env;
}

async function testAutoBackupUndo() {
  console.log('\n· « Annuler le dernier import » : profil restauré, sauvegardes manuelles intactes');
  const store = makeStore();
  const env = loadPIO(store, baseD());
  const PIO = env.ProfilesIO;
  PIO.createSnapshot('default', 'Manuelle');
  const snapsBefore = PIO.listSnapshots('default').length;
  assert(PIO.createAutoBackup('Avant import test') === true, 'copie automatique créée');
  assert(env._events.some((e) => e.code === 'IMPORT_BACKUP_CREATED'), 'événement IMPORT_BACKUP_CREATED');
  const info = PIO.getAutoBackupInfo('default');
  assert(!!info && /Avant import test/.test(info.label), 'copie visible (libellé, date)');
  const original = JSON.stringify(env.D);
  env.D.cours = [];
  env.D.exercices.push({ id: 'X-NEW', titre: 'importée' });
  PIO.createAutoBackup('Avant 2e import');
  assert(/2e import/.test(PIO.getAutoBackupInfo('default').label), 'un seul emplacement, réécrit');
  // Restaurer la copie du 2e import = état après 1er import modifié
  env.D = JSON.parse(original);
  PIO.createAutoBackup('Avant import X');
  env.D.cours = [];
  await PIO.restoreAutoBackup();
  assert(JSON.stringify(env.D) === original, 'profil revenu exactement à l’état d’avant import');
  assert(env._saved === 1, 'restauration enregistrée');
  assert(PIO.getAutoBackupInfo('default') == null, 'copie consommée après annulation');
  assert(PIO.listSnapshots('default').length === snapsBefore, 'sauvegardes manuelles non touchées');
  const pioSrc = fs.readFileSync(path.join(root, 'profiles-io.js'), 'utf8');
  assert(/createAutoBackup\('Avant import '/.test(pioSrc), 'import JSON : copie automatique avant applyImport');
  assert(/lsRemove\(AUTO_BACKUP_PREFIX \+ profileId\)/.test(pioSrc), 'suppression du profil : copie auto purgée');
}

async function testAutoBackupIsolation() {
  console.log('\n· copie automatique isolée par profil');
  const store = makeStore();
  store.setItem('active_profile', 'test');
  store.setItem('mc_profiles_meta', JSON.stringify({ schemaVersion: 1, activeProfile: 'test', profiles: [{ id: 'default', name: 'P' }, { id: 'test', name: 'T' }] }));
  const env = loadPIO(store, baseD());
  const PIO = env.ProfilesIO;
  PIO.pinSessionProfileId('test');
  PIO.createAutoBackup('Avant import test');
  assert(PIO.getAutoBackupInfo('test') != null, 'copie du profil test');
  assert(PIO.getAutoBackupInfo('default') == null, 'aucune copie côté principal');
}

async function main() {
  console.log('=== Imports sans perte ===');
  await testRollbackOnSaveFailure();
  await testRollbackOnException();
  await testSuccessKeepsImport();
  await testAutoBackupUndo();
  await testAutoBackupIsolation();
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) console.error('Échecs:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
