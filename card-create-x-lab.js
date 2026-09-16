/**
 * card-create-x-lab.js — Labo UX création carte X-
 * Silhouette session + modules du modal classique (matière Choices, ★, durée h:mm,
 * statut, guidage livres). N’altère pas ovExo.
 */
(function () {
  'use strict';

  var LAB = {
    draft: null,
    editId: ''
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function helpers() {
    return window.ankiV2FormHelpers || null;
  }

  function matOf(id) {
    const mats = window.D && window.D.matieres || [];
    return mats.find(function (m) { return m && m.id === id; })
      || (window.CANONICAL_MATIERES || []).find(function (m) { return m.id === id; })
      || { id: id || '', label: '?', name: '', color: '#5b8df7' };
  }

  function blankCard() {
    return {
      titre: '',
      question: '',
      reponse: '',
      mat: '',
      profil: 'COURS',
      importance: 3,
      tempsCible: 60,
      statut: 'reservoir',
      sourceEnonce: null,
      sourceCorrection: null,
      coursIds: []
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
    const H = helpers();
    const d = draftCard();
    d.titre = fieldVal('xlabTitre');
    d.question = fieldVal('xlabQ');
    d.reponse = fieldVal('xlabR');
    d.mat = fieldVal('xlabMat');
    d.profil = fieldVal('xlabProf') || 'COURS';
    d.importance = typeof window.getStarPickerValue === 'function'
      ? window.getStarPickerValue('xlabImportance')
      : 3;
    d.statut = fieldVal('xlabStat') || 'reservoir';
    var mins = 1;
    if (H && H.readDurationFromPicker) {
      mins = H.readDurationFromPicker('xlabTimeH', 'xlabTimeM', null, null, 1, 540);
    } else {
      const h = parseInt(fieldVal('xlabTimeH') || '0', 10) || 0;
      const m0 = parseInt(fieldVal('xlabTimeM0') || '0', 10) || 0;
      const m1 = parseInt(fieldVal('xlabTimeM1') || '0', 10) || 0;
      mins = Math.max(1, h * 60 + m0 * 10 + m1);
    }
    d.tempsCible = Math.round(mins * 60);

    function readSrc(side) {
      const type = fieldVal('xlabSrc' + side + 'Type');
      if (!type) return null;
      if (type === 'cours') {
        const coursUid = fieldVal('xlabSrc' + side + 'CoursUid');
        const remark = fieldVal('xlabSrc' + side + 'Remark');
        if (!coursUid) return null;
        const co = (window.D.cours || []).find(function (x) { return x.uid === coursUid; });
        return {
          type: 'cours',
          coursUid: coursUid,
          nom: co ? (co.title || co.uid) : coursUid,
          details: remark || ''
        };
      }
      if (type === 'livre') {
        const livreId = fieldVal('xlabSrc' + side + 'LivreId');
        if (!livreId) return null;
        const lv = ((window.D && window.D.classeurs) || []).find(function (x) {
          return x && x.id === livreId
            && (typeof window.isLivreClasseur !== 'function' || window.isLivreClasseur(x));
        });
        if (!lv) return null;
        return {
          type: 'livre',
          livreId: lv.id,
          nom: lv.name || '',
          details: fieldVal('xlabSrc' + side + 'Det') || ''
        };
      }
      const nom = fieldVal('xlabSrc' + side + 'Nom');
      const det = fieldVal('xlabSrc' + side + 'Det');
      if (!nom && !det) return null;
      return { type: type, nom: nom, details: det };
    }

    d.sourceEnonce = readSrc('Enonce');
    d.sourceCorrection = readSrc('Cor');
    LAB.draft = d;
    return d;
  }

  function paintMatChrome() {
    const matId = fieldVal('xlabMat');
    const m = matOf(matId);
    const scene = $('xlabScene');
    const card = document.querySelector('#paneCardCreateX .xlab-card');
    if (scene) scene.style.setProperty('--deck-accent', m.color || '#5b8df7');
    if (card) card.style.borderTopColor = m.color || '#5b8df7';
    const chip = $('xlabMatChip');
    if (chip) {
      chip.style.background = (m.color || '#5b8df7') + '20';
      chip.style.color = m.color || '#5b8df7';
      chip.style.borderColor = m.color || '#5b8df7';
      chip.textContent = m.label || '—';
      chip.title = m.name || m.label || '';
    }
    const hint = $('xlabMatHint');
    if (hint) {
      hint.textContent = matId
        ? ((m.label || '') + (m.name ? ' — ' + m.name : ''))
        : 'Choisis une matière PC* (obligatoire)';
    }
  }

  window.xlabOnStarChange = function () { /* badge live optionnel */ };

  window.xlabMatChanged = function () {
    paintMatChrome();
  };

  window.xlabReset = function () {
    LAB.editId = '';
    LAB.draft = blankCard();
    window.renderCardCreateXLab();
  };

  window.xlabSave = function () {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : création de carte indisponible.')) {
      return;
    }
    const d = readFormIntoDraft();
    const err = $('xlabFormError');
    if (err) { err.textContent = ''; err.classList.remove('visible'); }
    if (!d.titre || !d.mat) {
      if (err) {
        err.textContent = 'Titre et matière sont obligatoires.';
        err.classList.add('visible');
      }
      return;
    }
    if (!window.AnkiAlgoV2 || !window.D) {
      if (err) {
        err.textContent = 'Synchrotron non chargé.';
        err.classList.add('visible');
      }
      return;
    }

    const existing = (window.AnkiAlgoV2.allExistingIds
      ? window.AnkiAlgoV2.allExistingIds(window.D)
      : (window.D.exercices || []).map(function (c) { return c.id; }));
    const used = existing instanceof Set ? Array.from(existing)
      : (Array.isArray(existing) ? existing.slice() : Object.keys(existing || {}));

    let card;
    if (LAB.editId) {
      card = (window.D.exercices || []).find(function (c) { return c && c.id === LAB.editId; });
      if (!card) {
        if (err) { err.textContent = 'Carte introuvable.'; err.classList.add('visible'); }
        return;
      }
    } else {
      const id = window.AnkiAlgoV2.genExoUid('X', used);
      const easeProf = window.AnkiAlgoV2.getProfile(d.profil);
      card = {
        id: id,
        intervalle: 0,
        ease: (easeProf && easeProf.ease) || 2.5,
        repetitions: 0,
        historique: [],
        dateCreation: new Date().toISOString(),
        coursIds: []
      };
      if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
      window.D.exercices.unshift(card);
    }

    Object.assign(card, {
      titre: d.titre,
      question: d.question,
      reponse: d.reponse,
      mat: d.mat,
      profil: d.profil,
      tempsCible: d.tempsCible,
      importance: d.importance,
      statut: d.statut
    });
    if (d.sourceEnonce) card.sourceEnonce = d.sourceEnonce; else delete card.sourceEnonce;
    if (d.sourceCorrection) card.sourceCorrection = d.sourceCorrection; else delete card.sourceCorrection;
    if (d.statut === 'actif' && !card.dateProchaineRevision) {
      card.dateProchaineRevision = window.AnkiAlgoV2.todayISO();
    }

    Promise.resolve(typeof window.save === 'function' ? window.save() : null).then(function () {
      if (typeof window.showToast === 'function') {
        window.showToast(LAB.editId ? 'Carte mise à jour (labo).' : ('Carte ' + card.id + ' créée (labo).'), { type: 'ok' });
      }
      LAB.editId = '';
      LAB.draft = blankCard();
      window.renderCardCreateXLab();
    }).catch(function (e) {
      if (err) {
        err.textContent = String(e && e.message || e);
        err.classList.add('visible');
      }
    });
  };

  window.renderCardCreateXLab = function () {
    const pane = $('paneCardCreateX');
    if (!pane) return;
    const H = helpers();
    if (!H) {
      pane.innerHTML = '<div class="anki-card-block"><p class="anki-mut">Charge le Synchrotron…</p></div>';
      if (typeof window.ensureAnkiUi === 'function') {
        Promise.resolve(window.ensureAnkiUi()).then(function () {
          if (window.ankiV2FormHelpers) window.renderCardCreateXLab();
        });
      }
      return;
    }

    if (!LAB.draft) LAB.draft = blankCard();
    const c = draftCard();
    const mats = typeof window.listSelectableMatieres === 'function'
      ? window.listSelectableMatieres({ includeId: c.mat || '' })
      : (window.D && window.D.matieres || []);
    const matOpts = '<option value="">— Choisir une matière —</option>' + mats.map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === c.mat ? ' selected' : '') + '>' +
        esc(m.label) + ' — ' + esc(m.name) + '</option>';
    }).join('');
    const profiles = (window.AnkiAlgoV2 && window.AnkiAlgoV2.DEFAULT_PROFILES) || { COURS: { label: 'Cours' } };
    const profOpts = Object.keys(profiles).map(function (p) {
      return '<option value="' + esc(p) + '"' + ((c.profil || 'COURS') === p ? ' selected' : '') + '>' +
        esc(profiles[p].label || p) + '</option>';
    }).join('');
    const m = matOf(c.mat);
    const tempsMin = c.tempsCible ? (c.tempsCible / 60) : 1;
    const typeBadge = typeof window.cardTypeBadgeHtml === 'function'
      ? window.cardTypeBadgeHtml('main')
      : '<span class="anki-tag">X</span>';
    const imp = H.cardImportance ? H.cardImportance(c) : (c.importance || 3);

    pane.innerHTML =
      '<div class="xlab-page">' +
        '<header class="xlab-intro">' +
          '<h2>' + (window.iconLabel ? window.iconLabel('flask-conical', 'Labo carte X') : 'Labo carte X') + '</h2>' +
          '<p class="anki-mut">Silhouette session + <b>mêmes modules</b> que la création Synchrotron ' +
            '(matière, ★, durée h:mm, statut, guidage). Le modal classique reste inchangé.</p>' +
        '</header>' +
        '<div id="xlabFormError" class="anki-form-error" role="alert"></div>' +

        '<div class="xlab-shell">' +
          '<div class="xlab-scene anki-deck-scene" id="xlabScene" style="--deck-accent:' + esc(m.color) + '">' +
            '<div class="xlab-card anki-deck-card modal card-type-surface card-type-main" style="border-top:5px solid ' + esc(m.color) + '">' +

              '<div class="anki-deck-progress xlab-progress">' +
                '<div class="anki-deck-progress-label">' +
                  '<span>' + (window.iconLabel ? window.iconLabel('layers', 'Brouillon · création') : 'Brouillon · création') + '</span>' +
                  '<span>Labo X-</span>' +
                '</div>' +
                '<div class="anki-deck-progress-track"><div class="anki-deck-progress-fill" style="width:12%"></div></div>' +
              '</div>' +

              '<div class="anki-sess-top xlab-sess-top">' +
                '<div class="anki-sess-tags">' +
                  typeBadge +
                  '<span class="uid-badge">X-…</span>' +
                  '<span class="anki-tag xlab-mat-chip" id="xlabMatChip" ' +
                    'style="background:' + esc(m.color) + '20;color:' + esc(m.color) + ';border:1px solid ' + esc(m.color) + ';">' +
                    esc(m.label || '—') + '</span>' +
                  '<div class="xlab-stars-inline">' +
                    (typeof window.starPickerHtml === 'function' ? window.starPickerHtml('xlabImportance', imp) : '') +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<input type="text" id="xlabTitre" class="xlab-titre-input" value="' + esc(c.titre || '') + '" ' +
                'placeholder="Titre de la carte…" maxlength="120" required aria-label="Titre">' +
              '<textarea id="xlabQ" class="xlab-q-input" rows="3" placeholder="Énoncé (facultatif)…" aria-label="Énoncé">' +
                esc(c.question || '') + '</textarea>' +
              '<textarea id="xlabR" class="xlab-r-input" rows="2" placeholder="Réponse (facultatif)…" aria-label="Réponse">' +
                esc(c.reponse || '') + '</textarea>' +

              '<div class="xlab-mat-block">' +
                '<label class="xlab-mat-block-lab" for="xlabMat">Matière *</label>' +
                '<select id="xlabMat" class="fi" required onchange="window.xlabMatChanged()">' + matOpts + '</select>' +
                '<p class="anki-mut xlab-mat-hint" id="xlabMatHint">' +
                  (c.mat ? esc((m.label || '') + (m.name ? ' — ' + m.name : '')) : 'Choisis une matière PC* (obligatoire)') +
                '</p>' +
              '</div>' +

              '<div class="anki-modal-row">' +
                '<div class="fg"><label>Profil</label><select id="xlabProf">' + profOpts + '</select></div>' +
              '</div>' +

              '<div class="anki-modal-row anki-modal-row--meta">' +
                '<div class="fg fg-importance">' +
                  '<label>Importance</label>' +
                  '<div class="anki-importance-encart">' +
                    '<p class="anki-mut" style="margin:0 0 6px;font-size:12px;">Règle les ★ dans le bandeau (comme en session).</p>' +
                    '<p class="anki-mut anki-importance-tip" id="xlabImportanceTip">Plus d\'étoiles → monte plus vite en session et revient plus souvent.</p>' +
                  '</div>' +
                '</div>' +
                '<div class="fg fg-statut">' +
                  '<div class="anki-statut-duration">' +
                    '<label>Durée <span class="anki-mut" style="font-weight:normal;">(h:mm)</span></label>' +
                    H.durationPickerHtml(tempsMin, {
                      hId: 'xlabTimeH',
                      mId: 'xlabTimeM',
                      minTotal: 1,
                      maxTotal: 540,
                      minuteStep: 1,
                      editable: true,
                      wrapClass: 'anki-hmm-boxes anki-hmm-boxes--compact'
                    }) +
                  '</div>' +
                  '<label>Statut</label>' +
                  H.renderStatutChecks(c, 'xlab') +
                '</div>' +
              '</div>' +

              H.renderSrcGuidanceBlock(c, 'xlab',
                (window.iconLabel
                  ? window.iconLabel('book-open', '<b>Guidage physique</b> <span class="anki-mut" style="font-weight:normal;">— où trouver l\'énoncé et le corrigé (facultatif)</span>')
                  : '<b>Guidage physique</b>')) +

              '<button type="button" class="bp anki-reveal xlab-save-btn" onclick="window.xlabSave()">' +
                (window.iconLabel ? window.iconLabel('check', 'Enregistrer la carte') : 'Enregistrer la carte') +
              '</button>' +
              '<div class="xlab-foot-actions">' +
                '<button type="button" class="bs" onclick="window.xlabReset()">' +
                  (window.iconLabel ? window.iconLabel('refresh-cw', 'Réinitialiser') : 'Réinitialiser') + '</button>' +
              '</div>' +

            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (window.hydrateIcons) window.hydrateIcons(pane);
    paintMatChrome();
    H.wireEditableDurationPicker({
      hId: 'xlabTimeH',
      mId: 'xlabTimeM',
      minTotal: 1,
      maxTotal: 540
    });
    H.wireSrcGuidanceBlock('xlab');

    const matEl = $('xlabMat');
    if (matEl && !matEl._xlabPaintBound) {
      matEl._xlabPaintBound = true;
      matEl.addEventListener('change', function () {
        paintMatChrome();
      });
    }

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
