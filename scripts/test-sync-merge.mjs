/**
 * Synchronisation : traces de suppression (meta.deleted), horodatage par élément
 * (_mt), fusion « la modification la plus récente gagne », progression Anki jamais
 * perdue, sauvegardes locales en avance au démarrage, isolation des profils.
 * Usage: node scripts/test-sync-merge.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

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

function makeFirestore() {
  const docs = new Map();
  const key = (ref) => (typeof ref === 'string' ? ref : ref._path);
  const snap = (k) => (docs.has(k)
    ? { exists: () => true, data: () => JSON.parse(JSON.stringify(docs.get(k))) }
    : { exists: () => false, data: () => null });
  return {
    docs,
    doc(db, ...seg) { return { _path: seg.join('/'), id: seg[seg.length - 1] }; },
    async getDoc(ref) { return snap(key(ref)); },
    async setDoc(ref, data) { docs.set(key(ref), JSON.parse(JSON.stringify(data))); },
    async deleteDoc(ref) { docs.delete(key(ref)); },
    async runTransaction(db, fn) {
      await fn({ async get(ref) { return snap(key(ref)); }, set(ref, d) { docs.set(key(ref), JSON.parse(JSON.stringify(d))); } });
    }
  };
}

/** Bloc fusion de app.js (mergeRemoteCoursPatches … _mergeLocalAheadAtBoot). */
function mergeBlockSource() {
  const start = appSrc.indexOf('window.mergeRemoteCoursPatches = function');
  const end = appSrc.indexOf('window._applyCloudSnapshotGuards = function');
  if (start < 0 || end < 0 || end < start) throw new Error('Bloc fusion introuvable dans app.js');
  return appSrc.slice(start, end);
}

function makeDevice(opts) {
  opts = opts || {};
  const store = opts.store || makeStore();
  const fsMock = opts.fsMock || makeFirestore();
  const env = {
    localStorage: store,
    safeLocalGet: (k) => store.getItem(k),
    safeLocalSet: (k, v) => { store.setItem(k, v); return true; },
    safeLocalRemove: (k) => { store.removeItem(k); return true; },
    isLocalMode: !!opts.isLocalMode,
    cloudConnected: true,
    currentUser: { sub: 'uid1', email: 'a@b.c' },
    emptyData: { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [], meta: {} },
    D: null,
    db: {},
    doc: fsMock.doc.bind(fsMock),
    getDoc: fsMock.getDoc.bind(fsMock),
    setDoc: fsMock.setDoc.bind(fsMock),
    deleteDoc: fsMock.deleteDoc.bind(fsMock),
    runTransaction: fsMock.runTransaction.bind(fsMock),
    location: { reload() {} },
    _events: []
  };
  env.recordDataEvent = (code, detail) => { env._events.push({ code, detail }); };
  const sandbox = {
    window: env, console, Date, JSON, Object, Array, String, Number, Math, Promise,
    setTimeout, clearTimeout, Error, Set, Map
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'profiles-io.js'), 'utf8'), sandbox, { filename: 'profiles-io.js' });
  vm.runInNewContext(mergeBlockSource(), sandbox, { filename: 'app.js#merge' });
  env.PIO = env.ProfilesIO;
  env.store = store;
  env.fsMock = fsMock;
  return env;
}

