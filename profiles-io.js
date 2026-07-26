/**
 * profiles-io.js — Profils isolés (même compte) + import / export fiable
 *
 * Cloud  : utilisateurs/{uid}                    → index compte
 *          utilisateurs/{uid}/profiles/{id}      → données du profil (window.D)
 * Local  : mc_profiles_meta + backup_local_cours__{id}
 *          (+ miroir backup_local_cours = profil actif, pour repli)
 */
(function () {
  'use strict';

  var FORMAT = 'mes-cours-backup';
  var SCHEMA = 1;
  var DEFAULT_ID = 'default';
  var META_KEY = 'mc_profiles_meta';
  var ACTIVE_KEY = 'active_profile';
  var BOUND_UID_KEY = 'mc_profiles_bound_uid';
  var LEGACY_BACKUP = 'backup_local_cours';
  var LEGACY_MC = 'mc_v28';
  var SNAP_INDEX_PREFIX = 'mc_profile_snaps__';
  var SNAP_DATA_PREFIX = 'backup_snap__';
  var MAX_SNAPSHOTS = 8;

  /** Sections importables (cases à cocher) */
  var SECTIONS = [
    { id: 'structure', label: 'Matières & classeurs', hint: 'Organisation' },
    { id: 'cours', label: 'Cours / documents', hint: 'Tous les docs (IDs conservés)' },
    { id: 'notes', label: 'Notes & rangs', hint: 'Champs note/rang/effectif des DS & Khôlles' },
    { id: 'synchrotron', label: 'Synchrotron', hint: 'Cartes, devoirs, session en cours' },
    { id: 'settings', label: 'Réglages', hint: 'Thème, quotas, préférences' }
  ];

  function lsGet(key) {
    if (typeof window.safeLocalGet === 'function') return window.safeLocalGet(key);
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    if (typeof window.safeLocalSet === 'function') return window.safeLocalSet(key, val);
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }
  function lsRemove(key) {
    if (typeof window.safeLocalRemove === 'function') return window.safeLocalRemove(key);
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }
  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }
  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function nowIso() { return new Date().toISOString(); }
  function byteSizeOfString(s) {
    if (s == null || s === '') return 0;
    try { return new Blob([String(s)]).size; } catch (e) {
      try { return unescape(encodeURIComponent(String(s))).length; } catch (e2) {
        return String(s).length;
      }
    }
  }
  function formatBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' o';
    if (n < 1024 * 1024) {
      var ko = n / 1024;
      return (ko >= 10 ? ko.toFixed(0) : ko.toFixed(1)) + ' Ko';
    }
    return (n / (1024 * 1024)).toFixed(2) + ' Mo';
  }
  function slugify(name) {
    var s = String(name || 'profil')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (s || 'profil').slice(0, 24);
  }
  function uniqueId(base, existing) {
    var id = base || 'profil';
    if (!existing[id]) return id;
    var n = 2;
    while (existing[id + '-' + n]) n++;
    return id + '-' + n;
  }

  function localDataKey(profileId) {
    return LEGACY_BACKUP + '__' + (profileId || DEFAULT_ID);
  }
  function snapIndexKey(profileId) {
    return SNAP_INDEX_PREFIX + (profileId || DEFAULT_ID);
  }
  function snapDataKey(profileId, snapId) {
    return SNAP_DATA_PREFIX + (profileId || DEFAULT_ID) + '__' + snapId;
  }

  function emptyAccountIndex() {
    return {
      _account: true,
      schemaVersion: SCHEMA,
      activeProfile: DEFAULT_ID,
      activeProfileUpdatedAt: nowIso(),
      profiles: [
        { id: DEFAULT_ID, name: 'Principal', createdAt: nowIso(), updatedAt: nowIso(), bytes: 0 }
      ],
      deletedProfiles: {}
    };
  }

  function isLegacyDataDoc(data) {
    if (!data || typeof data !== 'object') return false;
    if (data._account === true) return false;
    if (data._deleted === true && !Array.isArray(data.cours) && !Array.isArray(data.exercices)) return false;
    return Array.isArray(data.cours) || Array.isArray(data.exercices)
      || Array.isArray(data.matieres) || Array.isArray(data.classeurs)
      || (data.settings != null && typeof data.settings === 'object' && !Array.isArray(data.settings));
  }

  function isAccountIndex(data) {
    return !!(data && data._account === true && Array.isArray(data.profiles));
  }

  /** true si l'objet ressemble à des données app (pas un index compte) */
  function isProfilePayload(data) {
    if (!data || typeof data !== 'object') return false;
    if (data._account === true) return false;
    if (data._deleted === true && !isLegacyDataDoc(data)) return false;
    return isLegacyDataDoc(data)
      || Array.isArray(data.cours)
      || Array.isArray(data.exercices)
      || Array.isArray(data.devoirs)
      || (data.settings && typeof data.settings === 'object');
  }

  /** Profil épinglé pour cet onglet (évite corruption multi-onglets) */
  function getSessionProfileId() {
    if (window._activeProfileId) return window._activeProfileId;
    return getActiveProfileId();
  }

  function pinSessionProfileId(id) {
    window._activeProfileId = id || getActiveProfileId();
    return window._activeProfileId;
  }

  function readMetaLocal() {
    try {
      var raw = lsGet(META_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) {
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function writeMetaLocal(meta) {
    lsSet(META_KEY, JSON.stringify(meta));
    if (meta.activeProfile) lsSet(ACTIVE_KEY, meta.activeProfile);
  }

  /**
   * Profil « coquille » (emptyData / template) — sans cours ni synchrotron.
   * Les matières/classeurs du template ne comptent PAS comme contenu utilisateur.
   */
  function isEffectivelyEmptyProfile(data) {
    if (!data || typeof data !== 'object' || data._account === true) return true;
    var cours = Array.isArray(data.cours) ? data.cours.length : 0;
    var ex = Array.isArray(data.exercices) ? data.exercices.length : 0;
    var dv = Array.isArray(data.devoirs) ? data.devoirs.length : 0;
    if (cours + ex + dv > 0) return false;
    if (data.sessionEnCoursV2) return false;
    return true;
  }

  /** Score de contenu utilisateur (anti écrasement d’un profil riche par une coquille). */
  function profileContentScore(data) {
    if (!data || typeof data !== 'object' || data._account === true) return 0;
    var cours = Array.isArray(data.cours) ? data.cours.length : 0;
    var ex = Array.isArray(data.exercices) ? data.exercices.length : 0;
    var dv = Array.isArray(data.devoirs) ? data.devoirs.length : 0;
    var score = cours * 100 + ex * 10 + dv * 10;
    if (data.sessionEnCoursV2) score += 5;
    return score;
  }

  function profileMetaUpdatedAt(data) {
    if (!data || !data.meta) return 0;
    var n = Number(data.meta.updatedAt) || 0;
    if (n > 0) return n;
    // fallback ISO
    try {
      var t = Date.parse(String(data.meta.updatedAt || ''));
      return isNaN(t) ? 0 : t;
    } catch (e) { return 0; }
  }

  function seedOwnerKey(profileId) {
    return 'mc_profile_seed_owner__' + (profileId || DEFAULT_ID);
  }
  function markSeedOwner(profileId) {
    lsSet(seedOwnerKey(profileId), '1');
  }
  function clearSeedOwner(profileId) {
    lsRemove(seedOwnerKey(profileId));
  }
  function isSeedOwner(profileId) {
    return !!lsGet(seedOwnerKey(profileId));
  }

  function purgeLocalBlobAndSnaps(profileId) {
    if (!profileId) return;
    lsRemove(localDataKey(profileId));
    try {
      var snaps = readSnapIndex(profileId);
      (snaps || []).forEach(function (s) {
        if (s && s.id) lsRemove(snapDataKey(profileId, s.id));
      });
    } catch (e) { /* ignore */ }
    lsRemove(snapIndexKey(profileId));
    clearSeedOwner(profileId);
  }

  /**
   * Lie le registre local au compte Google. Si l’UID change, purge meta/blobs locaux
   * pour ne jamais fusionner/uploader les données d’un autre compte.
   */
  function bindRegistryToUid(uid) {
    if (!uid) return { switched: false };
    var bound = lsGet(BOUND_UID_KEY);
    if (bound === uid) return { switched: false };
    if (bound && bound !== uid) {
      console.warn('[ProfilesIO] Changement de compte Google — purge registre local profils (évite contamination).');
      purgeLocalProfileStore();
      lsSet(BOUND_UID_KEY, uid);
      return { switched: true };
    }
    // Première liaison (pas encore de bound) : on lie sans tout effacer (migration mode local → cloud),
    // mais merge n’ajoutera pas de profils locaux orphelins à un index cloud déjà existant.
    lsSet(BOUND_UID_KEY, uid);
    return { switched: false, firstBind: true };
  }

  function purgeLocalProfileStore() {
    var meta = readMetaLocal();
    var ids = {};
    if (meta && Array.isArray(meta.profiles)) {
      meta.profiles.forEach(function (p) { if (p && p.id) ids[p.id] = true; });
    }
    ids[DEFAULT_ID] = true;
    Object.keys(ids).forEach(function (id) {
      purgeLocalBlobAndSnaps(id);
    });
    lsRemove(META_KEY);
    lsRemove(ACTIVE_KEY);
    lsRemove(LEGACY_BACKUP);
    lsRemove(LEGACY_MC);
    window._activeProfileId = null;
  }

  /** Assure un registre local + migration de l’ancienne clé unique */
  function ensureLocalRegistry() {
    var meta = readMetaLocal();
    if (!meta) {
      meta = emptyAccountIndex();
      var legacy = lsGet(LEGACY_BACKUP) || lsGet(LEGACY_MC);
      if (legacy && !lsGet(localDataKey(DEFAULT_ID))) {
        lsSet(localDataKey(DEFAULT_ID), legacy);
      }
      writeMetaLocal(meta);
    }
    // Jamais tous archivés : sinon plus de profil sélectionnable
    if (meta.profiles.length && !meta.profiles.some(function (p) { return p && !p.archived; })) {
      meta.profiles[0].archived = false;
    }
    var active = lsGet(ACTIVE_KEY) || meta.activeProfile || DEFAULT_ID;
    var activeEntry = meta.profiles.find(function (p) { return p.id === active; });
    if (!activeEntry || activeEntry.archived) {
      var firstLive = meta.profiles.find(function (p) { return p && p.id && !p.archived; });
      active = firstLive ? firstLive.id : (meta.profiles[0] && meta.profiles[0].id) || DEFAULT_ID;
    }
    meta.activeProfile = active;
    writeMetaLocal(meta);
    return meta;
  }

  function getActiveProfileId() {
    var meta = ensureLocalRegistry();
    return meta.activeProfile || DEFAULT_ID;
  }

  function listAllProfiles() {
    return ensureLocalRegistry().profiles.slice();
  }

  function listProfiles() {
    return listAllProfiles().filter(function (p) { return p && !p.archived; });
  }

  function listArchivedProfiles() {
    return listAllProfiles().filter(function (p) { return p && p.archived; });
  }

  function getProfileMeta(id) {
    return listAllProfiles().find(function (p) { return p.id === id; }) || null;
  }

  function setActiveProfileId(id) {
    var meta = ensureLocalRegistry();
    var p = meta.profiles.find(function (x) { return x.id === id; });
    if (!p) throw new Error('Profil inconnu : ' + id);
    if (p.archived) throw new Error('Ce profil est archivé. Désarchive-le avant de l’activer.');
    meta.activeProfile = id;
    meta.activeProfileUpdatedAt = nowIso();
    writeMetaLocal(meta);
  }

  /** Met à jour la taille annoncée d’un profil dans le registre (local + cloud via index). */
  function setProfileBytesMeta(profileId, bytes) {
    var meta = ensureLocalRegistry();
    var n = Math.max(0, Number(bytes) || 0);
    var changed = false;
    meta.profiles.forEach(function (p) {
      if (p && p.id === profileId) {
        if (p.bytes !== n) {
          p.bytes = n;
          p.updatedAt = nowIso();
          changed = true;
        }
      }
    });
    if (changed) writeMetaLocal(meta);
    return changed;
  }

  function readLocalProfileData(profileId) {
    var key = localDataKey(profileId);
    var raw = lsGet(key);
    if (!raw && profileId === DEFAULT_ID) {
      raw = lsGet(LEGACY_BACKUP) || lsGet(LEGACY_MC);
    }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed._account === true) {
        console.warn('[ProfilesIO] Ignoré sauvegarde locale corrompue (index compte) pour', profileId);
        return null;
      }
      return parsed;
    } catch (e) { return null; }
  }

  function writeLocalProfileData(profileId, data, opts) {
    opts = opts || {};
    var obj = data;
    if (typeof data === 'string') {
      try { obj = JSON.parse(data); } catch (e) {
        console.error('[ProfilesIO] writeLocal: JSON invalide');
        return false;
      }
    }
    if (obj && obj._account === true) {
      console.error('[ProfilesIO] Refus d’écrire un index compte comme données de profil');
      return false;
    }
    // Anti-wipe : coquille emptyData ne remplace pas un blob local non vide
    // allowEmpty (miroir secondary / reset) : seulement si le payload est plus
    // récent (updatedAt) ou d’une génération supérieure (delete+recreate).
    var allowEmpty = !!(opts.allowEmpty || window._allowEmptyProfileWrite);
    if (isEffectivelyEmptyProfile(obj)) {
      try {
        var existing = readLocalProfileData(profileId);
        if (existing && !isEffectivelyEmptyProfile(existing)) {
          if (!allowEmpty) {
            console.error('[ProfilesIO] Refus writeLocal : écrasement vide d’un profil local non vide');
            return false;
          }
          var localTs = Number((existing.meta && existing.meta.updatedAt) || 0) || 0;
          var remoteTs = Number((obj && obj.meta && obj.meta.updatedAt) || 0) || 0;
          var localGen = Number((existing.meta && existing.meta.profileGeneration) || 0) || 0;
          var remoteGen = Number((obj && obj.meta && obj.meta.profileGeneration) || 0) || 0;
          var genBump = remoteGen > 0 && localGen > 0 && remoteGen > localGen;
          if (!genBump && !(remoteTs > localTs)) {
            console.error('[ProfilesIO] Refus writeLocal allowEmpty : coquille pas plus récente que le local riche');
            return false;
          }
        }
      } catch (e) {
        console.error('[ProfilesIO] Refus writeLocal : contrôle anti-wipe impossible');
        return false;
      }
    }
    var payload = typeof data === 'string' ? data : JSON.stringify(data);
    var ok = lsSet(localDataKey(profileId), payload);
    if (!ok) {
      console.error('[ProfilesIO] Échec localStorage pour', profileId);
      return false;
    }
    // Miroir legacy UNIQUEMENT pour le profil default (évite de polluer le repli)
    if (profileId === DEFAULT_ID) {
      var okMirror = lsSet(LEGACY_BACKUP, payload);
      if (!okMirror) {
        console.warn('[ProfilesIO] Miroir backup_local_cours impossible (quota ?)');
      }
    }
    try {
      var meta = ensureLocalRegistry();
      var bytes = byteSizeOfString(payload);
      meta.profiles.forEach(function (p) {
        if (p.id === profileId) {
          p.updatedAt = nowIso();
          p.bytes = bytes;
        }
      });
      writeMetaLocal(meta);
    } catch (e) {
      console.warn('[ProfilesIO] meta non mise à jour:', e);
    }
    return true;
  }

  /**
   * Vérifie qu’on peut écrire le blob cloud du profil (pas tombstoné / pas pending étranger).
   * @returns {{ ok:boolean, reason?:string }}
   */
  async function assertProfileCloudWritable(user, profileId) {
    if (!user || !user.sub || !profileId) return { ok: false, reason: 'missing-user-or-profile' };
    if (!window.getDoc || !window.doc || !window.db) return { ok: false, reason: 'no-firestore' };
    try {
      var snap = await window.getDoc(accountDocRef(user.sub));
      if (!snap.exists()) return { ok: true };
      var idx = snap.data();
      if (!isAccountIndex(idx)) return { ok: false, reason: 'bad-index' };
      var deleted = idx.deletedProfiles || {};
      if (deleted[profileId]) return { ok: false, reason: 'tombstoned' };
      var entry = (idx.profiles || []).find(function (p) { return p && p.id === profileId; });
      if (!entry) return { ok: false, reason: 'not-in-index' };
      if (entry.archived) return { ok: false, reason: 'archived' };
      // Seed en cours créé ailleurs : ne pas recréer/écraser le blob
      if (entry.cloudBlobPending && !isSeedOwner(profileId)) {
        return { ok: false, reason: 'cloud-blob-pending' };
      }
      return { ok: true };
    } catch (e) {
      // Index illisible : fail-closed (évite réécriture d’un profil tombstoné non lu)
      return { ok: false, reason: 'index-read-failed' };
    }
  }

  function getLocalProfileRaw(profileId) {
    var raw = lsGet(localDataKey(profileId));
    if (!raw && profileId === DEFAULT_ID) {
      raw = lsGet(LEGACY_BACKUP) || lsGet(LEGACY_MC);
    }
    return raw || null;
  }

  function getProfileLiveBytes(profileId) {
    var bytes = byteSizeOfString(getLocalProfileRaw(profileId));
    // Profil de cette session : tenir compte de window.D non encore flushé
    if (profileId === getSessionProfileId() && window.D && isProfilePayload(window.D)) {
      try {
        var mem = byteSizeOfString(JSON.stringify(window.D));
        if (mem > bytes) bytes = mem;
      } catch (e) { /* ignore */ }
    }
    // Autre appareil : pas de blob local → taille annoncée via l’index (cloud/meta)
    if (bytes === 0) {
      var metaP = getProfileMeta(profileId);
      if (metaP && metaP.bytes != null) {
        var announced = Math.max(0, Number(metaP.bytes) || 0);
        if (announced > 0) bytes = announced;
      }
    }
    return bytes;
  }

  function readSnapIndex(profileId) {
    try {
      var raw = lsGet(snapIndexKey(profileId));
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeSnapIndex(profileId, arr) {
    return lsSet(snapIndexKey(profileId), JSON.stringify(arr || []));
  }

  function listSnapshots(profileId) {
    return readSnapIndex(profileId).map(function (s) {
      var raw = lsGet(snapDataKey(profileId, s.id));
      var bytes = s.bytes != null ? s.bytes : byteSizeOfString(raw);
      return {
        id: s.id,
        label: s.label || 'Sauvegarde',
        createdAt: s.createdAt || '',
        bytes: bytes,
        sizeLabel: formatBytes(bytes)
      };
    }).sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function wipeSnapshots(profileId) {
    var idx = readSnapIndex(profileId);
    idx.forEach(function (s) {
      if (s && s.id) lsRemove(snapDataKey(profileId, s.id));
    });
    lsRemove(snapIndexKey(profileId));
  }

  function getProfileStorageInfo(profileId) {
    var liveBytes = getProfileLiveBytes(profileId);
    var snaps = listSnapshots(profileId);
    var snapBytes = snaps.reduce(function (sum, s) { return sum + (s.bytes || 0); }, 0);
    return {
      profileId: profileId,
      liveBytes: liveBytes,
      liveLabel: formatBytes(liveBytes),
      snapCount: snaps.length,
      snapBytes: snapBytes,
      snapLabel: formatBytes(snapBytes),
      totalBytes: liveBytes + snapBytes,
      totalLabel: formatBytes(liveBytes + snapBytes),
      snapshots: snaps
    };
  }

  function createSnapshot(profileId, label) {
    profileId = profileId || getSessionProfileId();
    if (!getProfileMeta(profileId)) throw new Error('Profil introuvable');
    var dataObj;
    if (profileId === getSessionProfileId() && window.D && isProfilePayload(window.D)) {
      dataObj = deepClone(window.D);
    } else {
      dataObj = readLocalProfileData(profileId);
    }
    if (!dataObj || !isProfilePayload(dataObj)) {
      throw new Error('Aucune donnée à sauvegarder pour ce profil.');
    }
    var payload = JSON.stringify(dataObj);
    var bytes = byteSizeOfString(payload);
    var snapId = 's' + Date.now().toString(36);
    if (!lsSet(snapDataKey(profileId, snapId), payload)) {
      throw new Error('Stockage navigateur plein — impossible de créer la sauvegarde.');
    }
    var idx = readSnapIndex(profileId);
    idx.unshift({
      id: snapId,
      label: String(label || 'Sauvegarde').trim().slice(0, 60) || 'Sauvegarde',
      createdAt: nowIso(),
      bytes: bytes
    });
    // Eviction différée : ne pas effacer les blobs tant que l’index n’est pas écrit
    var evicted = [];
    while (idx.length > MAX_SNAPSHOTS) {
      evicted.push(idx.pop());
    }
    if (!writeSnapIndex(profileId, idx)) {
      lsRemove(snapDataKey(profileId, snapId));
      throw new Error('Impossible d’enregistrer l’index des sauvegardes (quota).');
    }
    evicted.forEach(function (old) {
      if (old && old.id) lsRemove(snapDataKey(profileId, old.id));
    });
    return listSnapshots(profileId).find(function (s) { return s.id === snapId; });
  }

  async function restoreSnapshot(profileId, snapId) {
    profileId = profileId || getSessionProfileId();
    var raw = lsGet(snapDataKey(profileId, snapId));
    if (!raw) throw new Error('Sauvegarde introuvable.');
    var data;
    try { data = JSON.parse(raw); } catch (e) {
      throw new Error('Sauvegarde corrompue.');
    }
    if (!isProfilePayload(data)) throw new Error('Sauvegarde invalide.');
    if (!writeLocalProfileData(profileId, data)) {
      throw new Error('Impossible d’écrire la restauration (quota navigateur).');
    }
    if (profileId === getSessionProfileId()) {
      window.D = data;
      if (typeof window.save === 'function') {
        try { await window.save(); } catch (e) {
          throw new Error('Données restaurées en local, sauvegarde cloud : ' + (e.message || e));
        }
      }
      if (typeof window.applySettings === 'function') window.applySettings();
    }
    return true;
  }

  function deleteSnapshot(profileId, snapId) {
    profileId = profileId || getSessionProfileId();
    var idx = readSnapIndex(profileId).filter(function (s) { return s.id !== snapId; });
    lsRemove(snapDataKey(profileId, snapId));
    writeSnapIndex(profileId, idx);
    return true;
  }

  function accountDocRef(uid) {
    return window.doc(window.db, 'utilisateurs', uid);
  }

  function profileDocRef(uid, profileId) {
    return window.doc(window.db, 'utilisateurs', uid, 'profiles', profileId);
  }

  /**
   * Résout le document de données du profil actif.
   * Migre l’ancien blob racine → profiles/default si besoin.
   */
  async function resolveProfileCloudDoc(user) {
    if (!user || !user.sub) throw new Error('Identifiant Google (UID) manquant.');
    if (!window.doc || !window.db || !window.getDoc) {
      throw new Error('Modules Firebase manquants.');
    }

    var uid = user.sub;
    // Empêche la fusion/upload des profils d’un autre compte Google sur cet appareil
    bindRegistryToUid(uid);
    var accountRef = accountDocRef(uid);
    var accountSnap = await window.getDoc(accountRef);
    var accountData = accountSnap.exists() ? accountSnap.data() : null;

    // Legacy : tout le D était sur la racine
    if (isLegacyDataDoc(accountData)) {
      var legacyD = accountData;
      var index = emptyAccountIndex();
      index.profiles[0].updatedAt = nowIso();
      try {
        index.profiles[0].bytes = byteSizeOfString(JSON.stringify(legacyD));
      } catch (eBytes) { /* ignore */ }
      try {
        await window.setDoc(profileDocRef(uid, DEFAULT_ID), legacyD);
        await window.setDoc(accountRef, index);
        accountData = index;
        console.log('☁️ Migration compte → profils/default effectuée.');
      } catch (e) {
        console.warn('☁️ Migration profils impossible — mode local-only (pas d’écriture sur la racine compte):', e);
        pinSessionProfileId(DEFAULT_ID);
        return {
          docRef: null,
          accountRef: accountRef,
          data: legacyD,
          profileId: DEFAULT_ID,
          legacyRoot: true,
          migrated: false,
          localOnly: true
        };
      }
    }

    if (!accountSnap.exists() || accountData == null) {
      // Vrai nouveau compte uniquement
      var fresh = emptyAccountIndex();
      var localMeta = ensureLocalRegistry();
      var localActive = localMeta.activeProfile || getActiveProfileId();
      fresh.activeProfile = localActive;
      fresh.activeProfileUpdatedAt = localMeta.activeProfileUpdatedAt || nowIso();
      if (!fresh.profiles.some(function (p) { return p.id === localActive; })) {
        fresh.profiles = listProfiles().map(function (p) {
          return {
            id: p.id,
            name: p.name,
            createdAt: p.createdAt || nowIso(),
            updatedAt: p.updatedAt || nowIso(),
            bytes: Math.max(0, Number(p.bytes) || 0)
          };
        });
        fresh.activeProfile = localActive;
        fresh.activeProfileUpdatedAt = localMeta.activeProfileUpdatedAt || nowIso();
      } else if (localMeta.profiles && localMeta.profiles[0]) {
        var lp0 = localMeta.profiles.find(function (p) { return p.id === DEFAULT_ID; }) || localMeta.profiles[0];
        if (lp0 && fresh.profiles[0]) {
          fresh.profiles[0].bytes = Math.max(0, Number(lp0.bytes) || 0);
          fresh.profiles[0].name = lp0.name || fresh.profiles[0].name;
        }
      }
      try {
        if (window.setDoc) await window.setDoc(accountRef, fresh);
      } catch (e) { console.warn('Index compte non écrit:', e); }
      accountData = fresh;
    } else if (!isAccountIndex(accountData)) {
      // Document racine inconnu : NE PAS écraser
      console.error('[ProfilesIO] Document compte non reconnu — pas d’écrasement.', accountData && Object.keys(accountData));
      throw new Error(
        'Structure cloud inattendue pour ce compte. Aucune donnée n’a été modifiée. ' +
        'Recharge ou contacte le support avant de continuer.'
      );
    }

    // Sync local registry names from cloud when possible
    syncRegistryFromAccount(accountData);

    // Multi-appareils : adopter le profil actif cloud si plus récent / valide
    var profileId = adoptActiveProfileFromCloud(accountData);
    var deletedMap = accountData.deletedProfiles || {};
    if (deletedMap[profileId]) {
      profileId = accountData.activeProfile || DEFAULT_ID;
      if (deletedMap[profileId] || !accountData.profiles.some(function (p) { return p.id === profileId; })) {
        profileId = (accountData.profiles[0] && accountData.profiles[0].id) || DEFAULT_ID;
      }
      setActiveProfileId(profileId);
    }
    if (!accountData.profiles.some(function (p) { return p.id === profileId; })) {
      profileId = accountData.activeProfile || DEFAULT_ID;
      if (!accountData.profiles.some(function (p) { return p.id === profileId; })) {
        profileId = accountData.profiles[0] ? accountData.profiles[0].id : DEFAULT_ID;
      }
      setActiveProfileId(profileId);
    }
    pinSessionProfileId(profileId);

    // Si ce dispositif a un choix plus récent, le republier pour les autres appareils
    try {
      var metaPush = ensureLocalRegistry();
      var localTsPush = String(metaPush.activeProfileUpdatedAt || '');
      var cloudTsPush = String(accountData.activeProfileUpdatedAt || '');
      var shouldPushActive = metaPush.activeProfile
        && metaPush.activeProfile !== accountData.activeProfile
        && localTsPush
        && (!cloudTsPush || localTsPush >= cloudTsPush);
      if (shouldPushActive && window.cloudConnected !== false) {
        await persistAccountIndexCloud(user, metaPush);
      }
    } catch (ePush) {
      console.warn('[ProfilesIO] Republish activeProfile:', ePush);
    }

    var pref = profileDocRef(uid, profileId);
    var snap = await window.getDoc(pref);
    var indexEntry = (accountData.profiles || []).find(function (p) { return p && p.id === profileId; }) || null;
    if (snap.exists()) {
      var cloudPayload = snap.data();
      if (cloudPayload && cloudPayload._deleted) {
        return {
          docRef: pref,
          accountRef: accountRef,
          data: null,
          profileId: profileId,
          legacyRoot: false,
          migrated: false
        };
      }
      if (cloudPayload && cloudPayload._account === true) {
        console.error('[ProfilesIO] Profil cloud contient un index — ignoré');
        return {
          docRef: pref,
          accountRef: accountRef,
          data: null,
          profileId: profileId,
          legacyRoot: false,
          migrated: false
        };
      }

      // Cloud coquille / plus pauvre que le local riche → ne pas écraser le travail local
      var localForCompare = readLocalProfileData(profileId);
      if (localForCompare && !isProfilePayload(localForCompare)) localForCompare = null;
      if (localForCompare && !isEffectivelyEmptyProfile(localForCompare)) {
        var cloudEmpty = isEffectivelyEmptyProfile(cloudPayload);
        var localScore = profileContentScore(localForCompare);
        var cloudScore = profileContentScore(cloudPayload);
        var localTs = profileMetaUpdatedAt(localForCompare);
        var cloudTs = profileMetaUpdatedAt(cloudPayload);
        var localRicher = cloudEmpty || localScore > cloudScore;
        var localNewerOrEqual = !cloudTs || localTs >= cloudTs;
        // Jamais « score × 2 » : un cloud plus récent avec moins de cours (suppressions
        // intentionnelles) doit gagner. Republier seulement coquille cloud ou local plus récent.
        var indexGen = indexEntry && indexEntry.generation != null ? Number(indexEntry.generation) : 0;
        var localGen = localForCompare.meta && localForCompare.meta.profileGeneration != null
          ? Number(localForCompare.meta.profileGeneration) : 0;
        if (indexGen && localGen && localGen !== indexGen) {
          // Génération différente (delete+recreate) : jeter le local zombie
          console.warn('[ProfilesIO] Local génération obsolète — purge', profileId, localGen, '≠', indexGen);
          purgeLocalBlobAndSnaps(profileId);
          localForCompare = null;
        } else if (localForCompare && localRicher && (cloudEmpty || localNewerOrEqual)) {
          // Republier le local riche (sauve le travail après poison empty / create collision)
          if (window.setDoc) {
            try { await window.setDoc(pref, localForCompare); } catch (eRep) {
              console.warn('[ProfilesIO] Republish local riche échoué:', eRep);
            }
          }
          return {
            docRef: pref,
            accountRef: accountRef,
            data: localForCompare,
            profileId: profileId,
            legacyRoot: false,
            migrated: false,
            recoveredFromLocal: true
          };
        }
      }

      return {
        docRef: pref,
        accountRef: accountRef,
        data: cloudPayload,
        profileId: profileId,
        legacyRoot: false,
        migrated: false
      };
    }

    // Profil cloud absent : republier UNIQUEMENT le seed du créateur (seed owner),
    // jamais une coquille emptyData d’un autre appareil.
    var inIndex = accountData.profiles.some(function (p) { return p && p.id === profileId; });
    var announcedBytes = Math.max(0, Number(indexEntry && indexEntry.bytes) || 0);
    var seedPending = !!(indexEntry && indexEntry.cloudBlobPending);
    var localD = null;
    if (inIndex && !deletedMap[profileId]) {
      localD = readLocalProfileData(profileId);
      if (localD && !isProfilePayload(localD)) localD = null;
    }

    async function publishLocalSeedAndClearPending() {
      if (!localD || !window.setDoc) return false;
      try {
        await window.setDoc(pref, localD);
      } catch (e) { return false; }
      clearSeedOwner(profileId);
      if (indexEntry && indexEntry.cloudBlobPending) {
        try {
          var metaClear = ensureLocalRegistry();
          metaClear.profiles.forEach(function (p) {
            if (p && p.id === profileId) {
              p.cloudBlobPending = false;
              p.bytes = getProfileLiveBytes(profileId);
              p.updatedAt = nowIso();
            }
          });
          writeMetaLocal(metaClear);
          await persistAccountIndexCloud(user, metaClear, { clearBlobPendingIds: [profileId] });
        } catch (eClear) { /* ignore */ }
      }
      return true;
    }

    if (inIndex && !deletedMap[profileId] && (seedPending || announcedBytes > 0)) {
      // Créateur : republie le seed (même coquille template)
      if (localD && isSeedOwner(profileId)) {
        await publishLocalSeedAndClearPending();
        return {
          docRef: pref,
          accountRef: accountRef,
          data: localD,
          profileId: profileId,
          legacyRoot: false,
          migrated: false,
          cloudPending: false
        };
      }
      // Non-owner : JAMAIS republier un local potentiellement périmé tant que le blob cloud
      // manque (pending ou bytes annoncés). On conserve le local non vide pour l’UI.
      if (localD && !isEffectivelyEmptyProfile(localD)) {
        return {
          docRef: null,
          accountRef: accountRef,
          data: localD,
          profileId: profileId,
          legacyRoot: false,
          migrated: false,
          cloudPending: true,
          localOnly: true
        };
      }
      // Coquille emptyData / pas de local : pas de docRef writable
      return {
        docRef: null,
        accountRef: accountRef,
        data: null,
        profileId: profileId,
        legacyRoot: false,
        migrated: false,
        cloudPending: true,
        localOnly: true
      };
    }

    // Cloud absent, rien annoncé : seul le seed owner (ou un local riche en 1ʳᵉ sync) publie.
    // Jamais une coquille anonyme qui créerait un blob vide empoisonnant les autres appareils.
    if (inIndex && !deletedMap[profileId] && localD && window.setDoc) {
      if (isSeedOwner(profileId)) {
        try { await window.setDoc(pref, localD); } catch (e) { /* ignore */ }
      } else if (!isEffectivelyEmptyProfile(localD)) {
        // Première sync d’un local riche sans index bytes : publier pour ne pas perdre le travail
        try { await window.setDoc(pref, localD); } catch (e) { /* ignore */ }
      }
      // else : coquille non-owner → ne pas créer de blob vide
    }

    var stillMissing = true;
    try {
      var check = await window.getDoc(pref);
      stillMissing = !check.exists();
    } catch (eChk) { /* ignore */ }

    if (stillMissing && inIndex && !deletedMap[profileId] && (!localD || isEffectivelyEmptyProfile(localD))) {
      // Nouveau profil vraiment vide sur ce device : docRef OK pour première écriture utilisateur
      return {
        docRef: pref,
        accountRef: accountRef,
        data: localD,
        profileId: profileId,
        legacyRoot: false,
        migrated: false,
        cloudPending: false
      };
    }
    if (stillMissing && localD && !isEffectivelyEmptyProfile(localD) && !isSeedOwner(profileId)) {
      return {
        docRef: null,
        accountRef: accountRef,
        data: localD,
        profileId: profileId,
        legacyRoot: false,
        migrated: false,
        cloudPending: true,
        localOnly: true
      };
    }

    return {
      docRef: pref,
      accountRef: accountRef,
      data: localD,
      profileId: profileId,
      legacyRoot: false,
      migrated: false,
      cloudPending: false
    };
  }

  /**
   * Adopte le profil actif cloud si valide et plus récent que le choix local.
   * Permet à tous les appareils de partager le même profil actif.
   */
  function adoptActiveProfileFromCloud(accountData) {
    if (!isAccountIndex(accountData)) return getActiveProfileId();
    var cloudActive = accountData.activeProfile;
    var deleted = accountData.deletedProfiles || {};
    if (!cloudActive || deleted[cloudActive]) return getActiveProfileId();
    var cloudEntry = (accountData.profiles || []).find(function (p) {
      return p && p.id === cloudActive && !p.archived;
    });
    if (!cloudEntry) return getActiveProfileId();

    var meta = ensureLocalRegistry();
    var localActive = meta.activeProfile || DEFAULT_ID;
    var cloudTs = String(accountData.activeProfileUpdatedAt || '');
    var localTs = String(meta.activeProfileUpdatedAt || '');

    var takeCloud = false;
    if (cloudActive === localActive) {
      // Aligner le timestamp local si manquant
      if (cloudTs && !localTs) {
        meta.activeProfileUpdatedAt = cloudTs;
        writeMetaLocal(meta);
      }
      return cloudActive;
    }
    if (cloudTs && localTs) takeCloud = cloudTs >= localTs;
    else if (cloudTs && !localTs) takeCloud = true;
    else if (!cloudTs && localTs) takeCloud = false;
    else takeCloud = true; // sans horodatage : le cloud gagne (sync multi-appareils)

    if (takeCloud) {
      meta.activeProfile = cloudActive;
      meta.activeProfileUpdatedAt = cloudTs || nowIso();
      writeMetaLocal(meta);
      pinSessionProfileId(cloudActive);
      return cloudActive;
    }
    return localActive;
  }

  function syncRegistryFromAccount(accountData) {
    if (!isAccountIndex(accountData)) return;
    var meta = ensureLocalRegistry();
    var deleted = accountData.deletedProfiles || {};
    var byId = {};
    meta.profiles.forEach(function (p) { byId[p.id] = p; });
    (accountData.profiles || []).forEach(function (cp) {
      if (!cp || !cp.id || deleted[cp.id]) return;
      if (byId[cp.id] && byId[cp.id] !== true) {
        byId[cp.id].name = cp.name || byId[cp.id].name;
        byId[cp.id].updatedAt = cp.updatedAt || byId[cp.id].updatedAt;
        byId[cp.id].archived = !!cp.archived;
        // Taille annoncée cloud → autres appareils (évite « 0 o »)
        if (cp.bytes != null) {
          var cloudBytes = Math.max(0, Number(cp.bytes) || 0);
          var localBytes = Math.max(0, Number(byId[cp.id].bytes) || 0);
          var hasLocalBlob = !!getLocalProfileRaw(cp.id);
          if (!hasLocalBlob || cloudBytes > localBytes) {
            byId[cp.id].bytes = cloudBytes;
          }
        }
        if (cp.cloudBlobPending != null) byId[cp.id].cloudBlobPending = !!cp.cloudBlobPending;
        if (cp.generation != null) {
          var prevGen = Number(byId[cp.id].generation) || 0;
          var nextGen = Number(cp.generation) || 0;
          if (nextGen && nextGen !== prevGen) {
            // Nouvelle génération cloud → purger blob local zombie (delete+recreate)
            if (prevGen && nextGen !== prevGen) purgeLocalBlobAndSnaps(cp.id);
            else if (!prevGen && getLocalProfileRaw(cp.id)) {
              var loc = readLocalProfileData(cp.id);
              var locGen = loc && loc.meta && loc.meta.profileGeneration != null
                ? Number(loc.meta.profileGeneration) : 0;
              if (locGen && locGen !== nextGen) purgeLocalBlobAndSnaps(cp.id);
            }
          }
          byId[cp.id].generation = nextGen || cp.generation;
        }
      } else {
        meta.profiles.push({
          id: cp.id,
          name: cp.name || cp.id,
          createdAt: cp.createdAt || nowIso(),
          updatedAt: cp.updatedAt || nowIso(),
          archived: !!cp.archived,
          bytes: Math.max(0, Number(cp.bytes) || 0),
          cloudBlobPending: !!cp.cloudBlobPending,
          generation: cp.generation != null ? Number(cp.generation) : undefined
        });
        byId[cp.id] = meta.profiles[meta.profiles.length - 1];
        // Nouveau profil cloud : si un blob local d’ancienne génération traîne, purger
        if (cp.generation != null && getLocalProfileRaw(cp.id)) {
          var locNew = readLocalProfileData(cp.id);
          var locGenNew = locNew && locNew.meta && locNew.meta.profileGeneration != null
            ? Number(locNew.meta.profileGeneration) : 0;
          if (locGenNew && locGenNew !== Number(cp.generation)) purgeLocalBlobAndSnaps(cp.id);
        }
      }
    });

    if (accountData.activeProfileUpdatedAt && !meta.activeProfileUpdatedAt) {
      meta.activeProfileUpdatedAt = accountData.activeProfileUpdatedAt;
    }

    function pickNonArchived(preferred) {
      if (preferred && !deleted[preferred]) {
        var pref = meta.profiles.find(function (p) { return p.id === preferred && !p.archived; });
        if (pref) return preferred;
      }
      var found = null;
      meta.profiles.some(function (p) {
        if (p && p.id && !deleted[p.id] && !p.archived) { found = p.id; return true; }
        return false;
      });
      if (found) return found;
      // Tous archivés (ou vides) : désarchiver un profil pour garder une issue
      var revive = meta.profiles.find(function (p) {
        return p && p.id && !deleted[p.id];
      });
      if (revive) {
        revive.archived = false;
        return revive.id;
      }
      return DEFAULT_ID;
    }

    // Si la session courante est tombstonée ou archivée, basculer AVANT de purger
    var sessionId = getSessionProfileId();
    var sessionMeta = meta.profiles.find(function (p) { return p.id === sessionId; });
    var activeMeta = meta.profiles.find(function (p) { return p.id === meta.activeProfile; });
    if (deleted[sessionId] || deleted[meta.activeProfile]
        || (sessionMeta && sessionMeta.archived) || (activeMeta && activeMeta.archived)) {
      var nextId = pickNonArchived(accountData.activeProfile);
      meta.activeProfile = nextId;
      meta.activeProfileUpdatedAt = accountData.activeProfileUpdatedAt || nowIso();
      lsSet(ACTIVE_KEY, nextId);
      pinSessionProfileId(nextId);
      sessionId = nextId;
    }

    // Purger tous les tombstones (meta + blobs locaux orphelins — anti republish après delete/recreate)
    Object.keys(deleted).forEach(function (delId) {
      if (delId) purgeLocalBlobAndSnaps(delId);
    });
    meta.profiles = meta.profiles.filter(function (p) {
      if (!p || !p.id) return false;
      if (deleted[p.id]) return false;
      return true;
    });
    if (!meta.profiles.some(function (p) { return p.id === meta.activeProfile && !p.archived; })) {
      meta.activeProfile = pickNonArchived(null);
      lsSet(ACTIVE_KEY, meta.activeProfile);
      pinSessionProfileId(meta.activeProfile);
    }
    writeMetaLocal(meta);
  }

  /**
   * Fusionne meta locale + index remote + tombstones / revives.
   * @returns {{ ok:boolean, payload?:object, reason?:string }}
   */
  function mergeAccountIndexPayload(remote, meta, opts) {
    opts = opts || {};
    var removedIds = opts.removedIds || [];
    var removedSet = Object.create(null);
    removedIds.forEach(function (id) { if (id) removedSet[id] = true; });

    var remoteProfiles = [];
    var remoteActive = null;
    var deletedProfiles = {};

    if (remote != null) {
      if (isAccountIndex(remote)) {
        remoteProfiles = remote.profiles || [];
        remoteActive = remote.activeProfile || null;
        deletedProfiles = remote.deletedProfiles && typeof remote.deletedProfiles === 'object'
          ? Object.assign({}, remote.deletedProfiles)
          : {};
      } else if (isLegacyDataDoc(remote)) {
        return { ok: false, reason: 'legacy' };
      } else {
        return { ok: false, reason: 'unrecognized' };
      }
    }

    removedIds.forEach(function (id) {
      if (id) deletedProfiles[id] = Date.now();
    });
    (opts.revivedIds || []).forEach(function (id) {
      if (id) delete deletedProfiles[id];
    });

    var byId = Object.create(null);
    remoteProfiles.forEach(function (p) {
      if (!p || !p.id || removedSet[p.id] || deletedProfiles[p.id]) return;
      byId[p.id] = {
        id: p.id,
        name: p.name || p.id,
        createdAt: p.createdAt || nowIso(),
        updatedAt: p.updatedAt || nowIso(),
        archived: !!p.archived,
        bytes: Math.max(0, Number(p.bytes) || 0),
        cloudBlobPending: !!p.cloudBlobPending,
        generation: p.generation != null ? Number(p.generation) : undefined
      };
    });
    (meta.profiles || []).forEach(function (p) {
      if (!p || !p.id || removedSet[p.id] || deletedProfiles[p.id]) return;
      var localBytes = Math.max(0, Number(p.bytes) || 0);
      var hasLocalBlob = !!getLocalProfileRaw(p.id);
      if (byId[p.id]) {
        byId[p.id].name = p.name || byId[p.id].name;
        byId[p.id].updatedAt = p.updatedAt || nowIso();
        byId[p.id].archived = !!p.archived;
        // Taille : si ce device a le blob, sa mesure prime ; sinon garder le max annoncé
        if (hasLocalBlob) byId[p.id].bytes = localBytes;
        else byId[p.id].bytes = Math.max(localBytes, Math.max(0, Number(byId[p.id].bytes) || 0));
        // Génération : garder le max (recreate gagne)
        if (p.generation != null) {
          var gLocal = Number(p.generation) || 0;
          var gRemote = Number(byId[p.id].generation) || 0;
          byId[p.id].generation = Math.max(gLocal, gRemote) || p.generation;
        }
        // Pending : seul un clear explicite (après setDoc blob réussi) peut baisser le flag
        if (p.cloudBlobPending === true) byId[p.id].cloudBlobPending = true;
        else if (p.cloudBlobPending === false) {
          var clearList = opts.clearBlobPendingIds || [];
          if (clearList.indexOf(p.id) !== -1) byId[p.id].cloudBlobPending = false;
        }
      } else {
        // Profil local-only : ne pas contaminer un index cloud existant
        // (création explicite via revivedIds, ou premier index remote absent)
        var revived = (opts.revivedIds || []).indexOf(p.id) !== -1;
        var allowOrphan = !!opts.allowLocalCreate || remote == null || revived;
        if (!allowOrphan) return;
        byId[p.id] = {
          id: p.id,
          name: p.name || p.id,
          createdAt: p.createdAt || nowIso(),
          updatedAt: p.updatedAt || nowIso(),
          archived: !!p.archived,
          bytes: localBytes,
          cloudBlobPending: !!p.cloudBlobPending,
          generation: p.generation != null ? Number(p.generation) : undefined
        };
      }
    });

    // Profil actif multi-appareils : le plus récent (activeProfileUpdatedAt) gagne
    var localActive = meta.activeProfile || DEFAULT_ID;
    var localTs = String(meta.activeProfileUpdatedAt || '');
    var remoteTs = String((remote && remote.activeProfileUpdatedAt) || '');
    var chosenActive = localActive;
    var chosenTs = localTs;
    if (remoteActive && remoteActive !== localActive) {
      if (localTs && remoteTs) {
        if (remoteTs >= localTs) {
          chosenActive = remoteActive;
          chosenTs = remoteTs;
        }
      } else if (!localTs && remoteTs) {
        chosenActive = remoteActive;
        chosenTs = remoteTs;
      } else if (!localTs && !remoteTs) {
        // Sans horodatage des deux côtés : conserver le cloud (évite écrasement croisé)
        chosenActive = remoteActive;
      }
    } else if (remoteActive && remoteActive === localActive) {
      chosenTs = localTs && remoteTs
        ? (remoteTs >= localTs ? remoteTs : localTs)
        : (localTs || remoteTs);
    }

    var payload = {
      _account: true,
      schemaVersion: SCHEMA,
      activeProfile: chosenActive || remoteActive || DEFAULT_ID,
      activeProfileUpdatedAt: chosenTs || nowIso(),
      profiles: Object.keys(byId).map(function (k) { return byId[k]; }),
      deletedProfiles: deletedProfiles
    };
    var activeEntry = payload.profiles.find(function (p) { return p.id === payload.activeProfile; });
    if (removedSet[payload.activeProfile] || deletedProfiles[payload.activeProfile]
      || !activeEntry || activeEntry.archived) {
      var fallback = payload.profiles.find(function (p) { return p && !p.archived; });
      if (!fallback && payload.profiles[0]) {
        payload.profiles[0].archived = false;
        fallback = payload.profiles[0];
      }
      payload.activeProfile = fallback ? fallback.id : DEFAULT_ID;
      payload.activeProfileUpdatedAt = nowIso();
    }
    // Sécurité : au moins un profil non archivé dans l’index cloud
    if (payload.profiles.length && !payload.profiles.some(function (p) { return p && !p.archived; })) {
      payload.profiles[0].archived = false;
      payload.activeProfile = payload.profiles[0].id;
      payload.activeProfileUpdatedAt = nowIso();
    }
    return { ok: true, payload: payload };
  }

  /**
   * Écrit l’index compte cloud (transaction si dispo → moins de LWW multi-onglets).
   * @param opts.removedIds — profils à retirer + tombstone
   * @param opts.revivedIds — profils à retirer des tombstones (recréation même id)
   */
  async function persistAccountIndexCloud(user, meta, opts) {
    if (window.isLocalMode || !user || !user.sub || !window.setDoc || !window.doc || !window.db) return true;
    if (window.cloudConnected === false) return false;
    opts = opts || {};

    if (!window.getDoc && !window.runTransaction) {
      console.warn('[ProfilesIO] Index non écrit : getDoc indisponible');
      return false;
    }

    var ref = accountDocRef(user.sub);

    // Chemin transactionnel (Firestore) — sérialise les merges concurrent
    if (typeof window.runTransaction === 'function') {
      try {
        await window.runTransaction(window.db, async function (tx) {
          var snap = await tx.get(ref);
          var remote = snap.exists() ? snap.data() : null;
          var merged = mergeAccountIndexPayload(remote, meta, opts);
          if (!merged.ok) {
            var err = new Error(merged.reason === 'legacy' ? 'legacy' : 'unrecognized');
            err.code = 'INDEX_MERGE_REFUSED';
            throw err;
          }
          tx.set(ref, merged.payload);
        });
        return true;
      } catch (e) {
        if (e && e.code === 'INDEX_MERGE_REFUSED') {
          console.warn('[ProfilesIO] Index non écrit :', e.message);
          return false;
        }
        console.warn('[ProfilesIO] Transaction index échouée — repli getDoc/setDoc:', e);
        // fall through
      }
    }

    var remote = null;
    try {
      var snap = await window.getDoc(ref);
      if (snap.exists()) remote = snap.data();
    } catch (e) {
      console.warn('[ProfilesIO] Lecture index échouée — pas d’écriture:', e);
      return false;
    }

    var merged = mergeAccountIndexPayload(remote, meta, opts);
    if (!merged.ok) {
      console.warn('[ProfilesIO] Index non écrit :', merged.reason);
      return false;
    }
    try {
      await window.setDoc(ref, merged.payload);
      return true;
    } catch (e) {
      console.warn('Écriture index profils cloud:', e);
      return false;
    }
  }

  // ─── Export ─────────────────────────────────────────────

  function sectionPayload(sectionIds, data) {
    var D = data || window.D || {};
    var out = {};
    var set = {};
    (sectionIds || []).forEach(function (id) { set[id] = true; });
    var all = !sectionIds || !sectionIds.length || set.all;

    if (all || set.structure) {
      out.matieres = deepClone(D.matieres || []);
      out.classeurs = deepClone(D.classeurs || []);
    }
    if (all || set.cours) {
      out.cours = deepClone(D.cours || []);
    }
    if (all || set.notes) {
      // Snapshot dédié notes (même si cours déjà inclus — pour import notes-only)
      out._notes = (D.cours || [])
        .filter(function (c) {
          return c && (c.type === 'DS' || c.type === 'KHOLLE')
            && (c.note != null && c.note !== '' || c.rang != null && c.rang !== '');
        })
        .map(function (c) {
          return {
            uid: c.uid,
            type: c.type,
            title: c.title,
            mat: c.mat,
            cl: c.cl,
            inter: c.inter,
            note: c.note,
            rang: c.rang,
            effectif: c.effectif,
            date: c.date,
            rev: c.rev,
            desc: c.desc,
            stat: c.stat
          };
        });
    }
    if (all || set.synchrotron) {
      out.exercices = deepClone(D.exercices || []);
      out.devoirs = deepClone(D.devoirs || []);
      if (D.sessionEnCoursV2) out.sessionEnCoursV2 = deepClone(D.sessionEnCoursV2);
    }
    if (all || set.settings) {
      out.settings = deepClone(D.settings || {});
    }
    if (all && D.meta) out.meta = deepClone(D.meta);
    return out;
  }

  function buildExport(sectionIds) {
    var profile = getProfileMeta(getActiveProfileId()) || { id: DEFAULT_ID, name: 'Principal' };
    var ids = sectionIds && sectionIds.length ? sectionIds.slice() : ['all'];
    if (ids.indexOf('all') !== -1) {
      ids = SECTIONS.map(function (s) { return s.id; });
    }
    return {
      format: FORMAT,
      schemaVersion: SCHEMA,
      exportedAt: nowIso(),
      profile: { id: profile.id, name: profile.name },
      sections: ids,
      data: sectionPayload(ids, window.D)
    };
  }

  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'mes-cours-sauvegarde.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function downloadExport(sectionIds) {
    if (!window.D) throw new Error('Aucune donnée à exporter.');
    var pack = buildExport(sectionIds);
    var pid = (pack.profile && pack.profile.id) || 'profil';
    var stamp = (pack.exportedAt || '').slice(0, 10);
    downloadJson(pack, 'mes-cours-' + pid + '-' + stamp + '.json');
    return pack;
  }

  // ─── Import ─────────────────────────────────────────────

  function parseImportText(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('JSON invalide : ' + (e.message || e));
    }
    return parsed;
  }

  function normalizeImport(parsed) {
    var report = { errors: [], warnings: [], format: null };

    if (!parsed || typeof parsed !== 'object') {
      report.errors.push('Fichier vide ou non objet.');
      return { ok: false, report: report, data: null, sections: [] };
    }

    var data;
    var sections = [];

    if (parsed.format === FORMAT) {
      report.format = FORMAT;
      if (Number(parsed.schemaVersion) > SCHEMA) {
        report.warnings.push('Version de fichier plus récente (' + parsed.schemaVersion + ') — import au mieux.');
      }
      data = parsed.data || {};
      sections = Array.isArray(parsed.sections) && parsed.sections.length
        ? parsed.sections.slice()
        : detectSectionsFromData(data);
    } else if (isLegacyDataDoc(parsed)) {
      // Export brut de window.D
      report.format = 'legacy-D';
      report.warnings.push('Ancien format (blob de données brut) détecté.');
      data = parsed;
      sections = detectSectionsFromData(data);
    } else if (parsed.data && typeof parsed.data === 'object') {
      report.format = 'wrapped';
      report.warnings.push('Format enveloppé non standard — tentative d’import.');
      data = parsed.data;
      sections = detectSectionsFromData(data);
    } else {
      report.errors.push('Format non reconnu. Attendu : sauvegarde « ' + FORMAT + ' ».');
      return { ok: false, report: report, data: null, sections: [] };
    }

    // Validations légères
    ['matieres', 'classeurs', 'cours', 'exercices', 'devoirs', '_notes'].forEach(function (k) {
      if (data[k] != null && !Array.isArray(data[k])) {
        report.errors.push('Champ « ' + k + ' » doit être un tableau.');
      }
    });
    if (data.settings != null && typeof data.settings !== 'object') {
      report.errors.push('Champ « settings » invalide.');
    }

    if (report.errors.length) {
      return { ok: false, report: report, data: null, sections: [] };
    }
    return { ok: true, report: report, data: data, sections: sections, meta: parsed.profile || null };
  }

  function detectSectionsFromData(data) {
    var s = [];
    if (data.matieres || data.classeurs) s.push('structure');
    if (data.cours) s.push('cours');
    if (data._notes || (Array.isArray(data.cours) && data.cours.some(function (c) {
      return c && (c.type === 'DS' || c.type === 'KHOLLE') && (c.note || c.rang);
    }))) s.push('notes');
    if (data.exercices || data.devoirs || data.sessionEnCoursV2) s.push('synchrotron');
    if (data.settings) s.push('settings');
    return s.length ? s : SECTIONS.map(function (x) { return x.id; });
  }

  function indexBy(arr, key) {
    var map = Object.create(null);
    (arr || []).forEach(function (item) {
      if (item && item[key] != null && item[key] !== '') map[String(item[key])] = item;
    });
    return map;
  }

  function ensureStructureForCours(target, srcMatieres, srcClasseurs, coursItem, report) {
    if (!target.matieres) target.matieres = [];
    if (!target.classeurs) target.classeurs = [];
    var matIds = indexBy(target.matieres, 'id');
    var clIds = indexBy(target.classeurs, 'id');
    if (coursItem.mat && !matIds[coursItem.mat]) {
      var m = (srcMatieres || []).find(function (x) { return x && x.id === coursItem.mat; });
      if (m) {
        target.matieres.push(deepClone(m));
        report.warnings.push('Matière « ' + (m.name || m.id) + ' » ajoutée pour le cours ' + coursItem.uid);
      } else {
        report.warnings.push('Cours ' + coursItem.uid + ' : matière ' + coursItem.mat + ' absente (sera classée Non trié).');
      }
    }
    if (coursItem.cl && !clIds[coursItem.cl]) {
      var c = (srcClasseurs || []).find(function (x) { return x && x.id === coursItem.cl; });
      if (c) {
        target.classeurs.push(deepClone(c));
        report.warnings.push('Classeur « ' + (c.name || c.id) + ' » ajouté pour le cours ' + coursItem.uid);
      }
    }
  }

  /**
   * Applique un import validé.
   * @param {object} normalized — sortie de normalizeImport
   * @param {{ sections: string[], mode: 'merge'|'replace' }} opts
   */
  function applyImport(normalized, opts) {
    opts = opts || {};
    var mode = opts.mode === 'replace' ? 'replace' : 'merge';
    var want = opts.sections && opts.sections.length ? opts.sections.slice() : (normalized.sections || []);
    if (want.indexOf('all') !== -1) want = SECTIONS.map(function (s) { return s.id; });

    var report = {
      ok: true,
      mode: mode,
      sections: want.slice(),
      imported: { matieres: 0, classeurs: 0, cours: 0, notes: 0, exercices: 0, devoirs: 0, settings: 0 },
      skipped: [],
      errors: (normalized.report && normalized.report.errors || []).slice(),
      warnings: (normalized.report && normalized.report.warnings || []).slice()
    };

    if (!normalized.ok || !normalized.data) {
      report.ok = false;
      if (!report.errors.length) report.errors.push('Import refusé : fichier invalide.');
      return report;
    }
    if (window.D && window.D._account === true) {
      report.ok = false;
      report.errors.push('État app corrompu (index compte). Recharge la page avant d’importer.');
      return report;
    }
    if (!window.D) window.D = deepClone(window.emptyData || {});

    var src = normalized.data;
    var target = mode === 'replace' ? deepClone(window.emptyData || {}) : deepClone(window.D);

    // Préserver meta / session si non demandés
    if (mode === 'replace') {
      if (want.indexOf('settings') === -1 && window.D.settings) {
        target.settings = deepClone(window.D.settings);
      }
      if (want.indexOf('synchrotron') === -1) {
        target.exercices = deepClone(window.D.exercices || []);
        target.devoirs = deepClone(window.D.devoirs || []);
        if (window.D.sessionEnCoursV2) target.sessionEnCoursV2 = deepClone(window.D.sessionEnCoursV2);
      }
      if (want.indexOf('cours') === -1) {
        // notes-only ne doit JAMAIS vider les cours : on patche dessus
        target.cours = deepClone(window.D.cours || []);
      }
      if (want.indexOf('structure') === -1) {
        target.matieres = deepClone(window.D.matieres || []);
        target.classeurs = deepClone(window.D.classeurs || []);
      }
    }

    function upsertList(targetKey, srcList, idKey, counterKey) {
      if (!Array.isArray(srcList)) {
        report.skipped.push(targetKey + ' : absent ou invalide');
        return;
      }
      if (!Array.isArray(target[targetKey])) target[targetKey] = [];
      if (mode === 'replace') {
        target[targetKey] = srcList.map(deepClone).filter(function (x) { return x && x[idKey] != null; });
        report.imported[counterKey] = target[targetKey].length;
        return;
      }
      var map = indexBy(target[targetKey], idKey);
      srcList.forEach(function (item, idx) {
        if (!item || item[idKey] == null || item[idKey] === '') {
          report.skipped.push(targetKey + '[' + idx + '] : id manquant');
          return;
        }
        var id = String(item[idKey]);
        if (map[id]) {
          Object.assign(map[id], deepClone(item));
        } else {
          var clone = deepClone(item);
          target[targetKey].push(clone);
          map[id] = clone;
        }
        report.imported[counterKey]++;
      });
    }

    if (want.indexOf('structure') !== -1) {
      upsertList('matieres', src.matieres, 'id', 'matieres');
      upsertList('classeurs', src.classeurs, 'id', 'classeurs');
    }

    if (want.indexOf('cours') !== -1) {
      if (!Array.isArray(src.cours)) {
        report.skipped.push('cours : absent');
      } else {
        if (!Array.isArray(target.cours)) target.cours = [];
        if (mode === 'replace') {
          target.cours = [];
          src.cours.forEach(function (c, idx) {
            if (!c || !c.uid) {
              report.skipped.push('cours[' + idx + '] : uid manquant');
              return;
            }
            ensureStructureForCours(target, src.matieres, src.classeurs, c, report);
            target.cours.push(deepClone(c));
            report.imported.cours++;
          });
        } else {
          var cmap = indexBy(target.cours, 'uid');
          src.cours.forEach(function (c, idx) {
            if (!c || !c.uid) {
              report.skipped.push('cours[' + idx + '] : uid manquant');
              return;
            }
            ensureStructureForCours(target, src.matieres, src.classeurs, c, report);
            var id = String(c.uid);
            if (cmap[id]) Object.assign(cmap[id], deepClone(c));
            else {
              var clone = deepClone(c);
              target.cours.push(clone);
              cmap[id] = clone;
            }
            report.imported.cours++;
          });
        }
      }
    }

    if (want.indexOf('notes') !== -1) {
      var notesSrc = Array.isArray(src._notes) ? src._notes : null;
      if (!notesSrc && Array.isArray(src.cours)) {
        notesSrc = src.cours.filter(function (c) {
          return c && (c.type === 'DS' || c.type === 'KHOLLE');
        });
      }
      if (!notesSrc) {
        report.skipped.push('notes : aucune donnée notes/rangs trouvée');
      } else {
        if (!Array.isArray(target.cours)) target.cours = [];
        var nmap = indexBy(target.cours, 'uid');
        notesSrc.forEach(function (n, idx) {
          if (!n || !n.uid) {
            report.skipped.push('notes[' + idx + '] : uid manquant');
            return;
          }
          var id = String(n.uid);
          if (nmap[id]) {
            if (n.note !== undefined) nmap[id].note = n.note;
            if (n.rang !== undefined) nmap[id].rang = n.rang;
            if (n.effectif !== undefined) nmap[id].effectif = n.effectif;
            if (n.date !== undefined && n.date) nmap[id].date = n.date;
            report.imported.notes++;
          } else if (n.type === 'DS' || n.type === 'KHOLLE') {
            ensureStructureForCours(target, src.matieres, src.classeurs, n, report);
            var created = deepClone(n);
            if (!created.rev) created.rev = 'green';
            if (!created.stat) created.stat = 'ok';
            target.cours.push(created);
            nmap[id] = created;
            report.imported.notes++;
            report.warnings.push('DS/Khôlle ' + id + ' créé pour importer la note/rang.');
          } else {
            report.skipped.push('notes ' + id + ' : cours introuvable (non DS/Khôlle)');
          }
        });
      }
    }

    if (want.indexOf('synchrotron') !== -1) {
      upsertList('exercices', src.exercices, 'id', 'exercices');
      upsertList('devoirs', src.devoirs, 'id', 'devoirs');
      if (src.sessionEnCoursV2) {
        target.sessionEnCoursV2 = deepClone(src.sessionEnCoursV2);
      } else if (mode === 'replace') {
        delete target.sessionEnCoursV2;
      }
      // Vérifier les coursIds orphelins
      var coursIds = {};
      (target.cours || []).forEach(function (c) { if (c && c.uid) coursIds[c.uid] = true; });
      function checkLinks(list, label) {
        (list || []).forEach(function (card) {
          var links = card && Array.isArray(card.coursIds) ? card.coursIds : [];
          links.forEach(function (uid) {
            if (uid && !coursIds[uid]) {
              report.warnings.push(label + ' ' + (card.id || '?') + ' : lien cours « ' + uid + ' » absent dans ce profil');
            }
          });
        });
      }
      checkLinks(target.exercices, 'Carte');
      checkLinks(target.devoirs, 'Devoir');
    }

    if (want.indexOf('settings') !== -1) {
      if (src.settings && typeof src.settings === 'object') {
        target.settings = mode === 'replace'
          ? deepClone(src.settings)
          : Object.assign({}, target.settings || {}, deepClone(src.settings));
        report.imported.settings = 1;
      } else {
        report.skipped.push('settings : absent');
      }
    }

    // Migrations / cohérence
    window.D = target;
    try {
      if (window.AnkiAlgo && typeof window.AnkiAlgo.migrateData === 'function') {
        window.AnkiAlgo.migrateData(window.D);
      }
    } catch (e) {
      report.warnings.push('migrateData : ' + (e.message || e));
    }
    try {
      if (typeof window.reconcileOrphanCours === 'function') window.reconcileOrphanCours();
    } catch (e) {
      report.warnings.push('reconcileOrphanCours : ' + (e.message || e));
    }

    if (report.errors.length) report.ok = false;
    return report;
  }

  // ─── Profils CRUD ───────────────────────────────────────

  function rollbackCreatedProfile(id) {
    var meta = ensureLocalRegistry();
    meta.profiles = meta.profiles.filter(function (p) { return p.id !== id; });
    writeMetaLocal(meta);
    purgeLocalBlobAndSnaps(id);
  }

  async function createProfile(name, opts) {
    opts = opts || {};
    var meta = ensureLocalRegistry();
    var existing = {};
    meta.profiles.forEach(function (p) { existing[p.id] = true; });

    var user = window.currentUser;
    var needsCloud = !window.isLocalMode && user && user.sub;
    if (needsCloud && window.cloudConnected === false) {
      throw new Error('Connexion cloud requise pour créer un profil (évite un profil fantôme au prochain sync).');
    }

    // Réserver un id libre aussi côté cloud (évite d’écraser un profil existant sur un autre appareil)
    if (needsCloud && window.getDoc) {
      try {
        var idxSnap = await window.getDoc(accountDocRef(user.sub));
        if (idxSnap.exists()) {
          var idxData = idxSnap.data();
          if (isAccountIndex(idxData)) {
            var delMap = idxData.deletedProfiles || {};
            (idxData.profiles || []).forEach(function (p) {
              if (p && p.id && !delMap[p.id]) existing[p.id] = true;
            });
          }
        }
      } catch (eIdx) {
        console.warn('[ProfilesIO] Lecture index avant create:', eIdx);
      }
    }

    var id = uniqueId(slugify(name), existing);

    // Refus si un blob cloud non vide existe déjà pour cet id
    if (needsCloud && window.getDoc) {
      try {
        var blobSnap = await window.getDoc(profileDocRef(user.sub, id));
        if (blobSnap.exists()) {
          var blob = blobSnap.data();
          if (blob && !blob._deleted && !isEffectivelyEmptyProfile(blob)) {
            throw new Error(
              'Un profil cloud « ' + id + ' » existe déjà avec des données. ' +
              'Choisis un autre nom (évite d’écraser le travail d’un autre appareil).'
            );
          }
        }
      } catch (eBlob) {
        if (/existe déjà/i.test(String(eBlob && eBlob.message))) throw eBlob;
        console.warn('[ProfilesIO] Lecture blob avant create:', eBlob);
      }
    }

    var entry = {
      id: id,
      name: String(name || 'Profil').trim() || id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      bytes: 0,
      cloudBlobPending: false,
      generation: Date.now()
    };
    meta.profiles.push(entry);
    writeMetaLocal(meta);

    var seed = opts.copyFromActive
      ? deepClone(window.D || window.emptyData)
      : deepClone(window.emptyData || { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [] });
    if (seed && seed._account) {
      seed = deepClone(window.emptyData || { settings: {}, matieres: [], classeurs: [], cours: [], exercices: [], devoirs: [] });
    }
    if (seed && seed.settings) {
      // garder le prénom du compte si possible
      if (window.D && window.D.settings && window.D.settings.userName) {
        seed.settings.userName = window.D.settings.userName;
      }
    }
    if (!seed.meta) seed.meta = {};
    seed.meta.updatedAt = Date.now();
    seed.meta.profileGeneration = entry.generation;

    if (!writeLocalProfileData(id, seed)) {
      rollbackCreatedProfile(id);
      throw new Error('Impossible de créer le profil (stockage navigateur plein ou refusé).');
    }

    // Meta fraîche (bytes après writeLocal) + flag anti-écrasement tant que le blob cloud n’existe pas
    meta = ensureLocalRegistry();
    meta.profiles.forEach(function (p) {
      if (p && p.id === id) {
        p.cloudBlobPending = !!needsCloud;
        p.bytes = getProfileLiveBytes(id);
        p.updatedAt = nowIso();
        p.generation = entry.generation;
      }
    });
    writeMetaLocal(meta);
    if (needsCloud) markSeedOwner(id);

    // revivedIds : si on recrée un nom déjà tombstoné, on lève le tombstone
    var okIdx = await persistAccountIndexCloud(user, meta, { revivedIds: [id] });
    if (needsCloud && window.cloudConnected && !okIdx) {
      clearSeedOwner(id);
      rollbackCreatedProfile(id);
      throw new Error('Index cloud non synchronisé — création annulée. Réessaie.');
    }
    if (needsCloud && window.cloudConnected && window.setDoc) {
      try {
        // Re-vérifier juste avant l’écriture (course avec un autre appareil)
        if (window.getDoc) {
          var raceSnap = await window.getDoc(profileDocRef(user.sub, id));
          if (raceSnap.exists()) {
            var raceBlob = raceSnap.data();
            if (raceBlob && !raceBlob._deleted && !isEffectivelyEmptyProfile(raceBlob)) {
              clearSeedOwner(id);
              rollbackCreatedProfile(id);
              throw new Error(
                'Collision : le profil « ' + id + ' » a été créé ailleurs avec des données. Création annulée.'
              );
            }
          }
        }
        await window.setDoc(profileDocRef(user.sub, id), seed);
        clearSeedOwner(id);
        meta = ensureLocalRegistry();
        meta.profiles.forEach(function (p) {
          if (p && p.id === id) {
            p.cloudBlobPending = false;
            p.bytes = getProfileLiveBytes(id);
            p.updatedAt = nowIso();
          }
        });
        writeMetaLocal(meta);
        try { await persistAccountIndexCloud(user, meta, { clearBlobPendingIds: [id] }); } catch (eMeta) { /* ignore */ }
      } catch (e) {
        if (/Collision|existe déjà/i.test(String(e && e.message))) throw e;
        console.warn('Création profil cloud (blob):', e);
        // Index + local OK, cloudBlobPending + seed owner → seul ce device republie
        throw new Error(
          'Profil créé, mais la copie cloud des données a échoué. ' +
          'Ouvre ce profil (ou réessaie) pour synchroniser. Détail : ' + (e && e.message ? e.message : e)
        );
      }
    }
    return entry;
  }

  async function renameProfile(id, name) {
    var meta = ensureLocalRegistry();
    var p = meta.profiles.find(function (x) { return x.id === id; });
    if (!p) throw new Error('Profil introuvable');
    var prevName = p.name;
    p.name = String(name || p.name).trim() || p.name;
    p.updatedAt = nowIso();
    writeMetaLocal(meta);
    var user = window.currentUser;
    if (!window.isLocalMode && user && user.sub && window.cloudConnected === false) {
      p.name = prevName;
      writeMetaLocal(meta);
      throw new Error('Connexion cloud requise pour renommer un profil.');
    }
    var okIdx = await persistAccountIndexCloud(user, meta);
    if (!window.isLocalMode && window.cloudConnected && user && user.sub && !okIdx) {
      p.name = prevName;
      writeMetaLocal(meta);
      throw new Error('Renommage cloud échoué. Réessaie.');
    }
    return p;
  }

  async function deleteProfile(id) {
    var meta = ensureLocalRegistry();
    if (meta.profiles.length <= 1) throw new Error('Impossible de supprimer le dernier profil.');
    if (id === getSessionProfileId() || id === meta.activeProfile) {
      throw new Error('Bascule sur un autre profil avant de supprimer celui-ci.');
    }

    var user = window.currentUser;
    if (!window.isLocalMode && !(user && user.sub)) {
      throw new Error('Compte Google requis pour supprimer un profil (mode cloud).');
    }
    var needsCloud = !window.isLocalMode && user && user.sub;
    if (needsCloud && window.cloudConnected === false) {
      throw new Error(
        'Connexion cloud requise pour supprimer un profil ' +
        '(sinon il réapparaîtrait au prochain sync).'
      );
    }

    // Cloud d’abord : tombstone index avant mutation locale (évite wipe local + restore cloud)
    if (needsCloud) {
      var okIdx = await persistAccountIndexCloud(user, meta, { removedIds: [id] });
      if (window.cloudConnected && !okIdx) {
        throw new Error('Suppression cloud de l’index échouée. Réessaie (rien n’a été modifié localement).');
      }
    }

    meta = ensureLocalRegistry();
    meta.profiles = meta.profiles.filter(function (p) { return p.id !== id; });
    writeMetaLocal(meta);
    purgeLocalBlobAndSnaps(id);

    if (needsCloud && window.cloudConnected && window.setDoc) {
      try {
        if (typeof window.deleteDoc === 'function') {
          await window.deleteDoc(profileDocRef(user.sub, id));
        } else {
          await window.setDoc(profileDocRef(user.sub, id), { _deleted: true, deletedAt: nowIso() });
        }
      } catch (e) { console.warn('Suppression cloud profil:', e); }
    }
  }

  async function archiveProfile(id) {
    var meta = ensureLocalRegistry();
    var p = meta.profiles.find(function (x) { return x.id === id; });
    if (!p) throw new Error('Profil introuvable');
    if (id === getSessionProfileId() || id === meta.activeProfile) {
      throw new Error('Bascule sur un autre profil avant d’archiver celui-ci.');
    }
    var activeCount = meta.profiles.filter(function (x) { return x && !x.archived; }).length;
    if (!p.archived && activeCount <= 1) {
      throw new Error('Impossible d’archiver le dernier profil actif.');
    }
    if (p.archived) return p;
    p.archived = true;
    p.updatedAt = nowIso();
    writeMetaLocal(meta);
    var user = window.currentUser;
    if (!window.isLocalMode && user && user.sub && window.cloudConnected === false) {
      p.archived = false;
      writeMetaLocal(meta);
      throw new Error('Connexion cloud requise pour archiver un profil.');
    }
    var okIdx = await persistAccountIndexCloud(user, meta);
    if (!window.isLocalMode && window.cloudConnected && user && user.sub && !okIdx) {
      p.archived = false;
      writeMetaLocal(meta);
      throw new Error('Archivage cloud échoué. Réessaie.');
    }
    return p;
  }

  async function unarchiveProfile(id) {
    var meta = ensureLocalRegistry();
    var p = meta.profiles.find(function (x) { return x.id === id; });
    if (!p) throw new Error('Profil introuvable');
    if (!p.archived) return p;
    p.archived = false;
    p.updatedAt = nowIso();
    writeMetaLocal(meta);
    var user = window.currentUser;
    if (!window.isLocalMode && user && user.sub && window.cloudConnected === false) {
      p.archived = true;
      writeMetaLocal(meta);
      throw new Error('Connexion cloud requise pour désarchiver un profil.');
    }
    var okIdx = await persistAccountIndexCloud(user, meta);
    if (!window.isLocalMode && window.cloudConnected && user && user.sub && !okIdx) {
      p.archived = true;
      writeMetaLocal(meta);
      throw new Error('Désarchivage cloud échoué. Réessaie.');
    }
    return p;
  }

  async function switchProfile(id) {
    if (id === getSessionProfileId()) return;
    var meta = ensureLocalRegistry();
    var target = meta.profiles.find(function (p) { return p.id === id; });
    if (!target) throw new Error('Profil inconnu');
    if (target.archived) throw new Error('Profil archivé — désarchive-le avant de basculer.');
    var wasLocal = lsGet('active_mode') === 'local' || !!window.isLocalMode;
    var fromId = getSessionProfileId();
    var user = window.currentUser;
    var needsCloud = !window.isLocalMode && user && user.sub;

    if (needsCloud && window.cloudConnected === false) {
      throw new Error('Connexion cloud requise pour changer de profil sur tous les appareils.');
    }

    // Secondaire : forcer une sauvegarde locale du profil courant avant bascule
    if (window.DeviceSession && typeof window.DeviceSession.canFullSave === 'function'
        && !window.DeviceSession.canFullSave()) {
      if (window.D && !writeLocalProfileData(fromId, window.D)) {
        throw new Error('Sauvegarde locale impossible avant bascule (appareil secondaire).');
      }
    } else if (typeof window.save === 'function' && window.D) {
      try {
        await window.save();
      } catch (e) {
        console.error('Save avant bascule profil:', e);
        throw new Error(
          'Sauvegarde du profil actuel impossible. Bascule annulée pour ne rien perdre. ' +
          'Réessaie ou exporte tes données d’abord. Détail : ' + (e && e.message ? e.message : e)
        );
      }
    }

    // Ne PAS re-pincher vers le nouveau profil tant que D = ancien blob
    // (évite qu’un save concurrent écrive l’ancien D dans le nouveau profil)
    window._persistDisabled = true;
    var prevActive = fromId;
    var prevTs = (ensureLocalRegistry().activeProfileUpdatedAt) || '';
    setActiveProfileId(id);
    if (wasLocal) lsSet('active_mode', 'local');
    meta = ensureLocalRegistry();
    var okIdx = await persistAccountIndexCloud(user, meta);
    if (needsCloud && window.cloudConnected && !okIdx) {
      // Rollback local — ne pas recharger sur un état cloud désynchronisé
      try {
        var roll = ensureLocalRegistry();
        roll.activeProfile = prevActive;
        roll.activeProfileUpdatedAt = prevTs || nowIso();
        writeMetaLocal(roll);
      } catch (e2) { /* ignore */ }
      window._persistDisabled = false;
      throw new Error('Bascule cloud échouée (index non synchronisé). Réessaie — rien n’a été changé sur les autres appareils.');
    }
    if (window.location && typeof window.location.reload === 'function') {
      window.location.reload();
    } else if (typeof location !== 'undefined' && location.reload) {
      location.reload();
    }
  }

  /** Après une save : publie la taille du profil actif dans l’index cloud (anti « 0 ko »). */
  async function syncActiveProfileIndexMeta() {
    try {
      var pid = getSessionProfileId();
      var bytes = getProfileLiveBytes(pid);
      setProfileBytesMeta(pid, bytes);
      var meta = ensureLocalRegistry();
      var user = window.currentUser;
      if (!window.isLocalMode && user && user.sub && window.cloudConnected !== false) {
        await persistAccountIndexCloud(user, meta);
      }
      return true;
    } catch (e) {
      console.warn('[ProfilesIO] syncActiveProfileIndexMeta:', e);
      return false;
    }
  }

  // ─── UI Paramètres ──────────────────────────────────────

  function formatReportHtml(report) {
    if (!report) return '';
    var lines = [];
    lines.push('<div class="pio-report ' + (report.ok ? 'is-ok' : 'is-err') + '">');
    lines.push('<div class="pio-report-title">' + (report.ok ? 'Import terminé' : 'Import incomplet / refusé') + '</div>');
    if (report.imported) {
      var bits = [];
      Object.keys(report.imported).forEach(function (k) {
        if (report.imported[k]) bits.push(k + ' : ' + report.imported[k]);
      });
      if (bits.length) lines.push('<div class="pio-report-line"><b>Importé</b> — ' + esc(bits.join(' · ')) + '</div>');
    }
    (report.errors || []).forEach(function (e) {
      lines.push('<div class="pio-report-line pio-err">✗ ' + esc(e) + '</div>');
    });
    (report.warnings || []).slice(0, 40).forEach(function (w) {
      lines.push('<div class="pio-report-line pio-warn">⚠ ' + esc(w) + '</div>');
    });
    if ((report.warnings || []).length > 40) {
      lines.push('<div class="pio-report-line pio-warn">… +' + ((report.warnings.length) - 40) + ' avertissements</div>');
    }
    (report.skipped || []).slice(0, 20).forEach(function (s) {
      lines.push('<div class="pio-report-line pio-skip">○ ' + esc(s) + '</div>');
    });
    lines.push('</div>');
    return lines.join('');
  }

  function formatSnapDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso || '';
      return d.toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso || ''; }
  }

  function updateProfileIndicator() {
    var chip = document.getElementById('activeProfileChip');
    if (!chip) return;
    var meta = getProfileMeta(getSessionProfileId());
    var name = (meta && meta.name) || 'Principal';
    chip.hidden = false;
    chip.textContent = name;
    chip.setAttribute('title', 'Profil actif : ' + name);
  }

  function renderSettingsBlock() {
    var root = document.getElementById('pioSettingsRoot');
    if (!root) return;
    var meta = ensureLocalRegistry();
    var active = getSessionProfileId() || meta.activeProfile;
    var activeProfiles = listProfiles();
    var archived = listArchivedProfiles();

    var profileOpts = activeProfiles.map(function (p) {
      var info = getProfileStorageInfo(p.id);
      return '<option value="' + esc(p.id) + '"' + (p.id === active ? ' selected' : '') + '>' +
        esc(p.name) + (p.id === active ? ' (actif)' : '') +
        ' — ' + esc(info.totalLabel) + '</option>';
    }).join('');

    var storageRows = listAllProfiles().map(function (p) {
      var info = getProfileStorageInfo(p.id);
      var tag = p.archived ? ' <span class="pio-tag">archivé</span>' : (p.id === active ? ' <span class="pio-tag pio-tag-on">actif</span>' : '');
      return '<div class="pio-storage-row">' +
        '<div class="pio-storage-name">' + esc(p.name) + tag + '</div>' +
        '<div class="pio-storage-meta">Données ' + esc(info.liveLabel) +
          (info.snapCount ? ' · ' + info.snapCount + ' sav. ' + esc(info.snapLabel) : '') +
          ' · total <b>' + esc(info.totalLabel) + '</b></div>' +
        '</div>';
    }).join('');

    var snaps = listSnapshots(active);
    var snapRows = snaps.length
      ? snaps.map(function (s) {
          return '<div class="pio-snap-row" data-snap-id="' + esc(s.id) + '">' +
            '<div class="pio-snap-info">' +
              '<div class="pio-snap-label">' + esc(s.label) + '</div>' +
              '<div class="pio-snap-meta">' + esc(formatSnapDate(s.createdAt)) +
                ' · <b>' + esc(s.sizeLabel) + '</b></div>' +
            '</div>' +
            '<div class="pio-snap-actions">' +
              '<button type="button" class="bs" data-pio-restore-snap="' + esc(s.id) + '">Restaurer</button>' +
              '<button type="button" class="bs pio-danger" data-pio-del-snap="' + esc(s.id) + '">Effacer</button>' +
            '</div>' +
          '</div>';
        }).join('')
      : '<p class="pio-card-sub">Aucune sauvegarde locale pour ce profil.</p>';

    var archivedBlock = archived.length
      ? '<div class="pio-card">' +
          '<div class="pio-card-title">Profils archivés</div>' +
          '<p class="pio-card-sub">Masqués du sélecteur. Tu peux les désarchiver ou les supprimer définitivement (données + sauvegardes locales).</p>' +
          archived.map(function (p) {
            var info = getProfileStorageInfo(p.id);
            return '<div class="pio-snap-row">' +
              '<div class="pio-snap-info">' +
                '<div class="pio-snap-label">' + esc(p.name) + '</div>' +
                '<div class="pio-snap-meta">total <b>' + esc(info.totalLabel) + '</b>' +
                  (info.snapCount ? ' · ' + info.snapCount + ' sav.' : '') + '</div>' +
              '</div>' +
              '<div class="pio-snap-actions">' +
                '<button type="button" class="bs" data-pio-unarchive="' + esc(p.id) + '">Désarchiver</button>' +
                '<button type="button" class="bs pio-danger" data-pio-purge="' + esc(p.id) + '">Supprimer…</button>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>'
      : '';

    var sectionChecks = SECTIONS.map(function (s) {
      return '<label class="pio-check"><input type="checkbox" data-pio-section="' + esc(s.id) + '" checked> ' +
        '<span><b>' + esc(s.label) + '</b><small>' + esc(s.hint) + '</small></span></label>';
    }).join('');

    root.innerHTML =
      '<div class="pio-card">' +
        '<div class="pio-card-title">Profils de données</div>' +
        '<p class="pio-card-sub">Plusieurs espaces isolés sous le même compte Google. Archiver masque un profil ; supprimer l’efface définitivement.</p>' +
        '<div class="pio-row">' +
          '<label class="pio-lbl">Profil actif</label>' +
          '<select id="pioActiveSelect" class="pio-select">' + profileOpts + '</select>' +
          '<button type="button" class="bs" id="pioSwitchBtn">Changer</button>' +
        '</div>' +
        '<div class="pio-row">' +
          '<input type="text" id="pioNewName" class="pio-input" placeholder="Nom du nouveau profil (ex. Test)" maxlength="40">' +
          '<button type="button" class="bs" id="pioCreateEmpty">Créer vide</button>' +
          '<button type="button" class="bs" id="pioCreateCopy">Créer (copie)</button>' +
        '</div>' +
        '<div class="pio-row">' +
          '<input type="text" id="pioRenameInput" class="pio-input" placeholder="Nouveau nom du profil actif" maxlength="40">' +
          '<button type="button" class="bs" id="pioRenameBtn">Renommer</button>' +
          '<button type="button" class="bs" id="pioArchiveBtn">Archiver…</button>' +
          '<button type="button" class="bs pio-danger" id="pioDeleteBtn">Supprimer…</button>' +
        '</div>' +
      '</div>' +

      '<div class="pio-card">' +
        '<div class="pio-card-title">Espace données</div>' +
        '<p class="pio-card-sub">Taille des données par profil (locale si disponible, sinon taille sync cloud).</p>' +
        '<div class="pio-storage-list">' + (storageRows || '<p class="pio-card-sub">Aucun profil.</p>') + '</div>' +
      '</div>' +

      '<div class="pio-card">' +
        '<div class="pio-card-title">Sauvegardes locales du profil actif</div>' +
        '<p class="pio-card-sub">Jusqu’à ' + MAX_SNAPSHOTS + ' snapshots par profil. Utile avant un import ou une grosse modif.</p>' +
        '<div class="pio-row">' +
          '<input type="text" id="pioSnapLabel" class="pio-input" placeholder="Libellé (ex. Avant import notes)" maxlength="60">' +
          '<button type="button" class="bp" id="pioSnapCreate">Créer une sauvegarde</button>' +
        '</div>' +
        '<div class="pio-snap-list">' + snapRows + '</div>' +
      '</div>' +

      archivedBlock +

      '<div class="pio-card">' +
        '<div class="pio-card-title">Export</div>' +
        '<p class="pio-card-sub">Télécharge une sauvegarde JSON du profil actif. Tu pourras la réimporter plus tard (tout ou partie).</p>' +
        '<div class="pio-sections" id="pioExportSections">' + sectionChecks + '</div>' +
        '<div class="pio-row">' +
          '<button type="button" class="bp" id="pioExportBtn"><span data-icon="download"></span> Exporter la sélection</button>' +
          '<button type="button" class="bs" id="pioExportAllBtn">Tout exporter</button>' +
        '</div>' +
      '</div>' +

      '<div class="pio-card">' +
        '<div class="pio-card-title">Import</div>' +
        '<p class="pio-card-sub">Les IDs de cours / cartes sont conservés. Choisis les blocs à importer et le mode fusion ou remplacement.</p>' +
        '<div class="pio-row">' +
          '<input type="file" id="pioImportFile" accept="application/json,.json" class="pio-file">' +
        '</div>' +
        '<div class="pio-sections" id="pioImportSections">' +
          SECTIONS.map(function (s) {
            return '<label class="pio-check"><input type="checkbox" data-pio-imp-section="' + esc(s.id) + '" checked> ' +
              '<span><b>' + esc(s.label) + '</b></span></label>';
          }).join('') +
        '</div>' +
        '<div class="pio-row pio-modes">' +
          '<label class="pio-check"><input type="radio" name="pioMode" value="merge" checked> Fusionner (ajoute / met à jour par ID)</label>' +
          '<label class="pio-check"><input type="radio" name="pioMode" value="replace"> Remplacer les blocs choisis</label>' +
        '</div>' +
        '<div class="pio-row">' +
          '<button type="button" class="bp" id="pioImportBtn"><span data-icon="upload"></span> Importer dans ce profil</button>' +
        '</div>' +
        '<div id="pioImportReport" class="pio-report-wrap" hidden></div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
    wireSettingsBlock();
    updateProfileIndicator();
  }

  function selectedSections(containerSel, attr) {
    var root = document.querySelector(containerSel);
    if (!root) return [];
    var out = [];
    root.querySelectorAll('input[' + attr + ']').forEach(function (el) {
      if (el.checked) out.push(el.getAttribute(attr));
    });
    return out;
  }

  function wireSettingsBlock() {
    var switchBtn = document.getElementById('pioSwitchBtn');
    if (switchBtn) {
      switchBtn.onclick = function () {
        var sel = document.getElementById('pioActiveSelect');
        if (!sel) return;
        var id = sel.value;
        if (id === getSessionProfileId()) {
          // Réaligner le LS si désync multi-onglets
          if (id !== getActiveProfileId()) setActiveProfileId(id);
          if (typeof window.showToast === 'function') window.showToast('Déjà sur ce profil.');
          return;
        }
        var name = (getProfileMeta(id) || {}).name || id;
        var go = function () {
          switchProfile(id).catch(function (e) {
            alert(e.message || e);
          });
        };
        if (typeof window.sysConfirm === 'function') {
          window.sysConfirm('Basculer vers le profil « ' + esc(name) + ' » ? La page va se recharger.', go);
        } else if (confirm('Basculer vers « ' + name + ' » ?')) go();
      };
    }

    var createEmpty = document.getElementById('pioCreateEmpty');
    if (createEmpty) {
      createEmpty.onclick = function () {
        var nameEl = document.getElementById('pioNewName');
        var name = (nameEl && nameEl.value.trim()) || 'Test';
        createProfile(name, { copyFromActive: false }).then(function (p) {
          if (typeof window.showToast === 'function') window.showToast('Profil « ' + p.name + ' » créé.');
          renderSettingsBlock();
        }).catch(function (e) {
          alert(e.message || e);
        });
      };
    }

    var createCopy = document.getElementById('pioCreateCopy');
    if (createCopy) {
      createCopy.onclick = function () {
        var nameEl = document.getElementById('pioNewName');
        var name = (nameEl && nameEl.value.trim()) || 'Copie';
        createProfile(name, { copyFromActive: true }).then(function (p) {
          if (typeof window.showToast === 'function') window.showToast('Profil « ' + p.name + ' » (copie) créé.');
          renderSettingsBlock();
        }).catch(function (e) {
          alert(e.message || e);
        });
      };
    }

    var renameBtn = document.getElementById('pioRenameBtn');
    if (renameBtn) {
      renameBtn.onclick = function () {
        var inp = document.getElementById('pioRenameInput');
        var name = inp && inp.value.trim();
        if (!name) return;
        renameProfile(getSessionProfileId(), name).then(function () {
          renderSettingsBlock();
          updateProfileIndicator();
        }).catch(function (e) { alert(e.message || e); });
      };
    }

    var delBtn = document.getElementById('pioDeleteBtn');
    if (delBtn) {
      delBtn.onclick = function () {
        var sel = document.getElementById('pioActiveSelect');
        var id = sel ? sel.value : null;
        if (!id) return;
        if (id === getSessionProfileId()) {
          alert('Tu ne peux pas supprimer le profil actif. Bascule d’abord vers un autre profil.');
          return;
        }
        var meta = getProfileMeta(id);
        var info = getProfileStorageInfo(id);
        var go = function () {
          deleteProfile(id).then(function () {
            if (typeof window.showToast === 'function') window.showToast('Profil « ' + ((meta && meta.name) || id) + ' » supprimé définitivement.');
            renderSettingsBlock();
            updateProfileIndicator();
          }).catch(function (e) { alert(e.message || e); });
        };
        var msg = 'Supprimer définitivement « ' + esc((meta && meta.name) || id) +
          ' » (' + esc(info.totalLabel) + ' local) et toutes ses sauvegardes ? Irréversible.';
        if (typeof window.sysConfirm === 'function') {
          window.sysConfirm(msg, go);
        } else if (confirm('Supprimer définitivement ?')) go();
      };
    }

    var archiveBtn = document.getElementById('pioArchiveBtn');
    if (archiveBtn) {
      archiveBtn.onclick = function () {
        var sel = document.getElementById('pioActiveSelect');
        var id = sel ? sel.value : null;
        if (!id) return;
        if (id === getSessionProfileId()) {
          alert('Tu ne peux pas archiver le profil actif. Bascule d’abord vers un autre profil.');
          return;
        }
        var meta = getProfileMeta(id);
        var go = function () {
          archiveProfile(id).then(function () {
            if (typeof window.showToast === 'function') window.showToast('Profil « ' + ((meta && meta.name) || id) + ' » archivé.');
            renderSettingsBlock();
          }).catch(function (e) { alert(e.message || e); });
        };
        if (typeof window.sysConfirm === 'function') {
          window.sysConfirm('Archiver « ' + esc((meta && meta.name) || id) + ' » ? Tu pourras le désarchiver plus tard.', go);
        } else if (confirm('Archiver ?')) go();
      };
    }

    var snapCreate = document.getElementById('pioSnapCreate');
    if (snapCreate) {
      snapCreate.onclick = function () {
        var lab = document.getElementById('pioSnapLabel');
        var label = (lab && lab.value.trim()) || ('Sauvegarde ' + new Date().toLocaleString('fr-FR'));
        try {
          var snap = createSnapshot(getSessionProfileId(), label);
          if (typeof window.showToast === 'function') {
            window.showToast('Sauvegarde créée (' + ((snap && snap.sizeLabel) || '?') + ').');
          }
          if (lab) lab.value = '';
          renderSettingsBlock();
        } catch (e) { alert(e.message || e); }
      };
    }

    var rootEl = document.getElementById('pioSettingsRoot');
    if (rootEl) {
      rootEl.querySelectorAll('[data-pio-restore-snap]').forEach(function (btn) {
        btn.onclick = function () {
          var snapId = btn.getAttribute('data-pio-restore-snap');
          var go = function () {
            restoreSnapshot(getSessionProfileId(), snapId).then(function () {
              if (typeof window.showToast === 'function') window.showToast('Sauvegarde restaurée.');
              renderSettingsBlock();
            }).catch(function (e) { alert(e.message || e); });
          };
          if (typeof window.sysConfirm === 'function') {
            window.sysConfirm('Restaurer cette sauvegarde ? Les données actuelles du profil actif seront écrasées (crée d’abord une sauvegarde si besoin).', go);
          } else if (confirm('Restaurer ?')) go();
        };
      });
      rootEl.querySelectorAll('[data-pio-del-snap]').forEach(function (btn) {
        btn.onclick = function () {
          var snapId = btn.getAttribute('data-pio-del-snap');
          deleteSnapshot(getSessionProfileId(), snapId);
          renderSettingsBlock();
        };
      });
      rootEl.querySelectorAll('[data-pio-unarchive]').forEach(function (btn) {
        btn.onclick = function () {
          unarchiveProfile(btn.getAttribute('data-pio-unarchive')).then(function () {
            renderSettingsBlock();
          }).catch(function (e) { alert(e.message || e); });
        };
      });
      rootEl.querySelectorAll('[data-pio-purge]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-pio-purge');
          var meta = getProfileMeta(id);
          var info = getProfileStorageInfo(id);
          var go = function () {
            deleteProfile(id).then(function () {
              if (typeof window.showToast === 'function') window.showToast('Profil supprimé définitivement.');
              renderSettingsBlock();
            }).catch(function (e) { alert(e.message || e); });
          };
          var msg = 'Supprimer définitivement « ' + esc((meta && meta.name) || id) +
            ' » (' + esc(info.totalLabel) + ') ? Irréversible.';
          if (typeof window.sysConfirm === 'function') window.sysConfirm(msg, go);
          else if (confirm('Supprimer ?')) go();
        };
      });
    }

    var exportBtn = document.getElementById('pioExportBtn');
    if (exportBtn) {
      exportBtn.onclick = function () {
        try {
          var secs = selectedSections('#pioExportSections', 'data-pio-section');
          if (!secs.length) { alert('Coche au moins une section.'); return; }
          downloadExport(secs);
          if (typeof window.showToast === 'function') window.showToast('Export téléchargé.');
        } catch (e) { alert(e.message || e); }
      };
    }
    var exportAll = document.getElementById('pioExportAllBtn');
    if (exportAll) {
      exportAll.onclick = function () {
        try {
          downloadExport(['all']);
          if (typeof window.showToast === 'function') window.showToast('Export complet téléchargé.');
        } catch (e) { alert(e.message || e); }
      };
    }

    var importBtn = document.getElementById('pioImportBtn');
    if (importBtn) {
      importBtn.onclick = function () {
        if (window.DeviceSession && typeof window.DeviceSession.canFullSave === 'function'
            && !window.DeviceSession.canFullSave()) {
          alert('Appareil secondaire : import désactivé (lecture seule). Passe en Principal pour importer.');
          return;
        }
        var fileEl = document.getElementById('pioImportFile');
        var file = fileEl && fileEl.files && fileEl.files[0];
        if (!file) { alert('Choisis un fichier JSON d’abord.'); return; }
        var secs = selectedSections('#pioImportSections', 'data-pio-imp-section');
        if (!secs.length) { alert('Coche au moins une section à importer.'); return; }
        var modeEl = document.querySelector('input[name="pioMode"]:checked');
        var mode = modeEl ? modeEl.value : 'merge';
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var parsed = parseImportText(String(reader.result || ''));
            var normalized = normalizeImport(parsed);
            if (!normalized.ok) {
              showImportReport(normalized.report || { ok: false, errors: ['Fichier invalide'] });
              return;
            }
            if (window._persistDisabled) {
              showImportReport({
                ok: false,
                errors: ['Sauvegarde désactivée dans cette session — import refusé (rien n’a été modifié).'],
                warnings: [],
                skipped: [],
                imported: {}
              });
              return;
            }
            var report = applyImport(normalized, { sections: secs, mode: mode });
            showImportReport(report);
            if (report.ok) {
              Promise.resolve(typeof window.save === 'function' ? window.save() : null).then(function () {
                if (typeof window.showToast === 'function') window.showToast('Données importées et sauvegardées.');
                if (typeof window.renderMatieres === 'function') window.renderMatieres();
                if (typeof window.renderClasseurs === 'function') window.renderClasseurs();
                if (typeof window.renderStats === 'function') window.renderStats();
                if (typeof window.renderDashboard === 'function') window.renderDashboard();
                if (typeof window.renderNotes === 'function') window.renderNotes();
                if (typeof window.applySettings === 'function') window.applySettings();
              }).catch(function (e) {
                report.warnings = (report.warnings || []).concat(['Sauvegarde post-import : ' + (e.message || e)]);
                report.ok = false;
                showImportReport(report);
              });
            }
          } catch (e) {
            showImportReport({ ok: false, errors: [e.message || String(e)], warnings: [], skipped: [], imported: {} });
          }
        };
        reader.onerror = function () {
          showImportReport({ ok: false, errors: ['Lecture du fichier impossible'], warnings: [], skipped: [], imported: {} });
        };
        reader.readAsText(file, 'UTF-8');
      };
    }
  }

  function showImportReport(report) {
    var box = document.getElementById('pioImportReport');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = formatReportHtml(report);
  }

  // API publique
  window.ProfilesIO = {
    FORMAT: FORMAT,
    SCHEMA: SCHEMA,
    DEFAULT_ID: DEFAULT_ID,
    SECTIONS: SECTIONS,
    MAX_SNAPSHOTS: MAX_SNAPSHOTS,
    localDataKey: localDataKey,
    getActiveProfileId: getActiveProfileId,
    getSessionProfileId: getSessionProfileId,
    pinSessionProfileId: pinSessionProfileId,
    setActiveProfileId: setActiveProfileId,
    listProfiles: listProfiles,
    listAllProfiles: listAllProfiles,
    listArchivedProfiles: listArchivedProfiles,
    getProfileMeta: getProfileMeta,
    ensureLocalRegistry: ensureLocalRegistry,
    isProfilePayload: isProfilePayload,
    isAccountIndex: isAccountIndex,
    isEffectivelyEmptyProfile: isEffectivelyEmptyProfile,
    bindRegistryToUid: bindRegistryToUid,
    assertProfileCloudWritable: assertProfileCloudWritable,
    readLocalProfileData: readLocalProfileData,
    writeLocalProfileData: writeLocalProfileData,
    resolveProfileCloudDoc: resolveProfileCloudDoc,
    buildExport: buildExport,
    downloadExport: downloadExport,
    parseImportText: parseImportText,
    normalizeImport: normalizeImport,
    applyImport: applyImport,
    createProfile: createProfile,
    renameProfile: renameProfile,
    deleteProfile: deleteProfile,
    archiveProfile: archiveProfile,
    unarchiveProfile: unarchiveProfile,
    switchProfile: switchProfile,
    syncActiveProfileIndexMeta: syncActiveProfileIndexMeta,
    adoptActiveProfileFromCloud: adoptActiveProfileFromCloud,
    createSnapshot: createSnapshot,
    restoreSnapshot: restoreSnapshot,
    deleteSnapshot: deleteSnapshot,
    listSnapshots: listSnapshots,
    getProfileStorageInfo: getProfileStorageInfo,
    formatBytes: formatBytes,
    updateProfileIndicator: updateProfileIndicator,
    renderSettingsBlock: renderSettingsBlock,
    formatReportHtml: formatReportHtml
  };

  // Init registre dès le chargement (sans bloquer)
  try {
    ensureLocalRegistry();
    pinSessionProfileId(getActiveProfileId());
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateProfileIndicator);
      } else {
        updateProfileIndicator();
      }
    }
  } catch (e) { console.warn('ProfilesIO init:', e); }
})();
