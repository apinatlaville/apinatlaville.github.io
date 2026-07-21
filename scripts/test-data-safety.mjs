/**
 * Tests de sécurité données : IDs cours, save/load, profils, import, snapshots.
 * Usage: node scripts/test-data-safety.mjs
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

function sampleD(overrides) {
  const base = {
    settings: { userName: 'Anel', themePreset: 'minimaliste' },
    matieres: [
      { id: 'PHYS', label: 'PHYS', name: 'Physique', color: '#5b8df7' },
      { id: 'MATH', label: 'MATH', name: 'Maths', color: '#50d890' }
    ],
    classeurs: [
      { id: 'A', name: 'Classeur Phys A', icon: 'book-blue', color: '#5b8df7', maxInter: 12, interNames: {} }
    ],
    cours: [
      {
        uid: 'PH-8X2', title: 'Optique géométrique', type: 'COURS', rev: '1',
        mat: 'PHYS', cl: 'A', inter: '1', note: '', rang: '', effectif: '',
        desc: 'Chapitre 1', date: '2026-01-10', stat: 'ok', duree: 45
      },
      {
        uid: 'PH-DS01', title: 'DS Optique', type: 'DS', rev: '1',
        mat: 'PHYS', cl: 'A', inter: '1', note: 14, rang: 5, effectif: 42,
        desc: '', date: '2026-02-01', stat: 'ok'
      },
      {
        uid: 'MA-KH1', title: 'Khôlle suites', type: 'KHOLLE', rev: '1',
        mat: 'MATH', cl: 'A', inter: '2', note: 16, rang: 2, effectif: 20,
        desc: '', date: '2026-02-15', stat: 'pending'
      }
    ],
    exercices: [
      { id: 'X-AAA1', type: 'anki', q: 'Question', a: 'Réponse', mat: 'PHYS' }
    ],
    devoirs: [
      { id: 'W-DM01', title: 'DM1', mat: 'PHYS', due: '2026-03-01' }
    ],
    meta: { revision: 1, updatedAt: Date.now() }
  };
  return Object.assign(base, overrides || {});
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
    Error,
    Blob: class {
      constructor(parts) {
        this.size = parts.reduce((n, p) => n + String(p).length, 0);
      }
    }
  };
  vm.runInNewContext(code, sandbox, { filename: 'profiles-io.js' });
  return env.ProfilesIO;
}

function baseEnv(store, fsMock, opts) {
  opts = opts || {};
  const env = {
    localStorage: store,
    safeLocalGet: (k) => store.getItem(k),
    safeLocalSet: (k, v) => { try { store.setItem(k, v); return true; } catch (e) { return false; } },
    safeLocalRemove: (k) => { store.removeItem(k); return true; },
    isLocalMode: opts.isLocalMode !== false,
    cloudConnected: opts.cloudConnected === true,
    currentUser: opts.user || { sub: 'uid-test', email: 'a@b.c' },
    emptyData: sampleD({ cours: [], exercices: [], devoirs: [] }),
    D: null,
    db: {},
    doc: fsMock.doc.bind(fsMock),
    getDoc: fsMock.getDoc.bind(fsMock),
    setDoc: fsMock.setDoc.bind(fsMock),
    deleteDoc: fsMock.deleteDoc.bind(fsMock),
    runTransaction: fsMock.runTransaction.bind(fsMock),
    _persistDisabled: false,
    _activeProfileId: null,
    location: { reload() { env._reloaded = true; } },
    _reloaded: false,
    docRef: null
  };
  env.D = sampleD();
  // Mimic app.js save targeting session pin
  env.save = async function () {
    if (env._persistDisabled) throw new Error('PERSIST_DISABLED');
    if (env.D && env.D._account === true) throw new Error('index compte');
    const pid = env._activeProfileId
      || (env.ProfilesIO && env.ProfilesIO.getSessionProfileId())
      || 'default';
    const payload = JSON.stringify(env.D);
    const ok = env.ProfilesIO.writeLocalProfileData(pid, payload);
    if (!ok) throw new Error('local save failed');
    if (!env.isLocalMode && env.cloudConnected && env.docRef && env.setDoc) {
      await env.setDoc(env.docRef, env.D);
    }
  };
  return env;
}

function uids(D) {
  return (D.cours || []).map((c) => c.uid).sort();
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function testRoundTripLocal() {
  console.log('\n[1] Round-trip local : IDs et champs intacts');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');

  const before = JSON.parse(JSON.stringify(env.D));
  await env.save();

  // Simulate cold reload
  const raw = store.getItem('backup_local_cours__default');
  assert(!!raw, 'blob local écrit');
  const loaded = JSON.parse(raw);
  assert(deepEqual(uids(loaded), uids(before)), 'uids cours identiques après reload');
  assert(loaded.cours.length === 3, '3 cours conservés');
  assert(loaded.cours.find((c) => c.uid === 'PH-8X2').title === 'Optique géométrique', 'titre cours intact');
  assert(loaded.cours.find((c) => c.uid === 'PH-DS01').note === 14, 'note DS intacte');
  assert(loaded.cours.find((c) => c.uid === 'PH-DS01').rang === 5, 'rang DS intact');
  assert(loaded.exercices[0].id === 'X-AAA1', 'id exercice intact');
  assert(loaded.devoirs[0].id === 'W-DM01', 'id devoir intact');
  assert(loaded.matieres[0].id === 'PHYS', 'id matière intact');
  assert(loaded.classeurs[0].id === 'A', 'id classeur intact');
}

async function testEditKeepsUid() {
  console.log('\n[2] Édition cours : uid permanent');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');

  const idx = env.D.cours.findIndex((c) => c.uid === 'PH-8X2');
  const prev = env.D.cours[idx];
  // Simule saveCours en mode édition (data.js:819-827)
  const obj = {
    title: 'Optique (révisé)', type: prev.type, rev: '2', mat: prev.mat, cl: prev.cl,
    inter: prev.inter, note: '', rang: '', effectif: '', desc: 'MAJ', date: prev.date
  };
  obj.uid = prev.uid;
  obj.stat = prev.stat;
  if (prev.duree != null) obj.duree = prev.duree;
  env.D.cours[idx] = obj;
  await env.save();

  const loaded = JSON.parse(store.getItem('backup_local_cours__default'));
  const c = loaded.cours.find((x) => x.uid === 'PH-8X2');
  assert(!!c, 'même uid PH-8X2 présent');
  assert(c.title === 'Optique (révisé)', 'titre mis à jour');
  assert(c.duree === 45, 'duree préservée');
  assert(loaded.cours.filter((x) => x.uid === 'PH-8X2').length === 1, 'pas de doublon uid');
}

async function testProfilesIsolated() {
  console.log('\n[3] Profils isolés : même uid sans collision');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);

  // Profile default
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');
  env.D = sampleD();
  await env.save();

  // Create labo profile with SAME cours uids but different title
  await PIO.createProfile('Labo', { copyFromActive: false });
  env._activeProfileId = 'labo';
  PIO.pinSessionProfileId('labo');
  PIO.setActiveProfileId('labo');
  env.D = sampleD();
  env.D.cours[0].title = 'VERSION LABO';
  await env.save();

  const dDefault = PIO.readLocalProfileData('default');
  const dLabo = PIO.readLocalProfileData('labo');
  assert(dDefault.cours[0].title === 'Optique géométrique', 'default inchangé');
  assert(dLabo.cours[0].title === 'VERSION LABO', 'labo a sa copie');
  assert(dDefault.cours[0].uid === dLabo.cours[0].uid, 'même uid OK (espaces séparés)');
  assert(store.getItem('backup_local_cours__default') !== store.getItem('backup_local_cours__labo'), 'clés localStorage distinctes');
}

async function testSwitchSavesBeforeLeave() {
  console.log('\n[4] Bascule profil : save avant départ');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);

  await PIO.createProfile('Labo', { copyFromActive: false });
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');
  PIO.setActiveProfileId('default');
  env.D = sampleD();
  env.D.cours.push({
    uid: 'PH-NEW9', title: 'Nouveau juste avant bascule', type: 'COURS',
    mat: 'PHYS', cl: 'A', inter: '1', note: '', rang: '', effectif: '',
    desc: '', date: '2026-03-01', stat: 'pending'
  });
  // Ne pas save manuel — switchProfile doit le faire
  await PIO.switchProfile('labo');
  assert(env._reloaded === true, 'reload déclenché');
  assert(env._persistDisabled === true, 'persist désactivé pendant bascule');

  const dDefault = PIO.readLocalProfileData('default');
  assert(dDefault.cours.some((c) => c.uid === 'PH-NEW9'), 'cours créé avant bascule bien sauvé dans default');
  assert(dDefault.cours.some((c) => c.uid === 'PH-8X2'), 'anciens cours default toujours là');
}

async function testExportImportPreserveUids() {
  console.log('\n[5] Export → import fusion : tous les uids');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');
  env.D = sampleD();

  const pack = PIO.buildExport(['all']);
  assert(pack.format === 'mes-cours-backup', 'format export');
  assert(Array.isArray(pack.data.cours) && pack.data.cours.length === 3, 'export contient 3 cours');

  // Wipe memory then import
  env.D = sampleD({ cours: [], exercices: [], devoirs: [] });
  const normalized = PIO.normalizeImport(pack);
  assert(normalized.ok, 'normalize ok');
  const report = PIO.applyImport(normalized, { sections: ['all'], mode: 'merge' });
  assert(report.ok, 'import merge ok');
  assert(deepEqual(uids(env.D), ['MA-KH1', 'PH-8X2', 'PH-DS01']), 'uids restaurés après import');
  assert(env.D.cours.find((c) => c.uid === 'PH-DS01').rang === 5, 'rang importé');
  assert(env.D.exercices[0].id === 'X-AAA1', 'exercice id importé');
}

async function testNotesOnlyReplaceKeepsCours() {
  console.log('\n[6] Import notes-only replace : cours intacts');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  env.D = sampleD();
  const uidsBefore = uids(env.D);
  const titlesBefore = env.D.cours.map((c) => c.title).sort();

  const pack = {
    format: 'mes-cours-backup',
    schemaVersion: 1,
    sections: ['notes'],
    data: {
      _notes: [
        { uid: 'PH-DS01', note: 18, rang: 1, effectif: 42 },
        { uid: 'MA-KH1', note: 12, rang: 8, effectif: 20 }
      ]
    }
  };
  const normalized = PIO.normalizeImport(pack);
  const report = PIO.applyImport(normalized, { sections: ['notes'], mode: 'replace' });
  assert(report.ok, 'import notes ok');
  assert(deepEqual(uids(env.D), uidsBefore), 'uids cours inchangés');
  assert(deepEqual(env.D.cours.map((c) => c.title).sort(), titlesBefore), 'titres cours inchangés');
  assert(env.D.cours.find((c) => c.uid === 'PH-DS01').note === 18, 'note DS mise à jour');
  assert(env.D.cours.find((c) => c.uid === 'PH-8X2').title === 'Optique géométrique', 'cours sans note intact');
}

async function testSnapshotRestoreSafetyNet() {
  console.log('\n[7] Snapshot → wipe → restore : filet de sécurité');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');
  env.D = sampleD();
  await env.save();

  const snap = PIO.createSnapshot('default', 'Avant accident');
  assert(snap && snap.bytes > 0, 'snapshot créé');

  // Accident : empty
  env.D = sampleD({ cours: [], exercices: [], devoirs: [] });
  await env.save();
  assert(PIO.readLocalProfileData('default').cours.length === 0, 'données effacées');

  await PIO.restoreSnapshot('default', snap.id);
  const restored = env.D;
  assert(restored.cours.length === 3, '3 cours restaurés');
  assert(restored.cours.some((c) => c.uid === 'PH-8X2'), 'uid PH-8X2 de retour');
  assert(restored.cours.find((c) => c.uid === 'PH-DS01').note === 14, 'notes restaurées');
}

async function testSessionPinAntiCrossWrite() {
  console.log('\n[8] Session pin : save ne pollue pas l’autre profil');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);

  await PIO.createProfile('Labo', { copyFromActive: false });
  // Seed labo empty-ish
  PIO.writeLocalProfileData('labo', sampleD({ cours: [{ uid: 'LB-ONLY', title: 'Labo only', type: 'COURS', mat: 'PHYS', cl: 'A', inter: '1', note: '', rang: '', effectif: '', desc: '', date: '2026-01-01', stat: 'ok' }], exercices: [], devoirs: [] }));

  // This tab is pinned on default but LS active_profile wrongly set to labo (multi-tab sim)
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');
  store.setItem('active_profile', 'labo');
  const meta = JSON.parse(store.getItem('mc_profiles_meta'));
  meta.activeProfile = 'labo';
  store.setItem('mc_profiles_meta', JSON.stringify(meta));

  env.D = sampleD();
  env.D.cours[0].title = 'ÉCRIT DEPUIS ONGLET DEFAULT';
  await env.save();

  const dDefault = PIO.readLocalProfileData('default');
  const dLabo = PIO.readLocalProfileData('labo');
  assert(dDefault.cours[0].title === 'ÉCRIT DEPUIS ONGLET DEFAULT', 'écrit dans default (session pin)');
  assert(dLabo.cours[0].uid === 'LB-ONLY', 'labo non écrasé');
  assert(!dLabo.cours.some((c) => c.title === 'ÉCRIT DEPUIS ONGLET DEFAULT'), 'pas de fuite vers labo');
}

async function testCloudRoundTrip() {
  console.log('\n[9] Cloud : setDoc profil conserve uids');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: false, cloudConnected: true });
  const PIO = loadProfilesIO(env);
  env._activeProfileId = 'default';
  PIO.pinSessionProfileId('default');
  env.docRef = fsMock.doc({}, 'utilisateurs', 'uid-test', 'profiles', 'default');
  env.D = sampleD();
  await env.save();

  const cloud = (await fsMock.getDoc(env.docRef)).data();
  assert(cloud && cloud.cours.length === 3, 'cloud a 3 cours');
  assert(deepEqual(uids(cloud), ['MA-KH1', 'PH-8X2', 'PH-DS01']), 'uids cloud = locaux');
  assert(cloud._account !== true, 'pas un index compte');

  // Resolve reload from cloud
  await fsMock.setDoc({ _path: 'utilisateurs/uid-test' }, {
    _account: true,
    schemaVersion: 1,
    activeProfile: 'default',
    profiles: [{ id: 'default', name: 'Principal', createdAt: 't', updatedAt: 't' }],
    deletedProfiles: {}
  });
  const resolved = await PIO.resolveProfileCloudDoc(env.currentUser);
  assert(resolved.profileId === 'default', 'profil default résolu');
  assert(deepEqual(uids(resolved.data), ['MA-KH1', 'PH-8X2', 'PH-DS01']), 'uids après resolve cloud');
}

async function testRefuseAccountAsData() {
  console.log('\n[10] Garde-fou : index compte jamais comme D');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  const ok = PIO.writeLocalProfileData('default', { _account: true, profiles: [] });
  assert(ok === false, 'refus écriture index comme profil');
  assert(!store.getItem('backup_local_cours__default') || !String(store.getItem('backup_local_cours__default')).includes('"_account":true'), 'pas d’index en local data');
}

async function testImportMergeUpsertSameUid() {
  console.log('\n[11] Import merge : upsert même uid (pas de doublon)');
  const store = makeStore();
  const fsMock = makeFirestore();
  const env = baseEnv(store, fsMock, { isLocalMode: true });
  const PIO = loadProfilesIO(env);
  env.D = sampleD();

  const pack = {
    format: 'mes-cours-backup',
    schemaVersion: 1,
    sections: ['cours'],
    data: {
      cours: [
        {
          uid: 'PH-8X2', title: 'Optique MAJ import', type: 'COURS', rev: '3',
          mat: 'PHYS', cl: 'A', inter: '1', note: '', rang: '', effectif: '',
          desc: 'from import', date: '2026-01-10', stat: 'ok'
        },
        {
          uid: 'PH-BRAND', title: 'Tout neuf', type: 'COURS', rev: '1',
          mat: 'PHYS', cl: 'A', inter: '1', note: '', rang: '', effectif: '',
          desc: '', date: '2026-04-01', stat: 'pending'
        }
      ]
    }
  };
  const report = PIO.applyImport(PIO.normalizeImport(pack), { sections: ['cours'], mode: 'merge' });
  assert(report.ok, 'merge ok');
  assert(env.D.cours.filter((c) => c.uid === 'PH-8X2').length === 1, 'un seul PH-8X2');
  assert(env.D.cours.find((c) => c.uid === 'PH-8X2').title === 'Optique MAJ import', 'titre upsert');
  assert(env.D.cours.some((c) => c.uid === 'PH-BRAND'), 'nouveau uid ajouté');
  assert(env.D.cours.some((c) => c.uid === 'PH-DS01'), 'autres cours non touchés');
}

async function main() {
  console.log('=== Tests sécurité persistance / IDs cours ===');
  await testRoundTripLocal();
  await testEditKeepsUid();
  await testProfilesIsolated();
  await testSwitchSavesBeforeLeave();
  await testExportImportPreserveUids();
  await testNotesOnlyReplaceKeepsCours();
  await testSnapshotRestoreSafetyNet();
  await testSessionPinAntiCrossWrite();
  await testCloudRoundTrip();
  await testRefuseAccountAsData();
  await testImportMergeUpsertSameUid();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nÉchecs:');
    failures.forEach((f) => console.log(' -', f));
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
