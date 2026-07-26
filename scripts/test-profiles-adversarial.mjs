/**
 * Preuves adversatives exécutables — conservation multi-profils / multi-appareils.
 * Chaque cas tente une perte de données réelle ; un assert qui passe = le scénario est bloqué.
 * Usage: node scripts/test-profiles-adversarial.mjs
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
    async deleteDoc(ref) { docs.delete(keyFromRef(ref)); },
    async runTransaction(db, fn) {
      const tx = {
        async get(ref) {
          const k = keyFromRef(ref);
          if (!docs.has(k)) return { exists: () => false, data: () => null };
          return { exists: () => true, data: () => JSON.parse(JSON.stringify(docs.get(k))) };
        },
        set(ref, data) { docs.set(keyFromRef(ref), JSON.parse(JSON.stringify(data))); }
      };
      await fn(tx);
    }
  };
}

function loadPIO(env) {
  const code = fs.readFileSync(path.join(root, 'profiles-io.js'), 'utf8');
  const sandbox = {
    window: env, console, Date, JSON, Object, Array, String, Number, Math,
    Promise, setTimeout, clearTimeout, Error,
    Blob: class { constructor(parts) { this.size = parts.reduce((n, p) => n + String(p).length, 0); } }
  };
  sandbox.window = env;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'profiles-io.js' });
  return env.ProfilesIO;
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
    D: null, db: {},
    doc: fsMock.doc.bind(fsMock),
    getDoc: fsMock.getDoc.bind(fsMock),
    setDoc: fsMock.setDoc.bind(fsMock),
    deleteDoc: fsMock.deleteDoc.bind(fsMock),
    runTransaction: fsMock.runTransaction.bind(fsMock),
    location: { reload() { env._reloaded = true; } },
    _reloaded: false,
    _allowEmptyProfileWrite: false
  };
  env.D = JSON.parse(JSON.stringify(env.emptyData));
  return env;
}

function rich(n, gen) {
  const cours = [];
  for (let i = 0; i < n; i++) cours.push({ uid: 'U' + i, titre: 'C' + i });
  return {
    settings: {}, matieres: [], classeurs: [], cours, exercices: [], devoirs: [],
    meta: { updatedAt: Date.now() - 5000, profileGeneration: gen }
  };
}

function shell() {
  return {
    settings: { userName: 'Étudiant' },
    matieres: [{ id: 'PHYS', name: 'Physique' }, { id: 'MATH', name: 'Maths' }],
    classeurs: [{ id: 'A', name: 'A' }],
    cours: [], exercices: [], devoirs: [],
    meta: { updatedAt: 1 }
  };
}

// ─── 1. Create sur appareil périmé n’écrase pas un labo cloud riche ───
async function pocCreateClobber() {
  console.log('\n[PoC1] Create « Labo » depuis registre local incomplet');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 90000, generation: 5 }
    ],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/labo', rich(5, 5));
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }]
  }));
  store.setItem('active_profile', 'default');
  const env = baseEnv(store, fsMock);
  const PIO = loadPIO(env);
  let err = null;
  try { await PIO.createProfile('Labo', { copyFromActive: false }); }
  catch (e) { err = e; }
  const blob = fsMock.docs.get('utilisateurs/uid1/profiles/labo');
  assert(blob && blob.cours && blob.cours.length === 5, 'PoC1: blob labo toujours 5 cours');
  assert(blob.cours[0].uid === 'U0', 'PoC1: U0 intact');
  const usedAlt = PIO.listProfiles().some((p) => p.id === 'labo-2');
  assert(!!err || usedAlt, 'PoC1: création refusée ou id labo-2');
}

// ─── 2. Cloud vide + local riche → local gagne, cloud réparé ───
async function pocEmptyCloudVsRichLocal() {
  console.log('\n[PoC2] Cloud coquille vs local riche');
  const store = makeStore();
  const fsMock = makeFirestore();
  const local = rich(4, 1);
  local.meta.updatedAt = Date.now();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-26T12:00:00.000Z',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', bytes: 10, generation: 1 }],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/default', shell());
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', generation: 1 }]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__default', JSON.stringify(local));
  const env = baseEnv(store, fsMock);
  const PIO = loadPIO(env);
  const r = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(r.data && r.data.cours.length === 4, 'PoC2: resolve retourne 4 cours locaux');
  const cloud = fsMock.docs.get('utilisateurs/uid1/profiles/default');
  assert(cloud.cours && cloud.cours.length === 4, 'PoC2: cloud réparé à 4 cours');
}

// ─── 3. Suppressions intentionnelles (cloud plus récent, moins de cours) ───
async function pocIntentionalDeletes() {
  console.log('\n[PoC3] Cloud plus récent avec 1 cours vs local vieux avec 3');
  const store = makeStore();
  const fsMock = makeFirestore();
  const now = Date.now();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', generation: 1 }],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/default', {
    ...rich(1, 1), meta: { updatedAt: now, profileGeneration: 1 }
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', generation: 1 }]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__default', JSON.stringify({
    ...rich(3, 1), meta: { updatedAt: now - 60000, profileGeneration: 1 }
  }));
  const env = baseEnv(store, fsMock);
  const PIO = loadPIO(env);
  const r = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(r.data.cours.length === 1, 'PoC3: cloud thin conservé (1 cours)');
  assert(!r.recoveredFromLocal, 'PoC3: pas de recoveredFromLocal');
  const cloud = fsMock.docs.get('utilisateurs/uid1/profiles/default');
  assert(cloud.cours.length === 1, 'PoC3: cloud non réécrit avec 3 cours');
}

// ─── 4. Delete+recreate : zombie local autre appareil ───
async function pocZombieAfterRecreate() {
  console.log('\n[PoC4] Delete+recreate — zombie local génération 100 vs index 200');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'labo',
    profiles: [
      { id: 'default', name: 'P', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 20, generation: 200 }
    ],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/labo', {
    ...shell(), meta: { updatedAt: Date.now(), profileGeneration: 200 }
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'labo',
    profiles: [
      { id: 'default', name: 'P', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', generation: 200 }
    ]
  }));
  store.setItem('active_profile', 'labo');
  store.setItem('backup_local_cours__labo', JSON.stringify(rich(8, 100)));
  const env = baseEnv(store, fsMock);
  const PIO = loadPIO(env);
  const r = await PIO.resolveProfileCloudDoc(env.currentUser);
  const cloud = fsMock.docs.get('utilisateurs/uid1/profiles/labo');
  assert(!(cloud.cours || []).some((c) => c.uid === 'U0'), 'PoC4: zombie pas republishé');
  assert((r.data.cours || []).length === 0, 'PoC4: UI = recreate vide, pas 8 vieux cours');
}

// ─── 5. writeLocal empty-over-rich (tous chemins : save secondaire, etc.) ───
async function pocWriteLocalAntiWipe() {
  console.log('\n[PoC5] writeLocal refuse empty→rich ; allowEmpty seulement si plus récent');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadPIO(env);
  assert(PIO.writeLocalProfileData('default', rich(2, 1)) === true, 'PoC5: écriture riche');
  assert(PIO.writeLocalProfileData('default', shell()) === false, 'PoC5: shell refusée');
  assert(PIO.readLocalProfileData('default').cours.length === 2, 'PoC5: 2 cours toujours là');
  assert(PIO.writeLocalProfileData('default', shell(), { allowEmpty: true }) === false, 'PoC5: allowEmpty shell vieille refusée');
  const newer = { ...shell(), meta: { updatedAt: Date.now() + 5000, profileGeneration: 1 } };
  assert(PIO.writeLocalProfileData('default', newer, { allowEmpty: true }) === true, 'PoC5: allowEmpty shell récente OK');
}

// ─── 6. Pending : appareil B avec shell ne publie pas ───
async function pocPendingShellNoPublish() {
  console.log('\n[PoC6] cloudBlobPending + shell locale → pas de setDoc');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T15:00:00.000Z',
    profiles: [
      { id: 'default', name: 'P', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 80000, cloudBlobPending: true, generation: 3 }
    ],
    deletedProfiles: {}
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T15:00:00.000Z',
    profiles: [
      { id: 'default', name: 'P', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 80000, cloudBlobPending: true, generation: 3 }
    ]
  }));
  store.setItem('active_profile', 'labo');
  store.setItem('backup_local_cours__labo', JSON.stringify(shell()));
  const env = baseEnv(store, fsMock);
  const PIO = loadPIO(env);
  const r = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(r.cloudPending === true, 'PoC6: cloudPending');
  assert(r.docRef == null, 'PoC6: pas de docRef writable');
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/labo'), 'PoC6: aucun blob publié');
}

// ─── 7. assert tombstone ───
async function pocTombstoneWritable() {
  console.log('\n[PoC7] assertProfileCloudWritable tombe sur tombstone');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: { labo: Date.now() }
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  const env = baseEnv(store, fsMock);
  const PIO = loadPIO(env);
  const w = await PIO.assertProfileCloudWritable(env.currentUser, 'labo');
  assert(w.ok === false && w.reason === 'tombstoned', 'PoC7: tombstoned');
}

// ─── 8. Changement de compte Google ───
async function pocAccountSwitch() {
  console.log('\n[PoC8] Changement UID purge secret, pas d’upload');
  const store = makeStore();
  const fsMock = makeFirestore();
  store.setItem('mc_profiles_bound_uid', 'uid-old');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'secret',
    profiles: [
      { id: 'default', name: 'P', createdAt: 't', updatedAt: 't' },
      { id: 'secret', name: 'Secret', createdAt: 't', updatedAt: 't' }
    ]
  }));
  store.setItem('backup_local_cours__secret', JSON.stringify(rich(3, 1)));
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-26T16:00:00.000Z',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't', bytes: 0 }],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/default', shell());
  const env = baseEnv(store, fsMock);
  const PIO = loadPIO(env);
  await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(!store.getItem('backup_local_cours__secret'), 'PoC8: blob secret purgé');
  const idx = fsMock.docs.get('utilisateurs/uid1');
  assert(!idx.profiles.some((p) => p.id === 'secret'), 'PoC8: secret pas dans index cloud');
}

// ─── 9. Seed owner republie après échec blob ───
async function pocSeedOwnerRecover() {
  console.log('\n[PoC9] Créateur republie après échec setDoc blob');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'P', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: {}
  });
  const env = baseEnv(store, fsMock);
  env.D = rich(2, 1);
  const PIO = loadPIO(env);
  const orig = fsMock.setDoc.bind(fsMock);
  let failBlob = true;
  fsMock.setDoc = async (ref, data) => {
    if (failBlob && String(ref._path || '').includes('/profiles/')) throw new Error('blob fail');
    return orig(ref, data);
  };
  env.setDoc = fsMock.setDoc;
  try { await PIO.createProfile('Labo', { copyFromActive: true }); } catch (_) { /* expected */ }
  assert(store.getItem('mc_profile_seed_owner__labo') === '1', 'PoC9: seed owner');
  failBlob = false;
  const meta = JSON.parse(store.getItem('mc_profiles_meta'));
  meta.activeProfile = 'labo';
  meta.activeProfileUpdatedAt = '2026-07-26T17:00:00.000Z';
  store.setItem('mc_profiles_meta', JSON.stringify(meta));
  store.setItem('active_profile', 'labo');
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T17:00:00.000Z',
    profiles: meta.profiles,
    deletedProfiles: {}
  });
  await PIO.resolveProfileCloudDoc(env.currentUser);
  const blob = fsMock.docs.get('utilisateurs/uid1/profiles/labo');
  assert(blob && blob.cours && blob.cours.length === 2, 'PoC9: seed publié avec 2 cours');
}

async function main() {
  console.log('=== Preuves adversatives ProfilesIO (perte de données) ===');
  await pocCreateClobber();
  await pocEmptyCloudVsRichLocal();
  await pocIntentionalDeletes();
  await pocZombieAfterRecreate();
  await pocWriteLocalAntiWipe();
  await pocPendingShellNoPublish();
  await pocTombstoneWritable();
  await pocAccountSwitch();
  await pocSeedOwnerRecover();
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.error('Échecs:\n' + failures.map((f) => ' - ' + f).join('\n'));
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
