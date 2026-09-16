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
  };

  window.xlabToggleMatMenu = function () {
    const menu = $('xlabMatMenu');
    if (!menu) return;
    menu.classList.toggle('hidden');
  };

  window.xlabPickMat = function (matId) {
    const hid = $('xlabMat');
    if (hid) hid.value = matId || '';
    const menu = $('xlabMatMenu');
    if (menu) menu.classList.add('hidden');
    window.xlabMatChanged();
  };

  window.xlabSetStat = function (v) {
    const hid = $('xlabStat');
    if (hid) hid.value = v === 'actif' ? 'actif' : 'reservoir';
    document.querySelectorAll('#xlabStatGroup .xlab-foot-stat').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-stat') === (hid && hid.value));
    });
  };

  function paintCardChrome() {
    const matId = ($('xlabMat') && $('xlabMat').value) || (LAB.draft && LAB.draft.mat) || '';
    const m = matOf(matId);
    const scene = $('xlabScene');
    const card = document.querySelector('#paneCardCreateX .xlab-card');
    if (scene) scene.style.setProperty('--deck-accent', m.color || '#5b8df7');
    if (card) card.style.borderTopColor = m.color || '#5b8df7';
    const tag = $('xlabMatTag');
    if (tag) {
      tag.style.background = (m.color || '#5b8df7') + '20';
      tag.style.color = m.color || '#5b8df7';
      tag.style.borderColor = m.color || '#5b8df7';
      tag.textContent = m.label || 'Matière';
    }
    const metaMat = $('xlabMetaMatName');
    if (metaMat) metaMat.textContent = m.name || m.label || 'choisir une matière';
    const prof = $('xlabProf');
    const metaProf = $('xlabMetaProf');
    if (metaProf && prof) {
      const opt = prof.options[prof.selectedIndex];
      metaProf.textContent = (opt && opt.textContent) || prof.value || 'Profil';
    }
  }

  window.xlabOnStarChange = function () {
    paintCardChrome();
  };

  window.xlabProfChanged = function () {
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
    const typeBadge = typeof window.cardTypeBadgeHtml === 'function'
      ? window.cardTypeBadgeHtml('main')
      : '<span class="anki-tag" style="background:#50d89020;color:#50d890;border:1px solid #50d890;">X</span>';
    const matMenu = mats.map(function (mm) {
      return (
        '<button type="button" class="xlab-mat-opt' + (mm.id === d.mat ? ' is-on' : '') + '" ' +
          'style="--mat-c:' + esc(mm.color || '#5b8df7') + '" ' +
          'onclick="window.xlabPickMat(\'' + jsStr(mm.id) + '\')">' +
          '<span class="xlab-mat-opt-lab">' + esc(mm.label) + '</span>' +
          '<span class="xlab-mat-opt-name">' + esc(mm.name) + '</span></button>'
      );
    }).join('');

    pane.innerHTML =
      '<div class="xlab-page">' +
        '<header class="xlab-intro">' +
          '<h2>' + (window.iconLabel ? window.iconLabel('flask-conical', 'Labo carte X') : 'Labo carte X') + '</h2>' +
          '<p class="anki-mut">Même silhouette qu’en session : clique le titre, les ★ et la matière. ' +
            'Profil / durée / livres à droite (desktop). Le modal Synchrotron classique n’est pas modifié.</p>' +
        '</header>' +
        '<div id="xlabFormError" class="anki-form-error" role="alert"></div>' +
        '<input type="hidden" id="xlabMat" value="' + esc(d.mat || '') + '">' +
        '<input type="hidden" id="xlabStat" value="' + esc(d.statut || 'reservoir') + '">' +

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
                  '<button type="button" class="anki-tag xlab-mat-chip" id="xlabMatTag" ' +
                    'style="background:' + esc(m.color) + '20;color:' + esc(m.color) + ';border:1px solid ' + esc(m.color) + ';" ' +
                    'onclick="window.xlabToggleMatMenu()" title="Choisir la matière">' +
                    esc(m.label || 'Matière') + '</button>' +
                  '<div class="xlab-stars-inline">' + starHtml + '</div>' +
                '</div>' +
                '<div class="xlab-mat-menu-wrap">' +
                  '<div id="xlabMatMenu" class="xlab-mat-menu hidden" role="listbox">' +
                    (matMenu || '<p class="anki-mut">Aucune matière active.</p>') +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div class="anki-sess-meta xlab-meta">' +
                (window.iconHtml ? window.iconHtml('timer', 12) : '') +
                ' Cible <input type="number" id="xlabTimeH" class="xlab-meta-num" min="0" max="9" value="' + th + '" aria-label="Heures">h' +
                '<input type="number" id="xlabTimeM" class="xlab-meta-num" min="0" max="59" value="' + tm + '" aria-label="Minutes"> min' +
                ' · <select id="xlabProf" class="xlab-meta-prof" onchange="window.xlabProfChanged()">' + profOpts + '</select>' +
                ' · <span id="xlabMetaMatName">' + esc(m.name || m.label || 'choisir une matière') + '</span>' +
              '</div>' +

              '<input type="text" id="xlabTitre" class="xlab-titre-input" value="' + esc(d.titre) + '" ' +
                'placeholder="Titre de la carte…" maxlength="120" aria-label="Titre">' +
              '<textarea id="xlabQ" class="xlab-q-input" rows="3" placeholder="Énoncé / question (facultatif)…" aria-label="Énoncé">' +
                esc(d.question) + '</textarea>' +
              '<textarea id="xlabR" class="xlab-r-input" rows="2" placeholder="Réponse (facultatif)…" aria-label="Réponse">' +
                esc(d.reponse) + '</textarea>' +

              '<button type="button" class="bp anki-reveal xlab-save-btn" onclick="window.xlabSave()">' +
                (window.iconLabel ? window.iconLabel('check', 'Enregistrer la carte') : 'Enregistrer la carte') +
              '</button>' +

              '<div class="anki-sess-foot xlab-foot" id="xlabStatGroup">' +
                '<div class="xlab-foot-stats">' +
                  '<button type="button" class="bs xlab-foot-stat' + (d.statut !== 'actif' ? ' is-active' : '') + '" data-stat="reservoir" onclick="window.xlabSetStat(\'reservoir\')">Réservoir</button>' +
                  '<button type="button" class="bs xlab-foot-stat' + (d.statut === 'actif' ? ' is-active' : '') + '" data-stat="actif" onclick="window.xlabSetStat(\'actif\')">Actif</button>' +
                '</div>' +
                '<div class="anki-sess-foot-actions">' +
                  '<button type="button" class="bs" onclick="window.xlabReset()">' +
                    (window.iconLabel ? window.iconLabel('refresh-cw', 'Réinit.') : 'Réinit.') + '</button>' +
                '</div>' +
              '</div>' +

            '</div>' +
          '</div>' +

          '<aside class="xlab-side">' +
            '<h3 class="xlab-side-title">' + (window.iconLabel ? window.iconLabel('book-open', 'Guidage') : 'Guidage') + '</h3>' +
            '<p class="anki-mut xlab-side-hint">Livres déjà créés uniquement (même règle que le modal).</p>' +
            '<section class="xlab-guidage">' +
              '<h4 class="anki-src-section-title">Énoncé · Livre</h4>' +
              '<div id="xlabLivreWrapEnonce">' + livreTilesHtml('Enonce', d.livreEnonceId, d.mat) + '</div>' +
              '<div class="fg"><label>Détails</label>' +
                '<input type="text" id="xlabDetEnonce" class="fi" value="' + esc(d.detEnonce) + '" placeholder="p.142 ex.7"></div>' +
              '<h4 class="anki-src-section-title" style="margin-top:14px;">Corrigé · Livre</h4>' +
              '<div id="xlabLivreWrapCor">' + livreTilesHtml('Cor', d.livreCorId, d.mat) + '</div>' +
              '<div class="fg"><label>Détails</label>' +
                '<input type="text" id="xlabDetCor" class="fi" value="' + esc(d.detCor) + '" placeholder="p.480"></div>' +
            '</section>' +
          '</aside>' +
        '</div>' +
      '</div>';

    if (window.hydrateIcons) window.hydrateIcons(pane);
    paintCardChrome();

    if (!window._xlabMatMenuBound) {
      window._xlabMatMenuBound = true;
      document.addEventListener('click', function (e) {
        const menu = $('xlabMatMenu');
        const chip = $('xlabMatTag');
        if (!menu || menu.classList.contains('hidden')) return;
        if (menu.contains(e.target) || (chip && chip.contains(e.target))) return;
        menu.classList.add('hidden');
      });
    }
  };
})();
