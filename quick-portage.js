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
      '',
      '## Espaces & texte dans les formules (OBLIGATOIRE)',
      'En mode math ($...$ / $$...$$), les espaces ordinaires sont IGNORÉS : "Q et W" devient "QetW".',
      'Toute phrase / mot / unité dans une formule DOIT aller dans \\\\text{...} (espaces gardés à l’intérieur).',
      '',
      'Comment mettre des espaces :',
      '- Texte / légende / parenthèse en français : \\\\text{Q et W algébriques, reçus par le système}',
      '- Petit espace math : \\\\,   (ex. $f\\\\,(x)$)',
      '- Espace forcé en math : backslash + espace  →  \\\\  (entre symboles)',
      '- Espace large : \\\\quad  /  \\\\qquad',
      '- Ne JAMAIS coller des mots hors \\\\text{} : interdit « QetWalgébriques ».',
      '',
      'Exemples (dans le JSON, chaque \\\\ est doublé) :',
      '- MAUVAIS : "$\\\\Delta U = Q + W (Q et W algébriques)$" → rendu : QetWalgébriques',
      '- BON : "$\\\\Delta U = Q + W\\\\ (\\\\text{Q et W algébriques, reçus par le système})$"',
      '- BON : "$\\\\Delta U = Q + W$ (Q et W algébriques)" ← texte HORS des $...$ si ce n’est pas de la math',
      '- BON unités : "$v = 3\\\\,\\\\text{m}\\\\cdot\\\\text{s}^{-1}$"',
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
    var allowReplace = !!opts.allowReplace;
    var modeHint = opts.modeHint === 'patch' ? 'patch'
      : (opts.modeHint === 'delta' ? 'delta'
        : (opts.modeHint === 'full' ? 'full' : null));
    if (modeHint === 'delta' && allowReplace) modeHint = 'patch';
    var parts = [];
    parts.push('# Kit Portage IA — Mes Cours (fiches Rapide Y-)');
    parts.push('');
    parts.push('Tu es une IA qui génère des fiches Anki Rapide pour Mes Cours PC*.');
    parts.push('Réponds UNIQUEMENT avec un objet JSON valide (pas de prose autour, ou un seul bloc ```json).');
    parts.push('');
    parts.push('## Schéma');
    if (modeHint === 'patch') {
      parts.push(JSON.stringify({
        format: FORMAT,
        version: VERSION,
        kind: KIND,
        mode: 'patch',
        summary: 'Phrase claire listant ajouts / modifications / suppressions',
        changes: {
          add: [{ q: 'nouvelle question', r: 'nouvelle réponse' }],
          update: [{ id: 'Y-…', q: 'question corrigée', r: 'réponse corrigée' }],
          remove: ['Y-…']
        }
      }, null, 2));
    } else {
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
    }
    parts.push('');
    parts.push('## Règles critiques');
    parts.push('- format="' + FORMAT + '", version=' + VERSION + ', kind="' + KIND + '".');
    parts.push('- mode "full" : lot complet pour CRÉER un nouveau dossier (jamais pour un dossier existant).');
    parts.push('- mode "delta" : UNIQUEMENT les NOUVELLES cartes (ajouts). Ne recopié JAMAIS les cartes déjà fournies.');
    parts.push('- mode "patch" : ajouts + modifications + suppressions via changes.add / update / remove.');
    if (modeHint === 'patch') {
      parts.push('- MODE IMPOSÉ : "patch" — l’utilisateur a AUTORISÉ remplacement/suppression.');
      parts.push('- summary OBLIGATOIRE (texte humain) dès qu’il y a update ou remove : dis clairement ce qui change.');
      parts.push('- update/remove : utilise UNIQUEMENT les "id" du JSON dossier ci-dessous. Ne invente pas d’id.');
      parts.push('- Ne touche que le nécessaire : pas de réécriture massive inutile.');
      parts.push('- INTERDIT : mode "full" pour « tout remplacer » un dossier existant.');
    } else if (modeHint === 'delta') {
      parts.push('- MODE IMPOSÉ : "delta" — NOUVELLES cartes seulement.');
      parts.push('- INTERDIT : modifier, supprimer, ou renvoyer mode "patch" / "full".');
    } else if (modeHint === 'full') {
      parts.push('- MODE IMPOSÉ : "full" — lot initial complet.');
      parts.push('- Chaque carte : "q" et "r" non vides (chaînes JSON).');
    } else {
      parts.push('- Chaque carte : "q" et "r" non vides (chaînes JSON).');
    }
    parts.push('- Guillemets / retours ligne / formules : JSON valide (\\" et \\n). Les ":" dans le texte sont OK.');
    parts.push('- Pas de HTML. Pas de SRS (ease, dates…).');
    parts.push('- ESPACES : en $...$, les espaces disparaissent. Mets le français dans \\text{...}, ou hors des $. Voir section Espaces.');
    parts.push('');
    parts.push(latexCatalogText());
    parts.push('');
    if (modeHint !== 'patch') {
      parts.push('## Exemple full (créer)');
      parts.push(JSON.stringify({
        format: FORMAT,
        version: VERSION,
        kind: KIND,
        mode: 'full',
        title: 'Thermo / Anglais',
        matiere: 'Physique',
        bidirectional: false,
        cards: [
          { q: 'although', r: 'bien que / quoique' },
          {
            q: 'Premier principe, système fermé',
            r: '$\\Delta U = Q + W$ (Q et W algébriques, reçus par le système)'
          },
          {
            q: 'Même formule, légende dans la math',
            r: '$\\Delta U = Q + W\\ (\\text{Q et W algébriques, reçus par le système})$'
          }
        ]
      }, null, 2));
      parts.push('');
      parts.push('## Exemple delta (compléter — ajouts seuls)');
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
    } else {
      parts.push('## Exemple patch (compléter avec remplacement)');
      parts.push(JSON.stringify({
        format: FORMAT,
        version: VERSION,
        kind: KIND,
        mode: 'patch',
        summary: 'Corrigé la formule ΔU ; supprimé un doublon ; ajouté 1 carte.',
        changes: {
          add: [{ q: 'Nouvelle notion', r: 'Définition courte' }],
          update: [{ id: 'Y-ABC12', q: 'Premier principe', r: '$\\Delta U = Q + W$ (Q et W algébriques)' }],
          remove: ['Y-OLD99']
        }
      }, null, 2));
    }
    if (opts.includeExport && opts.exportObj) {
      parts.push('');
      parts.push('## Dossier actuel (contexte — ids stables pour update/remove)');
      parts.push(JSON.stringify(opts.exportObj, null, 2));
      parts.push('');
      if (modeHint === 'patch') {
        parts.push('→ Réponds en mode "patch" avec changes + summary. Utilise les id ci-dessus.');
      } else {
        parts.push('→ Réponds en mode "delta" avec SEULEMENT les nouvelles cartes (pas de suppressions).');
      }
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
        id: String(c.id || ''),
        q: String(c.question || c.titre || '').trim(),
        r: String(c.reponse || '').trim()
      };
    }).filter(function (c) { return c.id && c.q && c.r; });
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

  function cardQR(c) {
    if (!c || typeof c !== 'object') return { q: '', r: '' };
    return {
      q: String(c.q != null ? c.q : (c.question != null ? c.question : '')).trim(),
      r: String(c.r != null ? c.r : (c.reponse != null ? c.reponse : '')).trim()
    };
  }

  /**
   * @param {object} obj
   * @param {{ allowReplace?:boolean, groupId?:string, uiMode?:string }} ctx
   *   uiMode: 'create' | 'complete'
   */
  function validatePortage(obj, ctx) {
    ctx = ctx || {};
    var allowReplace = !!ctx.allowReplace;
    var targetGroupId = String(ctx.groupId || '').trim();
    var uiMode = ctx.uiMode === 'complete' ? 'complete' : 'create';
    var errors = [];
    var cards = [];
    var empty = function () {
      return { ok: false, errors: errors, cards: [], meta: null };
    };
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      errors.push('Racine JSON doit être un objet.');
      return empty();
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
    if (mode !== 'full' && mode !== 'delta' && mode !== 'patch') {
      errors.push('mode doit être "full", "delta" ou "patch" (reçu : ' + JSON.stringify(obj.mode) + ').');
    }

    /* Consentement UI */
    if (uiMode === 'complete' && mode === 'full') {
      errors.push('mode "full" interdit en Compléter (crée un nouveau dossier via Créer).');
    }
    if (mode === 'patch') {
      if (uiMode !== 'complete') {
        errors.push('mode "patch" réservé à Compléter.');
      }
      if (!allowReplace) {
        errors.push('mode "patch" refusé — active « Autoriser remplacement et suppression » avant de vérifier.');
      }
    }
    /* Refuse update/remove cachés dans un payload delta/full si consentement OFF */
    if (!allowReplace && obj.changes && typeof obj.changes === 'object' && !Array.isArray(obj.changes)) {
      var sneakyUpd = Array.isArray(obj.changes.update) ? obj.changes.update : [];
      var sneakyRem = Array.isArray(obj.changes.remove) ? obj.changes.remove : [];
      if (sneakyUpd.length || sneakyRem.length) {
        errors.push('update/remove présents alors que le remplacement est désactivé.');
      }
    }

    var title = String(obj.title || '').trim();
    var matiere = String(obj.matiere || obj.matiereId || '').trim();
    var meta = {
      mode: mode,
      title: title,
      matiere: matiere,
      matiereId: resolveMatId(obj.matiereId || matiere),
      bidirectional: !!obj.bidirectional,
      summary: '',
      changes: null,
      destructive: false,
      raw: obj
    };

    if (mode === 'patch') {
      var ch = obj.changes;
      if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
        errors.push('changes doit être un objet { add, update, remove }.');
        return { ok: false, errors: errors, cards: [], meta: meta };
      }
      var addRaw = Array.isArray(ch.add) ? ch.add : [];
      var updRaw = Array.isArray(ch.update) ? ch.update : [];
      var remRaw = Array.isArray(ch.remove) ? ch.remove : [];
      if (!allowReplace && (updRaw.length || remRaw.length)) {
        errors.push('Modifications/suppressions refusées — active « Autoriser remplacement et suppression ».');
      }
      if (!targetGroupId) {
        errors.push('Dossier cible requis pour un patch.');
      }
      var byId = Object.create(null);
      if (targetGroupId) {
        cardsInGroup(targetGroupId).forEach(function (c) {
          if (c && c.id) byId[String(c.id)] = c;
        });
      }
      var add = [];
      addRaw.forEach(function (c, idx) {
        var n = idx + 1;
        var qr = cardQR(c);
        if (!qr.q) errors.push('changes.add #' + n + ' : "q" vide.');
        if (!qr.r) errors.push('changes.add #' + n + ' : "r" vide.');
        if (qr.q && qr.r) add.push(qr);
      });
      var update = [];
      var seenUpd = Object.create(null);
      updRaw.forEach(function (c, idx) {
        var n = idx + 1;
        if (!c || typeof c !== 'object') {
          errors.push('changes.update #' + n + ' : objet invalide.');
          return;
        }
        var id = String(c.id || '').trim();
        var qr = cardQR(c);
        if (!id) errors.push('changes.update #' + n + ' : "id" manquant.');
        if (id && seenUpd[id]) errors.push('changes.update : id en double « ' + id + ' ».');
        if (id) seenUpd[id] = true;
        if (!qr.q) errors.push('changes.update #' + n + ' : "q" vide.');
        if (!qr.r) errors.push('changes.update #' + n + ' : "r" vide.');
        if (id && !byId[id]) {
          errors.push('changes.update #' + n + ' : id « ' + id + ' » absent du dossier cible.');
        }
        if (id && byId[id] && qr.q && qr.r) {
          update.push({
            id: id,
            q: qr.q,
            r: qr.r,
            prevQ: String(byId[id].question || byId[id].titre || '').trim(),
            prevR: String(byId[id].reponse || '').trim()
          });
        }
      });
      var remove = [];
      var seenRem = Object.create(null);
      remRaw.forEach(function (rawId, idx) {
        var n = idx + 1;
        var id = '';
        if (rawId != null && typeof rawId === 'object' && !Array.isArray(rawId)) {
          id = String(rawId.id || '').trim();
        } else {
          id = String(rawId == null ? '' : rawId).trim();
        }
        if (!id) {
          errors.push('changes.remove #' + n + ' : id vide.');
          return;
        }
        if (seenRem[id]) {
          errors.push('changes.remove : id en double « ' + id + ' ».');
          return;
        }
        seenRem[id] = true;
        if (!byId[id]) {
          errors.push('changes.remove #' + n + ' : id « ' + id + ' » absent du dossier cible.');
          return;
        }
        if (seenUpd[id]) {
          errors.push('id « ' + id + ' » à la fois dans update et remove — ambigu.');
          return;
        }
        remove.push({
          id: id,
          q: String(byId[id].question || byId[id].titre || '').trim(),
          r: String(byId[id].reponse || '').trim()
        });
      });
      var summary = String(obj.summary || '').trim();
      if ((update.length || remove.length) && !summary) {
        errors.push('summary obligatoire dès qu’il y a une modification ou une suppression.');
      }
      if (!add.length && !update.length && !remove.length) {
        errors.push('changes vide — au moins un add, update ou remove.');
      }
      meta.summary = summary;
      meta.changes = { add: add, update: update, remove: remove };
      meta.destructive = !!(update.length || remove.length);
      cards = add.slice();
      return {
        ok: errors.length === 0 && (add.length + update.length + remove.length) > 0,
        errors: errors,
        cards: cards,
        meta: meta
      };
    }

    /* full / delta */
    if (!Array.isArray(obj.cards)) {
      errors.push('cards doit être un tableau.');
    } else if (!obj.cards.length) {
      errors.push('cards est vide — au moins une carte requise.');
    } else {
      obj.cards.forEach(function (c, idx) {
        var n = idx + 1;
        var qr = cardQR(c);
        if (!c || typeof c !== 'object') {
          errors.push('Carte #' + n + ' : objet invalide.');
          return;
        }
        if (!qr.q) errors.push('Carte #' + n + ' : "q" vide.');
        if (!qr.r) errors.push('Carte #' + n + ' : "r" vide.');
        if (qr.q && qr.r) cards.push(qr);
      });
    }
    return { ok: errors.length === 0 && cards.length > 0, errors: errors, cards: cards, meta: meta };
  }

  function parseAndValidate(raw, ctx) {
    try {
      var obj = extractJsonPayload(raw);
      return validatePortage(obj, ctx);
    } catch (e) {
      return {
        ok: false,
        errors: [e && e.message ? e.message : String(e)],
        cards: [],
        meta: null
      };
    }
  }

  function validateContextFromUI() {
    return {
      allowReplace: !!S.allowReplace,
      groupId: S.mode === 'complete'
        ? (S.completeGroupId || '')
        : (S.target === 'existing' ? (S.completeGroupId || '') : ''),
      uiMode: S.mode === 'complete' ? 'complete' : 'create'
    };
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

  function isHardSaveFailure(err) {
    var msg = String(err && err.message || err || '');
    return /SECONDARY_READ_ONLY|localStorage save failed|Sauvegarde refusée|corrompues|anti-wipe|SAVE_DISABLED|NO_DATA/i.test(msg);
  }

  /**
   * Applique un Portage validé.
   * opts.target: 'new' | 'existing'
   * opts.groupId (si existing)
   * opts.newTitle, opts.matId, opts.bidirectional (si new)
   * opts.allowReplace (requis pour patch)
   */
  function applyPortage(validated, opts) {
    opts = opts || {};
    if (!validated || !validated.ok) return Promise.reject(new Error('Portage invalide'));
    if (!window.D) return Promise.reject(new Error('NO_DATA'));
    if (!canMutate()) return Promise.reject(new Error('SECONDARY_READ_ONLY'));
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.quickGroups)) window.D.quickGroups = [];

    var mode = validated.meta && validated.meta.mode;
    if (mode === 'full' && opts.target === 'existing') {
      return Promise.reject(new Error('mode "full" interdit sur un dossier existant'));
    }
    if (mode === 'patch') {
      return applyPortagePatch(validated, opts);
    }

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

    try {
      built = buildCardObjects(validated.cards, matId, groupId);
    } catch (buildErr) {
      return Promise.reject(buildErr);
    }

    if (createdGroup) window.D.quickGroups.push(createdGroup);
    for (var i = built.length - 1; i >= 0; i--) {
      window.D.exercices.unshift(built[i]);
    }

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
        added: built.length,
        updated: 0,
        removed: 0,
        cards: built
      };
    }).catch(function (err) {
      var ids = new Set(built.map(function (c) { return c.id; }));
      built.forEach(function (c) {
        if (window._pendingExoIds) window._pendingExoIds.delete(c.id);
      });
      if (isHardSaveFailure(err)) {
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

  function applyPortagePatch(validated, opts) {
    opts = opts || {};
    if (!opts.allowReplace) {
      return Promise.reject(new Error('Remplacement non autorisé (consentement manquant)'));
    }
    if (opts.target !== 'existing') {
      return Promise.reject(new Error('patch réservé à un dossier existant'));
    }
    var groupId = String(opts.groupId || '').trim();
    var g = allGroups().find(function (x) { return x.id === groupId; });
    if (!g) return Promise.reject(new Error('Dossier cible introuvable'));
    var matId = g.mat || resolveMatId(validated.meta.matiere) || (allMats()[0] && allMats()[0].id) || 'XX';
    var changes = validated.meta && validated.meta.changes;
    if (!changes) return Promise.reject(new Error('changes manquant'));

    var built = [];
    try {
      if (changes.add && changes.add.length) {
        built = buildCardObjects(changes.add, matId, groupId);
      }
    } catch (buildErr) {
      return Promise.reject(buildErr);
    }

    var removeIds = {};
    (changes.remove || []).forEach(function (r) { removeIds[r.id] = true; });
    var removedCards = [];
    var updateSnaps = [];

    /* Snapshot + mutation mémoire */
    window.D.exercices = (window.D.exercices || []).filter(function (c) {
      if (c && removeIds[c.id] && c.groupId === groupId) {
        removedCards.push(c);
        return false;
      }
      return true;
    });
    (changes.update || []).forEach(function (u) {
      var c = (window.D.exercices || []).find(function (x) {
        return x && x.id === u.id && x.groupId === groupId;
      });
      if (!c) return;
      updateSnaps.push({ card: c, q: c.question, r: c.reponse });
      c.question = u.q;
      c.reponse = u.r;
    });
    for (var i = built.length - 1; i >= 0; i--) {
      window.D.exercices.unshift(built[i]);
    }

    if (typeof window.quickMarkGroupLocalDirty === 'function') {
      window.quickMarkGroupLocalDirty(groupId, { persist: false });
    }

    return Promise.resolve(window.save({ waitCloud: false })).then(function () {
      built.forEach(function (c) {
        if (window._pendingExoIds) window._pendingExoIds.delete(c.id);
      });
      return {
        groupId: groupId,
        createdGroup: null,
        count: built.length + (changes.update || []).length,
        added: built.length,
        updated: (changes.update || []).length,
        removed: removedCards.length,
        cards: built
      };
    }).catch(function (err) {
      built.forEach(function (c) {
        if (window._pendingExoIds) window._pendingExoIds.delete(c.id);
      });
      if (isHardSaveFailure(err)) {
        var addIds = new Set(built.map(function (c) { return c.id; }));
        window.D.exercices = (window.D.exercices || []).filter(function (c) {
          return !(c && addIds.has(c.id));
        });
        updateSnaps.forEach(function (s) {
          s.card.question = s.q;
          s.card.reponse = s.r;
        });
        for (var j = removedCards.length - 1; j >= 0; j--) {
          window.D.exercices.unshift(removedCards[j]);
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
    importBusy: false,
    /** Consentement Compléter : false = ajouts seuls (défaut). */
    allowReplace: false
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

  function renderDiffList(items, kind) {
    if (!items || !items.length) return '';
    var cls = kind === 'add' ? 'pia-diff-add' : (kind === 'upd' ? 'pia-diff-upd' : 'pia-diff-del');
    var title = kind === 'add' ? 'Ajouts' : (kind === 'upd' ? 'Modifications' : 'Suppressions');
    var rows = items.slice(0, 20).map(function (it) {
      if (kind === 'upd') {
        return '<li><code>' + esc(it.id) + '</code><br>' +
          '<span class="pia-diff-old">' + esc((it.prevQ || '').slice(0, 60)) + ' → ' + esc((it.prevR || '').slice(0, 60)) + '</span><br>' +
          '<span class="pia-diff-new">' + esc((it.q || '').slice(0, 60)) + ' → ' + esc((it.r || '').slice(0, 60)) + '</span></li>';
      }
      return '<li>' +
        (it.id ? '<code>' + esc(it.id) + '</code> · ' : '') +
        '<span class="qk-portage-q">' + esc((it.q || '').slice(0, 80)) + '</span> → ' +
        '<span class="qk-portage-r">' + esc((it.r || '').slice(0, 80)) + '</span></li>';
    }).join('');
    if (items.length > 20) {
      rows += '<li class="anki-mut">… +' + (items.length - 20) + '</li>';
    }
    return '<div class="pia-diff ' + cls + '"><b>' + title + ' (' + items.length + ')</b>' +
      '<ol class="qk-portage-preview-list">' + rows + '</ol></div>';
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

    var body = '';
    var btnLabel = '';
    if (v.meta.mode === 'patch' && v.meta.changes) {
      var ch = v.meta.changes;
      if (v.meta.summary) {
        body += '<div class="pia-diff-summary"><b>Résumé IA</b><p>' + esc(v.meta.summary) + '</p></div>';
      }
      body += renderDiffList(ch.add, 'add');
      body += renderDiffList(ch.update, 'upd');
      body += renderDiffList(ch.remove, 'del');
      var nAdd = (ch.add || []).length;
      var nUpd = (ch.update || []).length;
      var nDel = (ch.remove || []).length;
      body = '<div class="qk-portage-ok"><b>Patch</b> · +' + nAdd + ' · ✎' + nUpd + ' · −' + nDel + '</div>' + body;
      btnLabel = v.meta.destructive
        ? ('Appliquer les changements (+' + nAdd + ' / ✎' + nUpd + ' / −' + nDel + ')')
        : ('Importer ' + nAdd + ' carte(s)');
    } else {
      body =
        '<div class="qk-portage-ok"><b>' + v.cards.length + ' carte(s)</b> · mode <code>' +
          esc(v.meta.mode) + '</code>' +
          (v.meta.title ? ' · « ' + esc(v.meta.title) + ' »' : '') + '</div>' +
        '<ol class="qk-portage-preview-list">' +
        v.cards.slice(0, 12).map(function (c) {
          return '<li><span class="qk-portage-q">' + esc(c.q.slice(0, 80)) +
            '</span> → <span class="qk-portage-r">' + esc(c.r.slice(0, 80)) + '</span></li>';
        }).join('') +
        (v.cards.length > 12 ? '<li class="anki-mut">… +' + (v.cards.length - 12) + '</li>' : '') +
        '</ol>';
      btnLabel = 'Importer ' + v.cards.length + ' carte(s)';
    }

    return body +
      '<div class="qk-portage-target">' + destHtml +
        '<button type="button" class="bp" onclick="window.QuickPortage.confirmImport()">' +
          esc(btnLabel) + '</button>' +
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
          '</div>';
      } catch (e) {
        exportBlock = '<p class="anki-mut">' + esc(e.message) + '</p>';
      }
    } else {
      exportBlock = '<p class="anki-mut">Choisis un dossier Rapide Y- ci-dessus.</p>';
    }
    var kitHint = S.allowReplace
      ? 'L’IA peut <b>ajouter, modifier et supprimer</b> (<code>mode: patch</code>). Elle doit remplir <code>summary</code> + <code>changes</code>.'
      : 'L’IA ne renvoie que les <b>nouvelles</b> cartes (<code>mode: delta</code>). Aucune suppression.';
    var pastePh = S.allowReplace
      ? '{ "mode": "patch", "summary": "...", "changes": { ... } }'
      : '{ "mode": "delta", "cards": [...] }';
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
        '<h3 class="pia-h3">2 · Consentement & kit IA</h3>' +
        '<p class="anki-mut pia-lead">Choisis <b>avant</b> de copier le kit — ça change le message envoyé à l’IA.</p>' +
        '<div class="pia-consent" role="radiogroup" aria-label="Autorisation remplacement">' +
          '<label class="qk-portage-radio pia-consent-opt">' +
            '<input type="radio" name="piaAllowReplace" value="0"' +
              (!S.allowReplace ? ' checked' : '') +
              ' onchange="window.QuickPortage.setAllowReplace(false)">' +
            '<span><b>Ajouter seulement</b> — pas de modification ni suppression</span></label>' +
          '<label class="qk-portage-radio pia-consent-opt">' +
            '<input type="radio" name="piaAllowReplace" value="1"' +
              (S.allowReplace ? ' checked' : '') +
              ' onchange="window.QuickPortage.setAllowReplace(true)">' +
            '<span><b>Autoriser remplacement et suppression</b> — l’IA pourra patcher le dossier</span></label>' +
        '</div>' +
        '<p class="anki-mut pia-lead" style="margin-top:10px;">' + kitHint + '</p>' +
        '<div class="qk-portage-actions">' +
          '<button type="button" class="bp" onclick="window.QuickPortage.copyKitComplete()" ' +
            (gid ? '' : 'disabled') + '>Copier kit IA + dossier</button>' +
          '<button type="button" class="bs" onclick="window.QuickPortage.showKitPreview()" ' +
            (gid ? '' : 'disabled') + '>Aperçu kit</button>' +
        '</div>' +
        '<div id="piaKitPreview" class="hidden"></div>' +
      '</section>' +
      '<section class="pia-section">' +
        '<h3 class="pia-h3">3 · Importer la réponse</h3>' +
        '<textarea id="qkPortagePaste" class="fi qk-portage-ta" rows="8" placeholder=\'' + pastePh + '\'>' +
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
      else {
        S.target = 'new';
        S.allowReplace = false;
      }
      paintPane();
    },
    setAllowReplace: function (on) {
      S.allowReplace = !!on;
      S.validated = null;
      paintPane();
    },
    onCompleteGroupChange: function (id) {
      S.completeGroupId = String(id || '');
      S.validated = null;
      paintPane();
    },
    showKitPreview: function (hint) {
      var el = document.getElementById('piaKitPreview');
      if (!el) return;
      var opts = S.mode === 'complete'
        ? completeKitOpts(hint)
        : { modeHint: hint || 'full' };
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
      var opts = completeKitOpts();
      if (!opts.exportObj) {
        toast('Export dossier impossible.', 'error');
        return;
      }
      copyText(buildKitText(opts)).then(function () {
        toast(S.allowReplace ? 'Kit IA patch + dossier copiés.' : 'Kit IA delta + dossier copiés.', 'ok');
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
      if (S.mode === 'complete') S.target = 'existing';
      else S.target = 'new';
      var ctx = validateContextFromUI();
      if (S.mode === 'complete') ctx.groupId = S.completeGroupId || '';
      S.validated = parseAndValidate(S.importRaw, ctx);
      refreshImportPreview();
      if (S.validated.ok) {
        var m = S.validated.meta;
        if (m.mode === 'patch' && m.changes) {
          toast('Patch OK · +' + m.changes.add.length + ' / ✎' + m.changes.update.length +
            ' / −' + m.changes.remove.length, 'ok');
        } else {
          toast(S.validated.cards.length + ' carte(s) OK.', 'ok');
        }
      } else {
        toast('Portage invalide — vois les erreurs.', 'error');
      }
    },
    onFile: function (ev) {
      var f = ev && ev.target && ev.target.files && ev.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        S.importRaw = String(reader.result || '');
        if (S.mode === 'complete') S.target = 'existing';
        var ctx = validateContextFromUI();
        if (S.mode === 'complete') ctx.groupId = S.completeGroupId || '';
        S.validated = parseAndValidate(S.importRaw, ctx);
        refreshImportPreview();
        var ta = document.getElementById('qkPortagePaste');
        if (ta) ta.value = S.importRaw;
        if (S.validated.ok) toast('Fichier OK.', 'ok');
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
      if (!canMutate()) return;
      if (typeof window.save !== 'function') {
        toast('Sauvegarde indisponible — réessaie.', 'error');
        return;
      }

      /* Re-check consentement + dossier au moment de l’apply */
      var opts = {
        target: S.mode === 'complete' ? 'existing' : S.target,
        allowReplace: !!S.allowReplace
      };
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
        S.completeGroupId = opts.groupId;
      }

      var ta = document.getElementById('qkPortagePaste');
      if (ta) S.importRaw = ta.value;
      var ctx = {
        allowReplace: !!S.allowReplace,
        groupId: opts.target === 'existing' ? opts.groupId : '',
        uiMode: S.mode === 'complete' ? 'complete' : 'create'
      };
      S.validated = parseAndValidate(S.importRaw, ctx);
      refreshImportPreview();
      if (!S.validated || !S.validated.ok) {
        toast('Portage invalide — vois les erreurs.', 'error');
        return;
      }
      if (S.validated.meta.mode === 'full' && opts.target === 'existing') {
        toast('mode "full" interdit sur un dossier existant.', 'error');
        return;
      }
      if (S.validated.meta.mode === 'patch' && !S.allowReplace) {
        toast('Remplacement non autorisé — bascule le consentement.', 'error');
        return;
      }

      var run = function () {
        if (S.importBusy) return;
        S.importBusy = true;
        applyPortage(S.validated, opts).then(function (res) {
          var msg;
          if (res.updated || res.removed) {
            msg = 'Patch appliqué · +' + (res.added || 0) + ' · ✎' + (res.updated || 0) +
              ' · −' + (res.removed || 0);
          } else {
            msg = (res.added || res.count || 0) + ' carte(s) importée(s).';
          }
          toast(msg, 'ok');
          S.importRaw = '';
          S.validated = null;
          if (res.groupId) S.completeGroupId = res.groupId;
          paintPane();
          if (typeof window.renderFlashcards === 'function') {
            try { window.renderFlashcards(); } catch (e2) { /* ignore */ }
          }
        }).catch(function (err) {
          var em = String(err && err.message || err || '');
          if (/SECONDARY_READ_ONLY/i.test(em)) return;
          toast('Import échoué : ' + em, 'error');
        }).finally(function () { S.importBusy = false; });
      };

      if (S.validated.meta.destructive) {
        var nUpd = (S.validated.meta.changes.update || []).length;
        var nDel = (S.validated.meta.changes.remove || []).length;
        var confMsg = 'Cela va modifier ' + nUpd + ' carte(s) et supprimer ' + nDel +
          '. Cette action est définitive. Continuer ?';
        if (typeof window.sysConfirm === 'function') {
          window.sysConfirm(confMsg, run, 'Portage IA');
        } else if (window.confirm(confMsg)) {
          run();
        }
        return;
      }
      run();
    }
  };

  function completeKitOpts(hint) {
    var opts = {
      modeHint: hint || (S.allowReplace ? 'patch' : 'delta'),
      allowReplace: !!S.allowReplace,
      includeExport: true,
      exportObj: null
    };
    if (S.completeGroupId) {
      try { opts.exportObj = serializeGroup(S.completeGroupId); } catch (e) { opts.exportObj = null; }
    }
    return opts;
  }

  window.quickDefaultGroupColor = window.quickDefaultGroupColor || function (matId) {
    var colors = ['#6a9cff', '#50d890', '#f0c060', '#ff7a90', '#c084fc', '#2dd4bf'];
    var n = allGroups().filter(function (g) { return g.mat === matId; }).length;
    return colors[n % colors.length];
  };
})();
