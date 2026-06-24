/**
 * anki-quick.js — Onglet Rapide : cartes Y- par matière + réservoir Y-
 */
(function () {
  const $ = id => document.getElementById(id);
  const QUICK_PROFIL = "ANGLAIS";

  const Q = { mat: "", filterMat: "", openMat: new Set() };

  function ensure() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Q.mat && window.D.matieres && window.D.matieres.length) Q.mat = window.D.matieres[0].id;
  }

  const esc = s => window.escHtml(s);

  function isQuickCard(c) {
    return window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === "quick";
  }

  function matInfo(id) {
    return (window.D.matieres || []).find(m => m.id === id) || { color: '#666', label: id || '?', name: id || '?' };
  }

  window.renderFlashcards = function () {
    ensure();
    const root = $("paneFlashcards");
    if (!root) return;

    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${Q.mat === m.id ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const filterMatOpts = '<option value="">Toutes</option>' + (window.D.matieres || []).map(m => `<option value="${m.id}" ${Q.filterMat === m.id ? 'selected' : ''}>${m.label}</option>`).join('');

    root.innerHTML = `
      <div class="quick-head">
        <h2>${window.iconLabel('zap', 'Rapide — cartes Y-')}</h2>
        <p>Cartes courtes (~30s) par matière. Nouvelle carte → <b>réservoir</b> (active-la ci-dessous). Révision dédiée aux Y- actives.</p>
      </div>

      <div class="quick-create">
        <div class="quick-create-row">
          <input type="text" id="qkQ" placeholder="Question / recto (ex: « to elicit »)">
          <input type="text" id="qkR" placeholder="Réponse / verso (facultatif)">
        </div>
        <div class="quick-create-row">
          <select id="qkMat">${matOpts}</select>
          <input type="number" id="qkTemps" min="0.25" max="5" step="0.25" value="0.5" title="Temps cible (min)">
          <span class="anki-mut" style="align-self:center;font-size:12px;">min</span>
          <button class="bp" onclick="window.quickAdd()">${window.iconLabel('plus', 'Créer (réservoir)')}</button>
        </div>
        <div class="quick-mut">${window.iconLabel('lightbulb', 'Entrée dans le champ Réponse pour créer rapidement.')}</div>
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

  function bindEnter() {
    const r = $("qkR"); const q = $("qkQ");
    if (r) r.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); window.quickAdd(); } });
    if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter' && r) r.focus(); });
  }

  window.quickAdd = function () {
    const q = $("qkQ").value.trim();
    if (!q) { $("qkQ").focus(); return; }
    const r = $("qkR").value.trim();
    const mat = $("qkMat").value;
    const temps = Math.round((parseFloat($("qkTemps").value) || 0.5) * 60);
    if (!window.quickAddAnkiCard) { window.sysAlert("Module Anki non chargé.", "Erreur"); return; }
    window.quickAddAnkiCard({
      question: q, reponse: r, mat, profil: QUICK_PROFIL,
      tempsCible: temps, statut: "reservoir", importance: 3
    });
    $("qkQ").value = ''; $("qkR").value = '';
    $("qkQ").focus();
    renderSections();
  };

  window.quickFilter = function () { renderSections(); };
  window.quickFilterMat = function (v) { Q.filterMat = v; renderSections(); };

  window.quickToggleMat = function (matId) {
    if (Q.openMat.has(matId)) Q.openMat.delete(matId);
    else Q.openMat.add(matId);
    renderSections();
  };

  window.quickActivate = function (id) {
    const c = window.AnkiAlgo.findCard(window.D, id);
    if (!c || !window.AnkiAlgo.isReservoir(c)) return;
    window.AnkiAlgo.activateFromReservoir(c);
    window.save();
    renderSections();
  };

  window.quickActivateMat = function (matId) {
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

  function renderCard(c) {
    const m = matInfo(c.mat);
    const inRes = window.AnkiAlgo.isReservoir(c);
    return `
      <div class="qk-card${inRes ? ' qk-reservoir' : ''}" onclick="this.classList.toggle('flipped')">
        <div class="qk-inner">
          <div class="qk-front">
            <div class="qk-top">
              <span class="qk-mat" style="background:${m.color};">${m.label}</span>
              <span class="qk-id">${c.id}</span>
              ${inRes ? `<span class="anki-tag" style="background:rgba(255,170,51,.15);color:var(--gold);">Réservoir</span>` : ''}
            </div>
            <div class="qk-q">${esc(c.question)}</div>
            <div class="qk-foot">
              <span class="anki-mut">${window.iconLabel('zap', 'Rapide')}</span>
              <span class="qk-actions" onclick="event.stopPropagation();">
                ${inRes ? `<button class="bs" onclick="window.quickActivate('${c.id}')">${window.iconLabel('zap', 'Activer')}</button>` : window.iconBtn('play', 'Réviser', `onclick="window.startAnkiSingle('${c.id}')"`)}
                ${window.iconBtn('pencil', 'Modifier', `onclick="window.editExo('${c.id}')"`)}
                <button class="cbt icon-only-btn" aria-label="Supprimer" title="Supprimer" style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${c.id}')">${window.iconHtml('trash-2', 16, 'icon-sm')}</button>
              </span>
            </div>
            <div class="anki-card-stats qk-stats">${quickCardStats(c)}</div>
          </div>
          <div class="qk-back">
            <div class="qk-r">${c.reponse ? esc(c.reponse) : '<em style="color:var(--mut);">Pas de réponse — auto-évaluation libre</em>'}</div>
            <div class="anki-mut" style="font-size:11px;text-align:center;">${window.iconLabel('timer', window.AnkiAlgo ? window.AnkiAlgo.fmtDur(c.tempsCible || 60) : (c.tempsCible || 60) + 's')}</div>
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
      const total = g.active.length + g.reservoir.length;
      const open = Q.openMat.has(matId) || !!Q.filterMat;
      return `
        <div class="anki-lib-mat quick-mat${open ? ' open' : ''}">
          <div class="anki-lib-mat-hdr" style="border-left:4px solid ${m.color};" onclick="window.quickToggleMat('${esc(matId)}')" role="button" tabindex="0">
            <span class="anki-lib-chevron">${open ? '▼' : '▶'}</span>
            <span class="anki-lib-grp-mat" style="background:${m.color}20;color:${m.color};">${m.label}</span>
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
  }

  window.quickStartAll = function () {
    const list = getFiltered().filter(c => c.statut === 'actif');
    if (!list.length) return window.sysAlert("Aucune carte Y- active à réviser. Active des cartes depuis le réservoir.", "Rapide");
    window.save();
    if (window.startAnkiSingle && list.length === 1) {
      window.startAnkiSingle(list[0].id);
    } else if (typeof window.ankiSetQuickQueue === 'function') {
      window.ankiSetQuickQueue(list.map(c => c.id));
    } else if (window.startAnkiSingle) {
      window.startAnkiSingle(list[0].id);
    }
  };
})();
