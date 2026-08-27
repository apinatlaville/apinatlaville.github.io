/**
 * programme-search-test.js — Navigation Programme par Fil d’Ariane
 * Accueil → Matière → Année → Chapitres (ordre manuel respecté)
 */
(function () {
  'use strict';

  var _crumbMat = '';
  var _crumbAnnee = '';
  var _query = '';
  var _orphansOpen = false;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
  }

  function jsStr(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function matObj(id) {
    return (window.D && window.D.matieres || []).find(function (m) { return m.id === id; })
      || { name: id || '?', color: '#666' };
  }

  function clObj(id) {
    return (window.D && window.D.classeurs || []).find(function (c) { return c.id === id; })
      || { name: id || '?' };
  }

  function interLabel(clId, inter) {
    if (typeof window.formatInterLabel === 'function') {
      return window.formatInterLabel(clId, inter);
    }
    var cl = clObj(clId);
    var ns = String(inter || '').padStart(2, '0');
    var n = cl.interNames && cl.interNames[ns];
    return n ? (ns + ' — ' + n) : ns;
  }

  function userMatieres() {
    return (window.D.matieres || []).filter(function (m) {
      return !window.isSystemMatiere || !window.isSystemMatiere(m.id);
    });
  }

  function countChapitres(mat, annee) {
    if (typeof window.listChapitres !== 'function') return 0;
    return window.listChapitres({
      mat: mat || undefined,
      annee: annee != null && annee !== '' ? annee : undefined
    }).length;
  }

  function anneeLabel(a) {
    var n = parseInt(a, 10);
    return n + (n === 1 ? 'ère' : 'ème') + ' année';
  }

  function renderBreadcrumb() {
    var chevron = window.iconHtml ? window.iconHtml('chevron-right', 14) : '›';
    var parts = [];

    parts.push(
      '<button type="button" class="prog-bc-crumb' + (!_crumbMat ? ' is-current' : '') +
        '" onclick="window.progSearchBcReset()">' +
        (window.iconHtml ? window.iconHtml('home', 14) : '') +
        ' Programme' +
      '</button>'
    );

    if (_crumbMat) {
      parts.push('<span class="prog-bc-sep" aria-hidden="true">' + chevron + '</span>');
      parts.push(
        '<button type="button" class="prog-bc-crumb' + (!_crumbAnnee ? ' is-current' : '') +
          '" onclick="window.progSearchBcMat(\'' + jsStr(_crumbMat) + '\')">' +
          esc(matObj(_crumbMat).name) +
        '</button>'
      );
    }

    if (_crumbAnnee) {
      parts.push('<span class="prog-bc-sep" aria-hidden="true">' + chevron + '</span>');
      parts.push('<span class="prog-bc-crumb is-current">' + esc(anneeLabel(_crumbAnnee)) + '</span>');
    }

    return '<nav class="prog-bc-bar" aria-label="Fil d’Ariane">' + parts.join('') + '</nav>';
  }

  function renderMatGrid() {
    var mats = userMatieres();
    if (!mats.length) {
      return '<div class="prog-bc-empty">Aucune matière. Créez-en dans Organisation → Matières.</div>';
    }
    return (
      '<div class="prog-bc-level-head">' +
        '<h3 class="prog-bc-level-title">Choisir une matière</h3>' +
        '<p class="prog-bc-level-sub anki-mut">Puis l’année, puis les chapitres.</p>' +
      '</div>' +
      '<div class="prog-bc-grid">' +
        mats.map(function (m) {
          var n = countChapitres(m.id);
          return (
            '<button type="button" class="prog-bc-tile" style="--mat-color:' + esc(m.color) + '" ' +
              'onclick="window.progSearchBcMat(\'' + jsStr(m.id) + '\')">' +
              '<span class="prog-bc-tile-name">' + esc(m.name) + '</span>' +
              '<span class="prog-bc-tile-meta">' + n + ' chapitre' + (n === 1 ? '' : 's') + '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    );
  }

  function renderAnneeGrid() {
    var m = matObj(_crumbMat);
    return (
      '<div class="prog-bc-level-head">' +
        '<h3 class="prog-bc-level-title">Année — ' + esc(m.name) + '</h3>' +
        '<p class="prog-bc-level-sub anki-mut">Les chapitres sont rangés par année (figée à la création).</p>' +
      '</div>' +
      '<div class="prog-bc-grid prog-bc-grid-2">' +
        ['1', '2'].map(function (a) {
          var n = countChapitres(_crumbMat, a);
          return (
            '<button type="button" class="prog-bc-tile" style="--mat-color:' + esc(m.color) + '" ' +
              'onclick="window.progSearchBcAnnee(\'' + a + '\')">' +
              '<span class="prog-bc-tile-name">' + esc(anneeLabel(a)) + '</span>' +
              '<span class="prog-bc-tile-meta">' + n + ' chapitre' + (n === 1 ? '' : 's') + '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    );
  }

  function renderChapitreList() {
    var list = typeof window.listChapitres === 'function'
      ? window.listChapitres({ mat: _crumbMat, annee: _crumbAnnee })
      : [];
    var q = String(_query || '').trim().toLowerCase();
    if (q) {
      list = list.filter(function (ch) {
        return String(ch.title || '').toLowerCase().indexOf(q) !== -1
          || String(ch.id || '').toLowerCase().indexOf(q) !== -1
          || String(ch.notes || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    var rows = list.length
      ? list.map(function (ch, i) {
        var loc = ch.cl
          ? esc(clObj(ch.cl).name) + ' · ' + esc(interLabel(ch.cl, ch.inter))
          : '—';
        var label = typeof window.formatChapitreLabel === 'function'
          ? window.formatChapitreLabel(ch, true)
          : esc(ch.title);
        var uniteUid = ch.coursUniteUid || (typeof window.resolveChapitreCoursUid === 'function'
          ? window.resolveChapitreCoursUid(ch.id) : '');
        var linkedDocs = (window.D.cours || []).filter(function (c) {
          return c && c.chapitreId === ch.id && !(c.role === 'unite' || c.isUnite);
        }).length;
        return (
          '<article class="prog-bc-chap" style="--mat-color:' + esc(matObj(ch.mat).color) + '">' +
            '<div class="prog-bc-chap-ord" title="Ordre">' + (i + 1) + '</div>' +
            '<div class="prog-bc-chap-main">' +
              '<div class="prog-bc-chap-title">' + label + '</div>' +
              '<div class="prog-bc-chap-meta">' +
                '<span class="prog-bc-pill mono">' + esc(ch.id) + '</span>' +
                '<span class="prog-bc-pill prog-bc-pill-mut">' + loc + '</span>' +
                (uniteUid
                  ? '<span class="prog-bc-pill prog-bc-pill-unite" title="Cours unité Anki">Unité · ' + esc(uniteUid) + '</span>'
                  : '') +
                (linkedDocs
                  ? '<span class="prog-bc-pill prog-bc-pill-mut">' + linkedDocs + ' doc' + (linkedDocs > 1 ? 's' : '') + '</span>'
                  : '') +
              '</div>' +
              (ch.notes ? '<div class="prog-bc-chap-notes">' + esc(ch.notes) + '</div>' : '') +
            '</div>' +
          '</article>'
        );
      }).join('')
      : '<div class="prog-bc-empty">' +
          (q ? 'Aucun chapitre pour « ' + esc(_query) + ' ».' : 'Aucun chapitre dans cette année. Créez-en dans Organisation → Programme.') +
        '</div>';

    return (
      '<div class="prog-bc-level-head prog-bc-level-head-row">' +
        '<div>' +
          '<h3 class="prog-bc-level-title">Chapitres</h3>' +
          '<p class="prog-bc-level-sub anki-mut">' + list.length + ' affiché' + (list.length === 1 ? '' : 's') +
            ' · ordre Programme</p>' +
        '</div>' +
        '<label class="prog-bc-search">' +
          (window.iconHtml ? window.iconHtml('search', 14) : '') +
          '<input type="search" id="progBcQuery" value="' + esc(_query) +
            '" placeholder="Filtrer titre, id…" oninput="window.progSearchSetQuery(this.value)">' +
        '</label>' +
      '</div>' +
      '<div class="prog-bc-chap-list">' + rows + '</div>'
    );
  }

  function renderOrphans() {
    var docs = typeof window.getUnattachedCoursDocs === 'function'
      ? window.getUnattachedCoursDocs()
      : (window.D.cours || []).filter(function (c) { return c && !c.chapitreId && !(c.role === 'unite'); });
    var chapitres = typeof window.listChapitres === 'function'
      ? window.listChapitres({})
      : (window.D.chapitres || []);
    var open = _orphansOpen;
    var rows = open
      ? docs.slice(0, 20).map(function (c) {
        var opts = chapitres
          .filter(function (ch) { return !c.mat || ch.mat === c.mat; })
          .map(function (ch) {
            var label = typeof window.formatChapitreLabel === 'function'
              ? String(ch.title || ch.id)
              : (ch.title || ch.id);
            return '<option value="' + esc(ch.id) + '">' + esc(label) + ' · ' + esc(ch.id) + '</option>';
          }).join('');
        return (
          '<div class="prog-bc-orphan-row">' +
            '<span class="mono">' + esc(c.uid) + '</span>' +
            '<span class="prog-bc-orphan-title">' + esc(c.title || '') + '</span>' +
            '<select class="prog-bc-orphan-select" id="orphanChap-' + esc(c.uid) + '" aria-label="Chapitre">' +
              '<option value="">— Chapitre —</option>' + opts +
            '</select>' +
            '<button type="button" class="bs prog-bc-orphan-attach" onclick="window.progSearchAttachOrphan(\'' +
              jsStr(c.uid) + '\')">Rattacher</button>' +
          '</div>'
        );
      }).join('') +
        (docs.length > 20
          ? '<div class="prog-bc-orphan-more">+' + (docs.length - 20) + ' autres…</div>'
          : '')
      : '';

    return (
      '<section class="prog-bc-orphans">' +
        '<button type="button" class="prog-bc-orphans-toggle" onclick="window.progSearchToggleOrphans()">' +
          '<span>' + (open ? '▾' : '▸') + ' Non rattachés (Base Doc)</span>' +
          '<span class="prog-bc-orphans-count">' + docs.length + '</span>' +
        '</button>' +
        (open
          ? '<p class="anki-mut prog-bc-orphans-hint">Lie chaque document papier à un chapitre logique.</p>' +
            (docs.length ? rows : '<div class="prog-bc-empty">Tous les documents papier sont rattachés.</div>')
          : '') +
      '</section>'
    );
  }

  function renderBody() {
    if (!_crumbMat) return renderMatGrid();
    if (!_crumbAnnee) return renderAnneeGrid();
    return renderChapitreList();
  }

  window.progSearchBcReset = function () {
    _crumbMat = '';
    _crumbAnnee = '';
    _query = '';
    window.renderProgrammeSearchTest();
  };

  window.progSearchBcMat = function (matId) {
    _crumbMat = matId;
    _crumbAnnee = '';
    _query = '';
    window.renderProgrammeSearchTest();
  };

  window.progSearchBcAnnee = function (a) {
    _crumbAnnee = String(a);
    _query = '';
    window.renderProgrammeSearchTest();
  };

  window.progSearchSetQuery = function (val) {
    _query = val || '';
    window.renderProgrammeSearchTest();
    var input = $('progBcQuery');
    if (input) {
      input.focus();
      try {
        var len = input.value.length;
        input.setSelectionRange(len, len);
      } catch (e) { /* ignore */ }
    }
  };

  window.progSearchToggleOrphans = function () {
    _orphansOpen = !_orphansOpen;
    window.renderProgrammeSearchTest();
  };

  window.progSearchAttachOrphan = function (coursUid) {
    var sel = $('orphanChap-' + coursUid);
    var chapitreId = sel ? String(sel.value || '') : '';
    if (!chapitreId) {
      if (typeof window.showToast === 'function') window.showToast('Choisis un chapitre.');
      else if (typeof window.sysAlert === 'function') window.sysAlert('Choisis un chapitre.', 'Rattachement');
      return;
    }
    if (typeof window.proposeChapitreLink !== 'function') return;
    var res = window.proposeChapitreLink(coursUid, chapitreId);
    if (!res.ok) {
      if (typeof window.showToast === 'function') window.showToast(res.error || 'Échec rattachement');
      else if (typeof window.sysAlert === 'function') window.sysAlert(res.error || 'Échec', 'Rattachement');
      return;
    }
    var saveP = typeof window.save === 'function' ? window.save() : null;
    var done = function () {
      _orphansOpen = true;
      window.renderProgrammeSearchTest();
      if (typeof window.showToast === 'function') window.showToast('Document rattaché.');
    };
    if (saveP && typeof saveP.then === 'function') saveP.then(done).catch(done);
    else done();
  };

  window.renderProgrammeSearchTest = function () {
    var pane = $('paneProgrammeSearchTest');
    if (!pane) return;
    if (typeof window.ensureChapitresArray === 'function') window.ensureChapitresArray();
    if (typeof window.ensureChapitreOrders === 'function') window.ensureChapitreOrders();

    pane.innerHTML =
      '<div class="prog-bc-page">' +
        (typeof window.uiSection === 'function'
          ? window.uiSection('Fil d’Ariane', 'Parcourir les chapitres : matière → année → liste (ordre Programme).', 'search')
          : '<h2>Fil d’Ariane</h2>') +
        renderBreadcrumb() +
        '<div class="prog-bc-body">' + renderBody() + '</div>' +
        renderOrphans() +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
  };

})();
