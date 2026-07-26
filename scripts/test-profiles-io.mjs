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

async function testArchiveAndSnapshots() {
  console.log('\n[7] Archive + snapshots + sizes');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  env.D = {
    settings: { userName: 'A' },
    matieres: [{ id: 'm1', name: 'Math' }],
    classeurs: [],
    cours: [{ uid: 'c1', titre: 'Cours', mat: 'm1' }],
    exercices: [],
    devoirs: [],
    meta: {}
  };
  const PIO = loadProfilesIO(env);

  // seed second profile locally
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't' }
    ]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__labo', JSON.stringify(env.D));
  store.setItem('backup_local_cours__default', JSON.stringify(env.D));
  env._activeProfileId = 'default';

  const snap = PIO.createSnapshot('default', 'Avant test');
  assert(!!snap && snap.bytes > 0, 'snapshot created with size');
  assert(PIO.listSnapshots('default').length === 1, 'one snapshot listed');
  const info = PIO.getProfileStorageInfo('default');
  assert(info.liveBytes > 0 && info.snapBytes > 0, 'live + snap sizes reported');
  assert(info.totalBytes === info.liveBytes + info.snapBytes, 'total = live + snaps');

  await PIO.archiveProfile('labo');
  assert(PIO.listProfiles().every((p) => p.id !== 'labo'), 'archived hidden from active list');
  assert(PIO.listArchivedProfiles().some((p) => p.id === 'labo'), 'in archived list');

  let blocked = false;
  try { await PIO.switchProfile('labo'); } catch (e) { blocked = /archiv/i.test(String(e.message || e)); }
  assert(blocked, 'cannot switch to archived');

  await PIO.unarchiveProfile('labo');
  assert(PIO.listProfiles().some((p) => p.id === 'labo'), 'unarchived visible again');

  // restore overwrites D
  env.D.cours = [];
  await PIO.restoreSnapshot('default', snap.id);
  assert(env.D.cours && env.D.cours.length === 1, 'restore brings cours back');

  PIO.deleteSnapshot('default', snap.id);
  assert(PIO.listSnapshots('default').length === 0, 'snapshot deleted');

  // Tous archivés → ensureLocalRegistry doit en rouvrir un
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'labo',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', archived: true },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', archived: true }
    ]
  }));
  store.setItem('active_profile', 'labo');
  const live = PIO.listProfiles();
  assert(live.length >= 1, 'at least one live after all-archived repair');
  assert(live.some((p) => !p.archived), 'live list has non-archived');
}

async function testCrossDeviceActiveProfile() {
  console.log('\n· cross-device active profile adoption');
  const store = makeStore();
  const fsMock = makeFirestore();
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-01-01T10:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 100 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 50000 }
    ]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__default', JSON.stringify({
    settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: []
  }));

  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-25T12:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 1200 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 50000 }
    ],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/labo', {
    settings: { userName: 'Lab' },
    matieres: [], classeurs: [], cours: [{ uid: 'x1' }], exercices: [], devoirs: []
  });

  const env = baseEnv(store, fsMock);
  env._activeProfileId = 'default';
  const PIO = loadProfilesIO(env);

  assert(PIO.getProfileStorageInfo('labo').liveBytes === 50000, 'announced bytes without local blob');

  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.profileId === 'labo', 'device B adopts cloud active profile labo');
  assert(PIO.getActiveProfileId() === 'labo', 'local active becomes labo');
  assert(env._activeProfileId === 'labo', 'session pinned to labo');
}

async function testStaleDeviceDoesNotClobberActive() {
  console.log('\n· stale device rename must not clobber newer active');
  const store = makeStore();
  const fsMock = makeFirestore();
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-01-01T10:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 20 }
    ]
  }));
  store.setItem('active_profile', 'default');
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-25T18:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 20 }
    ],
    deletedProfiles: {}
  });
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  await PIO.renameProfile('default', 'Maison');
  const idx = fsMock.docs.get('utilisateurs/uid1');
  assert(idx.activeProfile === 'labo', 'cloud active stays labo after stale rename');
  assert(idx.profiles.some((p) => p.id === 'default' && p.name === 'Maison'), 'rename still applied');
}

