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
  const env = baseEnv(store, fsMock);
  env.getDoc = fsMock.getDoc;
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
  const { DS, PIO } = loadModules(env);

  await DS.start('uid1');
  await DS.switchToSecondary();

  // Coquille plus VIEILLE + allowEmpty → refus
  const oldShell = { ...shell(), meta: { updatedAt: Date.now() - 60000, revision: 2, profileGeneration: 1 } };
  assert(PIO.writeLocalProfileData('default', oldShell, { allowEmpty: true }) === false, 'DS4: shell plus vieille refusée même allowEmpty');
  assert(PIO.readLocalProfileData('default').cours.length === 3, 'DS4: 3 cours conservés');

  // Coquille plus RÉCENTE (reset primary) → miroir OK
  const newShell = { ...shell(), meta: { updatedAt: Date.now() + 1000, revision: 3, profileGeneration: 1 } };
  fsMock.docs.set('utilisateurs/uid1/profiles/default', newShell);
  DS.watchUserData(env.docRef);
  await new Promise((r) => setTimeout(r, 40));
  const after = PIO.readLocalProfileData('default');
  assert((after.cours || []).length === 0, 'DS4: shell plus récente appliquée (reset primary)');
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

async function main() {
  console.log('=== Preuves adversatives DeviceSession ===');
  await pocJoinGate();
  await pocJoinFailClosed();
  await pocSecondaryNoRecreate();
  await pocSecondaryMirrorAllowEmpty();
  await pocCreateRace();
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
