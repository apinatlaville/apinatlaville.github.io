/**
 * quick-share.js — Partage de dossiers Rapide (catalogue public, pull manuel)
 * Contenu partagé (contentId) ≠ cartes Y- locales (SRS perso).
 */
(function () {
  'use strict';

  var KIND = 'mes-cours-quick-pack';
  var SCHEMA = 1;
  var LOCAL_KEY = 'mes_cours_shared_packs_v1';
  var COLLECTION = 'sharedPacks';

  var S = {
    view: 'catalog', // catalog | mine | detail
    packId: '',
    q: '',
    matFilter: '', // id canonique or '' = toutes
    catalog: null,
    detail: null,
    versions: null,
    busy: false
  };

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

  function genContentId(used) {
    return genCode('S-', 4, used);
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
      return c && c.groupId === groupId
        && window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === 'quick';
    });
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
    var pack = store.packs[meta.packId] || { meta: meta, versions: {} };
    pack.meta = meta;
    pack.versions[String(versionDoc.version)] = versionDoc;
    store.packs[meta.packId] = pack;
    writeLocalStore(store);
    return { meta: meta, version: versionDoc.version };
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
    var packRef = window.doc(window.db, COLLECTION, meta.packId);
    var verRef = window.doc(window.db, COLLECTION, meta.packId, 'versions', String(versionDoc.version));
    await window.setDoc(packRef, meta, { merge: true });
    await window.setDoc(verRef, versionDoc);
    return { meta: meta, version: versionDoc.version };
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

    publishGroup: async function (groupId) {
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
      var packId = shared.packId || genPackId();
      var prevVersion = shared.installedVersion || shared.publishedVersion || 0;
      var nextVersion = Math.max(1, Number(prevVersion) + 1);

      // Si le pack existe déjà cloud/local, prendre latest+1
      var existingMeta = null;
      try { existingMeta = await window.QuickShare.getMeta(packId); } catch (e) { /* ignore */ }
      if (existingMeta && existingMeta.latestVersion != null) {
        nextVersion = Math.max(nextVersion, Number(existingMeta.latestVersion) + 1);
      }

      var versionDoc = buildVersionPayload(g, cards, nextVersion, pub);
      var meta = {
        packId: packId,
        name: g.name || 'Dossier',
        visibility: 'public',
        latestVersion: nextVersion,
        cardCount: cards.length,
        updatedAt: versionDoc.publishedAt,
        createdAt: (existingMeta && existingMeta.createdAt) || versionDoc.publishedAt,
        createdBy: (existingMeta && existingMeta.createdBy) || pub,
        lastPublishedBy: pub,
        suggestedMat: g.mat || '',
        suggestedColor: g.color || ''
      };

      var result;
      if (canUseCloud()) result = await cloudPublish(meta, versionDoc);
      else result = localPublish(meta, versionDoc);

      g.shared = {
        packId: packId,
        installedVersion: nextVersion,
        publishedVersion: nextVersion,
        mat: g.mat || '',
        chapitreId: g.chapitreId || '',
        color: g.color || '',
        localDirty: false,
        imported: !!shared.imported
      };
      if (typeof window.save === 'function') window.save();
      return result;
    },

    findLocalGroupByPack: function (packId) {
      return (window.D.quickGroups || []).find(function (g) {
        return g && g.shared && g.shared.packId === packId;
      }) || null;
    },

    installedLinks: function () {
      return (window.D.quickGroups || []).filter(function (g) {
        return g && g.shared && g.shared.packId;
      });
    },

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
      var byContent = {};
      localCards.forEach(function (c) {
        if (c.contentId) byContent[c.contentId] = c;
      });
      var packIds = {};
      var added = [];
      var updated = [];
      (versionDoc.cards || []).forEach(function (pc) {
        if (!pc || !pc.contentId) return;
        packIds[pc.contentId] = true;
        var loc = byContent[pc.contentId];
        if (!loc) added.push(pc);
        else {
          var same = (loc.titre || '') === (pc.titre || '')
            && (loc.question || '') === (pc.question || '')
            && (loc.reponse || '') === (pc.reponse || '')
            && (loc.profil || '') === (pc.profil || '')
            && Number(loc.tempsCible || 0) === Number(pc.tempsCible || 0)
            && Number(loc.importance || 0) === Number(pc.importance || 0);
          if (!same) updated.push({ local: loc, pack: pc });
        }
      });
      var removed = localCards.filter(function (c) {
        return c.contentId && !packIds[c.contentId];
      });
      return { added: added, updated: updated, removed: removed };
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

      var preview = window.QuickShare.previewUpdate(groupId, versionDoc);
      var byContent = {};
      cardsForGroup(groupId).forEach(function (c) {
        if (c.contentId) byContent[c.contentId] = c;
      });

      // Updates
      preview.updated.forEach(function (u) {
        var loc = u.local;
        var pc = u.pack;
        loc.titre = pc.titre || '';
        loc.question = pc.question || '';
        loc.reponse = pc.reponse || '';
        loc.profil = pc.profil || loc.profil || 'ANGLAIS';
        if (pc.tempsCible != null) loc.tempsCible = Number(pc.tempsCible);
        if (pc.importance != null) loc.importance = Number(pc.importance);
        // SRS inchangé
      });

      // Adds
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
      preview.added.forEach(function (pc) {
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
        window.D.exercices.unshift({
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

      // Removals
      if (opts.deleteRemoved !== false && preview.removed.length) {
        var delIds = new Set(preview.removed.map(function (c) { return c.id; }));
        window.D.exercices = window.D.exercices.filter(function (c) { return !delIds.has(c.id); });
      }

      if (!g.shared) g.shared = {};
      g.shared.packId = opts.packId || g.shared.packId;
      g.shared.installedVersion = versionDoc.version;
      g.shared.localDirty = false;
      if (versionDoc.name) g.name = versionDoc.name;

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
        chapitreId: prefs.chapitreId || '',
        shared: {
          packId: packMeta.packId,
          installedVersion: versionDoc.version,
          mat: mat,
          chapitreId: prefs.chapitreId || '',
          color: color,
          imported: true,
          localDirty: false
        }
      };
      window.D.quickGroups.push(g);

      // Create empty then apply version (adds all cards)
      window.QuickShare.applyVersionToGroup(gid, versionDoc, {
        packId: packMeta.packId,
        deleteRemoved: false
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
      pane.innerHTML = '<div class="anki-card-block"><p class="anki-mut">Chargement…</p></div>';
      return;
    }
    try {
      S.busy = true;
      if (S.view === 'detail' && S.packId) {
        await renderPartageDetail(pane);
      } else if (S.view === 'mine') {
        await renderPartageMine(pane);
      } else {
        await renderPartageCatalog(pane);
      }
    } catch (err) {
      pane.innerHTML = '<div class="anki-card-block"><p style="color:var(--red);">' +
        esc(err && err.message || err) + '</p></div>';
    } finally {
      S.busy = false;
      if (window.hydrateIcons) window.hydrateIcons(pane);
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
    var update = local && latest > Number(local.shared.installedVersion || 0);
    var mat = matiereDisplay(p.suggestedMat);
    var actionBtn;
    if (!local) {
      actionBtn = '<button type="button" class="bp partage-row-action" onclick="event.stopPropagation();window.partageImportFromCatalog(\'' +
        jsStr(p.packId) + '\')">' +
        (window.iconLabel ? window.iconLabel('download', 'Importer') : 'Importer') + '</button>';
    } else if (update) {
      actionBtn = '<button type="button" class="bp partage-row-action" onclick="event.stopPropagation();window.partageImportFromCatalog(\'' +
        jsStr(p.packId) + '\')">' +
        (window.iconLabel ? window.iconLabel('refresh-cw', 'Update') : 'Update') + '</button>';
    } else {
      actionBtn = '<span class="partage-badge">Installé</span>';
    }
    return (
      '<div class="partage-row partage-row-static">' +
        '<button type="button" class="partage-row-main partage-row-main-btn" onclick="window.partageOpenPack(\'' + jsStr(p.packId) + '\')" title="Voir le détail">' +
          '<strong>' + esc(p.name || p.packId) + '</strong>' +
          '<span class="anki-mut">' + esc(p.packId) +
            ' · ' + esc(String(p.cardCount || 0)) + ' cartes' +
            (p.suggestedMat ? ' · ' + esc(mat.label) : '') +
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
    var installed = {};
    links.forEach(function (g) { installed[g.shared.packId] = g; });

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
            ? '<button type="button" class="bp" onclick="window.partageOpenPack(\'' + jsStr(g.shared.packId) + '\')">' +
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
    var local = window.QuickShare.findLocalGroupByPack(S.packId);
    var latest = Number(meta.latestVersion || 1);
    var installed = local ? Number(local.shared.installedVersion || 0) : 0;
    var needsUpdate = local && latest > installed;
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
      actionBtn = '<button type="button" class="bp" onclick="window.partageDoUpdate()">' +
        (window.iconLabel ? window.iconLabel('refresh-cw', 'Update vers dernière') : 'Update') + '</button>';
    } else {
      actionBtn = '<span class="anki-mut">À jour (v' + esc(String(installed)) + ')</span>';
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
        (local ? '<p class="anki-mut" style="font-size:12px;">Lié au dossier local <b>' + esc(local.name) +
          '</b> (v' + esc(String(installed)) + ')</p>' : '') +
        '<div class="partage-detail-actions">' +
          actionBtn +
          '<label class="anki-mut" style="font-size:12px;">Version</label>' +
          '<select id="partageVerSel" class="fi" onchange="window.partageSelectVersion(this.value)">' + verOpts + '</select>' +
          '<button type="button" class="bs" onclick="window.partageInstallSelectedVersion()">' +
            (local ? 'Installer cette version' : 'Importer cette version') + '</button>' +
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
    window.renderPartage();
  };

  /** Import / update direct depuis le catalogue (dernière version). */
  window.partageImportFromCatalog = async function (packId) {
    if (!packId) return;
    try {
      var meta = (S.catalog || []).find(function (p) { return p && p.packId === packId; })
        || await window.QuickShare.getMeta(packId);
      if (!meta) return toast('Pack introuvable.', 'error');
      S.detail = meta;
      var local = window.QuickShare.findLocalGroupByPack(packId);
      if (local) {
        var ver = await window.QuickShare.getVersion(packId, meta.latestVersion);
        if (!ver) return toast('Version introuvable.', 'error');
        await confirmAndApply(local.id, meta, ver);
        return;
      }
      openImportWizard(meta, null);
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
    var local = window.QuickShare.findLocalGroupByPack(meta.packId);
    if (!local) return;
    var ver = await window.QuickShare.getVersion(meta.packId, meta.latestVersion);
    if (!ver) return toast('Version introuvable.', 'error');
    await confirmAndApply(local.id, meta, ver);
  };

  window.partageInstallSelectedVersion = async function () {
    var meta = S.detail;
    if (!meta) return;
    var sel = $('partageVerSel');
    var v = sel ? parseInt(sel.value, 10) : meta.latestVersion;
    var ver = await window.QuickShare.getVersion(meta.packId, v);
    if (!ver) return toast('Version introuvable.', 'error');
    var local = window.QuickShare.findLocalGroupByPack(meta.packId);
    if (!local) {
      openImportWizard(meta, ver);
      return;
    }
    await confirmAndApply(local.id, meta, ver);
  };

  async function confirmAndApply(groupId, meta, ver) {
    var preview = window.QuickShare.previewUpdate(groupId, ver);
    var msg = 'Mettre à jour le contenu vers <b>v' + esc(String(ver.version)) + '</b> ?' +
      '<br><br>+' + preview.added.length + ' · ~' + preview.updated.length + ' · −' + preview.removed.length +
      '<br><span class="anki-mut">Tes répétitions (SRS) ne sont pas modifiées.</span>';
    if (preview.removed.length) {
      msg += '<br><br><b style="color:var(--red);">' + preview.removed.length +
        ' carte(s) seront supprimées</b> (retirées du pack).';
    }
    var apply = function () {
      try {
        window.QuickShare.applyVersionToGroup(groupId, ver, { packId: meta.packId, deleteRemoved: true });
        toast('Pack mis à jour (v' + ver.version + ').', 'ok');
        if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
        window.renderPartage();
      } catch (e) {
        if (String(e && e.message) === 'SECONDARY_READ_ONLY') return;
        toast(String(e && e.message || e), 'error');
      }
    };
    if (typeof window.sysConfirm === 'function') {
      window.sysConfirm(msg, apply, 'Update pack');
    } else {
      apply();
    }
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
      var g = window.QuickShare.createGroupFromVersion(ctx.meta, ver, {
        name: (nameEl && nameEl.value) || ctx.meta.name,
        mat: mat,
        chapitreId: (chEl && chEl.value) || '',
        color: ctx.color
      });
      window.partageCloseImport();
      toast('Pack importé → dossier « ' + g.name + ' ».', 'ok');
      if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
      S.view = 'mine';
      window.renderPartage();
    } catch (e) {
      if (String(e && e.message) === 'SECONDARY_READ_ONLY') return;
      toast(String(e && e.message || e), 'error');
    }
  };

  /** Bouton Partager depuis Paramètres dossier Rapide */
  window.quickSharePublishGroup = async function (groupId) {
    if (!groupId) return;
    try {
      if (!window.QuickShare.canPublish()) {
        return toast('Connecte-toi avec Google pour publier, ou utilise le mode local.', 'error');
      }
      var result = await window.QuickShare.publishGroup(groupId);
      toast('Publié : ' + result.meta.packId + ' · v' + result.version, 'ok');
      if (typeof window.quickCloseEditGroup === 'function') window.quickCloseEditGroup();
      if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
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