async function testSwitchRequiresCloudIndex() {
  console.log('\n· switchProfile rolls back if cloud index write fails');
  const store = makeStore();
  const fsMock = makeFirestore();
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-01T00:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't' }
    ]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__default', JSON.stringify({
    settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: []
  }));
  store.setItem('backup_local_cours__labo', JSON.stringify({
    settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: []
  }));
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-01T00:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't' }
    ],
    deletedProfiles: {}
  });

  const env = baseEnv(store, fsMock);
  env._activeProfileId = 'default';
  env.save = async () => {};
  env.runTransaction = async () => { throw Object.assign(new Error('boom'), { code: 'INDEX_MERGE_REFUSED' }); };
  env.setDoc = async () => { throw new Error('setDoc blocked'); };
  const PIO = loadProfilesIO(env);

  let failedSwitch = false;
  try {
    await PIO.switchProfile('labo');
  } catch (e) {
    failedSwitch = /cloud|index|synchron/i.test(String(e.message || e));
  }
  assert(failedSwitch, 'switch throws when index cloud fails');
  assert(PIO.getActiveProfileId() === 'default', 'active rolled back to default');
  assert(!env._reloaded, 'no reload after failed switch');
}


async function testNoEmptyPublishWhileBlobPending() {
  console.log('\n· no empty cloud publish while blob pending');
  const store = makeStore();
  const fsMock = makeFirestore();
  // Index cloud : profil labo annoncé avec contenu, blob encore absent
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-25T20:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 42000, cloudBlobPending: true }
    ],
    deletedProfiles: {}
  });
  // Appareil B : pas de blob local labo
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-01-01T00:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 42000, cloudBlobPending: true }
    ]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('backup_local_cours__default', JSON.stringify({
    settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: []
  }));

  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.profileId === 'labo', 'active cloud labo adopted');
  assert(resolved.cloudPending === true, 'cloudPending flagged');
  assert(resolved.docRef == null, 'no writable docRef while pending');
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/labo'), 'empty blob not published');
}

async function testAccountSwitchPurgesLocalRegistry() {
  console.log('\n· account switch purges local profile store');
  const store = makeStore();
  const fsMock = makeFirestore();
  store.setItem('mc_profiles_bound_uid', 'uid-old');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'secret',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'secret', name: 'Secret', createdAt: 't', updatedAt: 't', bytes: 999 }
    ]
  }));
  store.setItem('active_profile', 'secret');
  store.setItem('backup_local_cours__secret', JSON.stringify({
    settings: {}, matieres: [{ id: 'X' }], classeurs: [], cours: [{ uid: 'LEAK' }], exercices: [], devoirs: []
  }));
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-25T21:00:00.000Z',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 0 }],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/default', {
    settings: { userName: 'New' }, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: []
  });

  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(store.getItem('mc_profiles_bound_uid') === 'uid1', 'bound to new uid');
  assert(!store.getItem('backup_local_cours__secret'), 'old account blob purged');
  assert(!PIO.listProfiles().some((p) => p.id === 'secret'), 'secret profile not merged into new account');
  const idx = fsMock.docs.get('utilisateurs/uid1');
  assert(!idx.profiles.some((p) => p.id === 'secret'), 'secret not uploaded to new account index');
}

async function testCreateBlobFailMarksPending() {
  console.log('\n· create blob fail keeps cloudBlobPending');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: {}
  });
  const env = baseEnv(store, fsMock);
  env.D = {
    settings: { userName: 'A' },
    matieres: [{ id: 'm1', name: 'Math' }],
    classeurs: [],
    cours: [{ uid: 'KEEP', titre: 'Important' }],
    exercices: [], devoirs: [], meta: {}
  };
  const PIO = loadProfilesIO(env);
  const origSet = fsMock.setDoc.bind(fsMock);
  fsMock.setDoc = async function (ref, data) {
    if (String(ref._path || '').includes('/profiles/')) throw new Error('blob fail');
    return origSet(ref, data);
  };
  env.setDoc = fsMock.setDoc;

  let threw = false;
  try {
    await PIO.createProfile('Labo', { copyFromActive: true });
  } catch (e) {
    threw = /cloud|synchron/i.test(String(e.message || e));
  }
  assert(threw, 'create reports blob failure');
  const idx = fsMock.docs.get('utilisateurs/uid1');
  const labo = idx.profiles.find((p) => p.id === 'labo');
  assert(!!labo, 'labo remains in index');
  assert(labo.cloudBlobPending === true, 'cloudBlobPending true after blob fail');
  assert(labo.bytes > 0, 'bytes announced from local seed');
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/labo'), 'no empty/partial blob on cloud');
  assert(!!store.getItem('backup_local_cours__labo'), 'local seed preserved');
}