/** Même séquence que _saveLocalImpl : révision++, horodatage, écriture. */
function save(env, pid, at) {
  pid = pid || 'default';
  if (!env.D.meta) env.D.meta = {};
  env.D.meta.revision = (Number(env.D.meta.revision) || 0) + 1;
  env.D.meta.updatedAt = at || Date.now();
  const next = env.PIO.stampPersistChanges(env.D, env._persistIndex || null, env.D.meta.updatedAt);
  const payload = JSON.stringify(env.D);
  const ok = env.PIO.writeLocalProfileData(pid, env.D, { payload });
  if (ok) env._persistIndex = next;
  return ok;
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function baseProfile() {
  return {
    settings: { userName: 'Moi', theme: 'dark' },
    matieres: [{ id: 'PHYS', name: 'Physique' }],
    classeurs: [{ id: 'A', name: 'A' }],
    chapitres: [{ id: 'PH-CH1', title: 'Méca', mat: 'PHYS' }],
    cours: [
      { uid: 'PH-AAA', title: 'Cours 1', mat: 'PHYS', cl: 'A', inter: '01' },
      { uid: 'PH-BBB', title: 'Cours 2', mat: 'PHYS', cl: 'A', inter: '02' }
    ],
    exercices: [
      { id: 'X-AAA', titre: 'Carte', question: 'Q', reponse: 'R', mat: 'PHYS', historique: [], repetitions: 0, intervalle: 0, ease: 2.5 }
    ],
    devoirs: [],
    quickGroups: [{ id: 'QG-AAAAAA', name: 'Dossier', mat: 'PHYS' }],
    meta: { revision: 10, updatedAt: Date.now() - 100000, profileGeneration: 1 }
  };
}

function twoDevices() {
  const fsMock = makeFirestore();
  const A = makeDevice({ fsMock });
  const B = makeDevice({ fsMock });
  A.D = clone(baseProfile());
  B.D = clone(baseProfile());
  A.resetPersistIndex();
  B.resetPersistIndex();
  return { A, B };
}

// ─── 1. Une suppression sur A disparaît aussi sur B ───
function testDeletionPropagates() {
  console.log('\n· suppression propagée A → B, jamais ressuscitée');
  const { A, B } = twoDevices();
  A.D.cours = A.D.cours.filter((c) => c.uid !== 'PH-AAA');
  A.D.exercices = [];
  save(A);
  assert(Number(A.D.meta.deleted['c:PH-AAA']) > 0, 'trace c:PH-AAA posée à la sauvegarde');
  assert(Number(A.D.meta.deleted['k:X-AAA']) > 0, 'trace k:X-AAA posée à la sauvegarde');
  B.mergeRemoteProfileIntoLocal(clone(A.D));
  assert(!B.D.cours.some((c) => c.uid === 'PH-AAA'), 'B : cours supprimé retiré');
  assert(!B.D.exercices.some((c) => c.id === 'X-AAA'), 'B : carte supprimée retirée');
  assert(B.D.cours.some((c) => c.uid === 'PH-BBB'), 'B : autre cours conservé');
  assert(B._events.some((e) => e.code === 'MERGE_APPLIED_DELETIONS'), 'B : événement MERGE_APPLIED_DELETIONS');
  // A reçoit l’ancienne version de B (qui avait encore le cours)
  const staleB = clone(baseProfile());
  A.mergeRemoteProfileIntoLocal(staleB);
  assert(!A.D.cours.some((c) => c.uid === 'PH-AAA'), 'A : union avec un vieux blob ne ressuscite pas');
  assert(!A.D.exercices.some((c) => c.id === 'X-AAA'), 'A : carte non ressuscitée');
}

// ─── 2. Modification après suppression : la plus récente gagne ───
function testEditAfterDeleteWins() {
  console.log('\n· édition postérieure à la suppression conservée');
  const { A, B } = twoDevices();
  const t0 = Date.now();
  A.D.cours = A.D.cours.filter((c) => c.uid !== 'PH-AAA');
  save(A, 'default', t0);
  B.D.cours[0].title = 'Cours 1 modifié';
  save(B, 'default', t0 + 5000);
  B.mergeRemoteProfileIntoLocal(clone(A.D));
  const kept = B.D.cours.find((c) => c.uid === 'PH-AAA');
  assert(!!kept && kept.title === 'Cours 1 modifié', 'cours modifié après la suppression conservé');
  assert(!(B.D.meta.deleted && B.D.meta.deleted['c:PH-AAA']), 'trace retirée pour l’élément conservé');
}

// ─── 3. Même cours modifié des deux côtés : la plus récente gagne ───
function testNewestEditWins() {
  console.log('\n· même élément modifié deux fois : la plus récente gagne');
  const { A, B } = twoDevices();
  const t0 = Date.now();
  A.D.cours[1].title = 'Titre A';
  A.D.chapitres[0].title = 'Chap A';
  save(A, 'default', t0);
  B.D.cours[1].title = 'Titre B';
  B.D.matieres[0].name = 'Physique-Chimie';
  save(B, 'default', t0 + 1000);
  A.mergeRemoteProfileIntoLocal(clone(B.D));
  assert(A.D.cours.find((c) => c.uid === 'PH-BBB').title === 'Titre B', 'cours : version la plus récente (B)');
  assert(A.D.matieres.find((m) => m.id === 'PHYS').name === 'Physique-Chimie', 'matière : version la plus récente');
  assert(A.D.chapitres.find((c) => c.id === 'PH-CH1').title === 'Chap A', 'chapitre modifié seulement sur A conservé');
  B.mergeRemoteProfileIntoLocal(clone(A.D));
  assert(B.D.cours.find((c) => c.uid === 'PH-BBB').title === 'Titre B', 'B garde sa version plus récente');
  assert(B.D.chapitres.find((c) => c.id === 'PH-CH1').title === 'Chap A', 'B reçoit le chapitre de A');
}

// ─── 4. Carte : texte le plus récent + progression la plus avancée ───
function testCardProgressNeverLost() {
  console.log('\n· carte : progression Anki jamais perdue');
  const { A, B } = twoDevices();
  const t0 = Date.now();
  const ca = A.D.exercices[0];
  ca.historique.push({ date: new Date(t0).toISOString(), qScore: 8 });
  ca.repetitions = 1;
  ca.intervalle = 3;
  save(A, 'default', t0);
  B.D.exercices[0].question = 'Q corrigée';
  save(B, 'default', t0 + 1000);
  A.mergeRemoteProfileIntoLocal(clone(B.D));
  const m = A.D.exercices.find((c) => c.id === 'X-AAA');
  assert(m.question === 'Q corrigée', 'texte : version la plus récente');
  assert(m.historique.length === 1 && m.repetitions === 1 && m.intervalle === 3, 'progression SRS conservée');
}

// ─── 5. Réglages : la plus récente gagne ───
function testSettingsNewest() {
  console.log('\n· réglages : la plus récente gagne');
  const { A, B } = twoDevices();
  const t0 = Date.now();
  A.D.settings.theme = 'light';
  save(A, 'default', t0);
  B.D.settings.userName = 'Autre';
  save(B, 'default', t0 + 1000);
  A.mergeRemoteProfileIntoLocal(clone(B.D));
  assert(A.D.settings.userName === 'Autre', 'réglages de B (plus récents) appliqués');
  B.mergeRemoteProfileIntoLocal(clone(A.D));
  assert(B.D.settings.userName === 'Autre', 'B ne reprend pas les réglages plus anciens de A');
}

// ─── 6. Supprimer son dernier contenu = autorisé (tracé), coquille = refusée ───
function testDeleteLastContent() {
  console.log('\n· suppression du dernier contenu autorisée, écrasement refusé');
  const env = makeDevice({ isLocalMode: true });
  env.D = clone(baseProfile());
  env.resetPersistIndex();
  assert(save(env) === true, 'profil initial écrit');
  env.D.cours = [];
  env.D.exercices = [];
  assert(save(env) === true, 'tout supprimer explicitement : sauvegarde acceptée');
  assert(env.PIO.readLocalProfileData('default').cours.length === 0, 'local à jour (0 cours)');
  const env2 = makeDevice({ isLocalMode: true, store: env.store });
  env2.store.setItem('backup_local_cours__default', JSON.stringify(baseProfile()));
  const shell = { settings: {}, matieres: [{ id: 'ZZ', name: 'Perso' }], classeurs: [], cours: [], exercices: [], devoirs: [], meta: {} };
  assert(env2.PIO.writeLocalProfileData('default', shell) === false, 'coquille non tracée refusée');
  assert(env2._events.some((e) => e.code === 'SAVE_REFUSED_SHELL'), 'événement SAVE_REFUSED_SHELL');
  assert(env2.PIO.readLocalProfileData('default').cours.length === 2, 'contenu existant intact');
}

// ─── 7. Réapparition (annulation / restauration) ───
function testReAddRemovesTombstone() {
  console.log('\n· élément ré-ajouté : trace retirée');
  const env = makeDevice({ isLocalMode: true });
  env.D = clone(baseProfile());
  env.resetPersistIndex();
  const removed = env.D.cours.shift();
  save(env);
  assert(!!env.D.meta.deleted['c:' + removed.uid], 'trace posée');
  env.D.cours.push(removed);
  save(env, 'default', Date.now() + 10);
  assert(!(env.D.meta.deleted && env.D.meta.deleted['c:' + removed.uid]), 'trace retirée après ré-ajout');
  assert(Number(removed._mt) > 0, 'élément ré-ajouté horodaté');
}

// ─── 8. Carte déplacée exercices → devoirs : pas une suppression ───
function testMoveIsNotDelete() {
  console.log('\n· déplacement exercices → devoirs non tracé comme suppression');
  const env = makeDevice({ isLocalMode: true });
  env.D = clone(baseProfile());
  env.resetPersistIndex();
  env.D.devoirs.push(env.D.exercices.pop());
  save(env);
  assert(!(env.D.meta.deleted && env.D.meta.deleted['k:X-AAA']), 'aucune trace pour une carte déplacée');
}

// ─── 9. Données anciennes (sans _mt ni meta.deleted) : comportement inchangé ───
function testLegacyCompat() {
  console.log('\n· données sans _mt : union historique conservée');
  const { A } = twoDevices();
  const remote = clone(baseProfile());
  remote.cours.push({ uid: 'PH-CCC', title: 'Nouveau distant' });
  remote.exercices[0].historique = [{ date: new Date().toISOString(), qScore: 5 }];
  remote.exercices[0].repetitions = 1;
  remote.cours[0].title = 'Titre distant';
  A.mergeRemoteProfileIntoLocal(remote);
  assert(A.D.cours.length === 3, 'union : cours distant ajouté');
  assert(A.D.cours.find((c) => c.uid === 'PH-AAA').title === 'Cours 1', 'sans _mt : version locale conservée (comme avant)');
  assert(A.D.exercices[0].repetitions === 1, 'sans _mt : carte la plus avancée (comme avant)');
}

// ─── 10. Profils isolés ───
function testProfileIsolation() {
  console.log('\n· profils isolés (test ≠ principal)');
  const env = makeDevice({ isLocalMode: true });
  env.D = clone(baseProfile());
  env.resetPersistIndex();
  save(env, 'default');
  const before = env.store.getItem('backup_local_cours__default');
  env.D = { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [], meta: {} };
  env.resetPersistIndex();
  env.D.cours.push({ uid: 'TE-AAA', title: 'Test' });
  save(env, 'test');
  env.D.cours = [];
  save(env, 'test');
  assert(env.store.getItem('backup_local_cours__default') === before, 'profil principal intact octet pour octet');
  assert(JSON.parse(env.store.getItem('backup_local_cours__test')).cours.length === 0, 'profil test modifié seul');
  assert(!JSON.parse(before).meta.deleted, 'aucune trace du profil test dans le principal');
}

// ─── 11. Démarrage : local en avance → fusion, cloud supprimés respectés ───
async function testBootLocalAhead() {
  console.log('\n· démarrage : sauvegardes locales non envoyées conservées');
  const fsMock = makeFirestore();
  const store = makeStore();
  const cloud = clone(baseProfile());
  cloud.meta = { revision: 10, updatedAt: Date.now() - 60000, profileGeneration: 1, deleted: { 'c:PH-BBB': Date.now() - 50000 } };
  cloud.cours = cloud.cours.filter((c) => c.uid !== 'PH-BBB');
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', generation: 1 }], deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  const local = clone(baseProfile());
  local.cours[0].title = 'Édité hors ligne';
  local.cours[0]._mt = Date.now() - 1000;
  local.meta = { revision: 12, updatedAt: Date.now() - 1000, profileGeneration: 1 };
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', generation: 1 }]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__default', JSON.stringify(local));
  const env = makeDevice({ fsMock, store });
  const r = await env.PIO.resolveProfileCloudDoc(env.currentUser);
  assert(!!r.localAhead, 'local en avance détecté');
  assert(r.localAhead && !r.localAhead.cours.some((c) => c.uid === 'PH-BBB'), 'suppression cloud appliquée à la copie locale');
  env.D = r.data;
  env.resetPersistIndex();
  env._mergeLocalAheadAtBoot(r.localAhead);
  assert(env.D.cours.find((c) => c.uid === 'PH-AAA').title === 'Édité hors ligne', 'édition locale non synchronisée conservée');
  assert(!env.D.cours.some((c) => c.uid === 'PH-BBB'), 'cours supprimé ailleurs non ressuscité');
  assert(env._bootLocalAheadMerged === true, 'sauvegarde de rattrapage demandée');
  // Local plus ancien que le cloud : pas de fusion
  const store2 = makeStore();
  store2._map = store._map;
  local.meta.revision = 9;
  store.setItem('backup_local_cours__default', JSON.stringify(local));
  const env2 = makeDevice({ fsMock, store });
  const r2 = await env2.PIO.resolveProfileCloudDoc(env2.currentUser);
  assert(!r2.localAhead, 'local plus ancien : cloud seul');
}

