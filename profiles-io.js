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
  var LEGACY_BACKUP = 'backup_local_cours';
  var LEGACY_MC = 'mc_v28';

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

  function emptyAccountIndex() {
    return {
      _account: true,
      schemaVersion: SCHEMA,
      activeProfile: DEFAULT_ID,
      profiles: [
        { id: DEFAULT_ID, name: 'Principal', createdAt: nowIso(), updatedAt: nowIso() }
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
    var active = lsGet(ACTIVE_KEY) || meta.activeProfile || DEFAULT_ID;
    if (!meta.profiles.some(function (p) { return p.id === active; })) {
      active = meta.profiles[0].id;
    }
    meta.activeProfile = active;
    writeMetaLocal(meta);
    return meta;
  }

  function getActiveProfileId() {
    var meta = ensureLocalRegistry();
    return meta.activeProfile || DEFAULT_ID;
  }

  function listProfiles() {
    return ensureLocalRegistry().profiles.slice();
  }

  function getProfileMeta(id) {
    return listProfiles().find(function (p) { return p.id === id; }) || null;
  }

  function setActiveProfileId(id) {
    var meta = ensureLocalRegistry();
    if (!meta.profiles.some(function (p) { return p.id === id; })) {
      throw new Error('Profil inconnu : ' + id);
    }
    meta.activeProfile = id;
    writeMetaLocal(meta);
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

  function writeLocalProfileData(profileId, data) {
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
      meta.profiles.forEach(function (p) {
        if (p.id === profileId) p.updatedAt = nowIso();
      });
      writeMetaLocal(meta);
    } catch (e) {
      console.warn('[ProfilesIO] meta non mise à jour:', e);
    }
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
    var accountRef = accountDocRef(uid);
    var accountSnap = await window.getDoc(accountRef);
    var accountData = accountSnap.exists() ? accountSnap.data() : null;

    // Legacy : tout le D était sur la racine
    if (isLegacyDataDoc(accountData)) {
      var legacyD = accountData;
      var index = emptyAccountIndex();
      index.profiles[0].updatedAt = nowIso();
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
      ensureLocalRegistry();
      var localActive = getActiveProfileId();
      fresh.activeProfile = localActive;
      if (!fresh.profiles.some(function (p) { return p.id === localActive; })) {
        fresh.profiles = listProfiles().map(function (p) {
          return { id: p.id, name: p.name, createdAt: p.createdAt || nowIso(), updatedAt: p.updatedAt || nowIso() };
        });
        fresh.activeProfile = localActive;
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

    var profileId = getActiveProfileId();
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

    var pref = profileDocRef(uid, profileId);
    var snap = await window.getDoc(pref);
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
      return {
        docRef: pref,
        accountRef: accountRef,
        data: cloudPayload,
        profileId: profileId,
        legacyRoot: false,
        migrated: false
      };
    }

    // Profil cloud absent : données locales UNIQUEMENT si le profil est dans l’index
    // (évite de ressusciter un profil tombstoné)
    var inIndex = accountData.profiles.some(function (p) { return p && p.id === profileId; });
    var localD = null;
    if (inIndex && !deletedMap[profileId]) {
      localD = readLocalProfileData(profileId);
      if (localD && isProfilePayload(localD) && window.setDoc) {
        try { await window.setDoc(pref, localD); } catch (e) { /* ignore */ }
      } else if (localD && !isProfilePayload(localD)) {
        localD = null;
      }
    }

    return {
      docRef: pref,
      accountRef: accountRef,
      data: localD,
      profileId: profileId,
      legacyRoot: false,
      migrated: false
    };
  }

  function syncRegistryFromAccount(accountData) {
    if (!isAccountIndex(accountData)) return;
    var meta = ensureLocalRegistry();
    var deleted = accountData.deletedProfiles || {};
    var byId = {};
    meta.profiles.forEach(function (p) { byId[p.id] = p; });
    (accountData.profiles || []).forEach(function (cp) {
      if (!cp || !cp.id || deleted[cp.id]) return;
      if (byId[cp.id]) {
        byId[cp.id].name = cp.name || byId[cp.id].name;
        byId[cp.id].updatedAt = cp.updatedAt || byId[cp.id].updatedAt;
      } else {
        meta.profiles.push({
          id: cp.id,
          name: cp.name || cp.id,
          createdAt: cp.createdAt || nowIso(),
          updatedAt: cp.updatedAt || nowIso()
        });
        byId[cp.id] = true;
      }
    });
    // Retirer les profils tombstonés (sauf session courante — bascule d’abord)
    var sessionId = getSessionProfileId();
    meta.profiles = meta.profiles.filter(function (p) {
      if (!p || !p.id) return false;
      if (deleted[p.id] && p.id !== sessionId) return false;
      return true;
    });
    writeMetaLocal(meta);
  }

  /**
   * Écrit l’index compte cloud.
   * @param opts.removedIds — profils à retirer + tombstone
   */
  async function persistAccountIndexCloud(user, meta, opts) {
    if (window.isLocalMode || !user || !user.sub || !window.setDoc || !window.doc || !window.db) return true;
    if (window.cloudConnected === false) return false;
    opts = opts || {};
    var removedIds = opts.removedIds || [];
    var removedSet = Object.create(null);
    removedIds.forEach(function (id) { if (id) removedSet[id] = true; });

    if (!window.getDoc) {
      console.warn('[ProfilesIO] Index non écrit : getDoc indisponible');
      return false;
    }

    var ref = accountDocRef(user.sub);
    var remoteProfiles = [];
    var remoteActive = null;
    var deletedProfiles = {};
    var remoteExists = false;
    try {
      var snap = await window.getDoc(ref);
      if (snap.exists()) {
        remoteExists = true;
        var remote = snap.data();
        if (isAccountIndex(remote)) {
          remoteProfiles = remote.profiles || [];
          remoteActive = remote.activeProfile || null;
          deletedProfiles = remote.deletedProfiles && typeof remote.deletedProfiles === 'object'
            ? Object.assign({}, remote.deletedProfiles)
            : {};
        } else if (isLegacyDataDoc(remote)) {
          console.warn('[ProfilesIO] Index non écrit : racine encore en format legacy');
          return false;
        } else {
          console.warn('[ProfilesIO] Index non écrit : document racine non reconnu');
          return false;
        }
      }
    } catch (e) {
      console.warn('[ProfilesIO] Lecture index échouée — pas d’écriture:', e);
      return false;
    }

    removedIds.forEach(function (id) {
      if (id) deletedProfiles[id] = Date.now();
    });

    var byId = Object.create(null);
    remoteProfiles.forEach(function (p) {
      if (!p || !p.id || removedSet[p.id] || deletedProfiles[p.id]) return;
      byId[p.id] = {
        id: p.id,
        name: p.name || p.id,
        createdAt: p.createdAt || nowIso(),
        updatedAt: p.updatedAt || nowIso()
      };
    });
    (meta.profiles || []).forEach(function (p) {
      if (!p || !p.id || removedSet[p.id] || deletedProfiles[p.id]) return;
      if (byId[p.id]) {
        byId[p.id].name = p.name || byId[p.id].name;
        byId[p.id].updatedAt = p.updatedAt || nowIso();
      } else {
        byId[p.id] = {
          id: p.id,
          name: p.name || p.id,
          createdAt: p.createdAt || nowIso(),
          updatedAt: p.updatedAt || nowIso()
        };
      }
    });

    var payload = {
      _account: true,
      schemaVersion: SCHEMA,
      activeProfile: meta.activeProfile || remoteActive || DEFAULT_ID,
      profiles: Object.keys(byId).map(function (k) { return byId[k]; }),
      deletedProfiles: deletedProfiles
    };
    if (removedSet[payload.activeProfile] || deletedProfiles[payload.activeProfile]
      || !payload.profiles.some(function (p) { return p.id === payload.activeProfile; })) {
      payload.activeProfile = payload.profiles[0] ? payload.profiles[0].id : DEFAULT_ID;
    }
    try {
      await window.setDoc(ref, payload);
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

  async function createProfile(name, opts) {
    opts = opts || {};
    var meta = ensureLocalRegistry();
    var existing = {};
    meta.profiles.forEach(function (p) { existing[p.id] = true; });
    var id = uniqueId(slugify(name), existing);
    var entry = {
      id: id,
      name: String(name || 'Profil').trim() || id,
      createdAt: nowIso(),
      updatedAt: nowIso()
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
    if (!writeLocalProfileData(id, seed)) {
      meta.profiles = meta.profiles.filter(function (p) { return p.id !== id; });
      writeMetaLocal(meta);
      throw new Error('Impossible de créer le profil (stockage navigateur plein ou refusé).');
    }

    var user = window.currentUser;
    var okIdx = await persistAccountIndexCloud(user, meta);
    if (!window.isLocalMode && window.cloudConnected && user && user.sub && !okIdx) {
      console.warn('[ProfilesIO] Index cloud non synchronisé après création');
    }
    if (!window.isLocalMode && window.cloudConnected && user && user.sub && window.setDoc) {
      try {
        await window.setDoc(profileDocRef(user.sub, id), seed);
      } catch (e) {
        console.warn('Création profil cloud:', e);
        throw new Error('Profil créé en local, mais la copie cloud a échoué. Réessaie plus tard.');
      }
    }
    return entry;
  }

  async function renameProfile(id, name) {
    var meta = ensureLocalRegistry();
    var p = meta.profiles.find(function (x) { return x.id === id; });
    if (!p) throw new Error('Profil introuvable');
    p.name = String(name || p.name).trim() || p.name;
    p.updatedAt = nowIso();
    writeMetaLocal(meta);
    await persistAccountIndexCloud(window.currentUser, meta);
    return p;
  }

  async function deleteProfile(id) {
    var meta = ensureLocalRegistry();
    if (meta.profiles.length <= 1) throw new Error('Impossible de supprimer le dernier profil.');
    if (id === getSessionProfileId() || id === meta.activeProfile) {
      throw new Error('Bascule sur un autre profil avant de supprimer celui-ci.');
    }
    meta.profiles = meta.profiles.filter(function (p) { return p.id !== id; });
    writeMetaLocal(meta);
    lsRemove(localDataKey(id));
    var okIdx = await persistAccountIndexCloud(window.currentUser, meta, { removedIds: [id] });
    if (!window.isLocalMode && window.cloudConnected && window.currentUser && window.currentUser.sub && !okIdx) {
      throw new Error('Suppression cloud de l’index échouée. Réessaie (le profil est retiré localement).');
    }
    if (!window.isLocalMode && window.cloudConnected && window.currentUser && window.currentUser.sub && window.setDoc) {
      try {
        if (typeof window.deleteDoc === 'function') {
          await window.deleteDoc(profileDocRef(window.currentUser.sub, id));
        } else {
          await window.setDoc(profileDocRef(window.currentUser.sub, id), { _deleted: true, deletedAt: nowIso() });
        }
      } catch (e) { console.warn('Suppression cloud profil:', e); }
    }
  }

  async function switchProfile(id) {
    if (id === getSessionProfileId()) return;
    var meta = ensureLocalRegistry();
    if (!meta.profiles.some(function (p) { return p.id === id; })) {
      throw new Error('Profil inconnu');
    }
    var wasLocal = lsGet('active_mode') === 'local' || !!window.isLocalMode;
    var fromId = getSessionProfileId();

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
    setActiveProfileId(id);
    if (wasLocal) lsSet('active_mode', 'local');
    meta = ensureLocalRegistry();
    await persistAccountIndexCloud(window.currentUser, meta);
    location.reload();
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

  function renderSettingsBlock() {
    var root = document.getElementById('pioSettingsRoot');
    if (!root) return;
    var meta = ensureLocalRegistry();
    var active = meta.activeProfile;

    var profileOpts = meta.profiles.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === active ? ' selected' : '') + '>' +
        esc(p.name) + (p.id === active ? ' (actif)' : '') + '</option>';
    }).join('');

    var sectionChecks = SECTIONS.map(function (s) {
      return '<label class="pio-check"><input type="checkbox" data-pio-section="' + esc(s.id) + '" checked> ' +
        '<span><b>' + esc(s.label) + '</b><small>' + esc(s.hint) + '</small></span></label>';
    }).join('');

    root.innerHTML =
      '<div class="pio-card">' +
        '<div class="pio-card-title">Profils de données</div>' +
        '<p class="pio-card-sub">Plusieurs espaces isolés sous le même compte Google. Les IDs peuvent se croiser d’un profil à l’autre sans collision.</p>' +
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
          '<button type="button" class="bs pio-danger" id="pioDeleteBtn">Supprimer…</button>' +
        '</div>' +
      '</div>' +

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
        var go = function () {
          deleteProfile(id).then(function () {
            if (typeof window.showToast === 'function') window.showToast('Profil « ' + ((meta && meta.name) || id) + ' » supprimé.');
            renderSettingsBlock();
          }).catch(function (e) { alert(e.message || e); });
        };
        if (typeof window.sysConfirm === 'function') {
          window.sysConfirm('Supprimer définitivement « ' + esc((meta && meta.name) || id) + ' » et toutes ses données ?', go);
        } else if (confirm('Supprimer ?')) go();
      };
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
    localDataKey: localDataKey,
    getActiveProfileId: getActiveProfileId,
    getSessionProfileId: getSessionProfileId,
    pinSessionProfileId: pinSessionProfileId,
    setActiveProfileId: setActiveProfileId,
    listProfiles: listProfiles,
    getProfileMeta: getProfileMeta,
    ensureLocalRegistry: ensureLocalRegistry,
    isProfilePayload: isProfilePayload,
    isAccountIndex: isAccountIndex,
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
    switchProfile: switchProfile,
    renderSettingsBlock: renderSettingsBlock,
    formatReportHtml: formatReportHtml
  };

  // Init registre dès le chargement (sans bloquer)
  try {
    ensureLocalRegistry();
    pinSessionProfileId(getActiveProfileId());
  } catch (e) { console.warn('ProfilesIO init:', e); }
})();