async function testShellLocalDoesNotPublishWhilePending() {
  console.log('\n· emptyData shell on device B must not publish while pending');
  const store = makeStore();
  const fsMock = makeFirestore();
  const emptyShell = {
    settings: { userName: 'Étudiant' },
    matieres: [
      { id: 'PHYS', name: 'Physique' },
      { id: 'MATH', name: 'Mathématiques' }
    ],
    classeurs: [{ id: 'A', name: 'Classeur Phys A' }],
    cours: [], exercices: [], devoirs: []
  };
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-25T22:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 80000, cloudBlobPending: true }
    ],
    deletedProfiles: {}
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-25T22:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 80000, cloudBlobPending: true }
    ]
  }));
  store.setItem('active_profile', 'labo');
  // Coquille locale (comme après initApp emptyData + save local)
  store.setItem('backup_local_cours__labo', JSON.stringify(emptyShell));

  const env = baseEnv(store, fsMock);
  env.emptyData = emptyShell;
  const PIO = loadProfilesIO(env);
  assert(PIO.isEffectivelyEmptyProfile(emptyShell) === true, 'template shell is effectively empty');
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.cloudPending === true, 'still cloudPending with shell local');
  assert(resolved.docRef == null, 'no writable docRef with shell local');
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/labo'), 'shell not published to cloud');
}

async function testSeedOwnerCanPublishAfterBlobFail() {
  console.log('\n· seed owner republishes after blob fail');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: {}
  });
  const env = baseEnv(store, fsMock);
  env.D = {
    settings: { userName: 'A' },
    matieres: [{ id: 'm1', name: 'Math' }],
    classeurs: [],
    cours: [{ uid: 'KEEP', titre: 'Important' }],
    exercices: [], devoirs: [], meta: {}
  };
  const PIO = loadProfilesIO(env);
  const origSet = fsMock.setDoc.bind(fsMock);
  let failBlob = true;
  fsMock.setDoc = async function (ref, data) {
    if (failBlob && String(ref._path || '').includes('/profiles/')) throw new Error('blob fail');
    return origSet(ref, data);
  };
  env.setDoc = fsMock.setDoc;
  try { await PIO.createProfile('Labo', { copyFromActive: true }); } catch (e) { /* expected */ }
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/labo'), 'blob still missing after create fail');
  assert(store.getItem('mc_profile_seed_owner__labo') === '1', 'seed owner marked');

  // Créateur recharge — doit publier
  failBlob = false;
  store.setItem('active_profile', 'labo');
  const meta = JSON.parse(store.getItem('mc_profiles_meta'));
  meta.activeProfile = 'labo';
  meta.activeProfileUpdatedAt = '2026-07-25T23:00:00.000Z';
  store.setItem('mc_profiles_meta', JSON.stringify(meta));
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-25T23:00:00.000Z',
    profiles: meta.profiles,
    deletedProfiles: {}
  });
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.cloudPending !== true, 'owner resolve not pending');
  assert(!!fsMock.docs.get('utilisateurs/uid1/profiles/labo'), 'owner published blob');
  const blob = fsMock.docs.get('utilisateurs/uid1/profiles/labo');
  assert(blob.cours && blob.cours.some((c) => c.uid === 'KEEP'), 'seed content preserved on cloud');
  assert(!store.getItem('mc_profile_seed_owner__labo'), 'seed owner cleared after publish');
}


async function testNonEmptyLocalPreservedWhilePending() {
  console.log('\n· non-empty local preserved (not wiped) while cloud pending');
  const store = makeStore();
  const fsMock = makeFirestore();
  const rich = {
    settings: { userName: 'A' },
    matieres: [{ id: 'm1', name: 'Math' }],
    classeurs: [],
    cours: [{ uid: 'KEEP-ME', titre: 'Cours important' }],
    exercices: [], devoirs: []
  };
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T10:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 90000, cloudBlobPending: true }
    ],
    deletedProfiles: {}
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T10:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 90000, cloudBlobPending: true }
    ]
  }));
  store.setItem('active_profile', 'labo');
  store.setItem('backup_local_cours__labo', JSON.stringify(rich));
  // Pas de seed owner → ancien bug : data null → emptyData → wipe

  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.cloudPending === true, 'pending for non-owner');
  assert(resolved.docRef == null, 'no writable docRef');
  assert(resolved.data && resolved.data.cours && resolved.data.cours[0].uid === 'KEEP-ME', 'local rich data returned');
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/labo'), 'did not publish stale/pending clash');
  const still = JSON.parse(store.getItem('backup_local_cours__labo'));
  assert(still.cours[0].uid === 'KEEP-ME', 'local blob untouched');
}


