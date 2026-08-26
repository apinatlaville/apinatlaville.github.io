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

  /** Re-rendu des faces LaTeX une fois MathLive / formatCardFaceHtml chargés */
  window.hydrateQuickCardFaces = function (root) {
    var host = root || document.getElementById('qkSections') || document;
    var nodes = host.querySelectorAll('[data-card-face-id]');
    if (!nodes.length) return Promise.resolve();
    var needs = false;
    nodes.forEach(function (el) {
      var id = el.getAttribute('data-card-face-id');
      var side = el.getAttribute('data-card-face-side') || 'q';
      var c = window.AnkiAlgo && window.AnkiAlgo.findCard(window.D, id);
      if (!c) return;
      var raw = side === 'r' ? (c.reponse || '') : (c.question || '');
      if (faceNeedsMath(raw)) needs = true;
    });
    if (!needs) return Promise.resolve();
    var load = Promise.resolve();
    if (typeof window.ensureScriptsForTab === 'function') {
      load = window.ensureScriptsForTab('quickLatex');
    } else if (typeof window.ensureMathLive === 'function') {
      load = window.ensureMathLive();
    }
    return load.then(function () {
      nodes.forEach(function (el) {
        var id = el.getAttribute('data-card-face-id');
        var side = el.getAttribute('data-card-face-side') || 'q';
        var c = window.AnkiAlgo && window.AnkiAlgo.findCard(window.D, id);
        if (!c || typeof window.formatCardFaceHtml !== 'function') return;
        var raw = side === 'r' ? (c.reponse || '') : (c.question || '');
        if (!raw) return;
        if (side === 'r' && !raw.trim()) {
          el.innerHTML = '<em style="color:var(--mut);">Pas de réponse — auto-évaluation libre</em>';
        } else {
          el.innerHTML = window.formatCardFaceHtml(raw);
        }
      });
    }).catch(function () { /* garde le fallback texte */ });
  };

  function isQuickCard(c) {
    return window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === "quick";
  }

  function matInfo(id) {
    return (window.D.matieres || []).find(m => m.id === id) || { color: '#666', label: id || '?', name: id || '?' };
  }

  function formatFace(str) {
    if (typeof window.formatCardFaceHtml === 'function') return window.formatCardFaceHtml(str);
    if (typeof window.formatQuickCardHtml === 'function') return window.formatQuickCardHtml(str);
    // Fallback sûr si latex-test pas encore chargé : texte échappé uniquement
    return esc(str);
  }

  window.closeQuickCreateMenu = function () {
    const menu = document.getElementById('quickCreateMenu');
    const trigger = document.getElementById('btnQuickCreateMenu');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  };

  window.toggleQuickCreateMenu = function () {
    const menu = document.getElementById('quickCreateMenu');
    const trigger = document.getElementById('btnQuickCreateMenu');
    if (!menu || !trigger) return;
    const open = !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  function bindQuickCreateMenu() {
    const trigger = document.getElementById('btnQuickCreateMenu');
    const btnSingle = document.getElementById('btnQuickCreateSingle');
    const btnBatch = document.getElementById('btnQuickCreateBatch');
    if (trigger && trigger.dataset.bound !== '1') {
      trigger.dataset.bound = '1';
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        window.toggleQuickCreateMenu();
      });
    }
    if (btnSingle && btnSingle.dataset.bound !== '1') {
      btnSingle.dataset.bound = '1';
      btnSingle.addEventListener('click', function () {
        window.closeQuickCreateMenu();
        window.quickAdd('single');
      });
    }
    if (btnBatch && btnBatch.dataset.bound !== '1') {
      btnBatch.dataset.bound = '1';
      btnBatch.addEventListener('click', function () {
        window.closeQuickCreateMenu();
        window.quickAdd('batch');
      });
    }
    if (!window._quickCreateMenuDocBound) {
      window._quickCreateMenuDocBound = true;
      document.addEventListener('click', function (e) {
        const menu = document.getElementById('quickCreateMenu');
        if (!menu || !menu.classList.contains('open')) return;
        if (menu.contains(e.target)) return;
        window.closeQuickCreateMenu();
      });
    }
  }

  /**
   * Ouvre le modal de création Rapide (même flux que Synchrotron / FAB).
   * @param {'single'|'batch'} [mode]
   */
  window.quickAdd = function (mode) {
    ensure();
    const m = mode === 'batch' ? 'batch' : 'single';
    const go = function () {
      window._cardCreateOpts = Q.mat ? { mat: Q.mat } : {};
      window._quickCreateMode = m;
      window._quickCreateCount = 0;
      if (typeof window.closeQuickCreateMenu === 'function') window.closeQuickCreateMenu();
      if (typeof window.ankiV2OpenQuickModal === 'function') {
        window.ankiV2OpenQuickModal({ mode: m, mat: Q.mat || undefined });
        return;
      }
      if (typeof window.openQuickCardCreate === 'function') {
        window.openQuickCardCreate(m);
        return;
      }
      if (typeof window.sysAlert === 'function') {
        window.sysAlert('Module Anki non chargé.', 'Erreur');
      }
    };
    const load = typeof window.ensureAnkiUi === 'function'
      ? window.ensureAnkiUi()
      : (typeof window.ensureScriptsForTab === 'function'
        ? window.ensureScriptsForTab('ankiV2')
        : Promise.resolve());
    Promise.resolve(load).then(function () {
      if (typeof window.ankiV2OpenQuickModal === 'function') {
        go();
        return;
      }
      if (typeof window.ensureScriptsForTab === 'function') {
        return window.ensureScriptsForTab('ankiV2').then(function () {
          if (typeof window.ankiV2OpenQuickModal === 'function') go();
          else if (typeof window.openQuickCardCreate === 'function') window.openQuickCardCreate(m);
          else if (typeof window.sysAlert === 'function') {
            window.sysAlert('Module Anki non chargé.', 'Erreur');
          }
        });
      }
      if (typeof window.openQuickCardCreate === 'function') window.openQuickCardCreate(m);
      else if (typeof window.sysAlert === 'function') {
        window.sysAlert('Module Anki non chargé.', 'Erreur');
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Rapide] quickAdd', err);
      }
      if (typeof window.ankiV2OpenQuickModal !== 'function'
          && typeof window.sysAlert === 'function') {
        window.sysAlert('Module Anki non chargé.', 'Erreur');
      }
    });
  };

  /** Alias : ouvre le modal puis l’éditeur LaTeX (rétrocompat). */
  window.quickOpenLatex = function (side) {
    ensure();
    const go = function () {
      if (typeof window.openQuickCardCreate === 'function') {
        window.openQuickCardCreate('single');
      } else if (typeof window.ankiV2OpenQuickModal === 'function') {
        window.ankiV2OpenQuickModal({ mat: Q.mat || undefined });
      }
      const openLatex = function () {
        if (typeof window.ankiV2QuickOpenLatex === 'function') {
          window.ankiV2QuickOpenLatex(side || 'both');
        }
      };
      setTimeout(openLatex, 0);
    };
    if (typeof window.ensureScriptsForTab === 'function') {
      window.ensureScriptsForTab('ankiV2').then(go).catch(function () {
        if (typeof window.sysAlert === 'function') {
          window.sysAlert('Module Anki non chargé.', 'Erreur');
        }
      });
    } else go();
  };

  window.renderFlashcards = function () {
    ensure();
    const root = $("paneFlashcards");
    if (!root) return;

    const filterMatOpts = '<option value="">Toutes</option>' + (window.D.matieres || []).map(m =>
      `<option value="${m.id}" ${Q.filterMat === m.id ? 'selected' : ''}>${esc(m.label)}</option>`
    ).join('');

    root.innerHTML = `
      <div class="quick-pane-toolbar">
        <div class="quick-head">
          <h2>${window.iconLabel('zap', 'Rapide — cartes Y-')}</h2>
          <p>Cartes courtes par matière · lien chapitre · option LaTeX. Nouvelle carte → <b>active directement</b>.</p>
        </div>
        <div class="cours-create-menu" id="quickCreateMenu">
          <button type="button" class="cours-create-trigger" id="btnQuickCreateMenu"
            aria-expanded="false" aria-haspopup="true" title="Créer une carte rapide">
            <span data-icon="plus" data-icon-size="14"></span>
            Créer
            <span class="cours-create-chevron" data-icon="chevron-down" data-icon-size="12"></span>
          </button>
          <div class="cours-create-dropdown" role="menu">
            <button type="button" class="cours-create-item" id="btnQuickCreateSingle" role="menuitem">
              <strong><span data-icon="zap" data-icon-size="14"></span> Créer une</strong>
              <span class="hint">1 carte rapide — ferme après création</span>
            </button>
            <button type="button" class="cours-create-item" id="btnQuickCreateBatch" role="menuitem">
              <strong><span data-icon="layers" data-icon-size="14"></span> Créer à la suite</strong>
              <span class="hint">Enchaîne plusieurs cartes (même matière / chapitre)</span>
            </button>
          </div>
        </div>
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
    bindQuickCreateMenu();
    if (window.hydrateIcons) window.hydrateIcons(root);
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
    return `
      <div class="qk-card ${typeCls}${inRes ? ' qk-reservoir' : ''}" onclick="this.classList.toggle('flipped')">
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
      host.innerHTML = '<div class="anki-empty">' + window.iconLabel('mouse-pointer-click', 'Aucune carte Y-. Utilise Créer pour en ajouter une') + '</div>';
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
