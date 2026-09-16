/**
 * card-create-y-lab.js — Labo UX création carte Y-
 * Silhouette « carte » : recto | verso côte à côte sur desktop.
 * N’altère pas le modal Rapide de prod (ovQuickCreate).
 */
(function () {
  'use strict';

  var LAB = {
    draft: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function matOf(id) {
    const mats = window.D && window.D.matieres || [];
    return mats.find(function (m) { return m && m.id === id; })
      || (window.CANONICAL_MATIERES || []).find(function (m) { return m.id === id; })
      || { id: id || '', label: '?', name: '', color: '#5bc0de' };
  }

  function blankCard() {
    return {
      question: '',
      reponse: '',
      mat: '',
      groupId: '',
      profil: 'ANGLAIS',
      importance: 3,
      tempsCible: 30,
      statut: 'actif'
    };
  }

  function draftCard() {
    return Object.assign(blankCard(), LAB.draft || {});
  }

  function fieldVal(id) {
    const el = $(id);
    return el ? String(el.value || '').trim() : '';
  }

  function readFormIntoDraft() {
    const d = draftCard();
    d.question = fieldVal('ylabQ');
    d.reponse = fieldVal('ylabR');
    d.mat = fieldVal('ylabMat');
    d.groupId = fieldVal('ylabGroup');
    d.importance = typeof window.getStarPickerValue === 'function'
      ? window.getStarPickerValue('ylabImportance')
      : 3;
    LAB.draft = d;
    return d;
  }

  function paintMatChrome() {
    const matId = fieldVal('ylabMat');
    const m = matOf(matId);
    const card = document.querySelector('#paneCardCreateY .ylab-card');
    if (card) card.style.borderTopColor = m.color || '#5bc0de';
    const chip = $('ylabMatChip');
    if (chip) {
      chip.style.background = (m.color || '#5bc0de') + '20';
      chip.style.color = m.color || '#5bc0de';
      chip.style.borderColor = m.color || '#5bc0de';
      chip.textContent = m.label || '—';
    }
    refreshGroupOptions(matId, fieldVal('ylabGroup'));
  }

  function refreshGroupOptions(matId, selectedId) {
    const sel = $('ylabGroup');
    if (!sel) return;
    const html = typeof window.quickGroupOptionsHtml === 'function'
      ? window.quickGroupOptionsHtml(selectedId || '', { noneLabel: 'Sans dossier', matFilter: matId || '' })
      : '<option value="">Sans dossier</option>';
    sel.innerHTML = html;
    if (typeof window.enhanceFormControls === 'function') {
      window.enhanceFormControls(sel.parentElement || sel);
    }
  }

  window.ylabMatChanged = function () {
    paintMatChrome();
  };

  window.ylabReset = function () {
    LAB.draft = blankCard();
    window.renderCardCreateYLab();
  };

  window.ylabSave = function () {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : création de carte indisponible.')) {
      return;
    }
    const d = readFormIntoDraft();
    const err = $('ylabFormError');
    if (err) { err.textContent = ''; err.classList.remove('visible'); }
    if (!d.question || !d.mat) {
      if (err) {
        err.textContent = 'Recto et matière sont obligatoires.';
        err.classList.add('visible');
      }
      return;
    }
    if (typeof window.quickAddAnkiCard !== 'function') {
      if (err) {
        err.textContent = 'Rapide non chargé.';
        err.classList.add('visible');
      }
      return;
    }
    Promise.resolve(window.quickAddAnkiCard({
      question: d.question,
      reponse: d.reponse,
      mat: d.mat,
      groupId: d.groupId || undefined,
      profil: d.profil || 'ANGLAIS',
      importance: d.importance,
      tempsCible: d.tempsCible,
      statut: 'actif'
    })).then(function (card) {
      if (typeof window.showToast === 'function') {
        window.showToast('Carte ' + (card && card.id ? card.id : 'Y-') + ' créée (labo).', { type: 'ok' });
      }
      LAB.draft = Object.assign(blankCard(), {
        mat: d.mat,
        groupId: d.groupId,
        importance: d.importance
      });
      window.renderCardCreateYLab();
    }).catch(function (e) {
      if (err) {
        err.textContent = String(e && e.message || e);
        err.classList.add('visible');
      }
    });
  };

  window.renderCardCreateYLab = function () {
    const pane = $('paneCardCreateY');
    if (!pane) return;

    if (!LAB.draft) LAB.draft = blankCard();
    const c = draftCard();
    const mats = typeof window.listSelectableMatieres === 'function'
      ? window.listSelectableMatieres({ includeId: c.mat || '' })
      : (window.D && window.D.matieres || []);
    const matOpts = '<option value="">— Choisir une matière —</option>' + mats.map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === c.mat ? ' selected' : '') + '>' +
        esc(m.label) + ' — ' + esc(m.name) + '</option>';
    }).join('');
    const groupOpts = typeof window.quickGroupOptionsHtml === 'function'
      ? window.quickGroupOptionsHtml(c.groupId || '', { noneLabel: 'Sans dossier', matFilter: c.mat || '' })
      : '<option value="">Sans dossier</option>';
    const m = matOf(c.mat);
    const typeBadge = typeof window.cardTypeBadgeHtml === 'function'
      ? window.cardTypeBadgeHtml('quick')
      : '<span class="anki-tag">Y</span>';
    const imp = c.importance || 3;

    pane.innerHTML =
      '<div class="ylab-page">' +
        '<header class="ylab-intro">' +
          '<h2>' + (window.iconLabel ? window.iconLabel('zap', 'Labo carte Y') : 'Labo carte Y') + '</h2>' +
          '<p class="anki-mut">Prototype création Rapide : la carte comme en révision — ' +
            '<b>recto | verso</b> côte à côte sur ordinateur. Le modal classique reste inchangé.</p>' +
        '</header>' +
        '<div id="ylabFormError" class="anki-form-error" role="alert"></div>' +

        '<div class="ylab-card card-type-surface card-type-quick" style="border-top:5px solid ' + esc(m.color) + '">' +
          '<div class="ylab-card-top">' +
            typeBadge +
            '<span class="uid-badge">Y-…</span>' +
            '<span class="anki-tag ylab-mat-chip" id="ylabMatChip" ' +
              'style="background:' + esc(m.color) + '20;color:' + esc(m.color) + ';border:1px solid ' + esc(m.color) + ';">' +
              esc(m.label || '—') + '</span>' +
            '<div class="ylab-stars-inline">' +
              (typeof window.starPickerHtml === 'function' ? window.starPickerHtml('ylabImportance', imp) : '') +
            '</div>' +
          '</div>' +

          '<div class="ylab-faces">' +
            '<section class="ylab-face ylab-face--recto">' +
              '<div class="ylab-face-lbl">Recto</div>' +
              '<textarea id="ylabQ" class="ylab-face-input" rows="6" placeholder="Question / face avant…" ' +
                'aria-label="Recto">' + esc(c.question || '') + '</textarea>' +
            '</section>' +
            '<section class="ylab-face ylab-face--verso">' +
              '<div class="ylab-face-lbl">Verso</div>' +
              '<textarea id="ylabR" class="ylab-face-input" rows="6" placeholder="Réponse / face arrière…" ' +
                'aria-label="Verso">' + esc(c.reponse || '') + '</textarea>' +
            '</section>' +
          '</div>' +

          '<div class="ylab-meta">' +
            '<div class="fg">' +
              '<label for="ylabMat">Matière *</label>' +
              '<select id="ylabMat" class="fi" required onchange="window.ylabMatChanged()">' + matOpts + '</select>' +
            '</div>' +
            '<div class="fg">' +
              '<label for="ylabGroup">Dossier</label>' +
              '<select id="ylabGroup" class="fi">' + groupOpts + '</select>' +
            '</div>' +
          '</div>' +

          '<div class="ylab-actions">' +
            '<button type="button" class="bs" onclick="window.ylabReset()">' +
              (window.iconLabel ? window.iconLabel('refresh-cw', 'Réinit.') : 'Réinit.') + '</button>' +
            '<button type="button" class="bp" onclick="window.ylabSave()">' +
              (window.iconLabel ? window.iconLabel('check', 'Créer la carte Y') : 'Créer la carte Y') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (window.hydrateIcons) window.hydrateIcons(pane);
    paintMatChrome();

    if (typeof window.ensureFormLibs === 'function') {
      Promise.resolve(window.ensureFormLibs()).then(function () {
        if (typeof window.enhanceFormControls === 'function') window.enhanceFormControls(pane);
        paintMatChrome();
      }).catch(function () {});
    } else if (typeof window.enhanceFormControls === 'function') {
      window.enhanceFormControls(pane);
    }
  };
})();
