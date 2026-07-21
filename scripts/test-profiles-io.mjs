/**
 * Tests unitaires ProfilesIO (Node, mocks localStorage + Firestore).
 * Usage: node scripts/test-profiles-io.mjs
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

function makeStore() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    _map: map
  };
}

function makeFirestore() {
  const docs = new Map();
  function keyFromRef(ref) {
    if (typeof ref === 'string') return ref;
    if (ref && ref._path) return ref._path;
    return String(ref);
  }
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
    async deleteDoc(ref) {
      docs.delete(keyFromRef(ref));
    },
    async runTransaction(db, fn) {
      const tx = {
        async get(ref) { return makeFirestoreGet(docs, ref); },
        set(ref, data) { docs.set(keyFromRef(ref), JSON.parse(JSON.stringify(data))); }
      };
      await fn(tx);
    }
  };
}

function makeFirestoreGet(docs, ref) {
  const k = typeof ref === 'string' ? ref : ref._path;
  if (!docs.has(k)) return { exists: () => false, data: () => null };
  return { exists: () => true, data: () => JSON.parse(JSON.stringify(docs.get(k))) };
}

function loadProfilesIO(env) {
  const code = fs.readFileSync(path.join(root, 'profiles-io.js'), 'utf8');
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
    Error
  };
  sandbox.window = env;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'profiles-io.js' });
  return env.ProfilesIO;
}

function baseEnv(store, fsMock, opts) {
  opts = opts || {};
  const env = {
    localStorage: store,
    safeLocalGet: (k) => store.getItem(k),
    safeLocalSet: (k, v) => { store.setItem(k, v); return true; },
    safeLocalRemove: (k) => { store.removeItem(k); return true; },
    isLocalMode: !!opts.isLocalMode,
    cloudConnected: opts.cloudConnected !== undefined ? opts.cloudConnected : true,
    currentUser: opts.user || { sub: 'uid1', email: 'a@b.c' },
    emptyData: {
      settings: { userName: 'Étudiant' },
      matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [],
      meta: {}
    },
    D: null,
    db: {},
    doc: fsMock.doc.bind(fsMock),
    getDoc: fsMock.getDoc.bind(fsMock),
    setDoc: fsMock.setDoc.bind(fsMock),
    deleteDoc: fsMock.deleteDoc.bind(fsMock),
    runTransaction: fsMock.runTransaction.bind(fsMock),
    location: { reload() { env._reloaded = true; } },
    _reloaded: false
  };
  env.D = JSON.parse(JSON.stringify(env.emptyData));
  return env;
}

async function testReviveSameName() {
  console.log('\n[1] Recreate same name clears tombstone');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);

  // Seed account index with default
  const accountPath = 'utilisateurs/uid1';
  await fsMock.setDoc({ _path: accountPath }, {
    _account: true,
    schemaVersion: 1,
    activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't0', updatedAt: 't0' }],
    deletedProfiles: {}
  });

  const created = await PIO.createProfile('Test', { copyFromActive: false });
  assert(created.id === 'test', 'id slug = test');
  assert(PIO.listProfiles().some((p) => p.id === 'test'), 'listed after create');

  let idx = (await fsMock.getDoc({ _path: accountPath })).data();
  assert(idx.profiles.some((p) => p.id === 'test'), 'in cloud index');
  assert(!idx.deletedProfiles.test, 'no tombstone yet');

  await PIO.deleteProfile('test');
  idx = (await fsMock.getDoc({ _path: accountPath })).data();
  assert(!!idx.deletedProfiles.test, 'tombstone after delete');
  assert(!idx.profiles.some((p) => p.id === 'test'), 'removed from index');
  assert(!PIO.listProfiles().some((p) => p.id === 'test'), 'removed locally');

  const recreated = await PIO.createProfile('Test', { copyFromActive: false });
  assert(recreated.id === 'test', 'reuses same id');
  idx = (await fsMock.getDoc({ _path: accountPath })).data();
  assert(!idx.deletedProfiles.test, 'tombstone cleared (revivedIds)');
  assert(idx.profiles.some((p) => p.id === 'test'), 'back in cloud index');
  assert(PIO.listProfiles().some((p) => p.id === 'test'), 'listed after recreate');
}

async function testOfflineDeleteBlocked() {
  console.log('\n[2] Offline delete blocked (no local wipe)');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { cloudConnected: true });
  const PIO = loadProfilesIO(env);

  await fsMock.setDoc({ _path: 'utilisateurs/uid1' }, {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't' }
    ],
    deletedProfiles: {}
  });
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't' }
    ]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__labo', JSON.stringify(env.emptyData));

  env.cloudConnected = false;
  let threw = false;
  try {
    await PIO.deleteProfile('labo');
  } catch (e) {
    threw = /cloud|connexion/i.test(String(e.message || e));
  }
  assert(threw, 'throws when cloudConnected=false');
  assert(PIO.listProfiles().some((p) => p.id === 'labo'), 'local profile still present');
}

async function testDeleteCloudFirst() {
  console.log('\n[3] Delete fails index → local untouched');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock);
  // Break setDoc for index only after seed
  const PIO = loadProfilesIO(env);
  await fsMock.setDoc({ _path: 'utilisateurs/uid1' }, {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'x', name: 'X', createdAt: 't', updatedAt: 't' }
    ],
    deletedProfiles: {}
  });
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'x', name: 'X', createdAt: 't', updatedAt: 't' }
    ]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__x', JSON.stringify(env.emptyData));

  const origSet = fsMock.setDoc.bind(fsMock);
  fsMock.setDoc = async function (ref, data) {
    if (ref._path === 'utilisateurs/uid1') throw new Error('network');
    return origSet(ref, data);
  };
  env.setDoc = fsMock.setDoc;
  // Disable transaction so fallback setDoc is used
  env.runTransaction = undefined;

  let threw = false;
  try {
    await PIO.deleteProfile('x');
  } catch (e) {
    threw = true;
  }
  assert(threw, 'delete throws on index write fail');
  assert(PIO.listProfiles().some((p) => p.id === 'x'), 'local not wiped');
  assert(store.getItem('backup_local_cours__x'), 'local blob kept');
}

async function testSyncPurgesTombstoneGhost() {
  console.log('\n[4] syncRegistry purges tombstoned active ghost');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);

  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'ghost',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'ghost', name: 'Ghost', createdAt: 't', updatedAt: 't' }
    ]
  }));
  store.setItem('active_profile', 'ghost');
  env._activeProfileId = 'ghost';

  await fsMock.setDoc({ _path: 'utilisateurs/uid1' }, {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: { ghost: Date.now() }
  });
  await fsMock.setDoc({ _path: 'utilisateurs/uid1/profiles/default' }, env.emptyData);

  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.profileId === 'default', 'switched away from ghost');
  assert(!PIO.listProfiles().some((p) => p.id === 'ghost'), 'ghost purged from list');
  assert(PIO.getActiveProfileId() === 'default', 'active is default');
}

async function testCreateRollbackOnIndexFail() {
  console.log('\n[5] Create rolls back if index sync fails');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock);
  await fsMock.setDoc({ _path: 'utilisateurs/uid1' }, {
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: {}
  });
  const PIO = loadProfilesIO(env);
  env.runTransaction = undefined;
  const origSet = fsMock.setDoc.bind(fsMock);
  fsMock.setDoc = async function (ref, data) {
    if (ref._path === 'utilisateurs/uid1') throw new Error('fail');
    return origSet(ref, data);
  };
  env.setDoc = fsMock.setDoc;

  let threw = false;
  try {
    await PIO.createProfile('Nouveau', { copyFromActive: false });
  } catch (e) {
    threw = /index|annul/i.test(String(e.message || e));
  }
  assert(threw, 'create throws on index fail');
  assert(!PIO.listProfiles().some((p) => p.id === 'nouveau'), 'local rolled back');
}

async function testImportMergeNotes() {
  console.log('\n[6] Import notes replace keeps cours');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  env.D = {
    settings: { userName: 'A' },
    matieres: [{ id: 'm1', name: 'Math' }],
    classeurs: [],
    cours: [
      { uid: 'c1', titre: 'Cours', mat: 'm1' },
      { uid: 'ds1', titre: 'DS1', type: 'DS', mat: 'm1', note: 12, rang: 3, effectif: 40 }
    ],
    exercices: [],
    devoirs: [],
    meta: {}
  };
  const PIO = loadProfilesIO(env);
  const payload = {
    format: 'mes-cours-backup',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    sections: ['notes'],
    data: {
      _notes: [{ uid: 'ds1', note: 15, rang: 1, effectif: 40 }]
    }
  };
  const normalized = PIO.normalizeImport(payload);
  assert(normalized.ok, 'normalize ok');
  const report = PIO.applyImport(normalized, { sections: ['notes'], mode: 'replace' });
  assert(report.ok, 'import ok');
  assert(env.D.cours.length === 2 && env.D.cours.some((c) => c.uid === 'c1'), 'cours preserved');
  const ds = env.D.cours.find((c) => c.uid === 'ds1');
  assert(ds && ds.note === 15 && ds.rang === 1, 'note/rang updated');
}

async function main() {
  console.log('ProfilesIO unit tests');
  await testReviveSameName();
  await testOfflineDeleteBlocked();
  await testDeleteCloudFirst();
  await testSyncPurgesTombstoneGhost();
  await testCreateRollbackOnIndexFail();
  await testImportMergeNotes();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
