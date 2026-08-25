/**
 * programme-search-test.js — Labo UX : 4 variantes de navigation Programme / Base Doc
 */
(function () {
  'use strict';

  var _crumbMat = '';
  var _crumbAnnee = '';
  var _colMat = '';
  var _colAnnee = '';
  var _fltMat = '';
  var _fltAnnee = '';
  var _fltText = '';
  var _treeOpen = {};

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
  }

  function matObj(id) {
    return (window.D && window.D.matieres || []).find(function (m) { return m.id === id; })
      || { name: id || '?', color: '#666' };
  }

  function chapitreRows(list) {
    if (!list.length) return '<div class="prog-lab-empty">Aucun chapitre</div>';
    return list.map(function (ch) {
      return (
        '<div class="prog-lab-item">' +
          (typeof window.formatChapitreLabel === 'function'
            ? window.formatChapitreLabel(ch, true)
            : esc(ch.title)) +
          ' <span class="prog-lab-id mono">' + esc(ch.id) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function orphanBlock() {
    var docs = typeof window.getUnattachedCoursDocs === 'function'
      ? window.getUnattachedCoursDocs()
      : (window.D.cours || []);
    var rows = docs.slice(0, 12).map(function (c) {
      return '<div class="prog-lab-item prog-lab-orphan">' +
        esc(c.uid) + ' · ' + esc(c.title || '') +
        '</div>';
    }).join('');
    var more = docs.length > 12 ? '<div class="prog-lab-more">+' + (docs.length - 12) + ' autres…</div>' : '';
    return (
      '<div class="prog-lab-bucket">' +
        '<h4>Non rattachés (Base Doc)</h4>' +
        '<p class="anki-mut">' + docs.length + ' document(s) sans chapitreId</p>' +
        rows + more +
      '</div>'
    );
  }

  function renderTree() {
    var groups = typeof window.listChapitresGrouped === 'function'
      ? window.listChapitresGrouped()
      : [];
    var html = '<div class="prog-lab-tree">';
    groups.forEach(function (g, gi) {
      var key = g.mat + '|' + g.annee;
      var open = _treeOpen[key] !== false;
      html += '<div class="prog-lab-tree-mat">' +
        '<button type="button" class="prog-lab-tree-toggle" onclick="window.progSearchToggleTree(\'' +
        esc(g.mat).replace(/'/g, "\\'") + '\',' + g.annee + ')">' +
        (open ? '▾' : '▸') + ' ' + esc(g.matName) + ' · ' + g.annee + (g.annee === 1 ? 'ère' : 'ème') +
        '</button>';
      if (open) {
        html += '<div class="prog-lab-tree-children">' + chapitreRows(g.items) + '</div>';
      }
      html += '</div>';
    });
    if (!groups.length) html += '<div class="prog-lab-empty">Aucune donnée</div>';
    html += '</div>' + orphanBlock();
    return html;
  }

  function renderBreadcrumb() {
    var mats = (window.D.matieres || []).filter(function (m) {
      return !window.isSystemMatiere || !window.isSystemMatiere(m.id);
    });
    var bc = '<div class="prog-lab-bc">';
    bc += '<button type="button" class="prog-lab-bc-link' + (!_crumbMat ? ' on' : '') +
      '" onclick="window.progSearchBcReset()">Accueil</button>';
    if (_crumbMat) {
      bc += ' › <button type="button" class="prog-lab-bc-link' + (!_crumbAnnee ? ' on' : '') +
        '" onclick="window.progSearchBcMat(\'' + esc(_crumbMat) + '\')">' +
        esc(matObj(_crumbMat).name) + '</button>';
    }
    if (_crumbAnnee) {
      bc += ' › <span class="prog-lab-bc-cur">' + _crumbAnnee + (parseInt(_crumbAnnee, 10) === 1 ? 'ère' : 'ème') + ' année</span>';
    }
    bc += '</div>';

    var body = '';
    if (!_crumbMat) {
      body = '<div class="prog-lab-grid">' +
        mats.map(function (m) {
          return '<button type="button" class="bs prog-lab-tile" onclick="window.progSearchBcMat(\'' + esc(m.id) + '\')">' +
            esc(m.name) + '</button>';
        }).join('') +
        '</div>';
    } else if (!_crumbAnnee) {
      body = '<div class="prog-lab-grid">' +
        ['1', '2'].map(function (a) {
          return '<button type="button" class="bs prog-lab-tile" onclick="window.progSearchBcAnnee(\'' + a + '\')">' +
            a + (a === '1' ? 'ère' : 'ème') + ' année</button>';
        }).join('') +
        '</div>';
    } else {
      var list = window.listChapitres({
        mat: _crumbMat,
        annee: _crumbAnnee
      });
      body = chapitreRows(list);
    }
    return bc + body + orphanBlock();
  }

  function renderColumns() {
    var mats = (window.D.matieres || []).filter(function (m) {
      return !window.isSystemMatiere || !window.isSystemMatiere(m.id);
    });
    var col1 = mats.map(function (m) {
      var on = _colMat === m.id ? ' on' : '';
      return '<button type="button" class="prog-lab-col-item' + on + '" onclick="window.progSearchColMat(\'' +
        esc(m.id) + '\')">' + esc(m.name) + '</button>';
    }).join('');

    var col2 = ['1', '2'].map(function (a) {
      var on = _colAnnee === a ? ' on' : '';
      var dis = _colMat ? '' : ' disabled';
      return '<button type="button" class="prog-lab-col-item' + on + '"' + dis +
        ' onclick="window.progSearchColAnnee(\'' + a + '\')">' +
        a + (a === '1' ? 'ère' : 'ème') + '</button>';
    }).join('');

    var col3 = '';
    if (_colMat && _colAnnee) {
      col3 = chapitreRows(window.listChapitres({ mat: _colMat, annee: _colAnnee }));
    } else {
      col3 = '<div class="prog-lab-empty">Sélectionnez matière et année</div>';
    }

    return (
      '<div class="prog-lab-columns">' +
        '<div class="prog-lab-col"><h4>Matière</h4>' + col1 + '</div>' +
        '<div class="prog-lab-col"><h4>Année</h4>' + col2 + '</div>' +
        '<div class="prog-lab-col"><h4>Chapitres</h4>' + col3 + '</div>' +
      '</div>' +
      orphanBlock()
    );
  }

  function renderFiltered() {
    var list = window.listChapitres({
      mat: _fltMat || undefined,
      annee: _fltAnnee !== '' ? _fltAnnee : undefined
    });
    if (_fltText) {
      var q = _fltText.toLowerCase();
      list = list.filter(function (ch) {
        return String(ch.title || '').toLowerCase().indexOf(q) !== -1
          || String(ch.id || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    return (
      '<div class="prog-lab-filters">' +
        '<label>Matière <select id="progLabFltMat" onchange="window.progSearchSetFlt(\'mat\', this.value)">' +
          '<option value="">Toutes</option>' +
          (window.D.matieres || []).filter(function (m) {
            return !window.isSystemMatiere || !window.isSystemMatiere(m.id);
          }).map(function (m) {
            return '<option value="' + esc(m.id) + '"' + (_fltMat === m.id ? ' selected' : '') + '>' +
              esc(m.name) + '</option>';
          }).join('') +
        '</select></label>' +
        '<label>Année <select id="progLabFltAnnee" onchange="window.progSearchSetFlt(\'annee\', this.value)">' +
          '<option value="">Toutes</option>' +
          '<option value="1"' + (_fltAnnee === '1' ? ' selected' : '') + '>1ère</option>' +
          '<option value="2"' + (_fltAnnee === '2' ? ' selected' : '') + '>2ème</option>' +
        '</select></label>' +
        '<label>Texte <input type="search" id="progLabFltText" value="' + esc(_fltText) +
          '" placeholder="Titre ou id…" oninput="window.progSearchSetFlt(\'text\', this.value)"></label>' +
      '</div>' +
      '<p class="anki-mut">' + list.length + ' résultat(s)</p>' +
      chapitreRows(list) +
      orphanBlock()
    );
  }

  window.progSearchToggleTree = function (mat, annee) {
    var key = mat + '|' + annee;
    _treeOpen[key] = _treeOpen[key] === false;
    window.renderProgrammeSearchTest();
  };

  window.progSearchBcReset = function () {
    _crumbMat = '';
    _crumbAnnee = '';
    window.renderProgrammeSearchTest();
  };

  window.progSearchBcMat = function (matId) {
    _crumbMat = matId;
    _crumbAnnee = '';
    window.renderProgrammeSearchTest();
  };

  window.progSearchBcAnnee = function (a) {
    _crumbAnnee = a;
    window.renderProgrammeSearchTest();
  };

  window.progSearchColMat = function (matId) {
    _colMat = matId;
    _colAnnee = '';
    window.renderProgrammeSearchTest();
  };

  window.progSearchColAnnee = function (a) {
    if (!_colMat) return;
    _colAnnee = a;
    window.renderProgrammeSearchTest();
  };

  window.progSearchSetFlt = function (key, val) {
    if (key === 'mat') _fltMat = val || '';
    if (key === 'annee') _fltAnnee = val || '';
    if (key === 'text') _fltText = val || '';
    window.renderProgrammeSearchTest();
  };

  window.renderProgrammeSearchTest = function () {
    var pane = $('paneProgrammeSearchTest');
    if (!pane) return;
    if (typeof window.ensureChapitresArray === 'function') window.ensureChapitresArray();

    pane.innerHTML =
      '<div class="prog-lab-page">' +
        (typeof window.uiSection === 'function'
          ? window.uiSection('Recherche Programme', 'Comparez 4 UX de navigation — mêmes données.', 'search')
          : '<h2>Recherche Programme (labo)</h2>') +
        '<div class="prog-lab-grid-4">' +
          '<section class="prog-lab-panel"><h3>A — Arbre</h3>' + renderTree() + '</section>' +
          '<section class="prog-lab-panel"><h3>B — Fil d’Ariane</h3>' + renderBreadcrumb() + '</section>' +
          '<section class="prog-lab-panel"><h3>C — Colonnes Finder</h3>' + renderColumns() + '</section>' +
          '<section class="prog-lab-panel"><h3>D — Filtres</h3>' + renderFiltered() + '</section>' +
        '</div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(pane);
  };

})();