async function testNoStaleRepublishWithoutPending() {
  console.log('\n· no stale republish when bytes announced but pending false');
  const store = makeStore();
  const fsMock = makeFirestore();
  const stale = {
    settings: {}, matieres: [], classeurs: [],
    cours: [{ uid: 'STALE', titre: 'Old' }], exercices: [], devoirs: []
  };
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T12:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 50000, cloudBlobPending: false }
    ],
    deletedProfiles: {}
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T12:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 50000, cloudBlobPending: false }
    ]
  }));
  store.setItem('active_profile', 'labo');
  store.setItem('backup_local_cours__labo', JSON.stringify(stale));
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.cloudPending === true, 'treated as pending/wait');
  assert(resolved.docRef == null, 'no writable docRef for stale republish');
  assert(!fsMock.docs.has('utilisateurs/uid1/profiles/labo'), 'stale local not published');
  assert(resolved.data && resolved.data.cours[0].uid === 'STALE', 'stale local kept for UI');
}

async function testWriteLocalRefusesEmptyOverNonEmpty() {
  console.log('\n· writeLocal refuses empty over non-empty');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  const rich = {
    settings: {}, matieres: [], classeurs: [],
    cours: [{ uid: 'X1' }], exercices: [], devoirs: []
  };
  assert(PIO.writeLocalProfileData('default', rich) === true, 'rich write ok');
  const shell = {
    settings: { userName: 'Étudiant' },
    matieres: [{ id: 'PHYS', name: 'Physique' }],
    classeurs: [], cours: [], exercices: [], devoirs: []
  };
  assert(PIO.isEffectivelyEmptyProfile(shell) === true, 'shell empty');
  assert(PIO.writeLocalProfileData('default', shell) === false, 'empty over rich refused');
  assert(PIO.readLocalProfileData('default').cours[0].uid === 'X1', 'rich preserved');
  env._allowEmptyProfileWrite = true;
  assert(PIO.writeLocalProfileData('default', shell) === true, 'allowed with flag');
}

async function testAssertTombstonedNotWritable() {
  console.log('\n· tombstoned profile not cloud-writable');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: { labo: Date.now() }
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  const w = await PIO.assertProfileCloudWritable(env.currentUser, 'labo');
  assert(w.ok === false && w.reason === 'tombstoned', 'tombstoned refused');
}


async function testCreateDoesNotClobberExistingCloudBlob() {
  console.log('\n· create must not clobber existing rich cloud blob');
  const store = makeStore();
  const fsMock = makeFirestore();
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 90000 }
    ],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/labo', {
    settings: {}, matieres: [], classeurs: [],
    cours: [{ uid: 'RICH1' }, { uid: 'RICH2' }], exercices: [], devoirs: [],
    meta: { updatedAt: Date.now() }
  });
  // Appareil B : registre local sans labo (périmé)
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1, activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }]
  }));
  store.setItem('active_profile', 'default');
  const env = baseEnv(store, fsMock);
  env.D = { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [] };
  const PIO = loadProfilesIO(env);
  let threw = false;
  try {
    await PIO.createProfile('Labo', { copyFromActive: false });
  } catch (e) {
    threw = /existe déjà|Collision|autre nom/i.test(String(e.message || e));
  }
  // Soit refuse, soit crée labo-2 — jamais écraser RICH*
  const blob = fsMock.docs.get('utilisateurs/uid1/profiles/labo');
  assert(blob && blob.cours && blob.cours.length === 2, 'rich labo blob intact');
  assert(blob.cours.some((c) => c.uid === 'RICH1'), 'RICH1 preserved');
  const createdLabo2 = PIO.listProfiles().some((p) => p.id === 'labo-2');
  assert(threw || createdLabo2, 'create refused or used labo-2');
}

async function testEmptyCloudDoesNotClobberRichLocal() {
  console.log('\n· empty cloud must not clobber rich local');
  const store = makeStore();
  const fsMock = makeFirestore();
  const rich = {
    settings: {}, matieres: [], classeurs: [],
    cours: [{ uid: 'L1' }, { uid: 'L2' }, { uid: 'L3' }],
    exercices: [], devoirs: [],
    meta: { updatedAt: Date.now() }
  };
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-26T12:00:00.000Z',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 }],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/default', {
    settings: { userName: 'Étudiant' },
    matieres: [{ id: 'PHYS', name: 'Physique' }],
    classeurs: [], cours: [], exercices: [], devoirs: [],
    meta: { updatedAt: 1 }
  });
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-26T12:00:00.000Z',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 10 }]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__default', JSON.stringify(rich));
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.data && resolved.data.cours && resolved.data.cours.length === 3, 'rich local preferred');
  const cloud = fsMock.docs.get('utilisateurs/uid1/profiles/default');
  assert(cloud.cours && cloud.cours.length === 3, 'cloud repaired from rich local');
}


