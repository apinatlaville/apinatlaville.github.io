/**
 * quick-share.js — Partage de dossiers Rapide (catalogue public, pull manuel)
 * Contenu partagé (contentId) ≠ cartes Y- locales (SRS perso).
 */
(function () {
  'use strict';

  var KIND = 'mes-cours-quick-pack';
  var SCHEMA = 2;
  var LOCAL_KEY = 'mes_cours_shared_packs_v1';
  var COLLECTION = 'sharedPacks';
  /** Seuil de recouvrement contenu pour rattacher un pack à un dossier existant (anti 2e groupe). */
  var CONTENT_OVERLAP_RATIO = 0.45;
  var CONTENT_OVERLAP_MIN_HITS = 2;

  var S = {
    view: 'catalog', // catalog | mine | detail
    packId: '',
    q: '',
    matFilter: '', // id canonique or '' = toutes
    catalog: null,
    detail: null,
    versions: null,
    busy: false,
    pendingRender: false
  };

  function isSamePublisher(meta) {
    if (!meta || !meta.createdBy || !meta.createdBy.uid) return false;
    var pub = publisherInfo();
    return !!(pub.uid && meta.createdBy.uid === pub.uid);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function jsStr(s) {
    return typeof window.escapeJsStr === 'function'
      ? window.escapeJsStr(s)
      : String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function isLocalMode() {
    return !!window.isLocalMode || (function () {
      try { return localStorage.getItem('active_mode') === 'local'; } catch (e) { return false; }
    })();
  }

  function canUseCloud() {
    return !!(window.db && window.doc && window.setDoc && window.getDoc && window.auth && window.auth.currentUser);
  }

  function publisherInfo() {
    var u = window.auth && window.auth.currentUser;
    if (u) {
      return {
        uid: u.uid || '',
        name: (u.displayName || u.email || 'Utilisateur').slice(0, 80)
      };
    }
    if (isLocalMode()) {
      return { uid: 'local', name: 'Mode Local' };
    }
    return { uid: '', name: 'Anonyme' };
  }

  function genCode(prefix, len, usedSet) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var used = usedSet || new Set();
    for (var n = 0; n < 3000; n++) {
      var s = prefix;
      for (var i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      if (!used.has(s)) return s;
    }
    return prefix + Date.now().toString(36).slice(-(len)).toUpperCase();
  }

  function genPackId() {
    return genCode('P-', 5);
  }

  /** Même compte + même dossier → même packId → nouvelles versions, pas de doublon catalogue. */
  function stablePackId(uid, groupId) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var seed = String(uid || 'anon') + '#' + String(groupId || '');
    function h32(s) {
      var h = 2166136261;
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
    var a = h32(seed);
    var b = h32(seed + '|b');
    var out = 'P-';
    var n = a;
    for (var i = 0; i < 10; i++) {
      out += chars.charAt(n % chars.length);
      n = (Math.imul(n, 1664525) + 1013904223 + b + i) >>> 0;
      if (i === 4) n ^= b;
    }
    return out;
  }

  function genContentId(used) {
    return genCode('S-', 4, used);
  }

  function normalizeContentText(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /** Empreinte stable du texte (titre+Q+R) — filet si contentId manquant / divergé. */
  function contentFingerprint(card) {
    if (!card) return '';
    var t = normalizeContentText(card.titre);
    var q = normalizeContentText(card.question);
    var r = normalizeContentText(card.reponse);
    if (!t && !q && !r) return '';
    return t + '\n' + q + '\n' + r;
  }

  function contentFields(card) {
    return {
      contentId: card.contentId,
      titre: card.titre || '',
      question: card.question || '',
      reponse: card.reponse || '',
      profil: card.profil || 'ANGLAIS',
      tempsCible: card.tempsCible != null ? Number(card.tempsCible) : 30,
      importance: card.importance != null ? Number(card.importance) : 3
    };
  }

  function ensureContentIds(cards) {
    var used = new Set();
    (window.D.exercices || []).forEach(function (c) {
      if (c && c.contentId) used.add(c.contentId);
    });
    var changed = false;
    cards.forEach(function (c) {
      if (!c.contentId) {
        c.contentId = genContentId(used);
        used.add(c.contentId);
        changed = true;
      } else {
        used.add(c.contentId);
      }
    });
    return changed;
  }

  function cardsForGroup(groupId) {
    return (window.D.exercices || []).filter(function (c) {
      if (!c || c.groupId !== groupId) return false;
      if (window.AnkiAlgo && typeof window.AnkiAlgo.cardKind === 'function') {
        return window.AnkiAlgo.cardKind(c) === 'quick';
      }
      if (window.AnkiAlgoV2 && typeof window.AnkiAlgoV2.cardKind === 'function') {
        return window.AnkiAlgoV2.cardKind(c) === 'quick';
      }
      /* Fallback si algo pas encore chargé : UIDs Y- */
      return /^Y-/i.test(String(c.id || ''));
    });
  }

  function cardSrsScore(c) {
    if (!c) return 0;
    var hist = Array.isArray(c.historique) ? c.historique.length : 0;
    var reps = Number(c.repetitions) || 0;
    var last = 0;
    if (hist) {
      var h = c.historique[hist - 1];
      last = Date.parse(h && h.date) || 0;
    }
    return hist * 1e12 + last + reps * 10;
  }

  /** Tous les packId associés à un dossier (lien courant + filiation). */
  function lineagePackIds(shared) {
    var out = [];
    var seen = Object.create(null);
    function add(id) {
      id = String(id || '').trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push(id);
    }
    if (!shared) return out;
    add(shared.packId);
    add(shared.originPackId);
    add(shared.forkedFrom);
    (shared.relatedPackIds || []).forEach(add);
    return out;
  }

  function mergeRelatedPackIds(prevList, extraId, extraList) {
    var out = [];
    var seen = Object.create(null);
    function add(id) {
      id = String(id || '').trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push(id);
    }
    (prevList || []).forEach(add);
    (extraList || []).forEach(add);
    add(extraId);
    return out;
  }

  function groupLinkedToPackId(g, packId) {
    if (!g || !packId) return false;
    return lineagePackIds(g.shared).indexOf(String(packId)) >= 0;
  }

  /**
   * Recouvrement contenu (contentId puis empreinte texte) entre un pack et un dossier local.
   * @returns {{ group:object, hits:number, total:number, ratio:number }|null}
   */
  function bestContentOverlapGroup(versionDoc, preferMat) {
    var packCards = (versionDoc && versionDoc.cards) || [];
    if (!packCards.length) return null;
    var best = null;
    (window.D.quickGroups || []).forEach(function (g) {
      if (!g || !g.id) return;
      var local = cardsForGroup(g.id);
      if (!local.length) return;
      var byId = Object.create(null);
      var byFp = Object.create(null);
      local.forEach(function (c) {
        if (c.contentId) byId[c.contentId] = c;
        var fp = contentFingerprint(c);
        if (fp) byFp[fp] = c;
      });
      var hits = 0;
      packCards.forEach(function (pc) {
        if (!pc) return;
        if (pc.contentId && byId[pc.contentId]) { hits++; return; }
        var fp = contentFingerprint(pc);
        if (fp && byFp[fp]) hits++;
      });
      var ratio = hits / packCards.length;
      var matBonus = (preferMat && g.mat && g.mat === preferMat) ? 0.01 : 0;
      var score = hits + matBonus;
      if (!best || score > best.score || (score === best.score && ratio > best.ratio)) {
        best = { group: g, hits: hits, total: packCards.length, ratio: ratio, score: score };
      }
    });
    if (!best) return null;
    if (best.hits >= CONTENT_OVERLAP_MIN_HITS && best.ratio >= CONTENT_OVERLAP_RATIO) return best;
    if (best.ratio >= 0.85 && best.hits >= 1) return best;
    return null;
  }

  /**
   * Dossier local déjà lié à ce pack (filiation) ou au même contenu.
   * Ne crée JAMAIS un 2e dossier si un match solide existe.
   */
  function findLocalGroupForPack(packId, versionDoc, preferMat) {
    packId = String(packId || '').trim();
    if (packId) {
      var byLineage = (window.D.quickGroups || []).find(function (g) {
        return groupLinkedToPackId(g, packId);
      });
      if (byLineage) return byLineage;
    }
    if (versionDoc) {
      var ov = bestContentOverlapGroup(versionDoc, preferMat);
      if (ov && ov.group) return ov.group;
    }
    return null;
  }

  function writeSharedLink(g, opts) {
    opts = opts || {};
    if (!g) return;
    var prev = g.shared || {};
    var packId = opts.packId || prev.packId || '';
    var origin = opts.originPackId || prev.originPackId || prev.packId || packId;
    var forkedFrom = opts.forkedFrom != null ? opts.forkedFrom : (prev.forkedFrom || '');
    var related = mergeRelatedPackIds(
      prev.relatedPackIds,
      opts.relatedPackId,
      opts.relatedPackIds
    ).filter(function (id) {
      return id && id !== packId && id !== origin && id !== forkedFrom;
    });
    g.shared = {
      packId: packId,
      originPackId: origin || packId,
      forkedFrom: forkedFrom || '',
      installedVersion: opts.installedVersion != null ? Number(opts.installedVersion) : Number(prev.installedVersion || 0),
      publishedVersion: opts.publishedVersion != null ? Number(opts.publishedVersion) : prev.publishedVersion,
      mat: opts.mat != null ? opts.mat : (g.mat || prev.mat || ''),
      chapitreId: opts.chapitreId != null ? opts.chapitreId : (g.chapitreId || prev.chapitreId || ''),
      color: opts.color != null ? opts.color : (g.color || prev.color || ''),
      localDirty: opts.localDirty != null ? !!opts.localDirty : !!prev.localDirty,
      imported: opts.imported != null ? !!opts.imported : !!prev.imported
    };
    if (related.length) g.shared.relatedPackIds = related;
    if (!g.shared.imported) delete g.shared.imported;
    if (!g.shared.forkedFrom) delete g.shared.forkedFrom;
    if (g.shared.publishedVersion == null) delete g.shared.publishedVersion;
  }

  /**
   * Supprime les doublons dans un dossier (même contentId ou même empreinte texte).
   * Conserve la carte au SRS le plus avancé ; adopte le contentId du pack si fourni.
   * @returns {number} nb de cartes retirées
   */
  function dedupeGroupCards(groupId) {
    var list = cardsForGroup(groupId);
    if (list.length < 2) return 0;
    var bestByKey = Object.create(null);
    var keyOf = function (c) {
      if (c.contentId) return 'id:' + c.contentId;
      var fp = contentFingerprint(c);
      return fp ? 'fp:' + fp : 'uid:' + c.id;
    };
    list.forEach(function (c) {
      var k = keyOf(c);
      var prev = bestByKey[k];
      if (!prev || cardSrsScore(c) > cardSrsScore(prev)) bestByKey[k] = c;
    });
    /* Fusionne aussi fp ↔ contentId : si A a contentId et B même texte sans id, garde A */
    var byFp = Object.create(null);
    Object.keys(bestByKey).forEach(function (k) {
      var c = bestByKey[k];
      var fp = contentFingerprint(c);
      if (!fp) return;
      var prev = byFp[fp];
      if (!prev) { byFp[fp] = c; return; }
      var winner = cardSrsScore(c) >= cardSrsScore(prev) ? c : prev;
      var loser = winner === c ? prev : c;
      if (!winner.contentId && loser.contentId) winner.contentId = loser.contentId;
      byFp[fp] = winner;
    });
    var keep = Object.create(null);
    Object.keys(byFp).forEach(function (fp) { keep[byFp[fp].id] = true; });
    Object.keys(bestByKey).forEach(function (k) {
      var c = bestByKey[k];
      var fp = contentFingerprint(c);
      if (fp && byFp[fp]) keep[byFp[fp].id] = true;
      else keep[c.id] = true;
    });
    var before = (window.D.exercices || []).length;
    window.D.exercices = (window.D.exercices || []).filter(function (c) {
      if (!c || c.groupId !== groupId) return true;
      var isQuick = false;
      if (window.AnkiAlgo && typeof window.AnkiAlgo.cardKind === 'function') {
        isQuick = window.AnkiAlgo.cardKind(c) === 'quick';
      } else if (window.AnkiAlgoV2 && typeof window.AnkiAlgoV2.cardKind === 'function') {
        isQuick = window.AnkiAlgoV2.cardKind(c) === 'quick';
      } else {
        isQuick = /^Y-/i.test(String(c.id || ''));
      }
      if (!isQuick) return true;
      return !!keep[c.id];
    });
    return Math.max(0, before - (window.D.exercices || []).length);
  }

  function dedupeAllQuickGroups() {
    var n = 0;
    (window.D.quickGroups || []).forEach(function (g) {
      if (g && g.id) n += dedupeGroupCards(g.id);
    });
    return n;
  }

  function buildVersionPayload(group, cards, version, pub) {
    return {
      version: version,
      publishedAt: nowIso(),
      publishedBy: pub,
      name: group.name || 'Dossier',
      cards: cards.map(contentFields)
    };
  }

  // ─── Storage local (mode test / hors cloud) ─────────────

  function readLocalStore() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return { packs: {} };
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return { packs: {} };
      if (!o.packs) o.packs = {};
      return o;
    } catch (e) {
      return { packs: {} };
    }
  }

  function writeLocalStore(store) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  }

  function localListPacks() {
    var store = readLocalStore();
    return Object.keys(store.packs).map(function (id) {
      return store.packs[id].meta;
    }).filter(Boolean).sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }

  function localGetPack(packId) {
    var store = readLocalStore();
    return store.packs[packId] || null;
  }

  function localPublish(meta, versionDoc) {
    var store = readLocalStore();
    var pack = store.packs[meta.packId] || { meta: null, versions: {} };
    if (!pack.versions) pack.versions = {};
    var existing = pack.meta;
    var nextVersion = existing && existing.latestVersion != null
      ? Number(existing.latestVersion) + 1
      : 1;
    var versionFinal = Object.assign({}, versionDoc, { version: nextVersion });
    var metaFinal = Object.assign({}, meta, {
      latestVersion: nextVersion,
      cardCount: (versionFinal.cards && versionFinal.cards.length) || meta.cardCount || 0,
      createdAt: (existing && existing.createdAt) || meta.createdAt,
      createdBy: (existing && existing.createdBy) || meta.createdBy,
      sourceGroupId: meta.sourceGroupId || (existing && existing.sourceGroupId) || '',
      forkedFrom: meta.forkedFrom || (existing && existing.forkedFrom) || '',
      originPackId: meta.originPackId || (existing && existing.originPackId) || meta.forkedFrom || ''
    });
    if (!metaFinal.forkedFrom) delete metaFinal.forkedFrom;
    if (!metaFinal.originPackId) delete metaFinal.originPackId;
    pack.meta = metaFinal;
    pack.versions[String(nextVersion)] = versionFinal;
    store.packs[meta.packId] = pack;
    writeLocalStore(store);
    return { meta: metaFinal, version: nextVersion };
  }

  // ─── Firestore ──────────────────────────────────────────

  async function cloudListPacks() {
    if (!window.collection || !window.getDocs) {
      throw new Error('Firestore collection API indisponible — recharge la page.');
    }
    var col = window.collection(window.db, COLLECTION);
    var snap = await window.getDocs(col);
    var list = [];
    snap.forEach(function (d) {
      var data = d.data() || {};
      data.packId = data.packId || d.id;
      if (data.visibility === 'group') return; // futur
      list.push(data);
    });
    list.sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
    return list;
  }

  async function cloudGetMeta(packId) {
    var ref = window.doc(window.db, COLLECTION, packId);
    var snap = await window.getDoc(ref);
    if (!snap.exists()) return null;
    var data = snap.data() || {};
    data.packId = data.packId || packId;
    return data;
  }

  async function cloudGetVersion(packId, version) {
    var ref = window.doc(window.db, COLLECTION, packId, 'versions', String(version));
    var snap = await window.getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  }

  function sortVersionsDesc(list) {
    return (list || []).slice().sort(function (a, b) {
      var ta = a && a.publishedAt ? Date.parse(a.publishedAt) : NaN;
      var tb = b && b.publishedAt ? Date.parse(b.publishedAt) : NaN;
      var na = isNaN(ta) ? 0 : ta;
      var nb = isNaN(tb) ? 0 : tb;
      if (nb !== na) return nb - na;
      return (Number(b && b.version) || 0) - (Number(a && a.version) || 0);
    });
  }

  async function cloudListVersions(packId) {
    if (!window.collection || !window.getDocs) return [];
    var col = window.collection(window.db, COLLECTION, packId, 'versions');
    var snap = await window.getDocs(col);
    var list = [];
    snap.forEach(function (d) {
      var data = d.data() || {};
      data.version = data.version != null ? data.version : parseInt(d.id, 10);
      list.push(data);
    });
    return sortVersionsDesc(list);
  }

  async function cloudPublish(meta, versionDoc) {
    var packId = meta.packId;
    var pub = meta.lastPublishedBy || meta.createdBy || publisherInfo();

    if (typeof window.runTransaction === 'function' && window.db) {
      return window.runTransaction(window.db, async function (transaction) {
        var packRef = window.doc(window.db, COLLECTION, packId);
        var snap = await transaction.get(packRef);
        var existing = snap.exists() ? (snap.data() || {}) : null;
        /* Collaborative : toute personne connectée peut ajouter une version.
           createdBy (créateur initial) est figé ; lastPublishedBy = contributeur. */
        var nextVersion = existing && existing.latestVersion != null
          ? Number(existing.latestVersion) + 1
          : 1;
        var versionFinal = Object.assign({}, versionDoc, { version: nextVersion });
        var metaFinal = Object.assign({}, meta, {
          packId: packId,
          latestVersion: nextVersion,
          cardCount: (versionFinal.cards && versionFinal.cards.length) || meta.cardCount || 0,
          createdAt: (existing && existing.createdAt) || meta.createdAt,
          createdBy: (existing && existing.createdBy) || meta.createdBy || pub,
          lastPublishedBy: pub,
          sourceGroupId: meta.sourceGroupId || (existing && existing.sourceGroupId) || '',
          forkedFrom: meta.forkedFrom || (existing && existing.forkedFrom) || '',
          originPackId: meta.originPackId || (existing && existing.originPackId)
            || meta.forkedFrom || (existing && existing.forkedFrom) || ''
        });
        if (!metaFinal.forkedFrom) delete metaFinal.forkedFrom;
        if (!metaFinal.originPackId) delete metaFinal.originPackId;
        var verRef = window.doc(window.db, COLLECTION, packId, 'versions', String(nextVersion));
        transaction.set(packRef, metaFinal, { merge: true });
        transaction.set(verRef, versionFinal);
        return { meta: metaFinal, version: nextVersion };
      });
    }

    var packRef = window.doc(window.db, COLLECTION, packId);
    var verRef = window.doc(window.db, COLLECTION, packId, 'versions', String(versionDoc.version));
    await window.setDoc(packRef, meta, { merge: true });
    await window.setDoc(verRef, versionDoc);
    return { meta: meta, version: versionDoc.version };
  }

  async function cloudDeletePack(packId) {
    if (!window.deleteDoc || !window.doc) {
      throw new Error('Suppression cloud indisponible — recharge la page.');
    }
    var versions = [];
    try { versions = await cloudListVersions(packId); } catch (e) { /* ignore */ }
    for (var i = 0; i < versions.length; i++) {
      var v = versions[i];
      var verId = v && v.version != null ? String(v.version) : null;
      if (!verId) continue;
      await window.deleteDoc(window.doc(window.db, COLLECTION, packId, 'versions', verId));
    }
    await window.deleteDoc(window.doc(window.db, COLLECTION, packId));
  }

  function localDeletePack(packId) {
    var store = readLocalStore();
    if (store.packs && store.packs[packId]) {
      delete store.packs[packId];
      writeLocalStore(store);
    }
  }

  /**
   * Retrouve le pack catalogue de ce dossier (créateur = toi).
   * 1) sourceGroupId exact
   * 2) repli legacy : un seul pack à toi avec le même nom (pas de matching contenu)
   */
  async function findReusablePackMeta(groupId, groupName) {
    if (!groupId) return null;
    var list;
    try { list = await window.QuickShare.listPacks(); } catch (e) { return null; }
    var pub = publisherInfo();
    if (!pub.uid) return null;
    var mine = (list || []).filter(function (p) {
      return p && p.createdBy && p.createdBy.uid === pub.uid;
    });
    if (!mine.length) return null;

    var bySrc = mine.filter(function (p) { return p.sourceGroupId === groupId; });
    if (bySrc.length) {
      bySrc.sort(function (a, b) {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });
      return bySrc[0];
    }

    // Legacy (packs publiés avant sourceGroupId) : nom unique chez moi uniquement
    var name = String(groupName || '').trim().toLowerCase();
    if (name) {
      var byName = mine.filter(function (p) {
        return String(p.name || '').trim().toLowerCase() === name;
      });
      if (byName.length === 1) return byName[0];
    }
    return null;
  }

  /**
   * Un dossier → un pack → des versions (collaboratif).
   * 1) shared.packId local → toujours ce pack (même si tu n’es pas le créateur)
   * 2) sourceGroupId / nom unique catalogue (tes packs)
   * 3) packId stable uid+dossier
   * opts.fork (rare) : nouveau packId séparé — non proposé par l’UI normale.
   */
  async function resolvePublishTarget(g, shared, pub, forking) {
    if (forking) {
      var origin = (shared && (shared.packId || shared.originPackId)) || '';
      if (origin) {
        try {
          var list = await window.QuickShare.listPacks();
          var mineForks = (list || []).filter(function (p) {
            return p && p.packId && p.createdBy && p.createdBy.uid === pub.uid
              && (p.forkedFrom === origin || p.originPackId === origin
                || (g && g.id && p.sourceGroupId === g.id));
          });
          if (mineForks.length) {
            mineForks.sort(function (a, b) {
              return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
            });
            return {
              packId: mineForks[0].packId,
              existingMeta: mineForks[0],
              forking: true,
              forkedFrom: mineForks[0].forkedFrom || origin,
              originPackId: mineForks[0].originPackId || origin
            };
          }
        } catch (e) { /* ignore — nouveau pack */ }
      }
      return {
        packId: genPackId(),
        existingMeta: null,
        forking: true,
        forkedFrom: origin || '',
        originPackId: (shared && shared.originPackId) || origin || ''
      };
    }
    var packId = (shared && shared.packId) || '';
    var existingMeta = null;
    if (packId) {
      try { existingMeta = await window.QuickShare.getMeta(packId); } catch (e) { /* ignore */ }
      /* Même packId que le dossier lié — créateur ou contributeur */
      return { packId: packId, existingMeta: existingMeta, forking: false };
    }

    var recovered = await findReusablePackMeta(g.id, g.name);
    if (recovered && recovered.packId) {
      return { packId: recovered.packId, existingMeta: recovered, forking: false };
    }

    packId = stablePackId(pub.uid, g.id);
    try { existingMeta = await window.QuickShare.getMeta(packId); } catch (e) { existingMeta = null; }
    if (existingMeta && !isSamePublisher(existingMeta)) {
      /* Collision d’id stable avec un pack tiers sans lien local → id frais, pas un fork « lié » */
      return {
        packId: genPackId(),
        existingMeta: null,
        forking: false,
        forkedFrom: '',
        originPackId: ''
      };
    }
    return { packId: packId, existingMeta: existingMeta, forking: false };
  }

  function unlinkLocalGroupsFromPack(packId) {
    var changed = false;
    (window.D.quickGroups || []).forEach(function (g) {
      if (g && g.shared && g.shared.packId === packId) {
        delete g.shared;
        changed = true;
      }
    });
    if (changed && typeof window.save === 'function') window.save();
    return changed;
  }

  // ─── API publique storage ───────────────────────────────

  window.QuickShare = {
    KIND: KIND,
    SCHEMA: SCHEMA,

    canPublish: function () {
      if (isLocalMode()) return true;
      return canUseCloud();
    },

    listPacks: async function () {
      if (canUseCloud()) return cloudListPacks();
      if (isLocalMode()) return localListPacks();
      throw new Error('Connecte-toi avec Google pour voir le catalogue partagé.');
    },

    getMeta: async function (packId) {
      if (canUseCloud()) return cloudGetMeta(packId);
      var p = localGetPack(packId);
      return p ? p.meta : null;
    },

    getVersion: async function (packId, version) {
      if (canUseCloud()) return cloudGetVersion(packId, version);
      var p = localGetPack(packId);
      if (!p || !p.versions) return null;
      return p.versions[String(version)] || null;
    },

    listVersions: async function (packId) {
      if (canUseCloud()) return cloudListVersions(packId);
      var p = localGetPack(packId);
      if (!p || !p.versions) return [];
      return sortVersionsDesc(Object.keys(p.versions).map(function (k) {
        return p.versions[k];
      }));
    },

    /** Construit le payload contenu depuis un dossier local (assigne contentIds si besoin). */
    prepareGroupContent: function (groupId) {
      var g = (window.D.quickGroups || []).find(function (x) { return x.id === groupId; });
      if (!g) throw new Error('Dossier introuvable.');
      var cards = cardsForGroup(groupId);
      if (!cards.length) throw new Error('Ce dossier n’a aucune carte Rapide (Y-) à partager.');
      var changed = ensureContentIds(cards);
      if (changed && typeof window.save === 'function') window.save();
      return { group: g, cards: cards };
    },

    isPackOwner: function (meta) {
      return isSamePublisher(meta);
    },

    /**
     * Si le lien shared manque en local (sync), rattache les dossiers aux packs
     * déjà publiés (même sourceGroupId ou packId stable) → indicateur Partage.
     */
    relinkLocalGroupsFromCatalog: async function () {
      var pub = publisherInfo();
      if (!pub.uid) return 0;
      var list;
      try { list = await window.QuickShare.listPacks(); } catch (e) { return 0; }
      var mine = (list || []).filter(function (p) {
        return p && p.packId && p.createdBy && p.createdBy.uid === pub.uid;
      });
      var bySrc = {};
      var byId = {};
      var nameCount = {};
      mine.forEach(function (p) {
        byId[p.packId] = p;
        if (p.sourceGroupId) {
          var prev = bySrc[p.sourceGroupId];
          if (!prev || String(p.createdAt || '') < String(prev.createdAt || '')) {
            bySrc[p.sourceGroupId] = p;
          }
        }
        var nk = String(p.name || '').trim().toLowerCase();
        if (nk) nameCount[nk] = (nameCount[nk] || 0) + 1;
      });
      var byNameUnique = {};
      mine.forEach(function (p) {
        var nk = String(p.name || '').trim().toLowerCase();
        if (nk && nameCount[nk] === 1) byNameUnique[nk] = p;
      });
      var n = 0;
      (window.D.quickGroups || []).forEach(function (g) {
        if (!g || !g.id) return;
        if (g.shared && g.shared.packId) return;
        var meta = bySrc[g.id]
          || byId[stablePackId(pub.uid, g.id)]
          || byNameUnique[String(g.name || '').trim().toLowerCase()];
        if (!meta || !meta.packId) return;
        var ver = Number(meta.latestVersion || 1);
        writeSharedLink(g, {
          packId: meta.packId,
          originPackId: meta.originPackId || meta.forkedFrom || meta.packId,
          forkedFrom: meta.forkedFrom || '',
          installedVersion: ver,
          publishedVersion: ver,
          mat: g.mat || '',
          chapitreId: g.chapitreId || '',
          color: g.color || '',
          localDirty: false,
          imported: false
        });
        n++;
      });
      if (n && typeof window.save === 'function') window.save();
      return n;
    },

    ensureShareLinks: async function () {
      if (window.QuickShare._relinkPromise) return window.QuickShare._relinkPromise;
      window.QuickShare._relinkPromise = Promise.resolve()
        .then(function () {
          var nDup = 0;
          try { nDup = dedupeAllQuickGroups(); } catch (e) { nDup = 0; }
          if (nDup && typeof window.save === 'function') window.save();
          return window.QuickShare.relinkLocalGroupsFromCatalog();
        })
        .catch(function () { return 0; })
        .finally(function () {
          setTimeout(function () { window.QuickShare._relinkPromise = null; }, 8000);
        });
      return window.QuickShare._relinkPromise;
    },

    /** Créateur initial uniquement (createdBy). Retire le pack du catalogue, pas les cartes locales. */
    deletePack: async function (packId) {
      if (!packId) throw new Error('Pack introuvable.');
      if (typeof window.refuseSecondaryFullMutation === 'function'
          && window.refuseSecondaryFullMutation('Appareil secondaire : suppression indisponible.')) {
        throw new Error('SECONDARY_READ_ONLY');
      }
      var meta = await window.QuickShare.getMeta(packId);
      if (!meta) throw new Error('Pack introuvable.');
      if (!isSamePublisher(meta) && !(isLocalMode() && meta.createdBy && meta.createdBy.uid === 'local')) {
        throw new Error('Seul le créateur initial du pack peut le supprimer du catalogue.');
      }
      if (canUseCloud()) await cloudDeletePack(packId);
      else localDeletePack(packId);
      unlinkLocalGroupsFromPack(packId);
      return true;
    },

    /**
     * Publie le dossier vers le catalogue.
     * - Pack déjà lié (shared.packId) : nouvelle version du même packId
     *   (créateur ou contributeur — createdBy inchangé).
     * - Sinon : crée / réutilise ton pack.
     * - opts.fork : nouveau packId séparé (API rare, pas l’UI par défaut).
     * Suppression catalogue = créateur initial uniquement (deletePack).
     */
    publishGroup: async function (groupId, opts) {
      opts = opts || {};
      if (!window.QuickShare.canPublish()) {
        throw new Error('Connecte-toi avec Google pour publier (ou utilise le mode local de test).');
      }
      if (typeof window.refuseSecondaryFullMutation === 'function'
          && window.refuseSecondaryFullMutation('Appareil secondaire : publication indisponible.')) {
        throw new Error('SECONDARY_READ_ONLY');
      }
      var prep = window.QuickShare.prepareGroupContent(groupId);
      var g = prep.group;
      var cards = prep.cards;
      var pub = publisherInfo();
      var shared = g.shared || {};

      var target = await resolvePublishTarget(g, shared, pub, !!opts.fork);
      var packId = target.packId;
      var existingMeta = target.existingMeta;

      // Numéro de version provisoire : cloud/local l’assignent atomiquement
      var versionDoc = buildVersionPayload(g, cards, 1, pub);
      var forkedFrom = target.forkedFrom
        || (existingMeta && existingMeta.forkedFrom)
        || (opts.fork ? (shared.packId || shared.originPackId || '') : '')
        || '';
      var originPackId = target.originPackId
        || (existingMeta && existingMeta.originPackId)
        || shared.originPackId
        || forkedFrom
        || (opts.fork ? '' : packId)
        || packId;
      var meta = {
        packId: packId,
        name: g.name || 'Dossier',
        visibility: 'public',
        latestVersion: 1,
        cardCount: cards.length,
        updatedAt: versionDoc.publishedAt,
        createdAt: (existingMeta && existingMeta.createdAt) || versionDoc.publishedAt,
        createdBy: (existingMeta && existingMeta.createdBy) || pub,
        lastPublishedBy: pub,
        suggestedMat: g.mat || '',
        suggestedColor: g.color || '',
        sourceGroupId: g.id || (existingMeta && existingMeta.sourceGroupId) || '',
        schema: SCHEMA
      };
      if (forkedFrom) meta.forkedFrom = forkedFrom;
      if (originPackId) meta.originPackId = originPackId;

      var result;
      if (canUseCloud()) result = await cloudPublish(meta, versionDoc);
      else result = localPublish(meta, versionDoc);

      writeSharedLink(g, {
        packId: result.meta.packId,
        originPackId: result.meta.originPackId || originPackId || result.meta.packId,
        forkedFrom: result.meta.forkedFrom || forkedFrom || '',
        installedVersion: result.version,
        publishedVersion: result.version,
        mat: g.mat || '',
        chapitreId: g.chapitreId || '',
        color: g.color || '',
        localDirty: false,
        imported: false
      });
      if (typeof window.save === 'function') window.save();
      return result;
    },

    findLocalGroupByPack: function (packId) {
      return findLocalGroupForPack(packId, null);
    },

    /** Filiation + recouvrement contenu (versionDoc / matière optionnels). */
    findLocalGroupForPack: function (packId, versionDoc, preferMat) {
      return findLocalGroupForPack(packId, versionDoc, preferMat);
    },

    installedLinks: function () {
      return (window.D.quickGroups || []).filter(function (g) {
        return g && g.shared && g.shared.packId;
      });
    },

    /** Index packId → groupe pour catalogue (tous les ids de filiation). */
    installedByPackIndex: function () {
      var index = Object.create(null);
      (window.D.quickGroups || []).forEach(function (g) {
        if (!g || !g.shared) return;
        lineagePackIds(g.shared).forEach(function (id) {
          if (!index[id]) index[id] = g;
        });
      });
      return index;
    },

    dedupeGroupCards: dedupeGroupCards,
    dedupeAllQuickGroups: dedupeAllQuickGroups,

    /** Marque un dossier lié à un pack comme modifié localement (non republie). */
    markLocalDirty: function (groupId) {
      if (!groupId) return false;
      var g = (window.D.quickGroups || []).find(function (x) { return x && x.id === groupId; });
      if (!g || !g.shared || !g.shared.packId) return false;
      if (g.shared.localDirty) return false;
      g.shared.localDirty = true;
      return true;
    },

    clearLocalDirty: function (groupId) {
      var g = (window.D.quickGroups || []).find(function (x) { return x && x.id === groupId; });
      if (!g || !g.shared) return;
      g.shared.localDirty = false;
    },

    /**
     * État partage d’un dossier (sync).
     * @returns {{ linked:boolean, imported:boolean, localDirty:boolean, updateAvailable:boolean,
     *   packId:string, installedVersion:number, latestVersion:number|null }}
     */
    getGroupShareState: async function (groupId) {
      var g = (window.D.quickGroups || []).find(function (x) { return x && x.id === groupId; });
      var empty = {
        linked: false, imported: false, localDirty: false, updateAvailable: false,
        packId: '', installedVersion: 0, latestVersion: null
      };
      if (!g || !g.shared || !g.shared.packId) return empty;
      var installed = Number(g.shared.installedVersion || 0);
      var latest = null;
      try {
        var meta = await window.QuickShare.getMeta(g.shared.packId);
        if (meta && meta.latestVersion != null) latest = Number(meta.latestVersion);
      } catch (e) { /* hors ligne / pas de catalogue */ }
      return {
        linked: true,
        imported: !!g.shared.imported,
        localDirty: !!g.shared.localDirty,
        updateAvailable: latest != null && latest > installed,
        packId: g.shared.packId,
        installedVersion: installed,
        latestVersion: latest
      };
    },

    previewUpdate: function (groupId, versionDoc) {
      var localCards = cardsForGroup(groupId);
      var byContent = Object.create(null);
      var byFp = Object.create(null);
      localCards.forEach(function (c) {
        if (c.contentId) byContent[c.contentId] = c;
        var fp = contentFingerprint(c);
        if (fp && !byFp[fp]) byFp[fp] = c;
      });
      var packIds = Object.create(null);
      var added = [];
      var updated = [];
      var matchedLocal = Object.create(null);
      (versionDoc.cards || []).forEach(function (pc) {
        if (!pc) return;
        var loc = null;
        if (pc.contentId && byContent[pc.contentId]) {
          loc = byContent[pc.contentId];
        } else {
          var fp = contentFingerprint(pc);
          if (fp && byFp[fp]) loc = byFp[fp];
        }
        if (pc.contentId) packIds[pc.contentId] = true;
        if (!loc) {
          /* Anti-doublon : déjà matché via autre clé */
          if (pc.contentId && matchedLocal[pc.contentId]) return;
          var fp2 = contentFingerprint(pc);
          if (fp2 && matchedLocal['fp:' + fp2]) return;
          added.push(pc);
          return;
        }
        /* Une carte locale ne doit matcher qu’une carte pack */
        if (matchedLocal[loc.id]) return;
        matchedLocal[loc.id] = true;
        if (loc.contentId) matchedLocal[loc.contentId] = true;
        var locFp = contentFingerprint(loc);
        if (locFp) matchedLocal['fp:' + locFp] = true;
        var same = (loc.titre || '') === (pc.titre || '')
          && (loc.question || '') === (pc.question || '')
          && (loc.reponse || '') === (pc.reponse || '')
          && (loc.profil || '') === (pc.profil || '')
          && Number(loc.tempsCible || 0) === Number(pc.tempsCible || 0)
          && Number(loc.importance || 0) === Number(pc.importance || 0)
          && (!pc.contentId || loc.contentId === pc.contentId);
        if (!same) updated.push({ local: loc, pack: pc });
      });
      var removed = localCards.filter(function (c) {
        if (matchedLocal[c.id]) return false;
        if (c.contentId && packIds[c.contentId]) return false;
        var fp = contentFingerprint(c);
        if (fp && matchedLocal['fp:' + fp]) return false;
        /* Carte locale sans lien pack = « absente du pack » seulement si elle a un contentId pack connu */
        return !!(c.contentId && !packIds[c.contentId]);
      });
      var localOnly = localCards.filter(function (c) {
        if (matchedLocal[c.id]) return false;
        if (c.contentId && packIds[c.contentId]) return false;
        var fp = contentFingerprint(c);
        if (fp && matchedLocal['fp:' + fp]) return false;
        return !c.contentId || !packIds[c.contentId];
      });
      return { added: added, updated: updated, removed: removed, localOnly: localOnly };
    },

    applyVersionToGroup: function (groupId, versionDoc, opts) {
      opts = opts || {};
      if (typeof window.refuseSecondaryFullMutation === 'function'
          && window.refuseSecondaryFullMutation('Appareil secondaire : import partage indisponible.')) {
        throw new Error('SECONDARY_READ_ONLY');
      }
      var g = (window.D.quickGroups || []).find(function (x) { return x.id === groupId; });
      if (!g) throw new Error('Dossier local introuvable.');
      if (!Array.isArray(window.D.exercices)) window.D.exercices = [];

      /* Guérit d’abord les doublons locaux (évite d’empiler encore) */
      dedupeGroupCards(groupId);

      var preview = window.QuickShare.previewUpdate(groupId, versionDoc);

      // Updates (+ adoption contentId via empreinte)
      preview.updated.forEach(function (u) {
        var loc = u.local;
        var pc = u.pack;
        if (pc.contentId && loc.contentId !== pc.contentId) loc.contentId = pc.contentId;
        loc.titre = pc.titre || '';
        loc.question = pc.question || '';
        loc.reponse = pc.reponse || '';
        loc.profil = pc.profil || loc.profil || 'ANGLAIS';
        if (pc.tempsCible != null) loc.tempsCible = Number(pc.tempsCible);
        if (pc.importance != null) loc.importance = Number(pc.importance);
        // SRS inchangé
      });

      // Adds — ordre pack préservé (unshift en sens inverse)
      var existingRaw = null;
      if (window.AnkiAlgoV2 && window.AnkiAlgoV2.allExistingIds) {
        existingRaw = window.AnkiAlgoV2.allExistingIds(window.D);
      } else if (window.AnkiAlgo && window.AnkiAlgo.allExistingIds) {
        existingRaw = window.AnkiAlgo.allExistingIds(window.D);
      } else {
        existingRaw = (window.D.exercices || []).map(function (c) { return c.id; });
      }
      var used = existingRaw instanceof Set
        ? Array.from(existingRaw)
        : (Array.isArray(existingRaw) ? existingRaw.slice() : Object.keys(existingRaw || {}));

      var newCards = [];
      preview.added.forEach(function (pc) {
        /* Dernière barrière anti-doublon */
        var fpAdd = contentFingerprint(pc);
        var exists = cardsForGroup(groupId).some(function (c) {
          if (pc.contentId && c.contentId === pc.contentId) return true;
          if (!fpAdd) return false;
          return contentFingerprint(c) === fpAdd;
        });
        if (exists) return;
        var gen = window.AnkiAlgoV2 && window.AnkiAlgoV2.genExoUid
          ? window.AnkiAlgoV2.genExoUid
          : (window.AnkiAlgo && window.AnkiAlgo.genExoUid);
        var id = gen ? gen('Y', used) : ('Y-' + Date.now().toString(36).slice(-3).toUpperCase());
        used.push(id);
        var ease = 2.3;
        try {
          if (window.AnkiAlgoV2 && window.AnkiAlgoV2.getQuickDefaultProfile) {
            ease = window.AnkiAlgoV2.getQuickDefaultProfile().ease || 2.3;
          }
        } catch (e) { /* ignore */ }
        var today = window.AnkiAlgoV2 && window.AnkiAlgoV2.todayISO
          ? window.AnkiAlgoV2.todayISO()
          : (window.localDateISO ? window.localDateISO() : nowIso().slice(0, 10));
        newCards.push({
          id: id,
          contentId: pc.contentId,
          titre: pc.titre || '',
          question: pc.question || '',
          reponse: pc.reponse || '',
          mat: g.mat || '',
          profil: pc.profil || 'ANGLAIS',
          tempsCible: pc.tempsCible != null ? Number(pc.tempsCible) : 30,
          importance: pc.importance != null ? Number(pc.importance) : 3,
          statut: 'actif',
          groupId: groupId,
          coursIds: [],
          intervalle: 0,
          ease: ease,
          repetitions: 0,
          dateProchaineRevision: today,
          historique: [],
          epinglee: false,
          dateCreation: nowIso()
        });
      });
      for (var i = newCards.length - 1; i >= 0; i--) {
        window.D.exercices.unshift(newCards[i]);
      }

      // Removals — seulement si l’utilisateur a choisi « Supprimer les cartes »
      if (opts.deleteRemoved === true && preview.removed.length) {
        var delIds = new Set(preview.removed.map(function (c) { return c.id; }));
        window.D.exercices = window.D.exercices.filter(function (c) { return !delIds.has(c.id); });
      }

      var prevPack = g.shared && g.shared.packId;
      var incomingPack = opts.packId || '';
      /* Ne pas voler le pack primaire d’un dossier « propriétaire » au profit d’un fork tiers */
      var keepOwnedPrimary = !!(prevPack && g.shared && !g.shared.imported
        && incomingPack && incomingPack !== prevPack);
      var origin = opts.originPackId
        || (g.shared && g.shared.originPackId)
        || prevPack
        || incomingPack
        || '';
      var forkedFrom = opts.forkedFrom
        || (opts.packMeta && opts.packMeta.forkedFrom)
        || (g.shared && g.shared.forkedFrom)
        || '';
      var linkOpts = {
        packId: keepOwnedPrimary ? prevPack : (incomingPack || prevPack || ''),
        originPackId: origin,
        forkedFrom: forkedFrom,
        mat: g.mat || '',
        chapitreId: g.chapitreId || '',
        color: g.color || '',
        relatedPackId: keepOwnedPrimary ? incomingPack : '',
        relatedPackIds: keepOwnedPrimary ? [incomingPack] : []
      };
      if (keepOwnedPrimary) {
        linkOpts.installedVersion = Number(g.shared.installedVersion || 0);
        linkOpts.imported = false;
        linkOpts.localDirty = true;
      } else {
        linkOpts.installedVersion = versionDoc.version;
        linkOpts.imported = opts.imported != null ? opts.imported : !!(g.shared && g.shared.imported);
        linkOpts.localDirty = false;
      }
      writeSharedLink(g, linkOpts);
      var keptLocal = false;
      if (opts.deleteRemoved !== true && preview.removed.length > 0) keptLocal = true;
      if (!keptLocal) {
        keptLocal = cardsForGroup(groupId).some(function (c) { return c && !c.contentId; });
      }
      if (!keptLocal && preview.localOnly && preview.localOnly.length) keptLocal = true;
      if (keepOwnedPrimary) keptLocal = true;
      g.shared.localDirty = !!keptLocal;
      /* Ne renomme pas un dossier propriétaire avec le nom d’un pack tiers */
      if (versionDoc.name && !keepOwnedPrimary) g.name = versionDoc.name;

      dedupeGroupCards(groupId);

      if (typeof window.save === 'function') window.save();
      return preview;
    },

    createGroupFromVersion: function (packMeta, versionDoc, prefs) {
      if (typeof window.refuseSecondaryFullMutation === 'function'
          && window.refuseSecondaryFullMutation('Appareil secondaire : import partage indisponible.')) {
        throw new Error('SECONDARY_READ_ONLY');
      }
      prefs = prefs || {};
      if (!Array.isArray(window.D.quickGroups)) window.D.quickGroups = [];
      if (!Array.isArray(window.D.exercices)) window.D.exercices = [];

      /* Garde-fou absolu : jamais un 2e dossier pour le même pack / même contenu */
      var preferMat = (prefs && prefs.mat) || (packMeta && packMeta.suggestedMat) || '';
      var existing = findLocalGroupForPack(packMeta && packMeta.packId, versionDoc, preferMat);
      if (existing) {
        var existingOwned = !!(existing.shared && existing.shared.packId && !existing.shared.imported);
        window.QuickShare.applyVersionToGroup(existing.id, versionDoc, {
          packId: packMeta.packId,
          originPackId: packMeta.originPackId || packMeta.forkedFrom || packMeta.packId,
          forkedFrom: packMeta.forkedFrom || '',
          packMeta: packMeta,
          deleteRemoved: false,
          /* Ne pas marquer imported un dossier dont on est déjà le publisher local */
          imported: existingOwned ? false : true
        });
        /* Ne pas écraser le nom/matière d’un dossier propriétaire fusionné */
        if (!existingOwned) {
          if (prefs.name) existing.name = prefs.name;
          if (prefs.mat) existing.mat = prefs.mat;
          if (prefs.color) existing.color = prefs.color;
          if (prefs.chapitreId != null) existing.chapitreId = prefs.chapitreId;
        }
        return existing;
      }

      var usedG = new Set((window.D.quickGroups || []).map(function (x) { return x.id; }));
      var gid = genCode('QG-', 3, usedG);
      var mat = (prefs.mat || '').trim();
      if (!mat) {
        throw new Error('Une matière est obligatoire pour créer un dossier Rapide.');
      }
      var color = prefs.color || packMeta.suggestedColor || '#5b8df7';
      var g = {
        id: gid,
        name: prefs.name || versionDoc.name || packMeta.name || 'Pack importé',
        color: color,
        order: window.D.quickGroups.length,
        mat: mat,
        chapitreId: prefs.chapitreId || ''
      };
      writeSharedLink(g, {
        packId: packMeta.packId,
        originPackId: packMeta.originPackId || packMeta.forkedFrom || packMeta.packId,
        forkedFrom: packMeta.forkedFrom || '',
        installedVersion: 0,
        mat: mat,
        chapitreId: prefs.chapitreId || '',
        color: color,
        imported: true,
        localDirty: false
      });
      window.D.quickGroups.push(g);

      window.QuickShare.applyVersionToGroup(gid, versionDoc, {
        packId: packMeta.packId,
        originPackId: packMeta.originPackId || packMeta.forkedFrom || packMeta.packId,
        forkedFrom: packMeta.forkedFrom || '',
        packMeta: packMeta,
        deleteRemoved: false,
        imported: true
      });
      return g;
    }
  };

  // ─── UI onglet Partage ──────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, { type: type || 'ok' });
    else if (typeof window.sysAlert === 'function') window.sysAlert(msg, 'Partage');
  }

  function formatWhen(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 16);
      return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return String(iso).slice(0, 16);
    }
  }

  window.renderPartage = async function () {
    var pane = $('panePartage');
    if (!pane) return;
    if (S.busy) {
      S.pendingRender = true;
      return;
    }
    try {
      if (window.QuickShare && typeof window.QuickShare.ensureShareLinks === 'function') {
        await window.QuickShare.ensureShareLinks();
      }
      S.busy = true;
      do {
        S.pendingRender = false;
        if (S.view === 'detail' && S.packId) {
          await renderPartageDetail(pane);
        } else if (S.view === 'mine') {
          await renderPartageMine(pane);
        } else {
          await renderPartageCatalog(pane);
        }
      } while (S.pendingRender);
    } catch (err) {
      pane.innerHTML = '<div class="anki-card-block"><p style="color:var(--red);">' +
        esc(err && err.message || err) + '</p></div>';
    } finally {
      S.busy = false;
      if (window.hydrateIcons) window.hydrateIcons(pane);
      if (S.pendingRender) {
        S.pendingRender = false;
        window.renderPartage();
      }
    }
  };

  function partageTabsHtml() {
    return (
      '<div class="partage-tabs">' +
        '<button type="button" class="cbt' + (S.view === 'catalog' || S.view === 'detail' ? ' on' : '') +
          '" onclick="window.partageSetView(\'catalog\')">' +
          (window.iconLabel ? window.iconLabel('library', 'Catalogue') : 'Catalogue') + '</button>' +
        '<button type="button" class="cbt' + (S.view === 'mine' ? ' on' : '') +
          '" onclick="window.partageSetView(\'mine\')">' +
          (window.iconLabel ? window.iconLabel('folder', 'Mes imports') : 'Mes imports') + '</button>' +
      '</div>'
    );
  }

  function matiereDisplay(id) {
    if (!id) return { id: '', label: 'Sans matière', name: 'Packs sans suggestedMat', color: '#6a6a88' };
    var local = (window.D && window.D.matieres || []).find(function (m) { return m && m.id === id; });
    if (local) return local;
    var canon = (window.CANONICAL_MATIERES || []).find(function (m) { return m.id === id; });
    if (canon) return canon;
    return { id: id, label: id, name: id, color: '#6a6a88' };
  }

  function packRowHtml(p, installed) {
    var local = installed[p.packId];
    var latest = Number(p.latestVersion || 1);
    var primary = local && local.shared && local.shared.packId === p.packId;
    var update = primary && latest > Number(local.shared.installedVersion || 0);
    var actionBtn;
    if (!local) {
      actionBtn = '<button type="button" class="bp partage-row-action" onclick="event.stopPropagation();window.partageImportFromCatalog(\'' +
        jsStr(p.packId) + '\')">' +
        (window.iconLabel ? window.iconLabel('download', 'Importer') : 'Importer') + '</button>';
    } else if (update) {
      actionBtn = '<button type="button" class="bp partage-row-action partage-btn-update" onclick="event.stopPropagation();window.partageImportFromCatalog(\'' +
        jsStr(p.packId) + '\')">' +
        (window.iconLabel ? window.iconLabel('refresh-cw', 'Update') : 'Update') + '</button>';
    } else if (primary) {
      actionBtn = '<span class="partage-badge">Installé</span>';
    } else {
      actionBtn = '<button type="button" class="bs partage-row-action" title="Déjà présent via un pack lié — ouvrir pour fusionner / maj" onclick="event.stopPropagation();window.partageImportFromCatalog(\'' +
        jsStr(p.packId) + '\')">' +
        (window.iconLabel ? window.iconLabel('link', 'Déjà présent') : 'Déjà présent') + '</button>';
    }
    return (
      '<div class="partage-row partage-row-static">' +
        '<button type="button" class="partage-row-main partage-row-main-btn" onclick="window.partageOpenPack(\'' + jsStr(p.packId) + '\')" title="Voir le détail">' +
          '<strong>' + esc(p.name || p.packId) + '</strong>' +
          '<span class="anki-mut">' + esc(p.packId) +
            ' · ' + esc(String(p.cardCount || 0)) + ' cartes' +
            (p.suggestedMat ? ' · ' + esc(matiereDisplay(p.suggestedMat).label) : '') +
            (p.lastPublishedBy && p.lastPublishedBy.name ? ' · ' + esc(p.lastPublishedBy.name) : '') +
            (p.updatedAt ? ' · ' + esc(formatWhen(p.updatedAt)) : '') +
          '</span>' +
        '</button>' +
        '<div class="partage-row-side">' +
          '<span class="partage-row-ver anki-mut">v' + esc(String(latest)) + '</span>' +
          actionBtn +
        '</div>' +
      '</div>'
    );
  }

  async function renderPartageCatalog(pane) {
    var list = await window.QuickShare.listPacks();
    S.catalog = list;
    var q = (S.q || '').trim().toLowerCase();
    if (q) {
      list = list.filter(function (p) {
        var matLab = matiereDisplay(p.suggestedMat);
        return ((p.name || '') + ' ' + (p.packId || '') + ' ' + (p.suggestedMat || '') + ' ' +
          (matLab.label || '') + ' ' + (matLab.name || '') + ' ' +
          ((p.lastPublishedBy && p.lastPublishedBy.name) || ''))
          .toLowerCase().indexOf(q) >= 0;
      });
    }
    if (S.matFilter) {
      list = list.filter(function (p) {
        return (p.suggestedMat || '') === S.matFilter;
      });
    }
    var links = window.QuickShare.installedLinks();
    var installed = window.QuickShare.installedByPackIndex
      ? window.QuickShare.installedByPackIndex()
      : (function () {
          var o = {};
          links.forEach(function (g) { if (g.shared) o[g.shared.packId] = g; });
          return o;
        })();

    var order = {};
    (window.CANONICAL_MATIERES || []).forEach(function (c, i) { order[c.id] = i; });
    var byMat = {};
    list.forEach(function (p) {
      var key = p.suggestedMat || '';
      if (!byMat[key]) byMat[key] = [];
      byMat[key].push(p);
    });
    var matKeys = Object.keys(byMat).sort(function (a, b) {
      if (!a) return 1;
      if (!b) return -1;
      var oa = order[a];
      var ob = order[b];
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return a.localeCompare(b, 'fr');
    });

    var rows = list.length ? matKeys.map(function (matId) {
      var packs = byMat[matId];
      var m = matiereDisplay(matId);
      return (
        '<section class="partage-mat-block">' +
          '<div class="anki-lib-group-hdr" style="border-left:4px solid ' + esc(m.color || '#6a6a88') + ';margin-bottom:8px;">' +
            '<span class="anki-lib-grp-mat" style="background:' + esc(m.color || '#6a6a88') + '20;color:' + esc(m.color || '#6a6a88') + ';">' +
              esc(m.label || '?') + '</span>' +
            '<span class="anki-lib-grp-t">' + esc(m.name || matId || 'Sans matière') + '</span>' +
            '<span class="anki-mut" style="margin-left:auto;">' + packs.length + ' pack' + (packs.length > 1 ? 's' : '') + '</span>' +
          '</div>' +
          packs.map(function (p) { return packRowHtml(p, installed); }).join('') +
        '</section>'
      );
    }).join('') : '<div class="anki-empty">Aucun pack public pour l’instant. Partage un dossier depuis Rapide → Paramètres.</div>';

    var chipMats = (window.CANONICAL_MATIERES || []).slice();
    var matChips = '<button type="button" class="anki-lib-chip' + (!S.matFilter ? ' on' : '') +
      '" onclick="window.partageFilterMat(\'\')">Toutes</button>' +
      chipMats.map(function (m) {
        return '<button type="button" class="anki-lib-chip' + (S.matFilter === m.id ? ' on' : '') +
          '" onclick="window.partageFilterMat(\'' + jsStr(m.id) + '\')">' + esc(m.label) + '</button>';
      }).join('');

    var cloudHint = canUseCloud()
      ? '<p class="anki-mut" style="font-size:12px;">Catalogue public (comptes Google). Update manuel — tes répétitions restent locales.</p>'
      : (isLocalMode()
        ? '<p class="anki-mut" style="font-size:12px;">Mode local : catalogue simulé sur cet appareil (localStorage).</p>'
        : '<p class="anki-mut" style="font-size:12px;color:var(--gold);">Connecte-toi avec Google pour le catalogue cloud.</p>');

    pane.innerHTML =
      '<div class="anki-card-block partage-page">' +
        '<div class="anki-block-hdr"><div><h3>' +
          (window.iconLabel ? window.iconLabel('share-2', 'Partage') : 'Partage') +
        '</h3>' + cloudHint + '</div></div>' +
        partageTabsHtml() +
        '<div class="anki-filters" style="margin-top:10px;">' +
          '<input type="search" class="fi" placeholder="Rechercher un pack…" value="' + esc(S.q) +
            '" oninput="window.partageFilter(this.value)">' +
          '<button type="button" class="bs" onclick="window.renderPartage()">' +
            (window.iconLabel ? window.iconLabel('refresh-cw', 'Actualiser') : 'Actualiser') + '</button>' +
        '</div>' +
        '<div class="anki-lib-chips partage-mat-chips" style="margin-top:8px;">' + matChips + '</div>' +
        '<div class="partage-list">' + rows + '</div>' +
      '</div>';
  }

  async function renderPartageMine(pane) {
    var links = window.QuickShare.installedLinks();
    var metas = {};
    try {
      var all = await window.QuickShare.listPacks();
      all.forEach(function (p) { metas[p.packId] = p; });
    } catch (e) { /* ignore */ }

    var rows = links.length ? links.map(function (g) {
      var meta = metas[g.shared.packId];
      var latest = meta ? Number(meta.latestVersion || 0) : 0;
      var installed = Number(g.shared.installedVersion || 0);
      var upd = latest > installed;
      return (
        '<div class="partage-row partage-row-static">' +
          '<div class="partage-row-main">' +
            '<strong>' + esc(g.name) + '</strong>' +
            '<span class="anki-mut">' + esc(g.shared.packId) + ' · installé v' + esc(String(installed)) +
              (latest ? ' · cloud v' + esc(String(latest)) : '') + '</span>' +
          '</div>' +
          (upd
            ? '<button type="button" class="bp partage-btn-update" onclick="window.partageOpenPack(\'' + jsStr(g.shared.packId) + '\')">' +
                (window.iconLabel ? window.iconLabel('refresh-cw', 'Update') : 'Update') + '</button>'
            : '<button type="button" class="bs" onclick="window.partageOpenPack(\'' + jsStr(g.shared.packId) + '\')">Voir</button>') +
        '</div>'
      );
    }).join('') : '<div class="anki-empty">Aucun dossier lié à un pack. Importe depuis le catalogue.</div>';

    pane.innerHTML =
      '<div class="anki-card-block partage-page">' +
        '<div class="anki-block-hdr"><div><h3>Mes imports</h3>' +
          '<p class="anki-mut" style="font-size:12px;">Dossiers Rapide liés à un pack partagé.</p></div></div>' +
        partageTabsHtml() +
        '<div class="partage-list" style="margin-top:10px;">' + rows + '</div>' +
      '</div>';
  }

  function cardsPreviewHtml(versionDoc) {
    var cards = (versionDoc && versionDoc.cards) || [];
    if (!cards.length) {
      return '<p class="anki-mut" style="margin:0;">Aucune carte dans cette version.</p>';
    }
    return (
      '<div class="partage-cards-preview-hdr">' +
        '<strong>Aperçu des cartes</strong>' +
        '<span class="anki-mut">' + cards.length + ' carte' + (cards.length > 1 ? 's' : '') +
          (versionDoc.version != null ? ' · v' + esc(String(versionDoc.version)) : '') +
        '</span>' +
      '</div>' +
      '<div class="partage-cards-preview-list">' +
        cards.map(function (c, i) {
          var q = (c && (c.question || c.titre)) || '—';
          var r = (c && c.reponse) || '';
          return (
            '<article class="partage-card-prev">' +
              '<div class="partage-card-prev-q">' +
                '<span class="partage-card-prev-n">' + (i + 1) + '.</span> ' + esc(q) +
              '</div>' +
              (r
                ? '<div class="partage-card-prev-r">' + esc(r) + '</div>'
                : '<div class="partage-card-prev-r anki-mut"><em>Pas de réponse</em></div>') +
            '</article>'
          );
        }).join('') +
      '</div>'
    );
  }

  async function renderPartageDetail(pane) {
    var meta = await window.QuickShare.getMeta(S.packId);
    if (!meta) {
      pane.innerHTML = '<div class="anki-card-block"><p>Pack introuvable.</p>' +
        '<button class="bs" onclick="window.partageSetView(\'catalog\')">Retour</button></div>';
      return;
    }
    var versions = await window.QuickShare.listVersions(S.packId);
    S.detail = meta;
    S.versions = versions;
    var verLatest = versions.length ? versions[0] : null;
    var local = window.QuickShare.findLocalGroupForPack
      ? window.QuickShare.findLocalGroupForPack(S.packId, verLatest)
      : window.QuickShare.findLocalGroupByPack(S.packId);
    var latest = Number(meta.latestVersion || 1);
    var samePrimary = !!(local && local.shared && local.shared.packId === S.packId);
    var installed = local && samePrimary ? Number(local.shared.installedVersion || 0) : 0;
    var needsUpdate = samePrimary && latest > installed;
    var selectedVer = versions.length ? Number(versions[0].version) : latest;

    var verOpts = versions.map(function (v) {
      return '<option value="' + esc(String(v.version)) + '"' +
        (Number(v.version) === selectedVer ? ' selected' : '') + '>v' + esc(String(v.version)) +
        (v.publishedAt ? ' — ' + esc(formatWhen(v.publishedAt)) : '') +
        (v.publishedBy && v.publishedBy.name ? ' · ' + esc(v.publishedBy.name) : '') +
        '</option>';
    }).join('');

    var verList = versions.length ? (
      '<div class="partage-ver-list" role="list">' +
        versions.map(function (v) {
          var on = Number(v.version) === selectedVer;
          return (
            '<button type="button" role="listitem" class="partage-ver-item' + (on ? ' is-on' : '') + '"' +
              ' onclick="window.partageSelectVersion(\'' + jsStr(String(v.version)) + '\')">' +
              '<span class="partage-ver-item-main">' +
                '<strong>v' + esc(String(v.version)) + '</strong>' +
                (Number(v.version) === latest ? ' <span class="partage-badge partage-badge-sm">dernière</span>' : '') +
                (Number(v.version) === installed ? ' <span class="partage-badge partage-badge-sm">installée</span>' : '') +
              '</span>' +
              '<span class="anki-mut partage-ver-item-meta">' +
                esc(String((v.cards && v.cards.length) || meta.cardCount || 0)) + ' cartes' +
                (v.publishedAt ? ' · ' + esc(formatWhen(v.publishedAt)) : '') +
                (v.publishedBy && v.publishedBy.name ? ' · ' + esc(v.publishedBy.name) : '') +
              '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    ) : '<p class="anki-mut">Aucune version.</p>';

    var actionBtn = '';
    if (!local) {
      actionBtn = '<button type="button" class="bp" onclick="window.partageStartImport()">' +
        (window.iconLabel ? window.iconLabel('download', 'Importer') : 'Importer') + '</button>';
    } else if (needsUpdate) {
      actionBtn = '<button type="button" class="bp partage-btn-update" onclick="window.partageDoUpdate()">' +
        (window.iconLabel ? window.iconLabel('refresh-cw', 'Update vers dernière') : 'Update') + '</button>';
    } else if (samePrimary) {
      actionBtn = '<span class="anki-mut">À jour (v' + esc(String(installed)) + ')</span>';
    } else {
      actionBtn = '<button type="button" class="bs" onclick="window.partageDoUpdate()">' +
        (window.iconLabel ? window.iconLabel('git-merge', 'Fusionner dans « ' + (local.name || 'dossier') + ' »') : 'Fusionner') +
        '</button>';
    }

    var ownerBtn = '';
    if (window.QuickShare.isPackOwner(meta)) {
      ownerBtn = '<button type="button" class="bs partage-btn-danger" onclick="window.partageDeletePack(\'' +
        jsStr(meta.packId) + '\')">' +
        (window.iconLabel ? window.iconLabel('trash-2', 'Supprimer du catalogue') : 'Supprimer du catalogue') +
        '</button>';
    }

    pane.innerHTML =
      '<div class="anki-card-block partage-page">' +
        '<button type="button" class="bs" style="margin-bottom:10px;" onclick="window.partageSetView(\'catalog\')">' +
          (window.iconLabel ? window.iconLabel('chevron-up', 'Catalogue') : '← Catalogue') + '</button>' +
        '<h3>' + esc(meta.name || meta.packId) +
          (needsUpdate ? ' <span class="partage-badge partage-badge-upd">Update</span>' : '') + '</h3>' +
        '<p class="anki-mut" style="font-size:12px;">' + esc(meta.packId) + ' · ' +
          esc(String(meta.cardCount || 0)) + ' cartes · dernière v' + esc(String(latest)) +
          (meta.lastPublishedBy && meta.lastPublishedBy.name ? ' · ' + esc(meta.lastPublishedBy.name) : '') +
          '</p>' +
        (local ? '<p class="anki-mut" style="font-size:12px;">' +
          (samePrimary
            ? ('Lié au dossier local <b>' + esc(local.name) + '</b> (v' + esc(String(installed)) + ')')
            : ('Déjà présent dans <b>' + esc(local.name) + '</b> (pack lié : ' +
              esc((local.shared && local.shared.packId) || '—') + ') — pas de second dossier')) +
          '</p>' : '') +
        '<div class="partage-detail-actions">' +
          actionBtn +
          '<label class="anki-mut" style="font-size:12px;">Version</label>' +
          '<select id="partageVerSel" class="fi" onchange="window.partageSelectVersion(this.value)">' + verOpts + '</select>' +
          '<button type="button" class="bs" onclick="window.partageInstallSelectedVersion()">' +
            (local ? 'Installer cette version' : 'Importer cette version') + '</button>' +
          ownerBtn +
        '</div>' +
        '<h4 class="partage-section-title">Versions (plus récente en haut)</h4>' +
        verList +
        '<div id="partagePreview" class="partage-cards-preview" style="margin-top:14px;"></div>' +
      '</div>';

    await window.partageSelectVersion(String(selectedVer));
  }

  window.partageSelectVersion = async function (verStr) {
    var v = parseInt(verStr, 10);
    if (!S.packId || isNaN(v)) return;
    var sel = $('partageVerSel');
    if (sel && String(sel.value) !== String(v)) sel.value = String(v);
    document.querySelectorAll('.partage-ver-item').forEach(function (btn) {
      var strong = btn.querySelector('strong');
      btn.classList.toggle('is-on', !!(strong && strong.textContent === 'v' + v));
    });
    var box = $('partagePreview');
    if (box) box.innerHTML = '<p class="anki-mut">Chargement des cartes…</p>';
    try {
      var ver = (S.versions || []).find(function (x) { return Number(x.version) === v; });
      if (!ver || !Array.isArray(ver.cards)) {
        ver = await window.QuickShare.getVersion(S.packId, v);
      }
      if (box) box.innerHTML = cardsPreviewHtml(ver);
    } catch (e) {
      if (box) box.innerHTML = '<p class="anki-mut" style="color:var(--red);">' + esc(String(e && e.message || e)) + '</p>';
    }
  };

  window.partageSetView = function (v) {
    S.view = v === 'mine' ? 'mine' : 'catalog';
    S.packId = '';
    window.renderPartage();
  };

  window.partageFilter = function (q) {
    S.q = q || '';
    clearTimeout(S._filtT);
    S._filtT = setTimeout(function () { window.renderPartage(); }, 200);
  };

  window.partageFilterMat = function (matId) {
    S.matFilter = matId || '';
    window.renderPartage();
  };

  window.partageOpenPack = function (packId) {
    S.view = 'detail';
    S.packId = packId;
    if (typeof window.switchTab === 'function' && window._activeTab !== 'partage') {
      window.switchTab('partage');
    } else {
      window.renderPartage();
    }
  };

  window.partageDeletePack = function (packId) {
    if (!packId || S.busy) return;
    var msg = 'Supprimer <b>' + esc(packId) + '</b> du catalogue ?<br><br>' +
      'Les versions cloud seront retirées. <b>Tes cartes Rapide locales ne sont pas effacées</b> — ' +
      'seul le lien catalogue est retiré.';
    var go = async function () {
      S.busy = true;
      try {
        await window.QuickShare.deletePack(packId);
        toast('Pack retiré du catalogue.', 'ok');
        S.view = 'catalog';
        S.packId = '';
        S.detail = null;
        S.versions = null;
        S.catalog = null;
        if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
        window.renderPartage();
      } catch (e) {
        if (String(e && e.message) === 'SECONDARY_READ_ONLY') return;
        toast(String(e && e.message || e), 'error');
      } finally {
        S.busy = false;
      }
    };
    if (typeof window.sysConfirm === 'function') {
      window.sysConfirm(msg, go, 'Supprimer du catalogue');
    } else {
      go();
    }
  };

  /** Import / update direct depuis le catalogue (dernière version). */
  window.partageImportFromCatalog = async function (packId) {
    if (!packId) return;
    try {
      var meta = (S.catalog || []).find(function (p) { return p && p.packId === packId; })
        || await window.QuickShare.getMeta(packId);
      if (!meta) return toast('Pack introuvable.', 'error');
      S.detail = meta;
      var ver = await window.QuickShare.getVersion(packId, meta.latestVersion);
      if (!ver) return toast('Version introuvable.', 'error');
      var local = window.QuickShare.findLocalGroupForPack
        ? window.QuickShare.findLocalGroupForPack(packId, ver)
        : window.QuickShare.findLocalGroupByPack(packId);
      if (local) {
        await confirmAndApply(local.id, meta, ver);
        return;
      }
      openImportWizard(meta, ver);
    } catch (e) {
      if (String(e && e.message) === 'SECONDARY_READ_ONLY') return;
      toast(String(e && e.message || e), 'error');
    }
  };

  window.partageStartImport = function () {
    var meta = S.detail;
    if (!meta) return;
    openImportWizard(meta, null);
  };

  window.partageDoUpdate = async function () {
    var meta = S.detail;
    if (!meta) return;
    var ver = await window.QuickShare.getVersion(meta.packId, meta.latestVersion);
    if (!ver) return toast('Version introuvable.', 'error');
    var local = window.QuickShare.findLocalGroupForPack
      ? window.QuickShare.findLocalGroupForPack(meta.packId, ver)
      : window.QuickShare.findLocalGroupByPack(meta.packId);
    if (!local) return;
    await confirmAndApply(local.id, meta, ver);
  };

  window.partageInstallSelectedVersion = async function () {
    var meta = S.detail;
    if (!meta) return;
    var sel = $('partageVerSel');
    var v = sel ? parseInt(sel.value, 10) : meta.latestVersion;
    var ver = await window.QuickShare.getVersion(meta.packId, v);
    if (!ver) return toast('Version introuvable.', 'error');
    var local = window.QuickShare.findLocalGroupForPack
      ? window.QuickShare.findLocalGroupForPack(meta.packId, ver)
      : window.QuickShare.findLocalGroupByPack(meta.packId);
    if (!local) {
      openImportWizard(meta, ver);
      return;
    }
    await confirmAndApply(local.id, meta, ver);
  };

  async function confirmAndApply(groupId, meta, ver) {
    var g = (window.D.quickGroups || []).find(function (x) { return x && x.id === groupId; });
    var installed = g && g.shared ? Number(g.shared.installedVersion || 0) : 0;
    var target = Number(ver.version);
    var samePrimary = !!(g && g.shared && g.shared.packId === meta.packId);
    if (samePrimary && target === installed) {
      toast('Cette version est déjà installée (v' + target + ').', 'ok');
      return;
    }

    var preview = window.QuickShare.previewUpdate(groupId, ver);
    var localOnlyN = (preview.localOnly && preview.localOnly.length) || 0;
    var localOrphans = cardsForGroup(groupId).filter(function (c) { return c && !c.contentId; }).length;
    var nAbsent = preview.removed.length;
    var hasLocalKeep = nAbsent > 0 || localOnlyN > 0 || localOrphans > 0;
    var isDowngrade = samePrimary && target < installed;
    var owns = window.QuickShare.isPackOwner(meta);
    var relatedNote = !samePrimary
      ? '<br><span class="anki-mut">Fusion dans le dossier déjà lié « ' +
        esc((g && g.name) || '') + ' » — aucun second dossier ne sera créé.</span>'
      : '';

    var statsLine = '+' + preview.added.length + ' ajoutée(s) · ~' + preview.updated.length + ' modifiée(s)' +
      (nAbsent ? ' · ' + nAbsent + ' carte(s) présentes chez toi absentes du pack' : '') +
      (localOnlyN && !nAbsent ? ' · ' + localOnlyN + ' carte(s) locales conservées' : '') +
      (localOrphans ? ' · ' + localOrphans + ' carte(s) locales sans lien pack' : '');

    function finishUi(msg) {
      toast(msg || ('Pack mis à jour (v' + ver.version + ').'), 'ok');
      if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
      window.renderPartage();
    }

    async function doApply(mode) {
      try {
        window.QuickShare.applyVersionToGroup(groupId, ver, {
          packId: meta.packId,
          originPackId: meta.originPackId || meta.forkedFrom || (g && g.shared && g.shared.originPackId) || meta.packId,
          forkedFrom: meta.forkedFrom || '',
          packMeta: meta,
          deleteRemoved: mode === 'delete',
          imported: owns ? false : true
        });
        if (mode === 'merge_publish') {
          var result = await window.QuickShare.publishGroup(groupId, {});
          finishUi('Mis à jour + publié (pack et cartes locales) : ' +
            result.meta.packId + ' · v' + result.version);
        } else if (mode === 'delete') {
          finishUi('Pack mis à jour (v' + ver.version + ') — cartes absentes du pack supprimées chez toi.');
        } else {
          finishUi('Pack mis à jour (v' + ver.version + ') — cartes locales conservées.');
        }
      } catch (e) {
        if (String(e && e.message) === 'SECONDARY_READ_ONLY') return;
        toast(String(e && e.message || e), 'error');
      }
    }

    function askDeleteConfirm() {
      var warn = 'Supprimer <b>' + esc(String(nAbsent)) + ' carte(s)</b> de ton dossier local ?<br><br>' +
        'Elles ne sont pas dans cette version du pack. ' +
        '<b>Confirmation :</b> cette suppression est définitive sur ton appareil (SRS inclus).';
      if (typeof window.sysConfirm === 'function') {
        window.sysConfirm(warn, function () { doApply('delete'); }, 'Confirmer la suppression');
      } else {
        doApply('delete');
      }
    }

    function askUpdateChoices() {
      var msg = (isDowngrade
        ? 'Installer la version <b>plus ancienne</b> v' + esc(String(target)) +
          ' (actuellement v' + esc(String(installed)) + ') ?'
        : 'Mettre à jour le contenu vers <b>v' + esc(String(ver.version)) + '</b> ?') +
        relatedNote +
        '<br><br>' + statsLine +
        '<br><span class="anki-mut">Tes répétitions (SRS) des cartes conservées ne sont pas modifiées. Tes cartes créées en local restent si tu choisis de les garder.</span>';

      if (hasLocalKeep && nAbsent > 0) {
        msg += '<br><br>Que faire des cartes locales absentes de cette version ?';
        if (typeof window.sysConfirmChoices === 'function') {
          window.sysConfirmChoices(msg, [
            { id: 'delete', label: 'Supprimer les cartes', danger: true },
            { id: 'keep', label: 'Garder les cartes en local', primary: true },
            { id: 'merge_publish', label: 'Publier nouveau + locales', gold: true }
          ], isDowngrade ? 'Downgrade pack' : 'Update pack', function (choice) {
            if (choice === 'delete') askDeleteConfirm();
            else if (choice === 'merge_publish') doApply('merge_publish');
            else doApply('keep');
          });
          return;
        }
      }

      if (typeof window.sysConfirm === 'function') {
        window.sysConfirm(msg, function () { doApply('keep'); }, isDowngrade ? 'Downgrade pack' : 'Update pack');
      } else {
        doApply('keep');
      }
    }

    if (isDowngrade) {
      var warn = 'Tu vas installer une version <b>plus ancienne</b> (v' + esc(String(target)) +
        ' &lt; v' + esc(String(installed)) + '). Le contenu local sera aligné sur cette version.';
      if (typeof window.sysConfirm === 'function') {
        window.sysConfirm(warn, askUpdateChoices, 'Version plus ancienne');
      } else {
        askUpdateChoices();
      }
      return;
    }
    askUpdateChoices();
  }

  function openImportWizard(meta, versionDoc) {
    var suggested = meta.suggestedMat || '';
    var mats = typeof window.listSelectableMatieres === 'function'
      ? window.listSelectableMatieres({ includeId: suggested })
      : (window.D.matieres || []);
    var matOpts = '<option value="">— Choisir une matière —</option>' + mats.map(function (m) {
      var sel = suggested && m.id === suggested ? ' selected' : '';
      return '<option value="' + esc(m.id) + '"' + sel + '>' + esc(m.label) + ' — ' + esc(m.name) + '</option>';
    }).join('');
    if (!mats.length) {
      matOpts = '<option value="">— Aucune matière active —</option>';
    }
    var colors = ['#5b8df7', '#f0c060', '#50d890', '#e07ab3', '#f06060', '#06b6d4', '#a855f7', '#f97316'];
    var defColor = meta.suggestedColor || colors[0];
    if (colors.indexOf(defColor) < 0) colors = [defColor].concat(colors);
    var colorDots = colors.map(function (c) {
      return '<button type="button" class="qk-color-dot' + (c === defColor ? ' is-on' : '') +
        '" data-color="' + esc(c) + '" style="background:' + esc(c) + ';--dot:' + esc(c) +
        '" aria-label="Couleur" aria-pressed="' + (c === defColor ? 'true' : 'false') +
        '" onclick="window.partagePickImportColor(\'' + jsStr(c) + '\')"></button>';
    }).join('');

    var ov = $('ovPartageImport');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovPartageImport';
      ov.className = 'ov ov-scroll';
      document.body.appendChild(ov);
    }
    window._partageImport = { meta: meta, versionDoc: versionDoc, color: defColor };
    ov.classList.remove('hidden');
    ov.innerHTML =
      '<div class="modal">' +
        '<h2>' + (window.iconLabel ? window.iconLabel('download', 'Importer le pack') : 'Importer le pack') + '</h2>' +
        '<p class="anki-mut" style="font-size:12px;">Personnalise matière / chapitre / couleur sur <b>ton</b> compte. Le contenu vient du pack.</p>' +
        '<div class="fg"><label>Nom local</label>' +
          '<input type="text" id="partageImpName" class="fi" value="' + esc(meta.name || '') + '"></div>' +
        '<div class="fg"><label>Matière *</label>' +
          '<select id="partageImpMat" class="fi" required onchange="window.partageImportMatChanged(this.value)">' + matOpts + '</select></div>' +
        '<div class="fg"><label>Chapitre</label><div id="partageImpChapWrap"></div></div>' +
        '<div class="fg"><label>Couleur</label><div class="qk-color-dots">' + colorDots + '</div></div>' +
        '<div class="macts">' +
          '<button type="button" class="bs" onclick="window.partageCloseImport()">Annuler</button>' +
          '<button type="button" class="bp" onclick="window.partageConfirmImport()">Importer</button>' +
        '</div>' +
      '</div>';
    window.partageImportMatChanged(($('partageImpMat') && $('partageImpMat').value) || '');
    if (window.hydrateIcons) window.hydrateIcons(ov);
  }

  window.partagePickImportColor = function (c) {
    if (!window._partageImport) return;
    window._partageImport.color = c;
    var ov = $('ovPartageImport');
    if (!ov) return;
    ov.querySelectorAll('.qk-color-dot').forEach(function (btn) {
      var on = btn.getAttribute('data-color') === c;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };

  window.partageImportMatChanged = function (matId) {
    var wrap = $('partageImpChapWrap');
    if (!wrap) return;
    var chaps = (window.D.chapitres || []).filter(function (ch) { return ch && ch.mat === matId; });
    var opts = '<option value="">— Aucun —</option>' + chaps.map(function (ch) {
      var lab = typeof window.formatChapitreLabel === 'function'
        ? window.formatChapitreLabel(ch, false) : (ch.title || ch.id);
      return '<option value="' + esc(ch.id) + '">' + esc(lab) + '</option>';
    }).join('');
    wrap.innerHTML = '<select id="partageImpChap" class="fi">' + opts + '</select>';
  };

  window.partageCloseImport = function () {
    var ov = $('ovPartageImport');
    if (ov) ov.classList.add('hidden');
    window._partageImport = null;
  };

  window.partageConfirmImport = async function () {
    var ctx = window._partageImport;
    if (!ctx || !ctx.meta) return;
    try {
      var nameEl = $('partageImpName');
      var matEl = $('partageImpMat');
      var chEl = $('partageImpChap');
      var mat = (matEl && matEl.value) || '';
      if (!mat) {
        toast('Choisis une matière PC* pour ce dossier.', 'error');
        if (matEl) matEl.focus();
        return;
      }
      var ver = ctx.versionDoc;
      if (!ver) {
        ver = await window.QuickShare.getVersion(ctx.meta.packId, ctx.meta.latestVersion);
      }
      if (!ver) throw new Error('Version introuvable.');
      var existed = !!(window.QuickShare.findLocalGroupForPack
        && window.QuickShare.findLocalGroupForPack(ctx.meta.packId, ver));
      var g = window.QuickShare.createGroupFromVersion(ctx.meta, ver, {
        name: (nameEl && nameEl.value) || ctx.meta.name,
        mat: mat,
        chapitreId: (chEl && chEl.value) || '',
        color: ctx.color
      });
      window.partageCloseImport();
      toast(
        existed
          ? 'Contenu fusionné dans « ' + g.name + ' » (aucun second dossier).'
          : 'Pack importé → dossier « ' + g.name + ' ».',
        'ok'
      );
      if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
      S.view = 'mine';
      window.renderPartage();
    } catch (e) {
      if (String(e && e.message) === 'SECONDARY_READ_ONLY') return;
      toast(String(e && e.message || e), 'error');
    }
  };

  /** Bouton Partager / publier une maj depuis Paramètres dossier Rapide */
  window.quickSharePublishGroup = async function (groupId) {
    if (!groupId) return;
    try {
      if (!window.QuickShare.canPublish()) {
        return toast('Connecte-toi avec Google pour publier, ou utilise le mode local.', 'error');
      }
      var g = (window.D.quickGroups || []).find(function (x) { return x && x.id === groupId; });
      var shared = g && g.shared;
      // Déjà lié + pas de modif locale → pas de fausse « maj » vide
      if (shared && shared.packId && !shared.localDirty) {
        return toast('Rien à publier : aucune modification locale depuis la dernière version.', 'ok');
      }
      var run = async function (opts) {
        var result = await window.QuickShare.publishGroup(groupId, opts || {});
        toast('Publié : ' + result.meta.packId + ' · v' + result.version, 'ok');
        if (typeof window.quickCloseEditGroup === 'function') window.quickCloseEditGroup();
        if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
      };
      if (shared && shared.packId) {
        var meta = null;
        try { meta = await window.QuickShare.getMeta(shared.packId); } catch (e) { /* ignore */ }
        var owns = meta ? window.QuickShare.isPackOwner(meta) : true;
        if (!owns) {
          var creatorName = (meta.createdBy && meta.createdBy.name)
            || (meta.createdBy && meta.createdBy.email)
            || 'un autre élève';
          var collabMsg = 'Tu vas publier une <b>nouvelle version</b> du pack créé par <b>' +
            esc(creatorName) + '</b>.<br><br>' +
            'Ça met à jour le catalogue pour tout le monde (même pack, pas de doublon). ' +
            'Seul le créateur peut supprimer le pack du catalogue.';
          if (typeof window.sysConfirm === 'function') {
            window.sysConfirm(collabMsg, function () { run({}); }, 'Publier la version');
          } else {
            await run({});
          }
          return;
        }
      }
      await run({});
    } catch (e) {
      if (String(e && e.message) === 'SECONDARY_READ_ONLY') return;
      toast(String(e && e.message || e), 'error');
    }
  };

  window.partageUpdatesCount = async function () {
    try {
      var links = window.QuickShare.installedLinks();
      if (!links.length) return 0;
      var list = await window.QuickShare.listPacks();
      var byId = {};
      list.forEach(function (p) { byId[p.packId] = p; });
      var n = 0;
      links.forEach(function (g) {
        var m = byId[g.shared.packId];
        if (m && Number(m.latestVersion || 0) > Number(g.shared.installedVersion || 0)) n++;
      });
      return n;
    } catch (e) {
      return 0;
    }
  };
})();
