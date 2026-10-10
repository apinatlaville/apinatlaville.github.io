/**
 * quick-portage.js — Portage Rapide (Y-) : export / import JSON + kit Liam
 * Hors-ligne (presse-papiers / fichier). Distinct du Partage cloud.
 */
(function () {
  'use strict';

  var FORMAT = 'MESCOURS-PORTAGE';
  var VERSION = 1;
  var KIND = 'rapide-y';

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

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, { type: type || 'ok' });
  }

  function isQuickCard(c) {
    return !!(c && window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === 'quick');
  }

  function allMats() {
    return Array.isArray(window.D && window.D.matieres) ? window.D.matieres : [];
  }

  function allGroups() {
    return Array.isArray(window.D && window.D.quickGroups) ? window.D.quickGroups : [];
  }

  function cardsInGroup(groupId) {
    return (window.D && window.D.exercices || []).filter(function (c) {
      return isQuickCard(c) && c.groupId === groupId;
    });
  }

  function matLabel(m) {
    if (!m) return '';
    return String(m.label || m.name || m.id || '').trim();
  }

  function resolveMatId(hint) {
    var h = String(hint || '').trim();
    if (!h) return null;
    var mats = allMats();
    var byId = mats.find(function (m) { return m.id === h; });
    if (byId) return byId.id;
    var low = h.toLowerCase();
    var byName = mats.find(function (m) {
      return matLabel(m).toLowerCase() === low;
    });
    if (byName) return byName.id;
    var partial = mats.filter(function (m) {
      var lab = matLabel(m).toLowerCase();
      return lab.indexOf(low) >= 0 || low.indexOf(lab) >= 0;
    });
    if (partial.length === 1) return partial[0].id;
    return null;
  }

  function latexCheatSheet() {
    return [
      'LaTeX dans q/r :',
      '  Inline  : $x^2+1$',
      '  Display : $$\\\\frac{a}{b}$$',
      'Commandes utiles (échappe les \\\\ en JSON) :',
      '  \\\\frac{a}{b}  \\\\sqrt{x}  \\\\sum_{i=1}^{n}  \\\\int_{a}^{b}',
      '  \\\\overrightarrow{u}  \\\\begin{pmatrix}a&b\\\\\\\\c&d\\\\end{pmatrix}',
      '  \\\\alpha \\\\pi \\\\leq \\\\neq \\\\times \\\\cdot \\\\infty \\\\rightarrow \\\\Rightarrow',
      '  \\\\mathbb{R}  \\\\in  \\\\sin  \\\\ln  \\\\ce{H2O}  \\\\left(|x|\\\\right)',
      '  Produit vectoriel : \\\\wedge  (affiché ∧)'
    ].join('\n');
  }

  function buildKitText(opts) {
    opts = opts || {};
    var parts = [];
    parts.push('# Kit Portage — Mes Cours (Rapide Y-)');
    parts.push('');
    parts.push('Tu es un assistant qui génère des fiches Anki Rapide pour Mes Cours.');
    parts.push('Réponds UNIQUEMENT avec un objet JSON valide (pas de prose autour, ou un seul bloc ```json).');
    parts.push('');
    parts.push('## Schéma');
    parts.push(JSON.stringify({
      format: FORMAT,
      version: VERSION,
      kind: KIND,
      mode: 'full | delta',
      title: 'Nom du dossier',
      matiere: 'Nom ou id matière (ex. Anglais)',
      bidirectional: false,
      cards: [{ q: 'recto / question', r: 'verso / réponse' }]
    }, null, 2));
    parts.push('');
    parts.push('## Règles critiques');
    parts.push('- format="' + FORMAT + '", version=' + VERSION + ', kind="' + KIND + '", cards[] non vide.');
    parts.push('- Chaque carte : "q" et "r" non vides (chaînes JSON).');
    parts.push('- mode "full" : lot complet (nouveau dossier ou lot initial).');
    parts.push('- mode "delta" : UNIQUEMENT les NOUVELLES cartes. Ne recopié PAS les cartes déjà fournies / déjà dans le dossier.');
    parts.push('- Si l’utilisateur joint un export existant et demande des ajouts → mode "delta" + nouvelles cartes seulement.');
    parts.push('- Guillemets / retours ligne / formules : JSON valide (\\" et \\n). Les ":" dans le texte sont OK.');
    parts.push('- Pas de HTML. Pas de SRS (ease, dates…).');
    parts.push('');
    parts.push(latexCheatSheet());
    parts.push('');
    parts.push('## Exemple delta');
    parts.push(JSON.stringify({
      format: FORMAT,
      version: VERSION,
      kind: KIND,
      mode: 'delta',
      title: 'Mots de liaison',
      matiere: 'Anglais',
      cards: [
        { q: 'whereas', r: 'tandis que' },
        { q: 'nevertheless', r: 'néanmoins' }
      ]
    }, null, 2));
    if (opts.includeExport && opts.exportObj) {
      parts.push('');
      parts.push('## Dossier actuel de l’utilisateur (contexte — ne pas tout recopier si tu ajoutes)');
      parts.push(JSON.stringify(opts.exportObj, null, 2));
      parts.push('');
      parts.push('→ Si tu ajoutes des fiches : réponds en mode "delta" avec SEULEMENT les nouvelles cartes.');
    }
    return parts.join('\n');
  }

  function serializeGroup(groupId) {
    var g = allGroups().find(function (x) { return x.id === groupId; });
    if (!g) throw new Error('Dossier introuvable');
    var mats = allMats();
    var mat = mats.find(function (m) { return m.id === g.mat; });
    var cards = cardsInGroup(groupId).map(function (c) {
      return {
        q: String(c.question || c.titre || '').trim(),
        r: String(c.reponse || '').trim()
      };
    }).filter(function (c) { return c.q && c.r; });
    return {
      format: FORMAT,
      version: VERSION,
      kind: KIND,
      mode: 'full',
      title: String(g.name || '').trim() || 'Dossier',
      matiere: matLabel(mat) || g.mat || '',
      matiereId: g.mat || '',
      bidirectional: !!g.bidirectional,
      groupId: g.id,
      cards: cards
    };
  }

  function tryParseObject(text) {
    try {
      var obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch (e) { /* continue */ }
    return null;
  }

  function extractJsonPayload(raw) {
    var text = String(raw || '').trim();
    if (!text) throw new Error('Texte vide');

    var direct = tryParseObject(text);
    if (direct) return direct;

    // Prefer ```json fences, then any fence, until one parses
    var fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
    var jsonFenceRe = /```json\s*([\s\S]*?)```/gi;
    var m;
    while ((m = jsonFenceRe.exec(text))) {
      var fromJson = tryParseObject(m[1].trim());
      if (fromJson) return fromJson;
    }
    while ((m = fenceRe.exec(text))) {
      var fromFence = tryParseObject(m[1].trim());
      if (fromFence) return fromFence;
    }

    // Trailing prose / leading chatter : first { … last }
    var i = text.indexOf('{');
    var j = text.lastIndexOf('}');
    if (i >= 0 && j > i) {
      var sliced = tryParseObject(text.slice(i, j + 1));
      if (sliced) return sliced;
    }
    throw new Error('JSON invalide : impossible d’extraire un objet Portage');
  }

  function validatePortage(obj) {
    var errors = [];
    var cards = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, errors: ['Racine JSON doit être un objet.'], cards: [], meta: null };
    }
    if (obj.format !== FORMAT) {
      errors.push('format doit être "' + FORMAT + '" (reçu : ' + JSON.stringify(obj.format) + ').');
    }
    if (!(obj.version === VERSION || obj.version === String(VERSION))) {
      errors.push('version doit être ' + VERSION + ' (reçu : ' + JSON.stringify(obj.version) + ').');
    }
    if (obj.kind !== KIND) {
      errors.push('kind doit être "' + KIND + '" (reçu : ' + JSON.stringify(obj.kind) + ').');
    }
    var mode = String(obj.mode || 'full').toLowerCase();
    if (mode !== 'full' && mode !== 'delta') {
      errors.push('mode doit être "full" ou "delta" (reçu : ' + JSON.stringify(obj.mode) + ').');
    }
    if (!Array.isArray(obj.cards)) {
      errors.push('cards doit être un tableau.');
    } else if (!obj.cards.length) {
      errors.push('cards est vide — au moins une carte requise.');
    } else {
      obj.cards.forEach(function (c, idx) {
        var n = idx + 1;
        if (!c || typeof c !== 'object') {
          errors.push('Carte #' + n + ' : objet invalide.');
          return;
        }
        var q = String(c.q != null ? c.q : (c.question != null ? c.question : '')).trim();
        var r = String(c.r != null ? c.r : (c.reponse != null ? c.reponse : '')).trim();
        if (!q) errors.push('Carte #' + n + ' : "q" vide.');
        if (!r) errors.push('Carte #' + n + ' : "r" vide.');
        if (q && r) cards.push({ q: q, r: r });
      });
    }
    var title = String(obj.title || '').trim();
    var matiere = String(obj.matiere || obj.matiereId || '').trim();
    var meta = {
      mode: mode,
      title: title,
      matiere: matiere,
      matiereId: resolveMatId(obj.matiereId || matiere),
      bidirectional: !!obj.bidirectional,
      raw: obj
    };
    return { ok: errors.length === 0 && cards.length > 0, errors: errors, cards: cards, meta: meta };
  }

  function parseAndValidate(raw) {
    try {
      var obj = extractJsonPayload(raw);
      return validatePortage(obj);
    } catch (e) {
      return {
        ok: false,
        errors: [e && e.message ? e.message : String(e)],
        cards: [],
        meta: null
      };
    }
  }

  function copyText(text) {
    text = String(text || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; });
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve(true);
        else reject(new Error('copie impossible'));
      } catch (e) {
        reject(e);
      }
    });
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'portage.portage.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function slugFile(name) {
    return String(name || 'dossier')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'dossier';
  }

  function canMutate() {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : Portage indisponible (lecture seule).')) {
      return false;
    }
    return true;
  }

  function genGroupIdLocal() {
    var used = new Set(allGroups().map(function (g) { return g.id; }));
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var n = 0; n < 2000; n++) {
      var s = 'QG-';
      for (var i = 0; i < 3; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      if (!used.has(s)) return s;
    }
    return 'QG-' + Date.now().toString(36).slice(-3).toUpperCase();
  }

  function existingExoIds() {
    if (window.AnkiAlgoV2 && typeof window.AnkiAlgoV2.allExistingIds === 'function') {
      return Array.from(window.AnkiAlgoV2.allExistingIds(window.D));
    }
    var ids = [];
    (window.D && window.D.exercices || []).forEach(function (c) {
      if (c && c.id) ids.push(c.id);
    });
    (window.D && window.D.devoirs || []).forEach(function (c) {
      if (c && c.id) ids.push(c.id);
    });
    return ids;
  }

  function genCardIds(n) {
    if (!window._pendingExoIds) window._pendingExoIds = new Set();
    if (!window.AnkiAlgoV2 || typeof window.AnkiAlgoV2.genExoUid !== 'function') {
      throw new Error('AnkiAlgoV2 indisponible');
    }
    var existing = existingExoIds().concat(Array.from(window._pendingExoIds));
    var ids = [];
    for (var i = 0; i < n; i++) {
      var id = window.AnkiAlgoV2.genExoUid('Y', existing.concat(ids));
      ids.push(id);
      window._pendingExoIds.add(id);
    }
    return ids;
  }

  function buildCardObjects(cards, matId, groupId) {
    var ids = genCardIds(cards.length);
    var ease = (window.AnkiAlgoV2 && window.AnkiAlgoV2.getQuickDefaultProfile)
      ? window.AnkiAlgoV2.getQuickDefaultProfile().ease
      : 2.5;
    var today = (window.AnkiAlgoV2 && window.AnkiAlgoV2.todayISO)
      ? window.AnkiAlgoV2.todayISO()
      : new Date().toISOString().slice(0, 10);
    return cards.map(function (c, i) {
      return {
        id: ids[i],
        titre: '',
        question: c.q,
        reponse: c.r,
        mat: matId,
        profil: 'ANGLAIS',
        tempsCible: 30,
        importance: 3,
        statut: 'actif',
        coursIds: [],
        groupId: groupId,
        intervalle: 0,
        ease: ease,
        repetitions: 0,
        dateProchaineRevision: today,
        historique: [],
        epinglee: false,
        dateCreation: new Date().toISOString()
      };
    });
  }

  /**
   * Applique un Portage validé.
   * opts.target: 'new' | 'existing'
   * opts.groupId (si existing)
   * opts.newTitle, opts.matId, opts.bidirectional (si new)
   */
  function applyPortage(validated, opts) {
    opts = opts || {};
    if (!validated || !validated.ok) return Promise.reject(new Error('Portage invalide'));
    if (!window.D) return Promise.reject(new Error('NO_DATA'));
    if (!canMutate()) return Promise.reject(new Error('SECONDARY_READ_ONLY'));
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.quickGroups)) window.D.quickGroups = [];

    var groupId = '';
    var matId = '';
    var createdGroup = null;
    var built = null;

    if (opts.target === 'existing') {
      groupId = String(opts.groupId || '').trim();
      var g = allGroups().find(function (x) { return x.id === groupId; });
      if (!g) return Promise.reject(new Error('Dossier cible introuvable'));
      matId = g.mat || resolveMatId(validated.meta.matiere) || (allMats()[0] && allMats()[0].id) || 'XX';
    } else {
      matId = String(opts.matId || validated.meta.matiereId || '').trim();
      if (!matId) matId = resolveMatId(validated.meta.matiere) || '';
      if (!matId) return Promise.reject(new Error('Choisis une matière pour le nouveau dossier'));
      var title = String(opts.newTitle || validated.meta.title || '').trim();
      if (!title) return Promise.reject(new Error('Indique un nom de dossier'));
      groupId = genGroupIdLocal();
      var color = '#6a9cff';
      if (typeof window.quickDefaultGroupColor === 'function') {
        color = window.quickDefaultGroupColor(matId);
      }
      createdGroup = {
        id: groupId,
        name: title,
        color: color,
        order: allGroups().filter(function (x) { return x.mat === matId; }).length,
        mat: matId,
        bidirectional: !!(opts.bidirectional != null ? opts.bidirectional : validated.meta.bidirectional)
      };
    }

    // Construire les cartes AVANT de muter D (évite dossier orphelin si genExoUid échoue)
    try {
      built = buildCardObjects(validated.cards, matId, groupId);
    } catch (buildErr) {
      return Promise.reject(buildErr);
    }

    if (createdGroup) window.D.quickGroups.push(createdGroup);
    for (var i = built.length - 1; i >= 0; i--) {
      window.D.exercices.unshift(built[i]);
    }

    // Dirty flag mémoire seulement — la save Portage juste après persiste tout
    if (typeof window.quickMarkGroupLocalDirty === 'function') {
      window.quickMarkGroupLocalDirty(groupId, { persist: false });
    }

    return Promise.resolve(window.save({ waitCloud: false })).then(function () {
      built.forEach(function (c) {
        if (window._pendingExoIds) window._pendingExoIds.delete(c.id);
      });
      return {
        groupId: groupId,
        createdGroup: createdGroup,
        count: built.length,
        cards: built
      };
    }).catch(function (err) {
      // Rollback local cards (+ groupe créé) si échec dur local
      var ids = new Set(built.map(function (c) { return c.id; }));
      built.forEach(function (c) {
        if (window._pendingExoIds) window._pendingExoIds.delete(c.id);
      });
      var msg = String(err && err.message || err || '');
      if (/SECONDARY_READ_ONLY|localStorage save failed|Sauvegarde refusée|corrompues|anti-wipe|SAVE_DISABLED|NO_DATA/i.test(msg)) {
        window.D.exercices = (window.D.exercices || []).filter(function (c) {
          return !(c && ids.has(c.id));
        });
        if (createdGroup) {
          window.D.quickGroups = (window.D.quickGroups || []).filter(function (x) {
            return x.id !== createdGroup.id;
          });
        }
      }
      throw err;
    });
  }

  /* ========== UI ========== */

  var S = {
    importRaw: '',
    validated: null,
    target: 'new',
    exportGroupId: '',
    importBusy: false
  };

  function ensureOverlay() {
    var ov = document.getElementById('ovQuickPortage');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'ovQuickPortage';
    ov.className = 'ov ov-scroll hidden';
    ov.innerHTML =
      '<div class="ov-card qk-portage-card" role="dialog" aria-labelledby="qkPortageTitle">' +
        '<div class="ov-head">' +
          '<h3 id="qkPortageTitle">' + (window.iconLabel ? window.iconLabel('file-text', 'Portage') : 'Portage') + '</h3>' +
          '<button type="button" class="bs" onclick="window.QuickPortage.close()">' +
            (window.iconLabel ? window.iconLabel('x', 'Fermer') : 'Fermer') +
          '</button>' +
        '</div>' +
        '<div id="qkPortageBody" class="qk-portage-body"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov) window.QuickPortage.close();
    });
    return ov;
  }

  function openOverlay(mode, groupId) {
    var ov = ensureOverlay();
    S.exportGroupId = groupId || '';
    var body = document.getElementById('qkPortageBody');
    var title = document.getElementById('qkPortageTitle');
    if (mode === 'export') {
      if (title) title.innerHTML = window.iconLabel ? window.iconLabel('copy', 'Portage — exporter') : 'Portage — exporter';
      body.innerHTML = renderExportPane(groupId);
    } else if (mode === 'guide') {
      if (title) title.innerHTML = window.iconLabel ? window.iconLabel('book-open', 'Portage — kit Liam') : 'Portage — kit Liam';
      body.innerHTML = renderGuidePane(groupId);
    } else {
      if (title) title.innerHTML = window.iconLabel ? window.iconLabel('download', 'Portage — importer') : 'Portage — importer';
      S.importRaw = '';
      S.validated = null;
      S.target = 'new';
      body.innerHTML = renderImportPane();
    }
    ov.classList.remove('hidden');
    if (window.hydrateIcons) window.hydrateIcons(ov);
  }

  function renderExportPane(groupId) {
    var obj;
    try { obj = serializeGroup(groupId); } catch (e) {
      return '<p class="anki-mut">Impossible d’exporter : ' + esc(e.message) + '</p>';
    }
    var pretty = JSON.stringify(obj, null, 2);
    return '' +
      '<p class="anki-mut qk-portage-lead">Contenu pédagogique seulement (pas de SRS). Envoie ça à Liam + le kit, ou copie le kit+dossier d’un coup.</p>' +
      '<p><b>' + esc(obj.title) + '</b> · ' + obj.cards.length + ' carte(s)' +
        (obj.bidirectional ? ' · recto↔verso' : '') + '</p>' +
      '<pre class="qk-portage-pre" id="qkPortageExportPre">' + esc(pretty) + '</pre>' +
      '<div class="qk-portage-actions">' +
        '<button type="button" class="bp" onclick="window.QuickPortage.copyExport(\'' + jsStr(groupId) + '\')">Copier JSON</button>' +
        '<button type="button" class="bs" onclick="window.QuickPortage.downloadExport(\'' + jsStr(groupId) + '\')">Télécharger .portage.json</button>' +
        '<button type="button" class="bs" onclick="window.QuickPortage.copyKitAndGroup(\'' + jsStr(groupId) + '\')">Copier kit Liam + dossier</button>' +
        '<button type="button" class="bs" onclick="window.QuickPortage.openGuide(\'' + jsStr(groupId) + '\')">Voir le kit</button>' +
      '</div>';
  }

  function renderGuidePane(groupId) {
    var kit = buildKitText({
      includeExport: !!groupId,
      exportObj: groupId ? (function () {
        try { return serializeGroup(groupId); } catch (e) { return null; }
      })() : null
    });
    return '' +
      '<p class="anki-mut qk-portage-lead">Colle ce kit à Liam. S’il complète un dossier : <b>mode delta = nouvelles cartes seulement</b>, pas besoin de tout remettre.</p>' +
      '<pre class="qk-portage-pre qk-portage-pre--kit" id="qkPortageKitPre">' + esc(kit) + '</pre>' +
      '<div class="qk-portage-actions">' +
        '<button type="button" class="bp" onclick="window.QuickPortage.copyKit(' +
          (groupId ? '\'' + jsStr(groupId) + '\'' : 'null') + ')">Copier le kit' +
          (groupId ? ' + dossier' : '') + '</button>' +
        (groupId
          ? '<button type="button" class="bs" onclick="window.QuickPortage.openExport(\'' + jsStr(groupId) + '\')">Retour export</button>'
          : '') +
      '</div>';
  }

  function matOptionsHtml(selected) {
    return allMats().map(function (m) {
      var sel = m.id === selected ? ' selected' : '';
      return '<option value="' + esc(m.id) + '"' + sel + '>' + esc(matLabel(m) || m.id) + '</option>';
    }).join('');
  }

  function groupOptionsHtml(selected) {
    return allGroups().slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    }).map(function (g) {
      var sel = g.id === selected ? ' selected' : '';
      var mat = allMats().find(function (m) { return m.id === g.mat; });
      var lab = (g.name || g.id) + (mat ? ' · ' + matLabel(mat) : '');
      return '<option value="' + esc(g.id) + '"' + sel + '>' + esc(lab) + '</option>';
    }).join('');
  }

  function renderImportPane() {
    var v = S.validated;
    var preview = '';
    if (v) {
      if (v.ok) {
        preview =
          '<div class="qk-portage-ok">' +
            '<b>' + v.cards.length + ' carte(s)</b> prêtes · mode <code>' + esc(v.meta.mode) + '</code>' +
            (v.meta.title ? ' · « ' + esc(v.meta.title) + ' »' : '') +
          '</div>' +
          '<ol class="qk-portage-preview-list">' +
            v.cards.slice(0, 12).map(function (c) {
              return '<li><span class="qk-portage-q">' + esc(c.q.slice(0, 80)) +
                '</span> → <span class="qk-portage-r">' + esc(c.r.slice(0, 80)) + '</span></li>';
            }).join('') +
            (v.cards.length > 12 ? '<li class="anki-mut">… +' + (v.cards.length - 12) + ' autres</li>' : '') +
          '</ol>' +
          renderImportTargetForm(v);
      } else {
        preview =
          '<div class="qk-portage-err"><b>Erreurs</b> — rien ne sera importé :</div>' +
          '<ul class="qk-portage-err-list">' +
            v.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') +
          '</ul>';
      }
    }
    return '' +
      '<p class="anki-mut qk-portage-lead">Colle le JSON de Liam (ou un fichier <code>.portage.json</code>). Validation avant toute écriture.</p>' +
      '<textarea id="qkPortagePaste" class="fi qk-portage-ta" rows="10" placeholder=\'{ "format": "MESCOURS-PORTAGE", ... }\'>' +
        esc(S.importRaw) + '</textarea>' +
      '<div class="qk-portage-actions">' +
        '<label class="bs qk-portage-file-lbl">' +
          '<input type="file" id="qkPortageFile" accept=".json,.portage.json,application/json,text/plain" hidden onchange="window.QuickPortage.onFile(event)">' +
          'Choisir un fichier' +
        '</label>' +
        '<button type="button" class="bp" onclick="window.QuickPortage.validatePaste()">Vérifier</button>' +
        '<button type="button" class="bs" onclick="window.QuickPortage.openGuide(null)">Kit Liam</button>' +
      '</div>' +
      '<div id="qkPortagePreview">' + preview + '</div>';
  }

  function renderImportTargetForm(v) {
    var mats = allMats();
    var groups = allGroups();
    var preferredMat = v.meta.matiereId || (mats[0] && mats[0].id) || '';
    var preferredTitle = v.meta.title || 'Nouveau dossier';
    var currentGroup = '';
    try {
      if (window.quickGetNavGroupId) currentGroup = window.quickGetNavGroupId() || '';
    } catch (e) { /* ignore */ }
    return '' +
      '<div class="qk-portage-target">' +
        '<p class="qk-portage-dest-label">Destination</p>' +
        '<label class="qk-portage-radio"><input type="radio" name="qkPortTarget" value="new"' +
          (S.target === 'new' ? ' checked' : '') +
          ' onchange="window.QuickPortage.setTarget(\'new\')"> Créer un nouveau dossier</label>' +
        '<label class="qk-portage-radio"><input type="radio" name="qkPortTarget" value="existing"' +
          (S.target === 'existing' ? ' checked' : '') +
          (groups.length ? '' : ' disabled') +
          ' onchange="window.QuickPortage.setTarget(\'existing\')"> Ajouter à un dossier existant</label>' +
        '<div id="qkPortTargetNew" class="qk-portage-target-fields' +
          (S.target === 'new' ? '' : ' hidden') + '">' +
          '<label class="fg"><span>Nom du dossier</span>' +
            '<input type="text" class="fi" id="qkPortNewTitle" value="' + esc(preferredTitle) + '">' +
          '</label>' +
          '<label class="fg"><span>Matière</span>' +
            '<select class="fi" id="qkPortNewMat">' + matOptionsHtml(preferredMat) + '</select>' +
          '</label>' +
          '<label class="qk-portage-check"><input type="checkbox" id="qkPortNewBidir"' +
            (v.meta.bidirectional ? ' checked' : '') + '> Recto ↔ verso (bidirectionnel)</label>' +
        '</div>' +
        '<div id="qkPortTargetExist" class="qk-portage-target-fields' +
          (S.target === 'existing' ? '' : ' hidden') + '">' +
          (groups.length
            ? '<label class="fg"><span>Dossier</span><select class="fi" id="qkPortExistGroup">' +
                groupOptionsHtml(currentGroup) + '</select></label>'
            : '<p class="anki-mut">Aucun dossier — crée-en un d’abord.</p>') +
        '</div>' +
        '<button type="button" class="bp" onclick="window.QuickPortage.confirmImport()">' +
          'Importer ' + v.cards.length + ' carte(s)' +
        '</button>' +
      '</div>';
  }

  function refreshImportPreview() {
    var body = document.getElementById('qkPortageBody');
    if (!body) return;
    var ta = document.getElementById('qkPortagePaste');
    if (ta) S.importRaw = ta.value;
    body.innerHTML = renderImportPane();
    if (window.hydrateIcons) window.hydrateIcons(body);
  }

  window.QuickPortage = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    serializeGroup: serializeGroup,
    parseAndValidate: parseAndValidate,
    buildKitText: buildKitText,
    applyPortage: applyPortage,

    close: function () {
      var ov = document.getElementById('ovQuickPortage');
      if (ov) ov.classList.add('hidden');
    },
    openExport: function (groupId) {
      if (!groupId || groupId === '__none__') {
        toast('Ouvre un dossier pour exporter.', 'warn');
        return;
      }
      openOverlay('export', groupId);
    },
    openImport: function () {
      openOverlay('import', null);
    },
    openGuide: function (groupId) {
      openOverlay('guide', groupId || null);
    },
    copyExport: function (groupId) {
      try {
        var pretty = JSON.stringify(serializeGroup(groupId), null, 2);
        copyText(pretty).then(function () {
          toast('JSON Portage copié.', 'ok');
        }).catch(function () {
          toast('Copie impossible — sélectionne le texte.', 'error');
        });
      } catch (e) {
        toast(e.message || 'Export impossible', 'error');
      }
    },
    downloadExport: function (groupId) {
      try {
        var obj = serializeGroup(groupId);
        downloadText(slugFile(obj.title) + '.portage.json', JSON.stringify(obj, null, 2));
        toast('Fichier téléchargé.', 'ok');
      } catch (e) {
        toast(e.message || 'Téléchargement impossible', 'error');
      }
    },
    copyKit: function (groupId) {
      var kit = buildKitText({
        includeExport: !!groupId,
        exportObj: groupId ? (function () {
          try { return serializeGroup(groupId); } catch (e) { return null; }
        })() : null
      });
      copyText(kit).then(function () {
        toast(groupId ? 'Kit Liam + dossier copiés.' : 'Kit Liam copié.', 'ok');
      }).catch(function () {
        toast('Copie impossible.', 'error');
      });
    },
    copyKitAndGroup: function (groupId) {
      this.copyKit(groupId);
    },
    validatePaste: function () {
      var ta = document.getElementById('qkPortagePaste');
      S.importRaw = ta ? ta.value : '';
      S.validated = parseAndValidate(S.importRaw);
      S.target = 'new';
      refreshImportPreview();
      if (S.validated.ok) toast(S.validated.cards.length + ' carte(s) OK.', 'ok');
      else toast('Portage invalide — vois les erreurs.', 'error');
    },
    onFile: function (ev) {
      var f = ev && ev.target && ev.target.files && ev.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        S.importRaw = String(reader.result || '');
        S.validated = parseAndValidate(S.importRaw);
        refreshImportPreview();
        if (S.validated.ok) toast(S.validated.cards.length + ' carte(s) OK.', 'ok');
        else toast('Fichier invalide — vois les erreurs.', 'error');
      };
      reader.onerror = function () { toast('Lecture fichier impossible.', 'error'); };
      reader.readAsText(f);
    },
    setTarget: function (t) {
      S.target = t === 'existing' ? 'existing' : 'new';
      var n = document.getElementById('qkPortTargetNew');
      var e = document.getElementById('qkPortTargetExist');
      if (n) n.classList.toggle('hidden', S.target !== 'new');
      if (e) e.classList.toggle('hidden', S.target !== 'existing');
    },
    confirmImport: function () {
      if (S.importBusy) return;
      if (!S.validated || !S.validated.ok) {
        toast('Vérifie d’abord le Portage.', 'warn');
        return;
      }
      if (!canMutate()) return;
      if (typeof window.save !== 'function') {
        toast('Sauvegarde indisponible — réessaie.', 'error');
        return;
      }
      var opts = { target: S.target };
      if (S.target === 'new') {
        var titleEl = document.getElementById('qkPortNewTitle');
        var matEl = document.getElementById('qkPortNewMat');
        var bidirEl = document.getElementById('qkPortNewBidir');
        opts.newTitle = titleEl ? titleEl.value.trim() : '';
        opts.matId = matEl ? matEl.value : '';
        opts.bidirectional = !!(bidirEl && bidirEl.checked);
        if (!opts.newTitle) { toast('Nom de dossier requis.', 'error'); return; }
        if (!opts.matId) { toast('Matière requise.', 'error'); return; }
      } else {
        var gEl = document.getElementById('qkPortExistGroup');
        opts.groupId = gEl ? gEl.value : '';
        if (!opts.groupId) { toast('Choisis un dossier.', 'error'); return; }
      }
      S.importBusy = true;
      applyPortage(S.validated, opts).then(function (res) {
        toast(res.count + ' carte(s) importée(s).', 'ok');
        window.QuickPortage.close();
        if (res.groupId && typeof window.quickNavigateToGroup === 'function') {
          try { window.quickNavigateToGroup(res.groupId); } catch (e1) { /* ignore */ }
        }
        if (typeof window.renderFlashcards === 'function') {
          try { window.renderFlashcards(); } catch (e2) { /* ignore */ }
        }
      }).catch(function (err) {
        var msg = String(err && err.message || err || '');
        if (/SECONDARY_READ_ONLY/i.test(msg)) return;
        toast('Import échoué : ' + msg, 'error');
      }).finally(function () { S.importBusy = false; });
    }
  };

  /** Helpers exposés pour anki-quick (couleur dossier). */
  window.quickDefaultGroupColor = window.quickDefaultGroupColor || function (matId) {
    var colors = ['#6a9cff', '#50d890', '#f0c060', '#ff7a90', '#c084fc', '#2dd4bf'];
    var n = allGroups().filter(function (g) { return g.mat === matId; }).length;
    return colors[n % colors.length];
  };
})();