async function testNewerThinnerCloudWinsOverOlderRichLocal() {
  console.log('\n· newer thinner cloud (intentional deletes) beats older rich local');
  const store = makeStore();
  const fsMock = makeFirestore();
  const now = Date.now();
  const olderRich = {
    settings: {}, matieres: [], classeurs: [],
    cours: [{ uid: 'A' }, { uid: 'B' }, { uid: 'C' }],
    exercices: [], devoirs: [],
    meta: { updatedAt: now - 100000 }
  };
  const newerThin = {
    settings: {}, matieres: [], classeurs: [],
    cours: [{ uid: 'A' }],
    exercices: [], devoirs: [],
    meta: { updatedAt: now }
  };
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    activeProfileUpdatedAt: '2026-07-26T14:00:00.000Z',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 1000, generation: 1 }],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/default', newerThin);
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't', bytes: 1000, generation: 1 }]
  }));
  store.setItem('active_profile', 'default');
  store.setItem('backup_local_cours__default', JSON.stringify(olderRich));
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.data && resolved.data.cours.length === 1, 'keeps intentional thin cloud');
  assert(resolved.data.cours[0].uid === 'A', 'cloud cours A');
  assert(!resolved.recoveredFromLocal, 'did not recover old rich local');
}

async function testGenerationMismatchPurgesZombieLocal() {
  console.log('\n· generation mismatch purges zombie local after recreate');
  const store = makeStore();
  const fsMock = makeFirestore();
  const zombie = {
    settings: {}, matieres: [], classeurs: [],
    cours: [{ uid: 'OLD1' }, { uid: 'OLD2' }],
    exercices: [], devoirs: [],
    meta: { updatedAt: Date.now(), profileGeneration: 100 }
  };
  const fresh = {
    settings: {}, matieres: [], classeurs: [],
    cours: [], exercices: [], devoirs: [],
    meta: { updatedAt: Date.now(), profileGeneration: 200 }
  };
  fsMock.docs.set('utilisateurs/uid1', {
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    activeProfileUpdatedAt: '2026-07-26T14:00:00.000Z',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', bytes: 50, generation: 200 }
    ],
    deletedProfiles: {}
  });
  fsMock.docs.set('utilisateurs/uid1/profiles/labo', fresh);
  store.setItem('mc_profiles_bound_uid', 'uid1');
  store.setItem('mc_profiles_meta', JSON.stringify({
    _account: true, schemaVersion: 1,
    activeProfile: 'labo',
    profiles: [
      { id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' },
      { id: 'labo', name: 'Labo', createdAt: 't', updatedAt: 't', generation: 200 }
    ]
  }));
  store.setItem('active_profile', 'labo');
  store.setItem('backup_local_cours__labo', JSON.stringify(zombie));
  const env = baseEnv(store, fsMock);
  const PIO = loadProfilesIO(env);
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.data && resolved.data.cours.length === 0, 'fresh empty recreate kept');
  assert(!store.getItem('backup_local_cours__labo') || PIO.readLocalProfileData('labo') == null
    || (PIO.readLocalProfileData('labo').cours || []).length === 0
    || !PIO.readLocalProfileData('labo').cours.some(c => c.uid === 'OLD1'),
    'zombie local purged or not resurrected');
  const cloud = fsMock.docs.get('utilisateurs/uid1/profiles/labo');
  assert(!(cloud.cours || []).some(c => c.uid === 'OLD1'), 'zombie not republished to cloud');
}

async function main() {
  console.log('ProfilesIO unit tests');
  await testReviveSameName();
  await testOfflineDeleteBlocked();
  await testDeleteCloudFirst();
  await testSyncPurgesTombstoneGhost();
  await testCreateRollbackOnIndexFail();
  await testImportMergeNotes();
  await testArchiveAndSnapshots();
  await testCrossDeviceActiveProfile();
  await testStaleDeviceDoesNotClobberActive();
  await testSwitchRequiresCloudIndex();
  await testNoEmptyPublishWhileBlobPending();
  await testAccountSwitchPurgesLocalRegistry();
  await testCreateBlobFailMarksPending();
  await testShellLocalDoesNotPublishWhilePending();
  await testSeedOwnerCanPublishAfterBlobFail();
  await testNonEmptyLocalPreservedWhilePending();
  await testNoStaleRepublishWithoutPending();
  await testWriteLocalRefusesEmptyOverNonEmpty();
  await testAssertTombstonedNotWritable();
  await testCreateDoesNotClobberExistingCloudBlob();
  await testEmptyCloudDoesNotClobberRichLocal();
  await testNewerThinnerCloudWinsOverOlderRichLocal();
  await testGenerationMismatchPurgesZombieLocal();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
