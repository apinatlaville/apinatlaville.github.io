/**
 * anki-quick.js — Onglet Rapide : cartes Y- par matière + lien chapitre + LaTeX
 */
(function () {
  const $ = id => document.getElementById(id);
  const QUICK_PROFIL = "ANGLAIS";
  const QUICK_DEFAULT_SEC = 30;

  const Q = { mat: "", filterMat: "", openMat: new Set(), coursId: "" };

  function ensure() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Q.mat && window.D.matieres && window.D.matieres.length) Q.mat = window.D.matieres[0].id;
  }

  const esc = s => window.escHtml(s);

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function faceNeedsMath(str) {
    var s = String(str == null ? '' : str);
    return s.indexOf('\\(') >= 0 || /\\[a-zA-Z[{]/.test(s);
  }

  function mathLiveReady() {
    try {
      if (window.MathfieldElement && typeof window.MathfieldElement.convertLatexToMarkup === 'function') return true;
      if (window.MathLive && typeof window.MathLive.convertLatexToMarkup === 'function') return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  /** Placeholder lisible tant que MathLive n’a pas rendu la formule. */
  function formatFacePlaceholder() {
    return '<span class="qk-math-pending" aria-busy="true">Formule en cours de rendu…</span>';
  }

  function applyCardFaceHtml(el, raw, side, opts) {
    if (!el) return;
    opts = opts || {};
    if (side === 'r' && !(raw || '').trim()) {
      el.innerHTML = '<em style="color:var(--mut);">Pas de réponse — auto-évaluation libre</em>';
      return;
    }
    if (!raw) {
      el.innerHTML = '';
      return;
    }
    if (faceNeedsMath(raw) && !mathLiveReady() && !opts.allowFallback) {
      el.innerHTML = formatFacePlaceholder();
      return;
    }
    if (typeof window.formatCardFaceHtml === 'function') {
      el.innerHTML = window.formatCardFaceHtml(raw);
    } else {
      el.innerHTML = esc(raw);
    }
  }

  /** Re-rendu des faces LaTeX une fois MathLive + formatCardFaceHtml prêts */
  window.hydrateQuickCardFaces = function (root) {
    var host = root || document.getElementById('qkSections') || document;
    if (!host) return Promise.resolve();

    function collectMathNodes() {
      return host.querySelectorAll('[data-card-face-id]');
    }

    function anyFaceNeedsMath(nodes) {
      var needs = false;
      nodes.forEach(function (el) {
        var id = el.getAttribute('data-card-face-id');
        var side = el.getAttribute('data-card-face-side') || 'q';
        var c = window.AnkiAlgo && window.AnkiAlgo.findCard(window.D, id);
        if (!c) return;
        var raw = side === 'r' ? (c.reponse || '') : (c.question || '');
        if (faceNeedsMath(raw)) needs = true;
      });
      return needs;
    }

    function paintFaces(allowFallback) {
      /* Re-query : le DOM a pu être re-rendu pendant le chargement async */
      var nodes = collectMathNodes();
      nodes.forEach(function (el) {
        var id = el.getAttribute('data-card-face-id');
        var side = el.getAttribute('data-card-face-side') || 'q';
        var c = window.AnkiAlgo && window.AnkiAlgo.findCard(window.D, id);
        if (!c) return;
        var raw = side === 'r' ? (c.reponse || '') : (c.question || '');
        applyCardFaceHtml(el, raw, side, { allowFallback: !!allowFallback });
        var card = el.closest('.qk-card');
        if (card && faceNeedsMath(raw)) card.classList.add('qk-card--math');
      });
    }

    var initial = collectMathNodes();
    if (!initial.length || !anyFaceNeedsMath(initial)) return Promise.resolve();

    var loadScripts = Promise.resolve();
    if (typeof window.ensureScriptsForTab === 'function') {
      loadScripts = window.ensureScriptsForTab('quickLatex');
    }
    return loadScripts.then(function () {
      if (typeof window.ensureMathLive === 'function') return window.ensureMathLive();
    }).then(function () {
      paintFaces(false);
      /* Si MathLive a échoué silencieusement, éviter le placeholder éternel */
      if (!mathLiveReady()) paintFaces(true);
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Rapide] hydrate LaTeX', err);
      }
      paintFaces(true);
    });
  };

  function isQuickCard(c) {
    return window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === "quick";
  }

  function matInfo(id) {
    return (window.D.matieres || []).find(m => m.id === id) || { color: '#666', label: id || '?', name: id || '?' };
  }

  function coursOptsForMat(matId, selected) {
    const list = (window.D.cours || []).filter(c => !matId || c.mat === matId);
    if (!list.length) {
      return '<option value="">— Aucun chapitre pour cette matière —</option>';
    }
    return '<option value="">— Chapitre (optionnel) —</option>' + list.map(c =>
      `<option value="${esc(c.uid)}"${c.uid === selected ? ' selected' : ''}>${esc(c.uid)} · ${esc(c.title)}</option>`
    ).join('');
  }

  function formatFace(str) {
    if (faceNeedsMath(str) && !mathLiveReady()) {
      return formatFacePlaceholder();
    }
    if (typeof window.formatCardFaceHtml === 'function') return window.formatCardFaceHtml(str);
    if (typeof window.formatQuickCardHtml === 'function') return window.formatQuickCardHtml(str);
    // Fallback sûr si latex-test pas encore chargé : texte échappé uniquement
    return esc(str);
  }

  window.renderFlashcards = function () {
    ensure();
    const root = $("paneFlashcards");
    if (!root) return;

    const matOpts = (window.D.matieres || []).map(m =>
      `<option value="${m.id}" ${Q.mat === m.id ? 'selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`
    ).join('');
    const filterMatOpts = '<option value="">Toutes</option>' + (window.D.matieres || []).map(m =>
      `<option value="${m.id}" ${Q.filterMat === m.id ? 'selected' : ''}>${esc(m.label)}</option>`
    ).join('');

    root.innerHTML = `
      <div class="quick-head">
        <h2>${window.iconLabel('zap', 'Rapide — cartes Y-')}</h2>
        <p>Cartes courtes par matière · lien chapitre · option LaTeX. Nouvelle carte → <b>active directement</b>.</p>
      </div>

      <div class="quick-create">
        <div class="quick-create-row quick-create-faces">
          <div class="quick-face-field">
            <input type="text" id="qkQ" placeholder="Question / recto">
            <button type="button" class="bs quick-latex-btn" title="Éditeur LaTeX recto"
              onclick="window.quickOpenLatex('recto')">${window.iconLabel('sigma', 'LaTeX')}</button>
          </div>
          <div class="quick-face-field">
            <input type="text" id="qkR" placeholder="Réponse / verso (facultatif)">
            <button type="button" class="bs quick-latex-btn" title="Éditeur LaTeX verso"
              onclick="window.quickOpenLatex('verso')">${window.iconLabel('sigma', 'LaTeX')}</button>
          </div>
        </div>
        <div class="quick-create-row">
          <select id="qkMat" onchange="window.quickMatChanged(this.value)">${matOpts}</select>
          <select id="qkCours">${coursOptsForMat(Q.mat, Q.coursId)}</select>
          <button type="button" class="bs" onclick="window.quickOpenLatex('both')" title="Recto et verso en LaTeX">
            ${window.iconLabel('sigma', 'Carte LaTeX')}
          </button>
          <button class="bp" onclick="window.quickAdd()">${window.iconLabel('plus', 'Créer (active)')}</button>
        </div>
        <div class="quick-mut">${window.iconLabel('lightbulb', 'LaTeX ouvre l’éditeur Easy (popup). Entrée = créer (texte simple).')}</div>
      </div>

      <div class="quick-filters">
        <div class="search-field">
          ${window.iconHtml('search', 14, 'icon-sm')}
          <input type="text" id="qkSearch" placeholder="Filtrer..." oninput="window.quickFilter()">
        </div>
        <select id="qkFltMat" onchange="window.quickFilterMat(this.value)">${filterMatOpts}</select>
        <button class="bs" onclick="window.quickStartAll()">${window.iconLabel('play', 'Réviser le lot filtré (actives)')}</button>
      </div>

      <div id="qkSections"></div>
    `;
    renderSections();
    bindEnter();
    if (window.hydrateIcons) window.hydrateIcons(root);
  };

  window.quickMatChanged = function (matId) {
    Q.mat = matId;
    Q.coursId = '';
    const sel = $('qkCours');
    if (sel) sel.innerHTML = coursOptsForMat(matId, '');
  };

  window.quickOpenLatex = function (side) {
    ensure();
    const mat = ($('qkMat') && $('qkMat').value) || Q.mat;
    const coursId = ($('qkCours') && $('qkCours').value) || '';
    const q = ($('qkQ') && $('qkQ').value) || '';
    const r = ($('qkR') && $('qkR').value) || '';
    const latexRecto = side === 'recto' || side === 'both';
    const latexVerso = side === 'verso' || side === 'both';
    const go = function () {
      if (typeof window.openQuickLatexCard !== 'function') {
        window.sysAlert('Éditeur LaTeX non chargé.', 'Erreur');
        return;
      }
      window.openQuickLatexCard({
        latexRecto,
        latexVerso: latexVerso || (side === 'verso'),
        focusSide: side === 'verso' ? 'verso' : 'recto',
        mat,
        coursIds: coursId ? [coursId] : [],
        question: q,
        reponse: r,
        restoreOverlay: null,
        fieldQ: 'qkQ',
        fieldR: 'qkR'
      });
    };
    if (typeof window.ensureScriptsForTab === 'function') {
      window.ensureScriptsForTab('quickLatex').then(go).catch(function () {
        window.sysAlert('Impossible de charger l’éditeur LaTeX.', 'Erreur');
      });
    } else {
      go();
    }
  };

  function bindEnter() {
    const r = $("qkR"); const q = $("qkQ");
    if (r) {
      r.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.quickAdd(); }
      };
    }
    if (q) {
      q.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (r) r.focus(); }
      };
    }
  }

  window.quickAdd = function () {
    if (window._quickAddInFlight) return;
    const qEl = $("qkQ");
    const rEl = $("qkR");
    const matEl = $("qkMat");
    if (!qEl || !matEl) return;
    const q = (qEl.value || '').trim();
    if (!q) { qEl.focus(); return; }
    const r = rEl ? (rEl.value || '').trim() : '';
    const mat = matEl.value;
    const coursId = ($("qkCours") && $("qkCours").value) || '';
    Q.mat = mat;
    Q.coursId = coursId;
    if (!window.quickAddAnkiCard) { window.sysAlert("Module Anki non chargé.", "Erreur"); return; }
    window._quickAddInFlight = true;
    const createBtn = document.querySelector('.quick-create .bp');
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.setAttribute('aria-busy', 'true');
    }
    const doAdd = function () {
      if (typeof window.quickAddAnkiCard !== 'function') {
        window.sysAlert("Module Anki non chargé.", "Erreur");
        return Promise.reject(new Error('NO_ANKI'));
      }
      return Promise.resolve(window.quickAddAnkiCard({
        question: q,
        reponse: r,
        mat,
        profil: QUICK_PROFIL,
        tempsCible: QUICK_DEFAULT_SEC,
        statut: "actif",
        importance: 3,
        coursIds: coursId ? [coursId] : []
      })).then(function (card) {
        if (!card) return;
        qEl.value = '';
        if (rEl) rEl.value = '';
        qEl.focus();
        renderSections();
        if (typeof window.showToast === 'function') {
          window.showToast('Carte ' + card.id + ' créée.');
        }
      });
    };
    const finish = function () {
      window._quickAddInFlight = false;
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.removeAttribute('aria-busy');
      }
    };
    if (typeof window.ensureScriptsForTab === 'function') {
      window.ensureScriptsForTab('ankiV2').then(doAdd).catch(function () {
        window.sysAlert("Module Anki non chargé.", "Erreur");
      }).finally(finish);
    } else {
      Promise.resolve(doAdd()).finally(finish);
    }
  };

  window.quickFilter = function () { renderSections(); };
  window.quickFilterMat = function (v) { Q.filterMat = v; renderSections(); };

  window.quickToggleMat = function (matId) {
    if (Q.openMat.has(matId)) Q.openMat.delete(matId);
    else Q.openMat.add(matId);
    renderSections();
  };

  window.quickActivate = function (id) {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : activation de carte indisponible.')) {
      return;
    }
    const c = window.AnkiAlgo.findCard(window.D, id);
    if (!c || !window.AnkiAlgo.isReservoir(c)) return;
    window.AnkiAlgo.activateFromReservoir(c);
    window.save();
    renderSections();
  };

  window.quickActivateMat = function (matId) {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : activation de carte indisponible.')) {
      return;
    }
    getFiltered().filter(c => c.mat === matId && window.AnkiAlgo.isReservoir(c)).forEach(c => {
      window.AnkiAlgo.activateFromReservoir(c);
    });
    window.save();
    renderSections();
  };

  function getFiltered() {
    const q = ($("qkSearch") && $("qkSearch").value || '').toLowerCase().trim();
    let list = (window.D.exercices || []).filter(isQuickCard);
    if (Q.filterMat) list = list.filter(c => c.mat === Q.filterMat);
    if (q) list = list.filter(c => (c.question + ' ' + (c.reponse || '') + ' ' + (c.titre || '') + ' ' + c.id).toLowerCase().includes(q));
    list.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
    return list;
  }

  function quickCardStats(c) {
    if (window.cardAlgoStatsLine) return window.cardAlgoStatsLine(c);
    return '';
  }

  function coursChip(c) {
    const ids = c.coursIds || (c.coursId ? [c.coursId] : []);
    if (!ids.length) return '';
    const labels = ids.map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      return co ? co.uid : uid;
    });
    return `<span class="anki-tag qk-cours-chip" title="Chapitre(s) lié(s)">${esc(labels.join(', '))}</span>`;
  }

  function renderCard(c) {
    const m = matInfo(c.mat);
    const inRes = window.AnkiAlgo.isReservoir(c);
    const typeCls = window.cardTypeSurfaceClass ? window.cardTypeSurfaceClass('quick') : '';
    const typeBadge = window.cardTypeBadgeHtml ? window.cardTypeBadgeHtml('quick') : '';
    const isMath = faceNeedsMath(c.question) || faceNeedsMath(c.reponse);
    return `
      <div class="qk-card ${typeCls}${inRes ? ' qk-reservoir' : ''}${isMath ? ' qk-card--math' : ''}" onclick="this.classList.toggle('flipped')">
        <div class="qk-inner">
          <div class="qk-front">
            <div class="qk-top">
              ${typeBadge}
              <span class="qk-mat" style="background:${m.color};">${esc(m.label)}</span>
              <span class="qk-id">${c.id}</span>
              ${coursChip(c)}
              ${inRes ? `<span class="anki-tag" style="background:rgba(255,170,51,.15);color:var(--gold);">Ancien réservoir</span>` : ''}
            </div>
            <div class="qk-q" data-card-face-id="${escAttr(c.id)}" data-card-face-side="q">${formatFace(c.question)}</div>
            <div class="qk-foot">
              <span class="anki-mut">${window.iconLabel('zap', 'Rapide')}</span>
              <span class="qk-actions" onclick="event.stopPropagation();">
                ${inRes ? `<button class="bs" onclick="window.quickActivate('${c.id}')">${window.iconLabel('zap', 'Activer')}</button>` : window.iconBtn('play', 'Réviser', `onclick="window.startAnkiSingle('${c.id}')"`)}
                ${typeof window.iconEditBtn === 'function' ? window.iconEditBtn(`window.editExo('${c.id}')`) : window.iconBtn('pencil', 'Modifier', `onclick="window.editExo('${c.id}')"`)}
                ${typeof window.iconDeleteBtn === 'function' ? window.iconDeleteBtn(`window.delExo('${c.id}')`) : `<button class="cbt icon-only-btn" aria-label="Supprimer" title="Supprimer" style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${c.id}')">${window.iconHtml('trash-2', 16, 'icon-sm')}</button>`}
              </span>
            </div>
            <div class="anki-card-stats qk-stats">${quickCardStats(c)}</div>
          </div>
          <div class="qk-back">
            <div class="qk-r" data-card-face-id="${escAttr(c.id)}" data-card-face-side="r">${c.reponse ? formatFace(c.reponse) : '<em style="color:var(--mut);">Pas de réponse — auto-évaluation libre</em>'}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSections() {
    const host = $("qkSections");
    if (!host) return;
    const list = getFiltered();
    if (!list.length) {
      host.innerHTML = '<div class="anki-empty">' + window.iconLabel('mouse-pointer-click', 'Aucune carte Y-. Crée la première ci-dessus') + '</div>';
      return;
    }

    const byMat = {};
    list.forEach(c => {
      const k = c.mat || '?';
      if (!byMat[k]) byMat[k] = { active: [], reservoir: [] };
      if (window.AnkiAlgo.isReservoir(c)) byMat[k].reservoir.push(c);
      else if (c.statut === 'actif') byMat[k].active.push(c);
    });

    const matOrder = (window.D.matieres || []).map(m => m.id).filter(id => byMat[id]);
    Object.keys(byMat).forEach(id => { if (!matOrder.includes(id)) matOrder.push(id); });

    host.innerHTML = matOrder.map(matId => {
      const m = matInfo(matId);
      const g = byMat[matId];
      const open = Q.openMat.has(matId) || !!Q.filterMat;
      return `
        <div class="anki-lib-mat quick-mat${open ? ' open' : ''}">
          <div class="anki-lib-mat-hdr" style="border-left:4px solid ${m.color};" onclick="window.quickToggleMat('${esc(matId)}')" role="button" tabindex="0">
            <span class="anki-lib-chevron">${open ? '▼' : '▶'}</span>
            <span class="anki-lib-grp-mat" style="background:${m.color}20;color:${m.color};">${esc(m.label)}</span>
            <span class="anki-lib-mat-name">${esc(m.name || matId)}</span>
            <span class="anki-mut" style="margin-left:auto;">${g.active.length} actives · ${g.reservoir.length} réservoir</span>
          </div>
          ${open ? `
          <div class="anki-lib-mat-body">
            ${g.reservoir.length ? `
              <div class="quick-reservoir-block">
                <div class="quick-reservoir-hdr">
                  <span>${window.iconLabel('hourglass', 'Réservoir Y-')}</span>
                  <button class="bs" onclick="event.stopPropagation();window.quickActivateMat('${esc(matId)}')">${window.iconLabel('zap', 'Activer toute la matière')}</button>
                </div>
                <div class="quick-grid">${g.reservoir.map(renderCard).join('')}</div>
              </div>` : ''}
            ${g.active.length ? `
              <div class="quick-active-block">
                <p class="anki-mut" style="font-size:11px;margin:8px 0;">${window.iconLabel('play', 'Actives')}</p>
                <div class="quick-grid">${g.active.map(renderCard).join('')}</div>
              </div>` : ''}
          </div>` : ''}
        </div>
      `;
    }).join('');
    if (window.hydrateIcons) window.hydrateIcons(host);
    if (typeof window.hydrateQuickCardFaces === 'function') {
      window.hydrateQuickCardFaces(host);
    }
  }

  window.quickStartAll = function () {
    const list = getFiltered().filter(c => c.statut === 'actif');
    if (!list.length) return window.sysAlert("Aucune carte Y- active à réviser.", "Rapide");
    window.save();
    if (window.startAnkiSingle && list.length === 1) {
      window.startAnkiSingle(list[0].id);
    } else if (typeof window.ankiV2SetQuickQueue === 'function') {
      window.ankiV2SetQuickQueue(list.map(c => c.id));
      window.switchTab('ankiV2');
    } else if (window.startAnkiSingle) {
      window.startAnkiSingle(list[0].id);
    }
  };
})();
