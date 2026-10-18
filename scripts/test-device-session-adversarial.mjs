/**
 * Preuves adversatives DeviceSession — chemins wipe / faux-PRIMARY / anti-recréation.
 * Chaque cas exécute le vrai module (vm) avec Firestore stub.
 * Usage: node scripts/test-device-session-adversarial.mjs
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
  const keyFromRef = (ref) => (typeof ref === 'string' ? ref : ref._path);
  return {
    docs,
    doc(db, ...segments) {
      return { _path: segments.join('/'), id: segments[segments.length - 1] };
    },
    async getDoc(ref) {
      const k = keyFromRef(ref);
      if (!docs.has(k)) return { exists: () => false, data: () => null };
      return { exists: () => true, data: () => JSON.parse(JSON.stringify(docs.get(k))) };
    },
    async setDoc(ref, data) {
      docs.set(keyFromRef(ref), JSON.parse(JSON.stringify(data)));
    },
    async updateDoc(ref, data) {
      const k = keyFromRef(ref);
      if (!docs.has(k)) {
        const err = new Error('not-found');
        err.code = 'not-found';
        throw err;
      }
      docs.set(k, { ...docs.get(k), ...JSON.parse(JSON.stringify(data)) });
    },
    async deleteDoc(ref) { docs.delete(keyFromRef(ref)); },
    onSnapshot(ref, okCb, errCb) {
      const k = keyFromRef(ref);
      queueMicrotask(() => {
        try {
          if (!docs.has(k)) okCb({ exists: () => false, data: () => null });
          else okCb({ exists: () => true, data: () => JSON.parse(JSON.stringify(docs.get(k))) });
        } catch (e) {
          if (errCb) errCb(e);
        }
      });
      return () => {};
    }
  };
}

function loadModules(env) {
  const sandbox = {
    window: env,
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Math,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Error,
    TypeError,
    navigator: { userAgent: 'NodeTest/1.0 Chrome/120' },
    document: {
      visibilityState: 'visible',
      addEventListener() {},
      removeEventListener() {},
      querySelector() { return null; },
      getElementById() { return null; },
      querySelectorAll() { return []; }
    },
    localStorage: env.localStorage,
    crypto: { randomUUID: () => 'dev-test-' + Math.random().toString(36).slice(2) },
    Blob: class { constructor(parts) { this.size = parts.reduce((n, p) => n + String(p).length, 0); } }
  };
  sandbox.globalThis = sandbox;
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.crypto = sandbox.crypto;
  sandbox.window.addEventListener = () => {};
  sandbox.window.removeEventListener = () => {};
  sandbox.window.localStorage = env.localStorage;
  // Empêcher le DOM UI de faire planter les PoCs
  env.renderDeviceSessionPanel = () => {};
  env.applyDeviceRoleUi = () => {};
  env.renderDeviceSecondarySession = () => {};
  sandbox.window.renderDeviceSessionPanel = env.renderDeviceSessionPanel;
  sandbox.window.applyDeviceRoleUi = env.applyDeviceRoleUi;
  sandbox.window.renderDeviceSecondarySession = env.renderDeviceSecondarySession;

  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'profiles-io.js'), 'utf8'),
    sandbox,
    { filename: 'profiles-io.js' }
  );
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'device-session.js'), 'utf8'),
    sandbox,
    { filename: 'device-session.js' }
  );
  // device-session.js redéfinit les helpers DOM — neutraliser après load
  sandbox.window.renderDeviceSessionPanel = () => {};
  sandbox.window.applyDeviceRoleUi = () => {};
  sandbox.window.renderDeviceSecondarySession = () => {};
  env.renderDeviceSessionPanel = sandbox.window.renderDeviceSessionPanel;
  env.applyDeviceRoleUi = sandbox.window.applyDeviceRoleUi;
  return { PIO: env.ProfilesIO, DS: sandbox.window.DeviceSession || env.DeviceSession, sandbox };
}

function rich(n, gen) {
  const cours = [];
  for (let i = 0; i < n; i++) cours.push({ uid: 'U' + i, titre: 'C' + i });
  return {
    settings: {}, matieres: [], classeurs: [], cours, exercices: [], devoirs: [],
    meta: { updatedAt: Date.now() - 5000, profileGeneration: gen, revision: 1 }
  };
}

function shell() {
  return {
    settings: { userName: 'Étudiant' },
    matieres: [{ id: 'PHYS', name: 'Physique' }],
    classeurs: [],
    cours: [], exercices: [], devoirs: [],
    meta: { updatedAt: 1, revision: 0 }
  };
}

function baseEnv(store, fsMock, opts = {}) {
  const env = {
    localStorage: store,
    safeLocalGet: (k) => store.getItem(k),
    safeLocalSet: (k, v) => { store.setItem(k, v); return true; },
    safeLocalRemove: (k) => { store.removeItem(k); return true; },
    isLocalMode: !!opts.isLocalMode,
    cloudConnected: opts.cloudConnected !== undefined ? opts.cloudConnected : true,
    currentUser: opts.user || { sub: 'uid1', email: 'a@b.c' },
    emptyData: { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [] },
    D: null,
    db: {},
    doc: fsMock.doc.bind(fsMock),
    getDoc: fsMock.getDoc.bind(fsMock),
    setDoc: fsMock.setDoc.bind(fsMock),
    updateDoc: fsMock.updateDoc.bind(fsMock),
    deleteDoc: fsMock.deleteDoc.bind(fsMock),
    onSnapshot: fsMock.onSnapshot.bind(fsMock),
    docRef: null,
    _activeProfileId: 'default',
    location: { reload() { env._reloaded = true; } },
    _reloaded: false,
    _allowEmptyProfileWrite: false
  };
  env.D = JSON.parse(JSON.stringify(env.emptyData));
  return env;
}

function seedAccount(store, fsMock) {
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', generation: 1 }],
    deletedProfiles: {}
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', generation: 1 }]
  }));
  store.setItem('active_profile', 'default');
}

// ─── DS1: canFullSave false tant que join non résolu ───
async function pocJoinGate() {
  console.log('\n[DS1] canFullSave bloqué pendant join non résolu');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);

  let releaseHub;
  const hubBarrier = new Promise((r) => { releaseHub = r; });
  const origGet = fsMock.getDoc.bind(fsMock);
  fsMock.getDoc = async (ref) => {
    if (String(ref._path || '').includes('/presence/')) {
      await hubBarrier;
    }
    return origGet(ref);
  };

  const env = baseEnv(store, fsMock);
  env.getDoc = fsMock.getDoc;
  const { DS } = loadModules(env);
  assert(!!DS, 'DS1: DeviceSession chargé');

  const startP = DS.start('uid1');
  // Laisser le 1er getDoc atteindre la barrière
  await new Promise((r) => setTimeout(r, 20));
  assert(DS.getStatus().enabled === true, 'DS1: session enabled');
  assert(DS.getStatus().joinResolved === false, 'DS1: join pas encore résolu');
  assert(DS.canFullSave() === false, 'DS1: canFullSave false pendant join');

  releaseHub();
  await startP;
  DS.stop();
}

// ─── DS2: erreur join → SECONDARY fail-closed (pas faux PRIMARY) ───
async function pocJoinFailClosed() {
  console.log('\n[DS2] resolveJoin en erreur → secondary + needsRoleChoice');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  fsMock.getDoc = async (ref) => {
    if (String(ref._path || '').includes('/presence/')) {
      throw new Error('permission-denied');
    }
    return { exists: () => false, data: () => null };
  };
  const realOnSnapshot = fsMock.onSnapshot.bind(fsMock);
  // Présence illisible = lecture ET écoute refusées (comme Firestore réel).
  fsMock.onSnapshot = (ref, okCb, errCb) => {
    if (String(ref._path || '').includes('/presence/')) {
      queueMicrotask(() => { if (errCb) errCb(new Error('permission-denied')); });
      return () => {};
    }
    return realOnSnapshot(ref, okCb, errCb);
  };
  const env = baseEnv(store, fsMock);
  env.getDoc = fsMock.getDoc;
  env.onSnapshot = fsMock.onSnapshot;
  const { DS } = loadModules(env);

  await DS.start('uid1');
  const st = DS.getStatus();
  assert(st.joinResolved === true, 'DS2: joinResolved');
  assert(st.isSecondary === true, 'DS2: rôle secondary');
  assert(st.needsRoleChoice === true, 'DS2: needsRoleChoice (pas primary silencieux)');
  assert(DS.canFullSave() === false, 'DS2: canFullSave false après fail-closed');
  DS.stop();
}

// ─── DS3: SECONDARY ne recrée pas un blob manquant ───
async function pocSecondaryNoRecreate() {
  console.log('\n[DS3] saveSecondaryPatch refuse blob absent (anti-recréation)');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  // Hub avec un autre primary vivant → on devient secondary
  const t = Date.now();
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: {
      'other-dev': { label: 'PC', role: 'primary', lastSeen: t }
    },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  // Pas de blob profil
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  const { DS, PIO } = loadModules(env);
  assert(!!PIO, 'DS3: ProfilesIO');

  await DS.start('uid1');
  // Choix rôle : rester secondary
  if (typeof DS.switchToSecondary === 'function') {
    await DS.switchToSecondary();
  }
  assert(DS.canSecondaryPatch() === true, 'DS3: patch secondary dispo');

  let err = null;
  try {
    await DS.saveSecondaryPatch((data) => { data.openTabs = ['x']; });
  } catch (e) {
    err = e;
  }
  assert(!!err && /absent|anti-recréation|refusé/i.test(String(err.message)), 'DS3: erreur anti-recréation');
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/default'), 'DS3: aucun blob créé');
  DS.stop();
}

// ─── DS4: miroir secondary — allowEmpty seulement si cloud plus récent ───
async function pocSecondaryMirrorAllowEmpty() {
  console.log('\n[DS4] watchUserData secondary : shell plus récente vide le local ; shell plus vieille refusée');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const localRich = rich(3, 1);
  localRich.meta.updatedAt = Date.now() - 10000;
  store.setItem('backup_local_cours__default', JSON.stringify(localRich));
  const t = Date.now();
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });

  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(localRich));
  const { DS, PIO } = loadModules(env);

  await DS.start('uid1');
  await DS.switchToSecondary();

  // Coquille plus VIEILLE + allowEmpty → refus
  const oldShell = { ...shell(), meta: { updatedAt: Date.now() - 60000, revision: 2, profileGeneration: 1 } };
  assert(PIO.writeLocalProfileData('default', oldShell, { allowEmpty: true }) === false, 'DS4: shell plus vieille refusée même allowEmpty');
  assert(PIO.readLocalProfileData('default').cours.length === 3, 'DS4: 3 cours conservés');

  // Coquille plus RÉCENTE avec traces (vrai reset Principal) → miroir OK
  const newShell = { ...shell(), meta: { updatedAt: Date.now() + 1000, revision: 3, profileGeneration: 1, deleted: { 'c:U0': Date.now(), 'c:U1': Date.now(), 'c:U2': Date.now() } } };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', newShell);
  DS.watchUserData(env.docRef);
  await new Promise((r) => setTimeout(r, 40));
  const after = PIO.readLocalProfileData('default');
  assert((after.cours || []).length === 0, 'DS4: shell plus récente appliquée (reset primary)');
  DS.stop();
}

async function pocPoisonEmptyDoesNotWipeExclusive() {
  console.log('\n[DS13] watchUserData : coquille vide sans traces n’écrase pas les cours locaux');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const localRich = rich(3, 1);
  localRich.meta.updatedAt = Date.now() - 10000;
  store.setItem('backup_local_cours__default', JSON.stringify(localRich));
  const t = Date.now();
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(localRich));
  env.mergeRemoteProfileIntoLocal = function () { env._merged = true; };
  const { DS, PIO } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  const poison = { ...shell(), meta: { updatedAt: Date.now() + 1000, revision: 9, profileGeneration: 1 } };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', poison);
  DS.watchUserData(env.docRef);
  await new Promise((r) => setTimeout(r, 40));
  assert(env._merged === true, 'DS13: fusion au lieu d’un miroir vide');
  assert((env.D.cours || []).length === 3, 'DS13: 3 cours encore en mémoire');
  assert((PIO.readLocalProfileData('default').cours || []).length === 3, 'DS13: 3 cours encore en localStorage');
  DS.stop();
}

// ─── DS5: create TOCTOU — blob riche injecté entre assert et setDoc ───
async function pocCreateRace() {
  console.log('\n[DS5/PoC10] Create : collision mid-flight n’écrase pas blob riche');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  fsMock.docs.set('utilisateurs/uid1/profiles/default', shell());

  const env = baseEnv(store, fsMock);
  const { PIO } = loadModules(env);

  const origGet = fsMock.getDoc.bind(fsMock);
  let profileGets = 0;
  fsMock.getDoc = async (ref) => {
    const pathStr = String(ref._path || '');
    const snap = await origGet(ref);
    // Après la 1ʳᵉ lecture blob « labo » (pré-check), un autre device publie un labo riche
    if (pathStr.endsWith('/profiles/labo')) {
      profileGets += 1;
      if (profileGets === 1) {
        // Première lecture : vide → create continue
        return snap;
      }
      // Lectures suivantes (race check) : riche
      return {
        exists: () => true,
        data: () => rich(6, 9)
      };
    }
    return snap;
  };
  env.getDoc = fsMock.getDoc;

  let err = null;
  try {
    await PIO.createProfile('Labo', { copyFromActive: false });
  } catch (e) {
    err = e;
  }
  assert(!!err && /Collision|existe déjà/i.test(String(err.message)), 'DS5: création annulée sur collision');
  // setDoc ne doit pas avoir écrit une coquille par-dessus — le mock renvoie riche sans l’écrire dans docs ;
  // vérifier qu’on n’a PAS écrit une coquille dans docs si une entrée labo a été posée.
  const written = fsMock.docs.get('utilisateurs/uid1/profiles/labo');
  assert(!written || (written.cours && written.cours.length >= 6), 'DS5: pas de coquille écrite sur labo');
}

// ─── DS6: claimPrimary échoué → SECONDARY (pas faux PRIMARY) ───
async function pocClaimPrimaryFailClosed() {
  console.log('\n[DS6] claimPrimary : écriture hub en échec → secondary (pas faux primary)');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: {
      'other-dev': { label: 'PC', role: 'primary', lastSeen: t }
    },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  const { DS } = loadModules(env);
  await DS.start('uid1');
  if (typeof DS.switchToSecondary === 'function') await DS.switchToSecondary();
  assert(DS.canFullSave() === false, 'DS6: secondary avant claim');

  const origSet = fsMock.setDoc.bind(fsMock);
  fsMock.setDoc = async (ref, data) => {
    if (String(ref._path || '').includes('/presence/')) {
      throw new Error('permission-denied');
    }
    return origSet(ref, data);
  };
  env.setDoc = fsMock.setDoc;

  const st = await DS.claimPrimary();
  assert(st.isPrimary !== true && st.isSecondary === true, 'DS6: claim échoué → secondary');
  assert(DS.canFullSave() === false, 'DS6: canFullSave false après claim échoué');
  const hub = fsMock.docs.get('utilisateurs/uid1/presence/hub');
  assert(hub && hub.primaryDeviceId === 'other-dev', 'DS6: hub non écrasé');
  DS.stop();
}

// ─── DS7: 1er snapshot présence depuis le cache (hors ligne) ≠ hub vide ───
async function pocJoinIgnoresCacheSnapshot() {
  console.log('\n[DS7] snapshot présence fromCache « absent » → pas de faux PRIMARY');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const realOnSnapshot = fsMock.onSnapshot.bind(fsMock);
  fsMock.onSnapshot = (ref, okCb, errCb) => {
    if (String(ref._path || '').includes('/presence/')) {
      queueMicrotask(() => okCb({ metadata: { fromCache: true }, exists: () => false, data: () => null }));
      return () => {};
    }
    return realOnSnapshot(ref, okCb, errCb);
  };
  const env = baseEnv(store, fsMock);
  env.onSnapshot = fsMock.onSnapshot;
  const { DS } = loadModules(env);
  await DS.start('uid1');
  const st = DS.getStatus();
  assert(st.isSecondary === true, 'DS7: secondary (Principal distant lu sur le serveur)');
  assert(DS.canFullSave() === false, 'DS7: pas de sauvegarde complète');
  const hub = fsMock.docs.get('utilisateurs/uid1/presence/hub');
  assert(hub && hub.primaryDeviceId === 'other-dev', 'DS7: Principal distant conservé');
  DS.stop();
}

async function pocLateJoinAfterTimeout() {
  console.log('\n[DS8] présence lue après le délai de 8 s → reste Secondaire (pas de PRIMARY tardif)');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const realOnSnapshot = fsMock.onSnapshot.bind(fsMock);
  fsMock.onSnapshot = (ref, okCb, errCb) => {
    if (String(ref._path || '').includes('/presence/')) return () => {};
    return realOnSnapshot(ref, okCb, errCb);
  };
  const realGetDoc = fsMock.getDoc.bind(fsMock);
  fsMock.getDoc = (ref) => {
    if (String(ref._path || '').includes('/presence/')) {
      return new Promise((resolve) => setTimeout(() => resolve(realGetDoc(ref)), 3990));
    }
    return realGetDoc(ref);
  };
  const env = baseEnv(store, fsMock);
  env.onSnapshot = fsMock.onSnapshot;
  env.getDoc = fsMock.getDoc;
  const { DS } = loadModules(env);
  await DS.start('uid1');
  assert(DS.getStatus().isSecondary === true, 'DS8: délai dépassé → Secondaire');
  await new Promise((r) => setTimeout(r, 900));
  const st = DS.getStatus();
  assert(st.isSecondary === true && st.needsRoleChoice === true, 'DS8: toujours Secondaire après la lecture tardive');
  const hub = fsMock.docs.get('utilisateurs/uid1/presence/hub');
  assert(!hub || hub.primaryDeviceId !== DS.getDeviceId(), 'DS8: aucune revendication PRIMARY écrite après coup');
  DS.stop();
}

async function pocSecondaryPatchKeepsExclusive() {
  console.log('\n[DS11] patch Secondaire : un cours local absent du cloud n’est pas jeté');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const cloud = rich(3, 1);
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(cloud));
  env.D.cours.push({ uid: 'PH-OFF', title: 'Hors ligne' });
  store.setItem('backup_local_cours__default', JSON.stringify(env.D));
  const { DS, PIO } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  await DS.saveSecondaryPatch(function (data) { data.openTabs = ['printed']; });
  assert((env.D.cours || []).some((c) => c.uid === 'PH-OFF'), 'DS11: cours hors ligne encore en mémoire');
  assert((PIO.readLocalProfileData('default').cours || []).some((c) => c.uid === 'PH-OFF'), 'DS11: cours hors ligne encore en localStorage');
  const afterCloud = fsMock.docs.get('utilisateurs/uid1/profiles/default');
  assert(!(afterCloud.cours || []).some((c) => c.uid === 'PH-OFF'), 'DS11: le patch n’envoie pas le cours sur le cloud (rôle Secondaire)');
  assert(afterCloud.openTabs && afterCloud.openTabs[0] === 'printed', 'DS11: le patch Principal (openTabs) est bien écrit');
  assert(PIO.getCloudConfirmedRev('default') == null, 'DS11: rév. cloud non confirmée tant que le cours hors ligne n’est pas parti');
  DS.stop();
}

async function pocSecondaryPatchDoesNotResurrect() {
  console.log('\n[DS12] patch Secondaire : un cours tracé comme supprimé n’est pas ressuscité');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const cloud = rich(3, 1);
  cloud.meta.deleted = { 'c:DEAD1': t - 1000 };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(cloud));
  env.D.cours.push({ uid: 'DEAD1', titre: 'Fantôme' });
  store.setItem('backup_local_cours__default', JSON.stringify(env.D));
  const { DS, PIO } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  await DS.saveSecondaryPatch(function (data) { data.openTabs = ['x']; });
  assert(!(env.D.cours || []).some((c) => c.uid === 'DEAD1'), 'DS12: cours tombstoné absent de la mémoire');
  assert(!(PIO.readLocalProfileData('default').cours || []).some((c) => c.uid === 'DEAD1'), 'DS12: cours tombstoné absent du localStorage');
  DS.stop();
}

async function pocWatchIgnoresCacheAndKeepsExclusive() {
  console.log('\n[DS10] watchUserData : ignore fromCache ; conserve un cours local absent du cloud');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const local = rich(3, 1);
  local.cours.push({ uid: 'PH-OFF', title: 'Hors ligne' });
  local.meta = { revision: 60, updatedAt: t, profileGeneration: 1 };
  store.setItem('backup_local_cours__default', JSON.stringify(local));
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const cloud = rich(3, 1);
  cloud.meta = { revision: 60, updatedAt: t - 1000, profileGeneration: 1 };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);

  const env = baseEnv(store, fsMock);
  env._activeProfileId = 'default';
  env.D = JSON.parse(JSON.stringify(local));
  env.mergeRemoteProfileIntoLocal = function () { env._merged = true; };
  const origOn = env.onSnapshot;
  let cacheFired = false;
  env.onSnapshot = (ref, okCb, errCb) => {
    const path = String(ref && ref._path || '');
    if (path.includes('/profiles/')) {
      queueMicrotask(() => {
        cacheFired = true;
        okCb({
          metadata: { fromCache: true },
          exists: () => true,
          data: () => ({ ...shell(), meta: { revision: 1, updatedAt: 1, profileGeneration: 1 } })
        });
      });
      return () => {};
    }
    return origOn(ref, okCb, errCb);
  };
  const { DS, PIO } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  DS.watchUserData(env.docRef || fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default'));
  await new Promise((r) => setTimeout(r, 40));
  assert(cacheFired, 'DS10: snapshot cache émis');
  assert((env.D.cours || []).some((c) => c.uid === 'PH-OFF'), 'DS10: fromCache n’écrase pas le cours hors ligne');
  assert((PIO.readLocalProfileData('default').cours || []).some((c) => c.uid === 'PH-OFF'), 'DS10: localStorage intact après fromCache');

  env.onSnapshot = origOn;
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  const env2 = baseEnv(store, fsMock);
  env2._activeProfileId = 'default';
  env2.D = JSON.parse(JSON.stringify(local));
  env2.mergeRemoteProfileIntoLocal = function () { env2._merged = true; };
  const { DS: DS2, PIO: PIO2 } = loadModules(env2);
  await DS2.start('uid1');
  await DS2.switchToSecondary();
  env2.docRef = fsMock.doc(env2.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  DS2.watchUserData(env2.docRef);
  await new Promise((r) => setTimeout(r, 40));
  assert(env2._merged === true, 'DS10: snapshot serveur fusionné (pas d’assignation brute)');
  assert((env2.D.cours || []).some((c) => c.uid === 'PH-OFF'), 'DS10: cours hors ligne encore en mémoire');
  assert((PIO2.readLocalProfileData('default').cours || []).some((c) => c.uid === 'PH-OFF'), 'DS10: cours hors ligne encore en localStorage');
  DS.stop();
  DS2.stop();
}

async function pocWatchKeepsLocalAheadDeletion() {
  console.log('\n[DS14] watchUserData : une suppression locale non sync n’est pas annulée par le cloud');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const local = rich(3, 1);
  local.cours = local.cours.filter((c) => c.uid !== 'U0');
  local.meta.deleted = { 'c:U0': t };
  local.meta.revision = 5;
  local.meta.updatedAt = t;
  store.setItem('backup_local_cours__default', JSON.stringify(local));
  const cloud = rich(3, 1);
  cloud.meta = { revision: 9, updatedAt: t + 1000, profileGeneration: 1 };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(local));
  const { DS, PIO } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  DS.watchUserData(env.docRef);
  await new Promise((r) => setTimeout(r, 40));
  assert(!(env.D.cours || []).some((c) => c.uid === 'U0'), 'DS14: U0 reste absent de la mémoire');
  assert(!!(env.D.meta && env.D.meta.deleted && env.D.meta.deleted['c:U0']), 'DS14: trace locale conservée');
  assert((env.D.cours || []).length === 2, 'DS14: les 2 autres cours restent');
  assert(!(PIO.readLocalProfileData('default').cours || []).some((c) => c.uid === 'U0'), 'DS14: U0 absent du localStorage');
  assert(PIO.getCloudConfirmedRev('default') == null, 'DS14: rév. non confirmée (traces locales hors cloud)');
  DS.stop();
}

async function pocWatchKeepsNewerSharedEdit() {
  console.log('\n[DS15] watchUserData : un titre local plus récent n’est pas écrasé');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const local = rich(3, 1);
  local.cours[0].titre = 'Titre local';
  local.cours[0]._mt = t;
  local.meta.revision = 5;
  local.meta.updatedAt = t;
  const cloud = rich(3, 1);
  cloud.cours[0].titre = 'Titre cloud';
  cloud.cours[0]._mt = t - 8000;
  cloud.meta = { revision: 9, updatedAt: t + 1000, profileGeneration: 1 };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(local));
  const { DS } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  DS.watchUserData(env.docRef);
  await new Promise((r) => setTimeout(r, 40));
  assert(env.D.cours[0].titre === 'Titre local', 'DS15: titre local plus récent conservé');
  DS.stop();
}

async function pocSecondaryPatchKeepsNewerSharedAndDoesNotConfirmKeepRev() {
  console.log('\n[DS16] patch Secondaire : titre local plus récent gardé, rév. locale non confirmée');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const cloud = rich(3, 1);
  cloud.cours[0].titre = 'Titre cloud';
  cloud.cours[0]._mt = t - 8000;
  cloud.meta.revision = 40;
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(cloud));
  env.D.cours[0].titre = 'Titre local';
  env.D.cours[0]._mt = t;
  env.D.meta.revision = 60;
  store.setItem('backup_local_cours__default', JSON.stringify(env.D));
  const { DS, PIO } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  await DS.saveSecondaryPatch(function (data) { data.openTabs = ['printed']; });
  assert(env.D.cours[0].titre === 'Titre local', 'DS16: titre local plus récent encore en mémoire');
  assert((PIO.readLocalProfileData('default').cours || [])[0].titre === 'Titre local', 'DS16: titre local encore en localStorage');
  assert(env.D.openTabs && env.D.openTabs[0] === 'printed', 'DS16: patch openTabs visible en mémoire');
  const afterCloud = fsMock.docs.get('utilisateurs/uid1/profiles/default');
  assert(afterCloud.openTabs && afterCloud.openTabs[0] === 'printed', 'DS16: patch écrit sur le cloud');
  assert(afterCloud.cours[0].titre === 'Titre cloud', 'DS16: le patch n’envoie pas le titre local (rôle Secondaire)');
  assert(Number(env.D.meta.revision) >= 60, 'DS16: révision locale ne recule pas');
  assert(PIO.getCloudConfirmedRev('default') !== 60, 'DS16: rév. 60 locale jamais confirmée comme ack cloud');
  DS.stop();
}

async function pocSecondaryPatchDoesNotConfirmKeepRevWithoutOverlay() {
  console.log('\n[DS17] patch Secondaire : rév. locale en avance jamais confirmée même sans _mt plus récent');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const cloud = rich(3, 1);
  cloud.meta.revision = 40;
  fsMock.docs.set('utilisateurs/uid1/profiles/default', cloud);
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(cloud));
  env.D.meta.revision = 60;
  store.setItem('backup_local_cours__default', JSON.stringify(env.D));
  const { DS, PIO } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  await DS.saveSecondaryPatch(function (data) { data.openTabs = ['x']; });
  assert(Number(env.D.meta.revision) >= 60, 'DS17: révision locale ne recule pas');
  assert(PIO.getCloudConfirmedRev('default') !== 60, 'DS17: rév. 60 jamais confirmée');
  DS.stop();
}

async function pocWatchKeepsLocalRevAheadEmptyShell() {
  console.log('\n[DS18] watchUserData : rév. locale > cloud, coquille sans traces → pas de miroir');
  const store = makeStore();
  const fsMock = makeFirestore();
  seedAccount(store, fsMock);
  const t = Date.now();
  const local = {
    settings: { userName: 'Moi' },
    matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [],
    meta: { revision: 8, updatedAt: t - 1000, profileGeneration: 1 }
  };
  store.setItem('backup_local_cours__default', JSON.stringify(local));
  fsMock.docs.set('utilisateurs/uid1/presence/hub', {
    devices: { 'other-dev': { label: 'PC', role: 'primary', lastSeen: t } },
    primaryDeviceId: 'other-dev',
    primaryUpdatedAt: t,
    primaryClaimedAt: t,
    updatedAt: t
  });
  const env = baseEnv(store, fsMock);
  env.docRef = fsMock.doc(env.db, 'utilisateurs', 'uid1', 'profiles', 'default');
  env.D = JSON.parse(JSON.stringify(local));
  env.mergeRemoteProfileIntoLocal = function () { env._merged = true; };
  const { DS } = loadModules(env);
  await DS.start('uid1');
  await DS.switchToSecondary();
  const poison = { ...shell(), meta: { updatedAt: t - 5000, revision: 2, profileGeneration: 1 } };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', poison);
  DS.watchUserData(env.docRef);
  await new Promise((r) => setTimeout(r, 40));
  assert(env._merged === true, 'DS18: fusion (rév. locale en avance) au lieu d’un miroir');
  assert(env.D.settings && env.D.settings.userName === 'Moi', 'DS18: réglages locaux conservés');
  DS.stop();
}

async function pocStaleHeartbeatDoesNotReclaim() {
  console.log('\n[DS9] heartbeat d’un Principal gelé n’écrase pas le claim d’un autre appareil');
  const fsMock = makeFirestore();
  const storeA = makeStore();
  const storeB = makeStore();
  seedAccount(storeA, fsMock);
  seedAccount(storeB, fsMock);
  storeA.setItem('mc_device_id', 'dev-A');
  storeB.setItem('mc_device_id', 'dev-B');
  const envA = baseEnv(storeA, fsMock);
  const envB = baseEnv(storeB, fsMock);
  const { DS: DSA } = loadModules(envA);
  await DSA.start('uid1');
  assert(DSA.getStatus().isPrimary === true, 'DS9: A Principal au départ');
  const { DS: DSB } = loadModules(envB);
  await DSB.start('uid1');
  assert(DSB.getStatus().isSecondary === true, 'DS9: B Secondaire');
  await DSB.claimPrimary();
  assert(DSB.getStatus().isPrimary === true, 'DS9: B a pris le contrôle');
  const hubAfter = fsMock.docs.get('utilisateurs/uid1/presence/hub');
  assert(hubAfter.primaryDeviceId === 'dev-B', 'DS9: hub cloud = B');
  await DSA._heartbeat();
  const hubAfterHb = fsMock.docs.get('utilisateurs/uid1/presence/hub');
  assert(hubAfterHb.primaryDeviceId === 'dev-B', 'DS9: heartbeat A n’a pas réécrit le Principal');
  assert(DSA.getStatus().isSecondary === true, 'DS9: A rétrogradé après relecture serveur');
  DSA.stop();
  DSB.stop();
}

async function main() {
  console.log('=== Preuves adversatives DeviceSession ===');
  await pocJoinGate();
  await pocJoinFailClosed();
  await pocJoinIgnoresCacheSnapshot();
  await pocLateJoinAfterTimeout();
  await pocStaleHeartbeatDoesNotReclaim();
  await pocSecondaryNoRecreate();
  await pocSecondaryMirrorAllowEmpty();
  await pocPoisonEmptyDoesNotWipeExclusive();
  await pocSecondaryPatchKeepsExclusive();
  await pocSecondaryPatchDoesNotResurrect();
  await pocWatchIgnoresCacheAndKeepsExclusive();
  await pocWatchKeepsLocalAheadDeletion();
  await pocWatchKeepsNewerSharedEdit();
  await pocSecondaryPatchKeepsNewerSharedAndDoesNotConfirmKeepRev();
  await pocSecondaryPatchDoesNotConfirmKeepRevWithoutOverlay();
  await pocWatchKeepsLocalRevAheadEmptyShell();
  await pocCreateRace();
  await pocClaimPrimaryFailClosed();
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.error('Échecs:\n' + failures.map((f) => ' - ' + f).join('\n'));
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