// ─── 12. Traces très anciennes purgées ───
function testTombstonePrune() {
  console.log('\n· traces > 400 jours purgées');
  const env = makeDevice({ isLocalMode: true });
  env.D = clone(baseProfile());
  env.D.meta.deleted = { 'c:OLD': Date.now() - 500 * 24 * 3600 * 1000, 'c:NEW': Date.now() - 1000 };
  env.resetPersistIndex();
  save(env);
  assert(!env.D.meta.deleted['c:OLD'] && !!env.D.meta.deleted['c:NEW'], 'purge des traces expirées seulement');
}

// ─── 13. Câblage app.js ───
function testWiring() {
  console.log('\n· câblage app.js');
  const saveImpl = appSrc.slice(appSrc.indexOf('window._saveLocalImpl = '), appSrc.indexOf('window._saveCloudImpl = '));
  const iStamp = saveImpl.indexOf('stampPersistChanges');
  const iStr = saveImpl.indexOf('JSON.stringify(window.D)');
  assert(iStamp > 0 && iStr > iStamp, 'save : horodatage avant sérialisation');
  assert(/writeLocalProfileData\(sessionPid, window\.D, \{ payload: payload \}\)/.test(saveImpl), 'save : sérialisation unique passée à writeLocal');
  assert(/window\._persistIndex = nextPersistIndex/.test(saveImpl), 'save : index mis à jour après écriture réussie');
  {
    const iReset = appSrc.indexOf('window.resetPersistIndex();\n  if (window.TabLock');
    const iMerge = appSrc.indexOf('if (window._bootLocalAhead) {', iReset);
    assert(iReset > 0 && iMerge > iReset && iMerge - iReset < 600, 'initApp : index initialisé puis fusion local en avance');
  }
  assert(/!window\._bootLocalAhead && window\.ProfilesIO/.test(appSrc), 'initApp : pas de miroir cloud→local si local en avance');
  const ds = fs.readFileSync(path.join(root, 'device-session.js'), 'utf8');
  assert((ds.match(/resetPersistIndex/g) || []).length >= 2, 'Secondaire : index réinitialisé sur données reçues');
}

async function main() {
  console.log('=== Synchronisation : suppressions, _mt, fusion ===');
  testDeletionPropagates();
  testEditAfterDeleteWins();
  testNewestEditWins();
  testCardProgressNeverLost();
  testSettingsNewest();
  testDeleteLastContent();
  testReAddRemovesTombstone();
  testMoveIsNotDelete();
  testLegacyCompat();
  testProfileIsolation();
  await testBootLocalAhead();
  testTombstonePrune();
  testWiring();
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) console.error('Échecs:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
