/**
 * quick-portage.js — Portage IA (onglet Système)
 * Export / import JSON des dossiers Rapide Y- + kit IA (LaTeX exhaustif).
 * Distinct du Partage cloud. Plus d’UI dans l’onglet Rapide.
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

  function latexCatalogText() {
    var lines = [
      '## LaTeX — règles Mes Cours',
      '- Inline dans q/r : $...$  |  Display : $$...$$',
      '- Dans le JSON, chaque \\ LaTeX doit être doublé : \\\\frac{a}{b} → s’écrit "\\\\frac{a}{b}" dans la chaîne JSON.',
      '- Pas de HTML. Pas de Markdown hors du JSON. Guillemets dans le texte : \\"',
      '- Chimie : \\\\ce{H2O} (mhchem). Matrices : \\\\begin{pmatrix}...\\\\end{pmatrix}',
      '- Délimiteurs auto : \\\\left( \\\\right)  \\\\left| \\\\right|',
      '- Produit vectoriel : \\\\wedge',
      ''
    ];
    var catalog = null;
    if (window.LatexLab && typeof window.LatexLab.getSnipCatalog === 'function') {
      try { catalog = window.LatexLab.getSnipCatalog(); } catch (e) { catalog = null; }
    }
    if (!catalog || !catalog.length) {
      lines.push('(Catalogue LaTeX indisponible — ouvre d’abord Portage IA pour charger le labo.)');
      return lines.join('\n');
    }
    lines.push('## Catalogue LaTeX complet (toutes les commandes du labo)');
    lines.push('Format : label | latex | titre');
    catalog.forEach(function (g) {
      lines.push('');
      lines.push('### ' + (g.label || g.id || 'Groupe'));
      (g.items || []).forEach(function (it) {
        var latex = String(it.latex || '').replace(/\\/g, '\\\\');
        lines.push('- ' + (it.label || '?') + ' | `' + latex + '` | ' + (it.title || ''));
      });
    });
    return lines.join('\n');
  }

  function buildKitText(opts) {
    opts = opts || {};
    var modeHint = opts.modeHint === 'delta' ? 'delta' : (opts.modeHint === 'full' ? 'full' : null);
    var parts = [];
    parts.push('# Kit Portage IA — Mes Cours (fiches Rapide Y-)');
    parts.push('');
    parts.push('Tu es une IA qui génère des fiches Anki Rapide pour Mes Cours PC*.');
    parts.push('Réponds UNIQUEMENT avec un objet JSON valide (pas de prose autour, ou un seul bloc ```json).');
    parts.push('');
    parts.push('## Schéma');
    parts.push(JSON.stringify({
      format: FORMAT,
      version: VERSION,
      kind: KIND,
      mode: modeHint || 'full | delta',
      title: 'Nom du dossier',
      matiere: 'Nom ou id matière (ex. Anglais)',
      bidirectional: false,
      cards: [{ q: 'recto / question', r: 'verso / réponse (LaTeX OK dans $...$)' }]
    }, null, 2));
    parts.push('');
    parts.push('## Règles critiques');
    parts.push('- format="' + FORMAT + '", version=' + VERSION + ', kind="' + KIND + '", cards[] non vide.');
    parts.push('- Chaque carte : "q" et "r" non vides (chaînes JSON).');
    parts.push('- mode "full" : lot complet pour CRÉER un nouveau dossier.');
    parts.push('- mode "delta" : UNIQUEMENT les NOUVELLES cartes pour COMPLÉTER un dossier. Ne recopié JAMAIS les cartes déjà fournies.');
    if (modeHint === 'delta') {
      parts.push('- MODE IMPOSÉ : "delta" — nouvelles cartes seulement.');
    } else if (modeHint === 'full') {
      parts.push('- MODE IMPOSÉ : "full" — lot initial complet.');
    }
    parts.push('- Guillemets / retours ligne / formules : JSON valide (\\" et \\n). Les ":" dans le texte sont OK.');
    parts.push('- Pas de HTML. Pas de SRS (ease, dates…).');
    parts.push('');
    parts.push(latexCatalogText());
    parts.push('');
    parts.push('## Exemple full (créer)');
    parts.push(JSON.stringify({
      format: FORMAT,
      version: VERSION,
      kind: KIND,
      mode: 'full',
      title: 'Mots de liaison',
      matiere: 'Anglais',
      bidirectional: true,
      cards: [
        { q: 'although', r: 'bien que / quoique' },
        { q: 'Energy $E=mc^2$', r: 'Énergie-masse' }
      ]
    }, null, 2));
    parts.push('');
    parts.push('## Exemple delta (compléter)');
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
      parts.push('## Dossier actuel (contexte — NE PAS tout recopier)');
      parts.push(JSON.stringify(opts.exportObj, null, 2));
      parts.push('');
      parts.push('→ Réponds en mode "delta" avec SEULEMENT les nouvelles cartes.');
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
    if (typeof window.quickGenGroupId === 'function') return window.quickGenGroupId();
    var used = new Set(allGroups().map(function (g) { return g.id; }));
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var n = 0; n < 4000; n++) {
      var s = 'QG-';
      for (var i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      if (!used.has(s)) return s;
    }
    return 'QG-' + Date.now().toString(36).slice(-6).toUpperCase();
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

  /* ========== UI onglet Système ========== */

  var S = {
    mode: 'create', // create | complete
    completeGroupId: '',
    importRaw: '',
    validated: null,
    target: 'new',
    importBusy: false
  };

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
      var n = cardsInGroup(g.id).length;
      var lab = (g.name || g.id) + (mat ? ' · ' + matLabel(mat) : '') + ' (' + n + ')';
      return '<option value="' + esc(g.id) + '"' + sel + '>' + esc(lab) + '</option>';
    }).join('');
  }

  function renderImportPreviewHtml() {
    var v = S.validated;
    if (!v) return '';
    if (!v.ok) {
      return '<div class="qk-portage-err"><b>Erreurs</b> — rien ne sera importé :</div>' +
        '<ul class="qk-portage-err-list">' +
        v.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') +
        '</ul>';
    }
    var forceExisting = S.mode === 'complete';
    var preferredMat = v.meta.matiereId || (allMats()[0] && allMats()[0].id) || '';
    var preferredTitle = v.meta.title || 'Nouveau dossier';
    var destHtml = '';
    if (forceExisting) {
      S.target = 'existing';
      destHtml =
        '<p class="qk-portage-dest-label">Destination (mode Compléter)</p>' +
        '<label class="fg"><span>Dossier</span><select class="fi" id="qkPortExistGroup">' +
          groupOptionsHtml(S.completeGroupId || '') + '</select></label>';
    } else {
      destHtml =
        '<p class="qk-portage-dest-label">Destination</p>' +
        '<label class="qk-portage-radio"><input type="radio" name="qkPortTarget" value="new"' +
          (S.target === 'new' ? ' checked' : '') +
          ' onchange="window.QuickPortage.setTarget(\'new\')"> Nouveau dossier</label>' +
        '<label class="qk-portage-radio"><input type="radio" name="qkPortTarget" value="existing"' +
          (S.target === 'existing' ? ' checked' : '') +
          (allGroups().length ? '' : ' disabled') +
          ' onchange="window.QuickPortage.setTarget(\'existing\')"> Ajouter à un dossier existant</label>' +
        '<div id="qkPortTargetNew" class="qk-portage-target-fields' +
          (S.target === 'new' ? '' : ' hidden') + '">' +
          '<label class="fg"><span>Nom</span><input type="text" class="fi" id="qkPortNewTitle" value="' + esc(preferredTitle) + '"></label>' +
          '<label class="fg"><span>Matière</span><select class="fi" id="qkPortNewMat">' + matOptionsHtml(preferredMat) + '</select></label>' +
          '<label class="qk-portage-check"><input type="checkbox" id="qkPortNewBidir"' +
            (v.meta.bidirectional ? ' checked' : '') + '> Recto ↔ verso</label>' +
        '</div>' +
        '<div id="qkPortTargetExist" class="qk-portage-target-fields' +
          (S.target === 'existing' ? '' : ' hidden') + '">' +
          (allGroups().length
            ? '<label class="fg"><span>Dossier</span><select class="fi" id="qkPortExistGroup">' +
                groupOptionsHtml(S.completeGroupId) + '</select></label>'
            : '<p class="anki-mut">Aucun dossier.</p>') +
        '</div>';
    }
    return '<div class="qk-portage-ok"><b>' + v.cards.length + ' carte(s)</b> · mode <code>' +
      esc(v.meta.mode) + '</code>' +
      (v.meta.title ? ' · « ' + esc(v.meta.title) + ' »' : '') + '</div>' +
      '<ol class="qk-portage-preview-list">' +
      v.cards.slice(0, 12).map(function (c) {
        return '<li><span class="qk-portage-q">' + esc(c.q.slice(0, 80)) +
          '</span> → <span class="qk-portage-r">' + esc(c.r.slice(0, 80)) + '</span></li>';
      }).join('') +
      (v.cards.length > 12 ? '<li class="anki-mut">… +' + (v.cards.length - 12) + '</li>' : '') +
      '</ol>' +
      '<div class="qk-portage-target">' + destHtml +
        '<button type="button" class="bp" onclick="window.QuickPortage.confirmImport()">' +
          'Importer ' + v.cards.length + ' carte(s)</button>' +
      '</div>';
  }

  function renderCreateSection() {
    return '' +
      '<section class="pia-section">' +
        '<h3 class="pia-h3">1 · Kit IA (créer)</h3>' +
        '<p class="anki-mut pia-lead">Copie le kit, donne-le à ton IA (« crée des fiches anglais sur… »), puis colle la réponse ci-dessous.</p>' +
        '<div class="qk-portage-actions">' +
          '<button type="button" class="bp" onclick="window.QuickPortage.copyKitCreate()">Copier le kit IA</button>' +
          '<button type="button" class="bs" onclick="window.QuickPortage.showKitPreview(\'full\')">Aperçu kit</button>' +
        '</div>' +
        '<div id="piaKitPreview" class="hidden"></div>' +
      '</section>' +
      '<section class="pia-section">' +
        '<h3 class="pia-h3">2 · Importer la réponse</h3>' +
        '<textarea id="qkPortagePaste" class="fi qk-portage-ta" rows="8" placeholder=\'{ "format": "MESCOURS-PORTAGE", "mode": "full", ... }\'>' +
          esc(S.importRaw) + '</textarea>' +
        '<div class="qk-portage-actions">' +
          '<label class="bs qk-portage-file-lbl">' +
            '<input type="file" id="qkPortageFile" accept=".json,.portage.json,application/json,text/plain" hidden onchange="window.QuickPortage.onFile(event)">' +
            'Fichier</label>' +
          '<button type="button" class="bp" onclick="window.QuickPortage.validatePaste()">Vérifier</button>' +
        '</div>' +
        '<div id="qkPortagePreview">' + renderImportPreviewHtml() + '</div>' +
      '</section>';
  }

  function renderCompleteSection() {
    var gid = S.completeGroupId;
    var exportBlock = '';
    if (gid) {
      try {
        var obj = serializeGroup(gid);
        exportBlock =
          '<p><b>' + esc(obj.title) + '</b> · ' + obj.cards.length + ' carte(s)</p>' +
          '<pre class="qk-portage-pre" id="qkPortageExportPre">' + esc(JSON.stringify(obj, null, 2)) + '</pre>' +
          '<div class="qk-portage-actions">' +
            '<button type="button" class="bp" onclick="window.QuickPortage.copyExport(\'' + jsStr(gid) + '\')">Copier JSON dossier</button>' +
            '<button type="button" class="bs" onclick="window.QuickPortage.downloadExport(\'' + jsStr(gid) + '\')">Télécharger</button>' +
            '<button type="button" class="bp" onclick="window.QuickPortage.copyKitComplete()">Copier kit IA + dossier</button>' +
          '</div>';
      } catch (e) {
        exportBlock = '<p class="anki-mut">' + esc(e.message) + '</p>';
      }
    } else {
      exportBlock = '<p class="anki-mut">Choisis un dossier Rapide Y- ci-dessus.</p>';
    }
    return '' +
      '<section class="pia-section">' +
        '<h3 class="pia-h3">1 · Dossier à compléter</h3>' +
        '<label class="fg"><span>Dossier Rapide</span>' +
          '<select class="fi" id="piaCompleteGroup" onchange="window.QuickPortage.onCompleteGroupChange(this.value)">' +
            '<option value="">— choisir —</option>' +
            groupOptionsHtml(gid) +
          '</select></label>' +
        exportBlock +
      '</section>' +
      '<section class="pia-section">' +
        '<h3 class="pia-h3">2 · Kit IA (compléter = delta)</h3>' +
        '<p class="anki-mut pia-lead">L’IA ne renvoie que les <b>nouvelles</b> cartes (<code>mode: delta</code>). Pas besoin de tout recopier.</p>' +
        '<div class="qk-portage-actions">' +
          '<button type="button" class="bp" onclick="window.QuickPortage.copyKitComplete()" ' +
            (gid ? '' : 'disabled') + '>Copier kit IA + dossier</button>' +
          '<button type="button" class="bs" onclick="window.QuickPortage.showKitPreview(\'delta\')" ' +
            (gid ? '' : 'disabled') + '>Aperçu kit</button>' +
        '</div>' +
        '<div id="piaKitPreview" class="hidden"></div>' +
      '</section>' +
      '<section class="pia-section">' +
        '<h3 class="pia-h3">3 · Importer les nouvelles cartes</h3>' +
        '<textarea id="qkPortagePaste" class="fi qk-portage-ta" rows="8" placeholder=\'{ "mode": "delta", "cards": [...] }\'>' +
          esc(S.importRaw) + '</textarea>' +
        '<div class="qk-portage-actions">' +
          '<label class="bs qk-portage-file-lbl">' +
            '<input type="file" id="qkPortageFile" accept=".json,.portage.json,application/json,text/plain" hidden onchange="window.QuickPortage.onFile(event)">' +
            'Fichier</label>' +
          '<button type="button" class="bp" onclick="window.QuickPortage.validatePaste()">Vérifier</button>' +
        '</div>' +
        '<div id="qkPortagePreview">' + renderImportPreviewHtml() + '</div>' +
      '</section>';
  }

  function paintPane() {
    var pane = document.getElementById('panePortageIa');
    if (!pane) return;
    var body = S.mode === 'complete' ? renderCompleteSection() : renderCreateSection();
    pane.innerHTML =
      '<div class="pia-root">' +
        '<header class="pia-head">' +
          '<h2 class="pia-title">' +
            (window.iconLabel ? window.iconLabel('file-text', 'Portage IA') : 'Portage IA') +
          '</h2>' +
          '<p class="anki-mut pia-lead">Génère des fiches Rapide Y- avec une IA : kit complet (LaTeX inclus), puis import JSON validé. Hors Partage cloud.</p>' +
          '<div class="pia-mode-tabs" role="tablist">' +
            '<button type="button" class="pia-mode-btn' + (S.mode === 'create' ? ' on' : '') +
              '" onclick="window.QuickPortage.setMode(\'create\')">Créer</button>' +
            '<button type="button" class="pia-mode-btn' + (S.mode === 'complete' ? ' on' : '') +
              '" onclick="window.QuickPortage.setMode(\'complete\')">Compléter</button>' +
          '</div>' +
        '</header>' +
        '<div class="pia-body">' + body + '</div>' +
      '</div>';
    if (window.hydrateIcons) window.hydrateIcons(pane);
  }

  function refreshImportPreview() {
    var ta = document.getElementById('qkPortagePaste');
    if (ta) S.importRaw = ta.value;
    var box = document.getElementById('qkPortagePreview');
    if (box) {
      box.innerHTML = renderImportPreviewHtml();
      if (window.hydrateIcons) window.hydrateIcons(box);
    } else {
      paintPane();
    }
  }

  window.renderPortageIa = function () {
    paintPane();
  };

  window.QuickPortage = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    serializeGroup: serializeGroup,
    parseAndValidate: parseAndValidate,
    buildKitText: buildKitText,
    applyPortage: applyPortage,

    setMode: function (m) {
      S.mode = m === 'complete' ? 'complete' : 'create';
      S.validated = null;
      if (S.mode === 'complete') S.target = 'existing';
      else S.target = 'new';
      paintPane();
    },
    onCompleteGroupChange: function (id) {
      S.completeGroupId = String(id || '');
      paintPane();
    },
    showKitPreview: function (hint) {
      var el = document.getElementById('piaKitPreview');
      if (!el) return;
      var opts = { modeHint: hint || (S.mode === 'complete' ? 'delta' : 'full') };
      if (S.mode === 'complete' && S.completeGroupId) {
        opts.includeExport = true;
        try { opts.exportObj = serializeGroup(S.completeGroupId); } catch (e) { opts.exportObj = null; }
      }
      el.classList.remove('hidden');
      el.innerHTML = '<pre class="qk-portage-pre qk-portage-pre--kit">' + esc(buildKitText(opts)) + '</pre>';
    },
    copyKitCreate: function () {
      copyText(buildKitText({ modeHint: 'full' })).then(function () {
        toast('Kit IA (créer) copié.', 'ok');
      }).catch(function () { toast('Copie impossible.', 'error'); });
    },
    copyKitComplete: function () {
      if (!S.completeGroupId) {
        toast('Choisis un dossier.', 'warn');
        return;
      }
      var exportObj = null;
      try { exportObj = serializeGroup(S.completeGroupId); } catch (e) {
        toast(e.message || 'Export impossible', 'error');
        return;
      }
      copyText(buildKitText({
        modeHint: 'delta',
        includeExport: true,
        exportObj: exportObj
      })).then(function () {
        toast('Kit IA + dossier copiés.', 'ok');
      }).catch(function () { toast('Copie impossible.', 'error'); });
    },
    copyExport: function (groupId) {
      try {
        var pretty = JSON.stringify(serializeGroup(groupId), null, 2);
        copyText(pretty).then(function () {
          toast('JSON dossier copié.', 'ok');
        }).catch(function () {
          toast('Copie impossible.', 'error');
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
    validatePaste: function () {
      var ta = document.getElementById('qkPortagePaste');
      S.importRaw = ta ? ta.value : '';
      S.validated = parseAndValidate(S.importRaw);
      if (S.mode === 'complete') S.target = 'existing';
      else S.target = 'new';
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
        if (S.mode === 'complete') S.target = 'existing';
        refreshImportPreview();
        var ta = document.getElementById('qkPortagePaste');
        if (ta) ta.value = S.importRaw;
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
      var opts = { target: S.mode === 'complete' ? 'existing' : S.target };
      if (opts.target === 'new') {
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
        opts.groupId = gEl ? gEl.value : (S.completeGroupId || '');
        if (!opts.groupId) { toast('Choisis un dossier.', 'error'); return; }
      }
      S.importBusy = true;
      applyPortage(S.validated, opts).then(function (res) {
        toast(res.count + ' carte(s) importée(s).', 'ok');
        S.importRaw = '';
        S.validated = null;
        if (res.groupId) S.completeGroupId = res.groupId;
        paintPane();
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

  window.quickDefaultGroupColor = window.quickDefaultGroupColor || function (matId) {
    var colors = ['#6a9cff', '#50d890', '#f0c060', '#ff7a90', '#c084fc', '#2dd4bf'];
    var n = allGroups().filter(function (g) { return g.mat === matId; }).length;
    return colors[n % colors.length];
  };
})();
