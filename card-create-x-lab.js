/**
 * card-create-x-lab.js — Labo UX création carte X-
 * Prototype : look « carte Synchrotron », 2 colonnes desktop, livres en tuiles.
 * N’altère pas le modal de prod (ovExo) — onglet Système → Labo carte X.
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

  function jsStr(s) {
    return typeof window.escapeJsStr === 'function'
      ? window.escapeJsStr(s)
      : String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function matOf(id) {
    const mats = window.D && window.D.matieres || [];
    return mats.find(function (m) { return m && m.id === id; })
      || (window.CANONICAL_MATIERES || []).find(function (m) { return m.id === id; })
      || { id: id || '', label: '?', name: '', color: '#5b8df7' };
  }

  function blankDraft() {
    return {
      titre: '',
      question: '',
      reponse: '',
      mat: '',
      profil: 'COURS',
      importance: 3,
      tempsCible: 60,
      statut: 'reservoir',
      livreEnonceId: '',
      detEnonce: '',
      livreCorId: '',
      detCor: ''
    };
  }

  function readForm() {
    const d = LAB.draft || blankDraft();
    d.titre = ($('xlabTitre') && $('xlabTitre').value || '').trim();
    d.question = ($('xlabQ') && $('xlabQ').value || '').trim();
    d.reponse = ($('xlabR') && $('xlabR').value || '').trim();
    d.mat = ($('xlabMat') && $('xlabMat').value) || '';
    d.profil = ($('xlabProf') && $('xlabProf').value) || 'COURS';
    d.importance = typeof window.getStarPickerValue === 'function'
      ? window.getStarPickerValue('xlabImportance')
      : (d.importance || 3);
    d.statut = ($('xlabStat') && $('xlabStat').value) || 'reservoir';
    const h = parseInt(($('xlabTimeH') && $('xlabTimeH').value) || '0', 10) || 0;
    const m = parseInt(($('xlabTimeM') && $('xlabTimeM').value) || '1', 10) || 0;
    d.tempsCible = Math.max(60, (h * 60 + m) * 60);
    d.livreEnonceId = ($('xlabLivreEnonce') && $('xlabLivreEnonce').value) || '';
    d.detEnonce = ($('xlabDetEnonce') && $('xlabDetEnonce').value || '').trim();
    d.livreCorId = ($('xlabLivreCor') && $('xlabLivreCor').value) || '';
    d.detCor = ($('xlabDetCor') && $('xlabDetCor').value || '').trim();
    LAB.draft = d;
    return d;
  }

  function livresForMat(matId) {
    return (typeof window.listLivresForMat === 'function' && matId)
      ? window.listLivresForMat(matId)
      : [];
  }

  function livreTilesHtml(side, selectedId, matId) {
    const livres = livresForMat(matId);
    if (!matId) {
      return '<p class="anki-mut anki-livre-pick-empty">Choisis une matière.</p>' +
        '<input type="hidden" id="xlabLivre' + side + '" value="">';
    }
    if (!livres.length) {
      return '<p class="anki-mut anki-livre-pick-empty">Aucun livre — Organisation → Classeurs.</p>' +
        '<input type="hidden" id="xlabLivre' + side + '" value="">';
    }
    const tiles = livres.map(function (l) {
      const on = selectedId === l.id;
      return (
        '<button type="button" class="anki-livre-pick-btn' + (on ? ' is-on' : '') + '" ' +
          'style="--livre-color:' + esc(l.color || '#5b8df7') + '" ' +
          'onclick="window.xlabPickLivre(\'' + side + '\',\'' + jsStr(l.id) + '\')">' +
          '<span class="anki-livre-pick-name">' + esc(l.name || l.id) + '</span></button>'
      );
    }).join('');
    return '<div class="anki-livre-pick-grid" role="listbox">' + tiles + '</div>' +
      '<input type="hidden" id="xlabLivre' + side + '" value="' + esc(selectedId || '') + '">';
  }

  window.xlabPickLivre = function (side, id) {
    readForm();
    if (side === 'Enonce') LAB.draft.livreEnonceId = id;
    else LAB.draft.livreCorId = id;
    const wrap = $('xlabLivreWrap' + side);
    if (wrap) {
      wrap.innerHTML = livreTilesHtml(side, id, LAB.draft.mat);
    }
    paintCardChrome();
  };

  window.xlabMatChanged = function () {
    readForm();
    LAB.draft.livreEnonceId = '';
    LAB.draft.livreCorId = '';
    ['Enonce', 'Cor'].forEach(function (side) {
      const wrap = $('xlabLivreWrap' + side);
      if (wrap) wrap.innerHTML = livreTilesHtml(side, '', LAB.draft.mat);
    });
    paintCardChrome();
    if (typeof window.enhanceFormControls === 'function') {
      window.enhanceFormControls($('paneCardCreateX'));
    }
  };

  window.xlabSetStat = function (v) {
    const hid = $('xlabStat');
    if (hid) hid.value = v === 'actif' ? 'actif' : 'reservoir';
    document.querySelectorAll('#xlabStatGroup .anki-statut-card').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-stat') === (hid && hid.value));
      btn.classList.toggle('is-active', btn.getAttribute('data-stat') === (hid && hid.value));
    });
    paintCardChrome();
  };

  function paintCardChrome() {
    const d = LAB.draft || blankDraft();
    const matId = ($('xlabMat') && $('xlabMat').value) || d.mat;
    const m = matOf(matId);
    const scene = $('xlabScene');
    if (scene) scene.style.setProperty('--deck-accent', m.color || '#5b8df7');
    const tag = $('xlabMatTag');
    if (tag) {
      tag.style.background = (m.color || '#5b8df7') + '20';
      tag.style.color = m.color || '#5b8df7';
      tag.style.borderColor = m.color || '#5b8df7';
      tag.textContent = m.label || '?';
    }
    const starsEl = $('xlabStarsTag');
    if (starsEl && typeof window.importanceLabel === 'function') {
      const imp = typeof window.getStarPickerValue === 'function'
        ? window.getStarPickerValue('xlabImportance')
        : (d.importance || 3);
      starsEl.innerHTML = window.importanceLabel({ importance: imp });
    }
  }

  window.xlabOnStarChange = function () {
    paintCardChrome();
  };

  function resolveLivreSrc(livreId, details) {
    if (!livreId) return null;
    const lv = ((window.D && window.D.classeurs) || []).find(function (x) {
      return x && x.id === livreId
        && (typeof window.isLivreClasseur !== 'function' || window.isLivreClasseur(x));
    });
    if (!lv) return null;
    return { type: 'livre', livreId: lv.id, nom: lv.name || '', details: details || '' };
  }

  window.xlabSave = function () {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : création de carte indisponible.')) {
      return;
    }
    const d = readForm();
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

    const srcE = resolveLivreSrc(d.livreEnonceId, d.detEnonce);
    const srcC = resolveLivreSrc(d.livreCorId, d.detCor);
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
        dateCreation: new Date().toISOString()
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
      statut: d.statut,
      coursIds: card.coursIds || []
    });
    if (srcE) card.sourceEnonce = srcE; else delete card.sourceEnonce;
    if (srcC) card.sourceCorrection = srcC; else delete card.sourceCorrection;
    if (d.statut === 'actif' && !card.dateProchaineRevision) {
      card.dateProchaineRevision = window.AnkiAlgoV2.todayISO();
    }

    Promise.resolve(typeof window.save === 'function' ? window.save() : null).then(function () {
      if (typeof window.showToast === 'function') {
        window.showToast(LAB.editId ? 'Carte mise à jour (labo).' : 'Carte X créée (labo).', { type: 'ok' });
      }
      LAB.editId = '';
      LAB.draft = blankDraft();
      window.renderCardCreateXLab();
    }).catch(function (e) {
      if (err) {
        err.textContent = String(e && e.message || e);
        err.classList.add('visible');
      }
    });
  };

  window.xlabReset = function () {
    LAB.editId = '';
    LAB.draft = blankDraft();
    window.renderCardCreateXLab();
  };

  window.renderCardCreateXLab = function () {
    const pane = $('paneCardCreateX');
    if (!pane) return;
    if (!LAB.draft) LAB.draft = blankDraft();
    const d = LAB.draft;
    const mats = typeof window.listSelectableMatieres === 'function'
      ? window.listSelectableMatieres({ includeId: d.mat || '' })
      : (window.D && window.D.matieres || []);
    const matOpts = '<option value="">— Matière —</option>' + mats.map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === d.mat ? ' selected' : '') + '>' +
        esc(m.label) + ' — ' + esc(m.name) + '</option>';
    }).join('');
    const profiles = (window.AnkiAlgoV2 && window.AnkiAlgoV2.DEFAULT_PROFILES) || { COURS: { label: 'Cours' } };
    const profOpts = Object.keys(profiles).map(function (p) {
      return '<option value="' + esc(p) + '"' + ((d.profil || 'COURS') === p ? ' selected' : '') + '>' +
        esc(profiles[p].label || p) + '</option>';
    }).join('');
    const m = matOf(d.mat);
    const tempsMin = Math.max(1, Math.round((d.tempsCible || 60) / 60));
    const th = Math.floor(tempsMin / 60);
    const tm = tempsMin % 60;
    const starHtml = typeof window.starPickerHtml === 'function'
      ? window.starPickerHtml('xlabImportance', d.importance || 3)
      : '';

    pane.innerHTML =
      '<div class="xlab-page">' +
        '<header class="xlab-intro">' +
          '<h2>' + (window.iconLabel ? window.iconLabel('flask-conical', 'Labo création carte X') : 'Labo création carte X') + '</h2>' +
          '<p class="anki-mut">Prototype : même place pour les ★ qu’en session, guidage livres en tuiles, 2 colonnes sur grand écran. ' +
            'Le modal Synchrotron classique reste inchangé pour l’instant.</p>' +
        '</header>' +
        '<div id="xlabFormError" class="anki-form-error" role="alert"></div>' +
        '<div class="xlab-scene anki-deck-scene" id="xlabScene" style="--deck-accent:' + esc(m.color) + '">' +
          '<div class="xlab-card anki-deck-card modal card-type-surface card-type-main" style="border-top:5px solid ' + esc(m.color) + '">' +
            '<div class="anki-sess-top xlab-sess-top">' +
              '<div class="anki-sess-tags">' +
                '<span class="anki-tag" id="xlabMatTag" style="background:' + esc(m.color) + '20;color:' + esc(m.color) + ';border:1px solid ' + esc(m.color) + ';">' + esc(m.label || '?') + '</span>' +
                '<span class="anki-tag" id="xlabStarsTag" title="Importance">' +
                  (typeof window.importanceLabel === 'function' ? window.importanceLabel({ importance: d.importance || 3 }) : '★★★') +
                '</span>' +
                '<span class="anki-mut xlab-badge">Brouillon X-</span>' +
              '</div>' +
              '<div class="xlab-stars-inline">' +
                '<span class="anki-mut" style="font-size:11px;">Importance</span>' +
                starHtml +
              '</div>' +
            '</div>' +

            '<div class="xlab-layout">' +
              '<div class="xlab-col xlab-col-main">' +
                '<div class="fg"><label>Titre *</label>' +
                  '<input type="text" id="xlabTitre" class="fi" value="' + esc(d.titre) + '" placeholder="Ex: Théorème énergie cinétique"></div>' +
                '<div class="fg"><label>Énoncé</label>' +
                  '<textarea id="xlabQ" class="fi" rows="4" placeholder="Question / énoncé…">' + esc(d.question) + '</textarea></div>' +
                '<div class="fg"><label>Réponse</label>' +
                  '<textarea id="xlabR" class="fi" rows="3" placeholder="Corrigé…">' + esc(d.reponse) + '</textarea></div>' +
              '</div>' +

              '<div class="xlab-col xlab-col-side">' +
                '<div class="fg"><label>Matière *</label>' +
                  '<select id="xlabMat" class="fi" onchange="window.xlabMatChanged()">' + matOpts + '</select></div>' +
                '<div class="fg"><label>Profil</label>' +
                  '<select id="xlabProf" class="fi">' + profOpts + '</select></div>' +
                '<div class="anki-statut-duration">' +
                  '<label>Durée (h:mm)</label>' +
                  '<div class="anki-hmm-boxes anki-hmm-boxes--compact">' +
                    '<input type="number" id="xlabTimeH" class="fi" min="0" max="9" value="' + th + '">' +
                    '<span>:</span>' +
                    '<input type="number" id="xlabTimeM" class="fi" min="0" max="59" value="' + tm + '">' +
                  '</div>' +
                '</div>' +
                '<div class="anki-statut-encart" id="xlabStatGroup">' +
                  '<input type="hidden" id="xlabStat" value="' + esc(d.statut || 'reservoir') + '">' +
                  '<div class="anki-statut-picker" role="group">' +
                    '<button type="button" class="anki-statut-card' + (d.statut !== 'actif' ? ' is-active' : '') + '" data-stat="reservoir" onclick="window.xlabSetStat(\'reservoir\')">' +
                      '<span class="anki-statut-option-title">Réservoir</span></button>' +
                    '<button type="button" class="anki-statut-card' + (d.statut === 'actif' ? ' is-active' : '') + '" data-stat="actif" onclick="window.xlabSetStat(\'actif\')">' +
                      '<span class="anki-statut-option-title">Actif</span></button>' +
                  '</div>' +
                '</div>' +

                '<section class="xlab-guidage">' +
                  '<h4 class="anki-src-section-title">' + (window.iconLabel ? window.iconLabel('book-open', 'Énoncé · Livre') : 'Énoncé · Livre') + '</h4>' +
                  '<div id="xlabLivreWrapEnonce">' + livreTilesHtml('Enonce', d.livreEnonceId, d.mat) + '</div>' +
                  '<div class="fg"><label>Détails</label>' +
                    '<input type="text" id="xlabDetEnonce" class="fi" value="' + esc(d.detEnonce) + '" placeholder="p.142 ex.7"></div>' +
                  '<h4 class="anki-src-section-title" style="margin-top:14px;">' + (window.iconLabel ? window.iconLabel('check', 'Corrigé · Livre') : 'Corrigé · Livre') + '</h4>' +
                  '<div id="xlabLivreWrapCor">' + livreTilesHtml('Cor', d.livreCorId, d.mat) + '</div>' +
                  '<div class="fg"><label>Détails</label>' +
                    '<input type="text" id="xlabDetCor" class="fi" value="' + esc(d.detCor) + '" placeholder="p.480"></div>' +
                '</section>' +
              '</div>' +
            '</div>' +

            '<div class="macts xlab-macts">' +
              '<button type="button" class="bs" onclick="window.xlabReset()">Réinitialiser</button>' +
              '<button type="button" class="bp" onclick="window.xlabSave()">' +
                (window.iconLabel ? window.iconLabel('check', 'Enregistrer la carte') : 'Enregistrer') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (window.hydrateIcons) window.hydrateIcons(pane);
    paintCardChrome();

    const starRoot = pane.querySelector('#xlabImportance') || pane.querySelector('.anki-star-picker');
    if (starRoot) {
      pane.querySelectorAll('.anki-star-picker button, .anki-star-picker [data-star], .anki-star').forEach(function (el) {
        el.addEventListener('click', function () {
          setTimeout(paintCardChrome, 0);
        });
      });
    }

    if (typeof window.ensureFormLibs === 'function') {
      Promise.resolve(window.ensureFormLibs()).then(function () {
        if (typeof window.enhanceFormControls === 'function') window.enhanceFormControls(pane);
      }).catch(function () {});
    } else if (typeof window.enhanceFormControls === 'function') {
      window.enhanceFormControls(pane);
    }
  };
})();
