/**
 * programme.js — Onglet Programme : chapitres logiques (hors documents Base Doc)
 * Phase 1 : CRUD chapitres, année figée à la création, bulk depuis intercalaires.
 */
(function () {
  'use strict';

  var WIZ = {
    mode: 'single',
    step: 'entry',
    mat: null,
    cl: null,
    inter: null,
    annee: 1,
    selectedInters: []
  };

  var _filterMat = '';
  var _filterAnnee = '';
  var _reorderMode = false;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
  }

  function jsStr(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  function iconLabel(name, text) {
    return window.iconLabel ? window.iconLabel(name, text) : esc(text);
  }

  function todayISO() {
    if (typeof window.localDateISO === 'function') return window.localDateISO();
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function matObj(id) {
    return (window.D && window.D.matieres || []).find(function (m) { return m.id === id; })
      || { color: '#666', label: id || '?', name: id || '?' };
  }

  function clObj(id) {
    return (window.D && window.D.classeurs || []).find(function (c) { return c.id === id; })
      || { name: id || '?', interNames: {} };
  }

  window.ensureChapitresArray = function () {
    if (!window.D) return false;
    if (!Array.isArray(window.D.chapitres)) {
      window.D.chapitres = [];
      return true;
    }
    return false;
  };

  window.getClasseurDefaultAnnee = function (clId) {
    var cl = clObj(clId);
    var a = cl && cl.defaultAnnee != null ? parseInt(cl.defaultAnnee, 10) : 1;
    return a === 2 ? 2 : 1;
  };

  window.normalizeAnnee = function (v) {
    var n = parseInt(v, 10);
    return n === 2 ? 2 : 1;
  };

  window.formatChapitreLabel = function (ch, html) {
    var title = ch && ch.title ? String(ch.title) : '';
    if (html) {
      return '<span class="chap-prefix">Chap.</span> ' + esc(title);
    }
    return 'Chap. ' + title;
  };

  /** Même format que les documents Base Doc : PH-A1B, MA-7Z3, CH-W2N… */
  window.generateChapitreId = function (mat) {
    window.ensureChapitresArray();
    if (typeof window.genUid === 'function') {
      return window.genUid(String(mat || ''));
    }
    var prefix = String(mat || 'XX').substring(0, 2).toUpperCase();
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (var attempt = 0; attempt < 500; attempt++) {
      var suffix = '';
      for (var i = 0; i < 3; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      var id = prefix + '-' + suffix;
      var taken = (window.D.cours || []).some(function (c) { return c.uid === id; })
        || (window.D.exercices || []).some(function (e) { return e.id === id; })
        || (window.D.devoirs || []).some(function (d) { return d.id === id; })
        || (window.D.chapitres || []).some(function (c) { return c.id === id; });
      if (!taken) return id;
    }
    return prefix + '-' + Date.now().toString(36).slice(-3).toUpperCase();
  };

  window.isChapitreIdTaken = function (id) {
    if (!id) return true;
    return (window.D.cours || []).some(function (c) { return c.uid === id; })
      || (window.D.exercices || []).some(function (e) { return e.id === id; })
      || (window.D.devoirs || []).some(function (d) { return d.id === id; })
      || (window.D.chapitres || []).some(function (c) { return c.id === id; });
  };

  function chapitreScopeKey(ch) {
    return String(ch.mat || '') + '|' + window.normalizeAnnee(ch.annee);
  }

  function chapitreFallbackCompare(a, b) {
    var ia = parseInt(a.inter, 10) || 0;
    var ib = parseInt(b.inter, 10) || 0;
    if (ia !== ib) return ia - ib;
    var t = String(a.title || '').localeCompare(String(b.title || ''), 'fr');
    if (t) return t;
    return String(a.created || '').localeCompare(String(b.created || ''));
  }

  /** Remplit order manquant par groupe matière+année (inter, titre, date). */
  window.ensureChapitreOrders = function () {
    window.ensureChapitresArray();
    var groups = {};
    (window.D.chapitres || []).forEach(function (ch) {
      var key = chapitreScopeKey(ch);
      if (!groups[key]) groups[key] = [];
      groups[key].push(ch);
    });
    Object.keys(groups).forEach(function (key) {
      var items = groups[key];
      if (!items.some(function (c) { return c.order == null; })) return;
      items.sort(chapitreFallbackCompare);
      items.forEach(function (c, i) { c.order = i; });
    });
  };

  window.nextChapitreOrder = function (mat, annee) {
    window.ensureChapitreOrders();
    var key = String(mat || '') + '|' + window.normalizeAnnee(annee);
    var max = -1;
    (window.D.chapitres || []).forEach(function (c) {
      if (chapitreScopeKey(c) !== key) return;
      if (typeof c.order === 'number' && c.order > max) max = c.order;
    });
    return max + 1;
  };

  window.moveChapitre = function (id, delta) {
    window.ensureChapitreOrders();
    var ch = (window.D.chapitres || []).find(function (c) { return c.id === id; });
    if (!ch) return { ok: false, error: 'Chapitre introuvable.' };
    delta = delta < 0 ? -1 : delta > 0 ? 1 : 0;
    if (!delta) return { ok: false, error: 'Delta invalide.' };
    var siblings = window.listChapitres({ mat: ch.mat, annee: ch.annee });
    var idx = siblings.findIndex(function (c) { return c.id === id; });
    var swapIdx = idx + delta;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) {
      return { ok: false, error: 'Limite atteinte.' };
    }
    var other = siblings[swapIdx];
    var tmp = ch.order;
    ch.order = other.order;
    other.order = tmp;
    return { ok: true, chapitre: ch };
  };

  /** Réordonne les chapitres d’un groupe matière+année selon la liste d’ids DnD. */
  window.reorderChapitresInGroup = function (mat, annee, orderedIds) {
    window.ensureChapitreOrders();
    if (!mat || !Array.isArray(orderedIds) || !orderedIds.length) {
      return { ok: false, error: 'Paramètres invalides.' };
    }
    var a = window.normalizeAnnee(annee);
    var byId = {};
    (window.D.chapitres || []).forEach(function (c) {
      if (c.mat === mat && window.normalizeAnnee(c.annee) === a) byId[c.id] = c;
    });
    var applied = 0;
    orderedIds.forEach(function (id, i) {
      var ch = byId[id];
      if (!ch) return;
      ch.order = i;
      applied++;
    });
    return { ok: applied > 0, count: applied };
  };

  window.listChapitres = function (opts) {
    window.ensureChapitresArray();
    window.ensureChapitreOrders();
    opts = opts || {};
    var list = (window.D.chapitres || []).slice();
    if (opts.mat) list = list.filter(function (c) { return c.mat === opts.mat; });
    if (opts.annee != null && opts.annee !== '') {
      var a = window.normalizeAnnee(opts.annee);
      list = list.filter(function (c) { return window.normalizeAnnee(c.annee) === a; });
    }
    list.sort(function (a, b) {
      var ma = matObj(a.mat).name.localeCompare(matObj(b.mat).name, 'fr');
      if (ma) return ma;
      if (a.annee !== b.annee) return a.annee - b.annee;
      var oa = typeof a.order === 'number' ? a.order : 0;
      var ob = typeof b.order === 'number' ? b.order : 0;
      if (oa !== ob) return oa - ob;
      return chapitreFallbackCompare(a, b);
    });
    return list;
  };

  window.listChapitresGrouped = function (opts) {
    var list = window.listChapitres(opts);
    var groups = [];
    var map = {};
    list.forEach(function (ch) {
      var key = ch.mat + '|' + ch.annee;
      if (!map[key]) {
        map[key] = {
          mat: ch.mat,
          annee: ch.annee,
          matName: matObj(ch.mat).name,
          items: []
        };
        groups.push(map[key]);
      }
      map[key].items.push(ch);
    });
    return groups;
  };

  window.getIntercalaireCandidates = function (clId) {
    var cl = clObj(clId);
    if (!cl) return [];
    var names = cl.interNames || {};
    var max = cl.maxInter || 12;
    var out = [];
    for (var i = 1; i <= max; i++) {
      var slot = String(i).padStart(2, '0');
      var label = names[slot];
      if (label && String(label).trim()) {
        out.push({ inter: slot, label: String(label).trim() });
      }
    }
    return out;
  };

  window.createChapitre = function (payload) {
    window.ensureChapitresArray();
    if (!payload || !payload.mat || !payload.title) {
      return { ok: false, error: 'Matière et titre requis.' };
    }
    var title = String(payload.title).trim();
    if (!title) return { ok: false, error: 'Titre vide.' };
    if (/^Chap\.\s/i.test(title)) title = title.replace(/^Chap\.\s/i, '').trim();
    var annee = window.normalizeAnnee(payload.annee);
    var inter = payload.inter != null ? String(payload.inter) : '';
    var id = payload.id || window.generateChapitreId(payload.mat);
    if (window.isChapitreIdTaken(id)) {
      return { ok: false, error: 'Id chapitre déjà utilisé : ' + id };
    }
    var ch = {
      id: id,
      mat: payload.mat,
      annee: annee,
      cl: payload.cl || '',
      inter: inter,
      title: title,
      order: typeof payload.order === 'number' ? payload.order : window.nextChapitreOrder(payload.mat, annee),
      created: payload.created || todayISO(),
      notes: payload.notes ? String(payload.notes) : ''
    };
    window.D.chapitres.push(ch);
    return { ok: true, chapitre: ch };
  };

  window.updateChapitre = function (id, patch) {
    window.ensureChapitresArray();
    var ch = (window.D.chapitres || []).find(function (c) { return c.id === id; });
    if (!ch) return { ok: false, error: 'Chapitre introuvable.' };
    patch = patch || {};
    if (patch.title != null) {
      var t = String(patch.title).trim();
      if (!t) return { ok: false, error: 'Titre vide.' };
      if (/^Chap\.\s/i.test(t)) t = t.replace(/^Chap\.\s/i, '').trim();
      ch.title = t;
    }
    if (patch.notes != null) ch.notes = String(patch.notes);
    if (patch.annee != null || patch.cl != null || patch.inter != null || patch.mat != null) {
      return { ok: false, error: 'Année, matière, classeur et inter ne sont modifiables qu’à la création.' };
    }
    return { ok: true, chapitre: ch };
  };

  window.deleteChapitre = function (id) {
    window.ensureChapitresArray();
    var before = window.D.chapitres.length;
    window.D.chapitres = window.D.chapitres.filter(function (c) { return c.id !== id; });
    return { ok: window.D.chapitres.length < before };
  };

  window.bulkCreateChapitresFromIntercalaires = function (opts) {
    opts = opts || {};
    var mat = opts.mat;
    var cl = opts.cl;
    var annee = window.normalizeAnnee(opts.annee);
    var inters = opts.inters || [];
    if (!mat || !cl) return { ok: false, error: 'Matière et classeur requis.', created: [] };
    var candidates = window.getIntercalaireCandidates(cl);
    var byInter = {};
    candidates.forEach(function (c) { byInter[c.inter] = c.label; });
    var created = [];
    var errors = [];
    inters.forEach(function (inter) {
      var slot = String(inter);
      var label = byInter[slot];
      if (!label) {
        errors.push('Inter ' + slot + ' sans nom');
        return;
      }
      var dup = (window.D.chapitres || []).some(function (ch) {
        return ch.mat === mat && ch.cl === cl && ch.inter === slot && ch.annee === annee;
      });
      if (dup) {
        errors.push('Chapitre déjà existant pour ' + slot);
        return;
      }
      var res = window.createChapitre({
        mat: mat,
        cl: cl,
        inter: slot,
        annee: annee,
        title: label,
        id: window.generateChapitreId(mat)
      });
      if (res.ok) created.push(res.chapitre);
      else if (res.error) errors.push(res.error);
    });
    return { ok: created.length > 0 || errors.length === 0, created: created, errors: errors };
  };

  /** Documents Base Doc sans lien chapitre (phase 1 : tous). */
  window.getUnattachedCoursDocs = function () {
    return (window.D && window.D.cours || []).filter(function (c) {
      return c && !c.chapitreId;
    });
  };

  /** Stub phase 1 — rattachement manuel futur. */
  window.proposeChapitreLink = function (coursUid) {
    return {
      ok: false,
      stub: true,
      message: 'Rattachement document → chapitre : disponible en phase 2.',
      coursUid: coursUid
    };
  };

  function interLabel(clId, inter) {
    if (typeof window.formatInterLabel === 'function') {
      return window.formatInterLabel(clId, inter);
    }
    var cl = clObj(clId);
    var ns = String(inter || '').padStart(2, '0');
    var n = cl.interNames && cl.interNames[ns];
    return n ? (ns + ' — ' + n) : ns;
  }

  function saveAndRefresh() {
    var p = typeof window.save === 'function' ? window.save() : null;
    var done = function () {
      window.renderProgramme();
    };
    if (p && typeof p.then === 'function') p.then(done).catch(done);
    else done();
  }

  function renderChapitreRow(ch, idx, count) {
    var m = matObj(ch.mat);
    var loc = ch.cl
      ? esc(clObj(ch.cl).name) + ' · ' + esc(interLabel(ch.cl, ch.inter))
      : '—';
    var dragAttrs = _reorderMode
      ? ' draggable="true" class="programme-row card programme-row-draggable" data-id="' + esc(ch.id) + '"'
      : ' class="programme-row card"';
    var grip = _reorderMode
      ? '<div class="programme-row-grip" title="Glisser pour réordonner" aria-hidden="true">' +
          (window.iconHtml ? window.iconHtml('move-vertical', 16) : '⋮⋮') +
        '</div>'
      : '';
    var actions = _reorderMode
      ? ''
      : (
        '<div class="programme-row-actions">' +
          '<button type="button" class="bs" title="Modifier" onclick="window.programmeOpenEdit(\'' + jsStr(ch.id) + '\')">' +
            (window.iconHtml ? window.iconHtml('pencil', 16) : '✎') +
          '</button>' +
          '<button type="button" class="bs" style="color:var(--red);border-color:var(--red);" title="Supprimer" onclick="window.programmeDelete(\'' + jsStr(ch.id) + '\')">' +
            (window.iconHtml ? window.iconHtml('trash-2', 16) : '×') +
          '</button>' +
        '</div>'
      );
    return (
      '<div' + dragAttrs + ' style="--mat-color:' + esc(m.color) + '">' +
        grip +
        '<div class="programme-row-main">' +
          '<div class="programme-row-title">' + window.formatChapitreLabel(ch, true) + '</div>' +
          '<div class="programme-row-meta">' +
            '<span class="programme-badge">' + esc(m.name) + '</span>' +
            '<span class="programme-badge">' + ch.annee + (ch.annee === 1 ? 'ère' : 'ème') + ' année</span>' +
            '<span class="programme-badge programme-badge-muted">' + loc + '</span>' +
            '<span class="programme-badge programme-badge-muted mono">' + esc(ch.id) + '</span>' +
          '</div>' +
          (ch.notes ? '<div class="programme-row-notes">' + esc(ch.notes) + '</div>' : '') +
        '</div>' +
        actions +
      '</div>'
    );
  }

  function bindProgrammeDragDrop(pane) {
    if (!_reorderMode || !pane) return;
    pane.querySelectorAll('.programme-list[data-mat]').forEach(function (box) {
      var mat = box.getAttribute('data-mat');
      var annee = box.getAttribute('data-annee');
      box.querySelectorAll('.programme-row-draggable').forEach(function (row) {
        row.addEventListener('dragstart', function (e) {
          row.classList.add('dragging');
          try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', row.dataset.id || '');
          } catch (err) { /* ignore */ }
        });
        row.addEventListener('dragend', function () {
          row.classList.remove('dragging');
        });
        row.addEventListener('dragover', function (e) {
          e.preventDefault();
          var dragging = box.querySelector('.dragging');
          if (!dragging || dragging === row) return;
          var rect = row.getBoundingClientRect();
          var after = (e.clientY - rect.top) > rect.height / 2;
          box.insertBefore(dragging, after ? row.nextSibling : row);
        });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          var ids = Array.prototype.map.call(
            box.querySelectorAll('.programme-row-draggable'),
            function (r) { return r.dataset.id; }
          );
          window.reorderChapitresInGroup(mat, annee, ids);
          saveAndRefresh();
        });
      });
    });
  }

  window.renderProgramme = function () {
    window.ensureChapitresArray();
    var pane = $('paneProgramme');
    if (!pane) return;

    var mats = (window.D.matieres || []).filter(function (m) {
      return !window.isSystemMatiere || !window.isSystemMatiere(m.id);
    });
    var matOpts = '<option value="">Toutes matières</option>' +
      mats.map(function (m) {
        var sel = _filterMat === m.id ? ' selected' : '';
        return '<option value="' + esc(m.id) + '"' + sel + '>' + esc(m.name) + '</option>';
      }).join('');
    var anOpts = ['<option value="">Toutes années</option>',
      '<option value="1"' + (_filterAnnee === '1' ? ' selected' : '') + '>1ère année</option>',
      '<option value="2"' + (_filterAnnee === '2' ? ' selected' : '') + '>2ème année</option>'
    ].join('');

    var groups = window.listChapitresGrouped({
      mat: _filterMat || undefined,
      annee: _filterAnnee !== '' ? _filterAnnee : undefined
    });
    var total = groups.reduce(function (n, g) { return n + g.items.length; }, 0);

    var body = groups.length
      ? groups.map(function (g) {
        return (
          '<section class="programme-group' + (_reorderMode ? ' programme-group-reorder' : '') + '">' +
            '<h3 class="programme-group-title">' + esc(g.matName) +
              ' <span class="programme-group-sub">· ' + g.annee + (g.annee === 1 ? 'ère' : 'ème') + ' année</span></h3>' +
            '<div class="programme-list" data-mat="' + esc(g.mat) + '" data-annee="' + g.annee + '">' +
              g.items.map(function (ch, i) { return renderChapitreRow(ch, i, g.items.length); }).join('') +
            '</div>' +
          '</section>'
        );
      }).join('')
      : '<div class="anki-empty">Aucun chapitre. Créez-en un ou importez depuis les intercalaires d’un classeur.</div>';

    var canReorder = groups.some(function (g) { return g.items.length >= 2; });
    var reorderBtn = _reorderMode
      ? '<button type="button" class="bp" onclick="window.programmeToggleReorder()">' +
          iconLabel('check', 'Terminer') +
        '</button>'
      : '<button type="button" class="bs" onclick="window.programmeToggleReorder()"' +
          (canReorder ? '' : ' disabled title="Au moins 2 chapitres dans un même groupe"') + '>' +
          iconLabel('move-vertical', 'Réorganiser') +
        '</button>';

    pane.innerHTML =
      '<div class="programme-page' + (_reorderMode ? ' programme-page-reorder' : '') + '">' +
        (typeof window.uiSection === 'function'
          ? window.uiSection('Programme', 'Chapitres logiques (plan de cours). Les documents papier restent dans Base Doc.', 'book-open')
          : '<h2>Programme</h2><p class="anki-mut">Chapitres logiques — documents papier dans Base Doc.</p>') +
        '<div class="programme-toolbar">' +
          '<div class="programme-filters">' +
            '<label>Matière <select id="progFltMat" onchange="window.programmeSetFilter(\'mat\', this.value)"' +
              (_reorderMode ? ' disabled' : '') + '>' + matOpts + '</select></label>' +
            '<label>Année <select id="progFltAnnee" onchange="window.programmeSetFilter(\'annee\', this.value)"' +
              (_reorderMode ? ' disabled' : '') + '>' + anOpts + '</select></label>' +
          '</div>' +
          '<div class="programme-toolbar-actions">' +
            reorderBtn +
            (_reorderMode
              ? ''
              : '<button type="button" class="bp" onclick="window.programmeOpenWizard()">' +
                  iconLabel('plus', 'Créer un chapitre') +
                '</button>') +
          '</div>' +
        '</div>' +
        (_reorderMode
          ? '<p class="programme-reorder-hint">Glissez-déposez les chapitres dans chaque groupe (matière · année). L’ordre est enregistré automatiquement.</p>'
          : '<p class="programme-count anki-mut">' + total + ' chapitre(s) · triés par matière et année</p>') +
        body +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
    bindProgrammeDragDrop(pane);
  };

  window.programmeToggleReorder = function () {
    _reorderMode = !_reorderMode;
    window.renderProgramme();
  };

  window.programmeSetFilter = function (key, val) {
    if (key === 'mat') _filterMat = val || '';
    if (key === 'annee') _filterAnnee = val || '';
    window.renderProgramme();
  };

  function resetWizard() {
    WIZ.mode = 'single';
    WIZ.step = 'entry';
    WIZ.mat = null;
    WIZ.cl = null;
    WIZ.inter = null;
    WIZ.annee = 1;
    WIZ.selectedInters = [];
  }

  function wizardBody() {
    var mats = (window.D.matieres || []).filter(function (m) {
      return !window.isSystemMatiere || !window.isSystemMatiere(m.id);
    });
    var cls = (window.D.classeurs || []).filter(function (c) {
      return !window.isSystemClasseur || !window.isSystemClasseur(c.id);
    });

    if (WIZ.step === 'entry') {
      return (
        '<p class="programme-wiz-sub">Les chapitres portent le préfixe <span class="chap-prefix">Chap.</span> en affichage. L’année est fixée à la création.</p>' +
        '<div class="programme-wiz-choices">' +
          '<button type="button" class="bp programme-wiz-choice" onclick="window.programmeWizPickMode(\'single\')">' +
            iconLabel('file-plus', 'Un chapitre (titre libre)') +
          '</button>' +
          '<button type="button" class="bp programme-wiz-choice" onclick="window.programmeWizPickMode(\'bulk\')">' +
            iconLabel('layers', 'Depuis les intercalaires du classeur') +
          '</button>' +
        '</div>'
      );
    }

    if (WIZ.step === 'mat') {
      return (
        '<p class="programme-wiz-sub">Choisis la matière.</p>' +
        '<div class="programme-wiz-grid">' +
          mats.map(function (m) {
            return '<button type="button" class="bs programme-wiz-tile" onclick="window.programmeWizPickMat(\'' + jsStr(m.id) + '\')">' +
              esc(m.name) + '</button>';
          }).join('') +
        '</div>'
      );
    }

    if (WIZ.step === 'cl') {
      return (
        '<p class="programme-wiz-sub">Classeur de référence (rangement). L’année est préremplie depuis le classeur.</p>' +
        '<div class="programme-wiz-grid">' +
          cls.map(function (c) {
            return '<button type="button" class="bs programme-wiz-tile" onclick="window.programmeWizPickCl(\'' + jsStr(c.id) + '\')">' +
              esc(c.name) + '</button>';
          }).join('') +
        '</div>'
      );
    }

    if (WIZ.step === 'annee') {
      return (
        '<p class="programme-wiz-sub">Année scolaire — <b>non modifiable après création</b>.</p>' +
        '<div class="fg">' +
          '<label>Année</label>' +
          '<select id="progWizAnnee" onchange="window.programmeWizSetAnnee(this.value)">' +
            '<option value="1"' + (WIZ.annee === 1 ? ' selected' : '') + '>1ère année</option>' +
            '<option value="2"' + (WIZ.annee === 2 ? ' selected' : '') + '>2ème année</option>' +
          '</select>' +
        '</div>' +
        '<div class="programme-wiz-footer">' +
          '<button type="button" class="bs" onclick="window.programmeWizBack()">Retour</button>' +
          '<button type="button" class="bp" onclick="window.programmeWizAfterAnnee()">Continuer</button>' +
        '</div>'
      );
    }

    if (WIZ.step === 'inter') {
      var cands = window.getIntercalaireCandidates(WIZ.cl);
      return (
        '<p class="programme-wiz-sub">Intercalaire source (nom copié une seule fois).</p>' +
        '<div class="programme-wiz-grid">' +
          cands.map(function (c) {
            return '<button type="button" class="bs programme-wiz-tile" onclick="window.programmeWizPickInter(\'' + jsStr(c.inter) + '\')">' +
              esc(c.inter) + ' — ' + esc(c.label) + '</button>';
          }).join('') +
          (cands.length ? '' : '<p class="anki-empty">Aucun intercalaire nommé dans ce classeur.</p>') +
        '</div>' +
        '<div class="programme-wiz-footer">' +
          '<button type="button" class="bs" onclick="window.programmeWizBack()">Retour</button>' +
        '</div>'
      );
    }

    if (WIZ.step === 'bulk') {
      var bulkCands = window.getIntercalaireCandidates(WIZ.cl);
      WIZ.selectedInters = WIZ.selectedInters.filter(function (i) {
        return bulkCands.some(function (c) { return c.inter === i; });
      });
      return (
        '<p class="programme-wiz-sub">Coche les intercalaires à créer en chapitres (prévisualisation <span class="chap-prefix">Chap.</span>).</p>' +
        '<div class="programme-bulk-list">' +
          bulkCands.map(function (c) {
            var on = WIZ.selectedInters.indexOf(c.inter) !== -1;
            return (
              '<label class="programme-bulk-row">' +
                '<input type="checkbox"' + (on ? ' checked' : '') +
                ' onchange="window.programmeWizToggleInter(\'' + jsStr(c.inter) + '\', this.checked)">' +
                '<span class="chap-prefix">Chap.</span> ' + esc(c.label) +
                '<span class="programme-bulk-slot">' + esc(c.inter) + '</span>' +
              '</label>'
            );
          }).join('') +
          (bulkCands.length ? '' : '<p class="anki-empty">Aucun intercalaire nommé.</p>') +
        '</div>' +
        '<p class="programme-phase2-hint anki-mut">Phase 2 — créer aussi un cours unité du même nom (bientôt)</p>' +
        '<div class="programme-wiz-footer">' +
          '<button type="button" class="bs" onclick="window.programmeWizBack()">Retour</button>' +
          '<button type="button" class="bp" onclick="window.programmeWizConfirmBulk()"' +
            (WIZ.selectedInters.length ? '' : ' disabled') + '>Créer ' + WIZ.selectedInters.length + ' chapitre(s)</button>' +
        '</div>'
      );
    }

    if (WIZ.step === 'form') {
      var pref = '';
      if (WIZ.inter) {
        var cand = window.getIntercalaireCandidates(WIZ.cl).find(function (c) { return c.inter === WIZ.inter; });
        if (cand) pref = cand.label;
      }
      return (
        '<div id="progWizError" class="anki-form-error" role="alert"></div>' +
        '<div class="fg">' +
          '<label>Titre du chapitre <span class="anki-mut">(sans « Chap. »)</span></label>' +
          '<div class="programme-title-preview">' + window.formatChapitreLabel({ title: pref || '…' }, true) + '</div>' +
          '<input type="text" id="progWizTitle" value="' + esc(pref) + '" placeholder="Ex: Électrostatique" oninput="window.programmeWizPreviewTitle(this.value)">' +
        '</div>' +
        '<div class="fg">' +
          '<label>Notes (optionnel)</label>' +
          '<textarea id="progWizNotes" rows="3" placeholder="Sections, remarques…"></textarea>' +
        '</div>' +
        '<p class="programme-phase2-hint anki-mut">Phase 2 — créer aussi un cours unité du même nom (bientôt)</p>' +
        '<div class="programme-wiz-footer">' +
          '<button type="button" class="bs" onclick="window.programmeWizBack()">Retour</button>' +
          '<button type="button" class="bp" onclick="window.programmeWizConfirmSingle()">Créer</button>' +
        '</div>'
      );
    }

    return '';
  }

  window.programmeOpenWizard = function () {
    resetWizard();
    window.programmeRenderWizard();
    var ov = $('ovProgrammeWizard');
    if (ov) ov.classList.remove('hidden');
  };

  window.programmeCloseWizard = function () {
    var ov = $('ovProgrammeWizard');
    if (ov) ov.classList.add('hidden');
    resetWizard();
  };

  window.programmeRenderWizard = function () {
    var body = $('progWizardBody');
    if (body) body.innerHTML = wizardBody();
    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(body);
  };

  window.programmeWizPickMode = function (mode) {
    WIZ.mode = mode;
    WIZ.step = 'mat';
    window.programmeRenderWizard();
  };

  window.programmeWizPickMat = function (matId) {
    WIZ.mat = matId;
    WIZ.step = 'cl';
    window.programmeRenderWizard();
  };

  window.programmeWizPickCl = function (clId) {
    WIZ.cl = clId;
    WIZ.annee = window.getClasseurDefaultAnnee(clId);
    WIZ.step = 'annee';
    window.programmeRenderWizard();
  };

  window.programmeWizSetAnnee = function (v) {
    WIZ.annee = window.normalizeAnnee(v);
  };

  window.programmeWizAfterAnnee = function () {
    WIZ.annee = window.normalizeAnnee($('progWizAnnee') ? $('progWizAnnee').value : WIZ.annee);
    if (WIZ.mode === 'bulk') {
      WIZ.step = 'bulk';
      WIZ.selectedInters = window.getIntercalaireCandidates(WIZ.cl).map(function (c) { return c.inter; });
    } else {
      WIZ.step = 'inter';
    }
    window.programmeRenderWizard();
  };

  window.programmeWizPickInter = function (inter) {
    WIZ.inter = inter;
    WIZ.step = 'form';
    window.programmeRenderWizard();
  };

  window.programmeWizToggleInter = function (inter, on) {
    if (on && WIZ.selectedInters.indexOf(inter) === -1) WIZ.selectedInters.push(inter);
    if (!on) WIZ.selectedInters = WIZ.selectedInters.filter(function (i) { return i !== inter; });
    var footer = document.querySelector('#progWizardBody .programme-wiz-footer');
    if (footer) {
      var btn = footer.querySelector('.bp');
      if (btn) {
        btn.disabled = !WIZ.selectedInters.length;
        btn.textContent = 'Créer ' + WIZ.selectedInters.length + ' chapitre(s)';
      }
    }
  };

  window.programmeWizPreviewTitle = function (val) {
    var el = document.querySelector('.programme-title-preview');
    if (el) el.innerHTML = window.formatChapitreLabel({ title: val || '…' }, true);
  };

  window.programmeWizBack = function () {
    if (WIZ.step === 'form') WIZ.step = 'inter';
    else if (WIZ.step === 'inter' || WIZ.step === 'bulk') WIZ.step = 'annee';
    else if (WIZ.step === 'annee') WIZ.step = 'cl';
    else if (WIZ.step === 'cl') WIZ.step = 'mat';
    else if (WIZ.step === 'mat') WIZ.step = 'entry';
    window.programmeRenderWizard();
  };

  window.programmeWizConfirmSingle = function () {
    var title = $('progWizTitle') ? String($('progWizTitle').value || '').trim() : '';
    var notes = $('progWizNotes') ? String($('progWizNotes').value || '') : '';
    var err = $('progWizError');
    if (!title) {
      if (err) err.textContent = 'Titre requis.';
      return;
    }
    if (err) err.textContent = '';
    var res = window.createChapitre({
      mat: WIZ.mat,
      cl: WIZ.cl,
      inter: WIZ.inter,
      annee: WIZ.annee,
      title: title,
      notes: notes
    });
    if (!res.ok) {
      if (err) err.textContent = res.error || 'Erreur';
      return;
    }
    window.programmeCloseWizard();
    saveAndRefresh();
    if (typeof window.showToast === 'function') window.showToast('Chapitre créé.');
  };

  window.programmeWizConfirmBulk = function () {
    if (!WIZ.selectedInters.length) return;
    var res = window.bulkCreateChapitresFromIntercalaires({
      mat: WIZ.mat,
      cl: WIZ.cl,
      annee: WIZ.annee,
      inters: WIZ.selectedInters.slice()
    });
    window.programmeCloseWizard();
    saveAndRefresh();
    var msg = res.created.length + ' chapitre(s) créé(s).';
    if (res.errors && res.errors.length) msg += ' (' + res.errors.length + ' ignoré(s))';
    if (typeof window.showToast === 'function') window.showToast(msg);
  };

  window.programmeOpenEdit = function (id) {
    var ch = (window.D.chapitres || []).find(function (c) { return c.id === id; });
    if (!ch) return;
    var ov = $('ovProgrammeEdit');
    if (!ov) return;
    $('progEditId').value = ch.id;
    $('progEditTitle').value = ch.title;
    $('progEditNotes').value = ch.notes || '';
    var meta = $('progEditMeta');
    if (meta) {
      meta.innerHTML =
        window.formatChapitreLabel(ch, true) + '<br>' +
        '<span class="anki-mut">' + esc(matObj(ch.mat).name) + ' · ' +
        ch.annee + (ch.annee === 1 ? 'ère' : 'ème') + ' année · ' +
        esc(clObj(ch.cl).name) + ' / ' + esc(interLabel(ch.cl, ch.inter)) +
        ' (figé à la création)</span>';
    }
    ov.classList.remove('hidden');
  };

  window.programmeCloseEdit = function () {
    var ov = $('ovProgrammeEdit');
    if (ov) ov.classList.add('hidden');
  };

  window.programmeSaveEdit = function () {
    var id = $('progEditId') ? $('progEditId').value : '';
    var title = $('progEditTitle') ? String($('progEditTitle').value || '').trim() : '';
    var notes = $('progEditNotes') ? String($('progEditNotes').value || '') : '';
    var err = $('progEditError');
    var res = window.updateChapitre(id, { title: title, notes: notes });
    if (!res.ok) {
      if (err) err.textContent = res.error || 'Erreur';
      return;
    }
    window.programmeCloseEdit();
    saveAndRefresh();
    if (typeof window.showToast === 'function') window.showToast('Chapitre mis à jour.');
  };

  window.programmeDelete = function (id) {
    var ch = (window.D.chapitres || []).find(function (c) { return c.id === id; });
    if (!ch) return;
    if (!window.confirm('Supprimer le chapitre « ' + ch.title + ' » ?')) return;
    window.deleteChapitre(id);
    saveAndRefresh();
    if (typeof window.showToast === 'function') window.showToast('Chapitre supprimé.');
  };

})();
