/**
 * anki-quick-latex.js — Page « Carte rapide LaTeX » (recto / verso personnalisés)
 * Entrée : window.openQuickLatexCard({ latexRecto, latexVerso, mat, coursIds, question, reponse, returnTab })
 */
(function () {
  'use strict';

  var QUICK_DEFAULT_SEC = 30;
  var CTX = null;
  var _mfRecto = null;
  var _mfVerso = null;

  function esc(s) {
    return typeof window.escHtml === 'function' ? window.escHtml(s) : String(s == null ? '' : s);
  }

  function $(id) { return document.getElementById(id); }

  function defaultCtx() {
    return {
      latexRecto: true,
      latexVerso: false,
      mat: '',
      coursIds: [],
      question: '',
      reponse: '',
      returnTab: 'flashcards',
      focusSide: 'recto'
    };
  }

  window.openQuickLatexCard = function (opts) {
    CTX = Object.assign(defaultCtx(), opts || {});
    if (!CTX.mat && window.D && window.D.matieres && window.D.matieres[0]) {
      CTX.mat = window.D.matieres[0].id;
    }
    window._quickLatexCtx = CTX;
    if (typeof window.switchTab === 'function') {
      window.switchTab('quickLatex');
    } else if (typeof window.renderQuickLatexCard === 'function') {
      window.renderQuickLatexCard();
    }
  };

  function parseInlineParts(str) {
    var s = String(str || '');
    var m = s.match(/^(.*?)\s*\\\(([\s\S]*?)\\\)\s*(.*)$/);
    if (m) {
      return { before: m[1].trim(), latex: m[2].trim(), after: m[3].trim() };
    }
    return { before: s, latex: '', after: '' };
  }

  function readSide(prefix, useLatex) {
    if (!useLatex) {
      var plain = $(prefix + 'Plain');
      return plain ? plain.value.trim() : '';
    }
    var before = ($(prefix + 'Before') && $(prefix + 'Before').value) || '';
    var after = ($(prefix + 'After') && $(prefix + 'After').value) || '';
    var mf = prefix === 'qlRecto' ? _mfRecto : _mfVerso;
    var latex = '';
    try {
      if (mf) latex = mf.getValue ? mf.getValue('latex') : (mf.value || '');
    } catch (e) { latex = mf && mf.value ? mf.value : ''; }
    if (typeof window.latexBuildInline === 'function') {
      return window.latexBuildInline(before, latex, after);
    }
    var math = latex.trim() ? '\\(' + latex.trim() + '\\)' : '';
    return [before, math, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function syncPreview(prefix, useLatex) {
    var wrap = $(prefix + 'Preview');
    if (!wrap) return;
    var text = readSide(prefix, useLatex);
    if (!text) {
      wrap.innerHTML = '<span class="anki-mut">Aperçu vide</span>';
      return;
    }
    if (!useLatex || typeof window.latexToMarkup !== 'function') {
      wrap.textContent = text;
      return;
    }
    wrap.innerHTML = formatCardHtml(text);
  }

  function formatCardHtml(str) {
    var s = String(str || '');
    var out = '';
    var re = /\\\(([\s\S]*?)\\\)/g;
    var last = 0;
    var m;
    while ((m = re.exec(s))) {
      if (m.index > last) out += esc(s.slice(last, m.index));
      out += '<span class="latex-lab-preview-math">' + window.latexToMarkup(m[1]) + '</span>';
      last = m.index + m[0].length;
    }
    if (last < s.length) out += esc(s.slice(last));
    return out || esc(s);
  }
  window.formatQuickCardHtml = formatCardHtml;

  function coursOptionsHtml(matId, selectedIds) {
    var sel = new Set(selectedIds || []);
    var list = (window.D && window.D.cours || []).filter(function (c) {
      return !matId || c.mat === matId;
    });
    if (!list.length) {
      return '<option value="">— Aucun chapitre pour cette matière —</option>';
    }
    return '<option value="">— Aucun (optionnel) —</option>' + list.map(function (c) {
      return '<option value="' + esc(c.uid) + '"' + (sel.has(c.uid) ? ' selected' : '') + '>' +
        esc(c.uid) + ' · ' + esc(c.title) + '</option>';
    }).join('');
  }

  function wireMathField(el) {
    if (!el) return null;
    try {
      el.mathVirtualKeyboardPolicy = 'manual';
      if ('smartMode' in el) el.smartMode = false;
      if ('smartFence' in el) el.smartFence = true;
    } catch (e) { /* ignore */ }
    return el;
  }

  function sideEditorHtml(prefix, label, useLatex, seed) {
    var parts = parseInlineParts(seed);
    if (useLatex) {
      return (
        '<section class="ql-side latex-lab-panel" data-side="' + prefix + '">' +
          '<div class="latex-lab-panel-label">' + label + ' <span class="anki-mut">· LaTeX</span></div>' +
          '<div class="ql-side-preview latex-lab-preview-wrap" id="' + prefix + 'Preview"></div>' +
          '<input type="text" id="' + prefix + 'Before" class="latex-lab-text-field" placeholder="Texte avant" value="' + esc(parts.before) + '" autocomplete="off">' +
          '<div class="latex-lab-field-wrap"><math-field id="' + prefix + 'Field" class="latex-lab-field"></math-field></div>' +
          '<input type="text" id="' + prefix + 'After" class="latex-lab-text-field" placeholder="Texte après" value="' + esc(parts.after) + '" autocomplete="off">' +
        '</section>'
      );
    }
    return (
      '<section class="ql-side latex-lab-panel" data-side="' + prefix + '">' +
        '<div class="latex-lab-panel-label">' + label + ' <span class="anki-mut">· texte</span></div>' +
        '<textarea id="' + prefix + 'Plain" class="latex-lab-code" rows="4" placeholder="' + label + '">' + esc(seed || '') + '</textarea>' +
        '<div class="ql-side-preview latex-lab-preview-wrap" id="' + prefix + 'Preview"></div>' +
      '</section>'
    );
  }

  window.renderQuickLatexCard = function () {
    var root = $('paneQuickLatex');
    if (!root) return;
    CTX = window._quickLatexCtx || CTX || defaultCtx();
    window._quickLatexCtx = CTX;

    var matOpts = (window.D && window.D.matieres || []).map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === CTX.mat ? ' selected' : '') + '>' +
        esc(m.label) + ' — ' + esc(m.name) + '</option>';
    }).join('');

    root.innerHTML =
      '<div class="latex-lab ql-card-lab">' +
        '<header class="latex-lab-toolbar">' +
          '<div class="latex-lab-toolbar-head">' +
            '<h2 class="latex-lab-title"><span data-icon="sigma"></span> Carte rapide LaTeX</h2>' +
            '<div class="latex-lab-head-actions">' +
              '<button type="button" class="bs" id="qlBack">' +
                '<span data-icon="arrow-left"></span> Retour</button>' +
              '<button type="button" class="bp" id="qlSave">' +
                '<span data-icon="check"></span> Créer la carte</button>' +
            '</div>' +
          '</div>' +
          '<p class="anki-mut" style="margin:6px 0 0;font-size:12px;">Compose le recto et/ou le verso. Pas de durée — packing session à ~30&nbsp;s.</p>' +
        '</header>' +

        '<div class="ql-meta">' +
          '<div class="fg"><label>Matière *</label><select id="qlMat">' + matOpts + '</select></div>' +
          '<div class="fg"><label>Chapitre / cours <span class="anki-mut">(optionnel)</span></label>' +
            '<select id="qlCours">' + coursOptionsHtml(CTX.mat, CTX.coursIds) + '</select></div>' +
          '<div class="ql-toggles">' +
            '<label class="ql-toggle"><input type="checkbox" id="qlUseRecto"' + (CTX.latexRecto ? ' checked' : '') + '> LaTeX recto</label>' +
            '<label class="ql-toggle"><input type="checkbox" id="qlUseVerso"' + (CTX.latexVerso ? ' checked' : '') + '> LaTeX verso</label>' +
          '</div>' +
        '</div>' +

        '<div id="qlEditors" class="ql-editors"></div>' +
        '<div id="qlError" class="anki-form-error" role="alert"></div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);

    function rebuildEditors() {
      CTX.latexRecto = !!($('qlUseRecto') && $('qlUseRecto').checked);
      CTX.latexVerso = !!($('qlUseVerso') && $('qlUseVerso').checked);
      var host = $('qlEditors');
      if (!host) return;
      host.innerHTML =
        sideEditorHtml('qlRecto', 'Recto / question', CTX.latexRecto, CTX.question) +
        sideEditorHtml('qlVerso', 'Verso / réponse', CTX.latexVerso, CTX.reponse);

      var load = typeof window.ensureMathLive === 'function' ? window.ensureMathLive() : Promise.resolve();
      load.then(function () {
        return customElements.whenDefined('math-field');
      }).then(function () {
        _mfRecto = wireMathField($('qlRectoField'));
        _mfVerso = wireMathField($('qlVersoField'));
        var pr = parseInlineParts(CTX.question);
        var pv = parseInlineParts(CTX.reponse);
        if (_mfRecto && CTX.latexRecto) {
          try { _mfRecto.value = pr.latex || ''; } catch (e) { /* ignore */ }
        }
        if (_mfVerso && CTX.latexVerso) {
          try { _mfVerso.value = pv.latex || ''; } catch (e2) { /* ignore */ }
        }
        ['qlRectoBefore', 'qlRectoAfter', 'qlVersoBefore', 'qlVersoAfter', 'qlRectoPlain', 'qlVersoPlain'].forEach(function (id) {
          var el = $(id);
          if (el) el.addEventListener('input', function () {
            syncPreview('qlRecto', CTX.latexRecto);
            syncPreview('qlVerso', CTX.latexVerso);
          });
        });
        if (_mfRecto) _mfRecto.addEventListener('input', function () { syncPreview('qlRecto', true); });
        if (_mfVerso) _mfVerso.addEventListener('input', function () { syncPreview('qlVerso', true); });
        syncPreview('qlRecto', CTX.latexRecto);
        syncPreview('qlVerso', CTX.latexVerso);
        var focusId = CTX.focusSide === 'verso'
          ? (CTX.latexVerso ? 'qlVersoField' : 'qlVersoPlain')
          : (CTX.latexRecto ? 'qlRectoField' : 'qlRectoPlain');
        var focusEl = $(focusId);
        if (focusEl && focusEl.focus) {
          try { focusEl.focus(); } catch (e3) { /* ignore */ }
        }
      }).catch(function (err) {
        var errEl = $('qlError');
        if (errEl) errEl.textContent = (err && err.message) || 'MathLive indisponible';
      });
    }

    rebuildEditors();

    var matEl = $('qlMat');
    if (matEl) {
      matEl.addEventListener('change', function () {
        CTX.mat = matEl.value;
        var coursEl = $('qlCours');
        if (coursEl) coursEl.innerHTML = coursOptionsHtml(CTX.mat, []);
      });
    }
    var useR = $('qlUseRecto');
    var useV = $('qlUseVerso');
    function onToggle() {
      // Conserver le texte courant avant rebuild
      CTX.question = readSide('qlRecto', CTX.latexRecto) || CTX.question;
      CTX.reponse = readSide('qlVerso', CTX.latexVerso) || CTX.reponse;
      rebuildEditors();
    }
    if (useR) useR.addEventListener('change', onToggle);
    if (useV) useV.addEventListener('change', onToggle);

    var back = $('qlBack');
    if (back) {
      back.addEventListener('click', function () {
        window.switchTab(CTX.returnTab || 'flashcards');
      });
    }
    var save = $('qlSave');
    if (save) {
      save.addEventListener('click', function () {
        var errEl = $('qlError');
        if (errEl) errEl.textContent = '';
        var mat = ($('qlMat') && $('qlMat').value) || '';
        var coursVal = ($('qlCours') && $('qlCours').value) || '';
        var q = readSide('qlRecto', !!($('qlUseRecto') && $('qlUseRecto').checked));
        var r = readSide('qlVerso', !!($('qlUseVerso') && $('qlUseVerso').checked));
        if (!q) {
          if (errEl) errEl.textContent = 'Le recto / question est obligatoire.';
          return;
        }
        if (!mat) {
          if (errEl) errEl.textContent = 'Choisis une matière.';
          return;
        }
        function finish() {
          if (!window.quickAddAnkiCard) {
            if (errEl) errEl.textContent = 'Module Anki non chargé.';
            return;
          }
          window.quickAddAnkiCard({
            question: q,
            reponse: r,
            mat: mat,
            profil: 'FORMULE',
            tempsCible: QUICK_DEFAULT_SEC,
            statut: 'actif',
            importance: 3,
            coursIds: coursVal ? [coursVal] : []
          });
          window._quickLatexCtx = null;
          CTX = null;
          if (typeof window.sysAlert === 'function') {
            window.sysAlert(
              (typeof window.iconLabel === 'function' ? window.iconLabel('check', 'Carte rapide LaTeX créée.') : 'Carte créée.'),
              'Rapide Y-'
            );
          }
          window.switchTab('flashcards');
          if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
        }
        if (typeof window.ensureScriptsForTab === 'function') {
          Promise.all([
            window.ensureScriptsForTab('flashcards'),
            window.ensureScriptsForTab('ankiV2')
          ]).then(finish).catch(finish);
        } else {
          finish();
        }
      });
    }
  };
})();
