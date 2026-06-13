/**
 * =========================================================================================
 * 🧠 anki-app.js v3 — UI Mode Synchrotron (PC*)
 * =========================================================================================
 * Vues : Cockpit · Bibliothèque · Prévisions · Diagnostic · Réglages
 * Fonctions : drag&drop, slider 1-10 + boutons 3, cartes spéciales DM/Colle,
 *             score d'urgence visible, file d'attente accessible.
 * =========================================================================================
 */
(function () {
  const $ = id => document.getElementById(id);

  const S = {
    view: "cockpit",
    queue: [], current: null, showAnswer: false,
    chronoStart: 0, chronoElapsed: 0, chronoInt: null,
    stats: { ok: 0, mid: 0, bad: 0, total: 0 },
    mode: "normal",
    libFilter: { mat: "", stat: "", profil: "", q: "" },
    forecastDays: 14,
    selectionIds: new Set(),
    coursLinkSelection: new Set(),
    coursLinkQuery: "",
    manualOrder: null, // array d'ids quand l'utilisateur drag&drop
    expandedDay: null,
    sliderValue: 7,
    showSlider: false
  };

  function ensure() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
  }
  function fmtSec(s) {
    s = Math.max(0, Math.round(s));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function mat(id) { return (window.D.matieres || []).find(m => m.id === id) || { color: "#666", label: id || "?", name: id || "?" }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function pri(p) { return p === 1 ? "🔥 Urgence" : p === 3 ? "🌙 Faible" : "⭐ Normale"; }
  function profileLabel(p) { const pr = window.AnkiAlgo.getProfile(p); return pr ? pr.label : p; }

  // ===== Vue principale =====
  window.renderAnki = function () {
    ensure();
    // Décalage auto si session ratée
    const shift = window.AnkiAlgo.shiftProgramIfMissed(window.D.exercices);
    if (shift.shifted > 0) {
      window.AnkiAlgo.log("auto-shift", { count: shift.shifted, reason: "session ratée → décalage à aujourd'hui" });
      window.save();
    }
    const root = $("paneAnki");
    if (!root) return;

    const exos = window.D.exercices;
    const actifs = exos.filter(c => c.statut === "actif").length;
    const reservoir = exos.filter(c => c.statut === "attente").length;
    const cands = window.AnkiAlgo.getCandidates(exos);
    const sessionMin = (window.D.settings && window.D.settings.ankiSessionMin) || 60;

    root.innerHTML = `
      <div class="anki-head">
        <h2>🧬 Synchrotron <span class="anki-sub">— Répétition espacée PC*</span></h2>
        <p>Coefficient d'urgence continu · Auto + Override · Cartes spéciales DM/Colle.</p>
      </div>

      <div class="anki-nav">
        <button class="anki-tab ${S.view === 'cockpit' ? 'on' : ''}" onclick="window.ankiSetView('cockpit')">🎛 Cockpit</button>
        <button class="anki-tab ${S.view === 'library' ? 'on' : ''}" onclick="window.ankiSetView('library')">📚 Bibliothèque</button>
        <button class="anki-tab ${S.view === 'forecast' ? 'on' : ''}" onclick="window.ankiSetView('forecast')">📅 Prévisions</button>
        <button class="anki-tab ${S.view === 'stats' ? 'on' : ''}" onclick="window.ankiSetView('stats')">📊 Stats</button>
        <button class="anki-tab ${S.view === 'diag' ? 'on' : ''}" onclick="window.ankiSetView('diag')">🔬 Diagnostic</button>
        <button class="anki-tab ${S.view === 'settings' ? 'on' : ''}" onclick="window.ankiSetView('settings')">⚙️ Réglages</button>
      </div>

      <div class="anki-kpis">
        <div class="kpi"><div class="kpi-n" style="color:var(--red);">${cands.length}</div><div class="kpi-l">Candidates</div></div>
        <div class="kpi"><div class="kpi-n" style="color:var(--gold);">${reservoir}</div><div class="kpi-l">Réservoir</div></div>
        <div class="kpi"><div class="kpi-n" style="color:var(--grn);">${actifs}</div><div class="kpi-l">Actives</div></div>
        <div class="kpi"><div class="kpi-n">${sessionMin}<span style="font-size:14px;color:var(--mut);">min</span></div><div class="kpi-l">Session</div></div>
      </div>

      <div id="ankiViewContent"></div>
    `;
    renderActiveView();
  };

  window.ankiSetView = function (v) { S.view = v; window.renderAnki(); };

  function renderActiveView() {
    const c = $("ankiViewContent");
    if (!c) return;
    if (S.view === "cockpit")    c.innerHTML = viewCockpit();
    else if (S.view === "library")  c.innerHTML = viewLibrary();
    else if (S.view === "forecast") c.innerHTML = viewForecast();
    else if (S.view === "stats")    c.innerHTML = viewStats();
    else if (S.view === "diag")     c.innerHTML = viewDiag();
    else if (S.view === "settings") c.innerHTML = viewSettings();
    bindDragDrop();
  }

  // ====== VUE COCKPIT ======
  function viewCockpit() {
    const settings = window.D.settings || {};
    const sessionMin = settings.ankiSessionMin || 60;
    const includeNew = settings.ankiIncludeNew !== undefined ? settings.ankiIncludeNew : 5;
    const selectedIds = Array.from(S.selectionIds);
    const isManualMode = selectedIds.length > 0 || S.manualOrder;

    const plan = window.AnkiAlgo.buildSession(window.D.exercices, {
      sessionMinutes: sessionMin,
      includeNew,
      selectedIds: selectedIds.length ? selectedIds : null,
      manualOrder: S.manualOrder
    });

    const cartes = plan.cartes;
    const total = plan.tempsTotalPrev;

    // Bloc 1 : file (auto OU manuelle selon ce que l'utilisateur a coché)
    let html = `
      <div class="anki-card-block ${isManualMode ? 'manual' : 'auto'}">
        <div class="anki-block-hdr">
          <div>
            <h3>${isManualMode ? '✋ File MANUELLE' : '🤖 File AUTOMATIQUE'} <span class="anki-mut">(${cartes.length} cartes · ${window.AnkiAlgo.fmtDur(total)})</span></h3>
            <p class="anki-mut">${plan.countDue} dues · ${plan.countNew} nouvelles · ${isManualMode ? '<span style="color:var(--gold);">Ta sélection / ton ordre</span>' : '<span style="color:var(--grn);">L&apos;algorithme choisit pour toi</span>'}</p>
          </div>
          <div class="anki-block-actions">
            <button class="bs" onclick="window.ankiQuickEditSession()">⏱ ${sessionMin} min</button>
            ${isManualMode ? `<button class="bs" onclick="window.ankiBackToAuto()">↺ Revenir à l'auto</button>` : ''}
            <button class="bp" onclick="window.startAnkiSession()" ${cartes.length === 0 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>▶ Commencer</button>
          </div>
        </div>
        <p class="anki-mut" style="font-size:11px;margin:0 0 8px;">💡 Glisse-dépose les cartes pour personnaliser l'ordre. Clique sur une carte pour la réviser tout de suite.</p>
        <div class="anki-queue" id="ankiQueueDrop">
          ${cartes.length === 0 ? '<div class="anki-empty">Aucune carte à réviser. 🎉</div>' : cartes.map((c, i) => renderQueueRow(c, i)).join('')}
        </div>
        ${plan.reportees.length ? `<div class="anki-mut" style="margin-top:8px;font-size:11px;">${plan.reportees.length} carte(s) hors budget → reportées</div>` : ""}
      </div>
    `;

    // Bloc 2 : sélection / recherche dans toutes les cartes
    const allCards = (window.D.exercices || []).filter(c => c.statut === 'actif' || c.statut === 'attente');
    const candidats = window.AnkiAlgo.getCandidates(window.D.exercices)
      .map(x => ({ ...x.card, _urg: x.score.total }));
    const cockpitSearch = S.cockpitSearch || '';
    let displayList = candidats;
    if (cockpitSearch) {
      const q = cockpitSearch.toLowerCase();
      displayList = allCards.filter(c =>
        ((c.titre || '') + ' ' + (c.question || '') + ' ' + (c.id || '')).toLowerCase().includes(q)
      ).map(c => {
        const urg = window.AnkiAlgo.urgenceScore(c).total;
        return { ...c, _urg: urg };
      });
    }

    html += `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>🔎 Choisir mes cartes <span class="anki-mut">(au choix, en plus du proposé)</span></h3>
          <div class="anki-block-actions">
            <button class="bs" onclick="window.ankiSelectClear()">Vider</button>
            <button class="bs" onclick="window.ankiSelectAllDue()">Cocher dues</button>
          </div>
        </div>
        <input type="text" class="fi anki-search-input" placeholder="🔍 Cherche n'importe quelle carte (titre, énoncé, code)..." value="${esc(cockpitSearch)}" oninput="window.ankiCockpitSearch(this.value)">
        <p class="anki-mut" style="margin:8px 0 6px;font-size:11px;">${cockpitSearch ? `<b>Recherche dans toutes les cartes</b> (${displayList.length} résultats) — coche pour basculer en mode manuel` : `<b>Candidats triés par urgence ↓</b> — coche les cartes à inclure dans la session`}</p>
        <div class="anki-pick-grid" id="ankiPickGrid">
          ${displayList.slice(0, 80).map(c => renderPickCard(c)).join('') || '<div class="anki-empty">Aucun résultat</div>'}
        </div>
      </div>

      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>📝 Cartes spéciales (DM / Colle / Exo)</h3>
          <div class="anki-block-actions">
            <button class="bp" onclick="window.openDevoirModal()">+ Ajouter un devoir</button>
          </div>
        </div>
        <p class="anki-mut" style="font-size:12px;margin-bottom:8px;">Découpe automatique en morceaux séparés (chaque morceau est une carte indépendante dans la file).</p>
        <div class="anki-devoirs-list">${renderDevoirsList()}</div>
      </div>
    `;
    return html;
  }

  window.ankiCockpitSearch = function (v) {
    S.cockpitSearch = v;
    // Re-render seulement la grille
    const grid = $("ankiPickGrid");
    if (!grid) { renderActiveView(); return; }
    // Plus simple : re-render la vue Cockpit complète (pas la nav)
    renderActiveView();
    // Restaure le focus sur le champ
    const input = document.querySelector('.anki-search-input');
    if (input) { input.focus(); input.setSelectionRange(v.length, v.length); }
  };

  window.ankiBackToAuto = function () {
    S.selectionIds.clear();
    S.manualOrder = null;
    S.cockpitSearch = '';
    renderActiveView();
  };

  function renderQueueRow(c, i) {
    const m = mat(c.mat);
    const today = window.AnkiAlgo.todayISO();
    const isLate = c.dateProchaineRevision && c.dateProchaineRevision < today;
    const urg = window.AnkiAlgo.urgenceScore(c, today);
    const isDevoir = c.type === 'devoir';
    // Pour un DM : on affiche le temps PAR SESSION (pas la durée totale)
    const tempsAffiche = isDevoir
      ? Math.round(((c._dureeTotaleMin || (c.tempsCible / 60)) / (c._morceauxTotal || 1)) * 10) / 10
      : ((c.tempsCible || 60) / 60).toFixed(1).replace(/\.0$/, '');
    const sessionInfo = isDevoir ? ` · session ${(c._morceauxFaits || 0) + 1}/${c._morceauxTotal || 1}` : '';
    return `
      <div class="anki-q-row ${isDevoir ? 'devoir' : ''}" draggable="true" data-id="${c.id}" data-idx="${i}">
        <span class="anki-q-handle" title="Glisser">⋮⋮</span>
        <div class="anki-q-num">${i + 1}</div>
        <div class="anki-q-mat" style="background:${m.color};">${isDevoir ? '📝' : m.label}</div>
        <div class="anki-q-body" onclick="window.startAnkiSingle('${c.id}')">
          <div class="anki-q-title">${esc(c.titre || (c.question || '').substring(0, 60))}${sessionInfo}</div>
          <div class="anki-q-meta">${c.id} · urgence ${urg.total.toFixed(1)} ${isLate ? '<span style="color:var(--red);">· retard</span>' : ''}</div>
        </div>
        <div class="anki-q-time" onclick="event.stopPropagation();">
          <input type="number" min="0.25" max="600" step="0.25" value="${tempsAffiche}" title="Temps en minutes — éditable"
            onchange="window.ankiUpdateTemps('${c.id}', this.value, ${isDevoir})">
          <span class="anki-mut">min</span>
        </div>
        <div class="anki-q-go" onclick="window.startAnkiSingle('${c.id}')">▶</div>
      </div>
    `;
  }

  function renderPickCard(c) {
    const m = mat(c.mat);
    const checked = S.selectionIds.has(c.id);
    return `
      <label class="anki-pick ${checked ? 'on' : ''}" data-pickid="${c.id}">
        <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation();" onchange="window.ankiTogglePick('${c.id}', event)">
        <span class="anki-pick-mat" style="background:${m.color}20;color:${m.color};border:1px solid ${m.color};">${m.label}</span>
        <span class="anki-pick-id">${c.id}</span>
        <span class="anki-pick-q">${esc(c.titre || (c.question || '').substring(0, 40))}</span>
        <span class="anki-pick-urg" title="Coefficient d'urgence">${(c._urg || 0).toFixed(1)}</span>
      </label>
    `;
  }

  function renderDevoirsList() {
    const list = (window.D.exercices || []).filter(c => c.type === 'devoir');
    if (!list.length) return '<div class="anki-empty">Aucun devoir spécial</div>';
    return list.map(d => {
      const m = mat(d.mat);
      const done = (d._morceauxFaits || 0);
      const total = (d._morceauxTotal || 1);
      const pct = Math.round(done / total * 100);
      return `
        <div class="anki-devoir-row">
          <span class="anki-q-mat" style="background:${m.color};">📝</span>
          <div class="anki-devoir-body">
            <div class="anki-devoir-title">${esc(d.titre || d.question)}</div>
            <div class="anki-devoir-meta">${d.id} · ⏱ ${window.AnkiAlgo.fmtDur(d.tempsCible)} · ${d.dateLimite || ''} · ${done}/${total}</div>
            <div class="anki-progress"><div class="anki-progress-bar" style="width:${pct}%;background:${m.color};"></div></div>
          </div>
          <button class="cbt" onclick="window.editExo('${d.id}')">✏️</button>
          <button class="cbt" style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${d.id}')">🗑</button>
        </div>
      `;
    }).join('');
  }

  // ===== Drag & drop =====
  function bindDragDrop() {
    const box = $("ankiQueueDrop");
    if (!box) return;
    let dragId = null;
    box.querySelectorAll('.anki-q-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragId = row.dataset.id;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = box.querySelector('.dragging');
        if (!dragging || dragging === row) return;
        const rect = row.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        box.insertBefore(dragging, after ? row.nextSibling : row);
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        const ids = Array.from(box.querySelectorAll('.anki-q-row')).map(r => r.dataset.id);
        S.manualOrder = ids;
        window.AnkiAlgo.log("reorder", { ids });
        renderActiveView();
      });
    });
  }

  // ===== Sélection sans re-render complet (fix page blanche) =====
  window.ankiTogglePick = function (id, ev) {
    if (S.selectionIds.has(id)) S.selectionIds.delete(id);
    else S.selectionIds.add(id);
    // Toggle visuel local SANS re-render
    const lbl = document.querySelector(`[data-pickid="${id}"]`);
    if (lbl) lbl.classList.toggle('on', S.selectionIds.has(id));
    // Re-render seulement la file (pas la grille pour ne pas perdre les checkboxes)
    refreshQueueOnly();
    if (ev) ev.stopPropagation();
  };
  function refreshQueueOnly() {
    const box = $("ankiQueueDrop");
    if (!box) return;
    const settings = window.D.settings || {};
    const selectedIds = Array.from(S.selectionIds);
    const plan = window.AnkiAlgo.buildSession(window.D.exercices, {
      sessionMinutes: settings.ankiSessionMin || 60,
      includeNew: settings.ankiIncludeNew !== undefined ? settings.ankiIncludeNew : 5,
      selectedIds: selectedIds.length ? selectedIds : null,
      manualOrder: S.manualOrder
    });
    box.innerHTML = plan.cartes.length === 0
      ? '<div class="anki-empty">Aucune carte à réviser. 🎉</div>'
      : plan.cartes.map((c, i) => renderQueueRow(c, i)).join('');
    bindDragDrop();
  }
  window.ankiSelectClear = function () {
    S.selectionIds.clear();
    document.querySelectorAll('.anki-pick.on').forEach(el => el.classList.remove('on'));
    document.querySelectorAll('.anki-pick input').forEach(i => { i.checked = false; });
    refreshQueueOnly();
  };
  window.ankiSelectAllDue = function () {
    window.AnkiAlgo.getCandidates(window.D.exercices).forEach(x => S.selectionIds.add(x.card.id));
    renderActiveView();
  };
  window.ankiUpdateTemps = function (id, valMin, isDevoir) {
    const c = window.D.exercices.find(x => x.id === id);
    if (!c) return;
    const minVal = parseFloat(valMin) || 1;
    if (isDevoir) {
      // Pour un DM : on modifie le temps PAR SESSION, donc on recalcule la durée totale = min × morceauxRestants
      const restants = (c._morceauxTotal || 1) - (c._morceauxFaits || 0);
      c.tempsCible = Math.round(minVal * 60) * Math.max(1, restants);
      c._dureeTotaleMin = minVal * (c._morceauxTotal || 1);
    } else {
      c.tempsCible = Math.round(minVal * 60);
    }
    window.AnkiAlgo.log("update-temps", { id, min: minVal, isDevoir: !!isDevoir });
    window.save();
    refreshQueueOnly();
  };
  window.ankiResetManualOrder = function () {
    S.manualOrder = null;
    window.AnkiAlgo.log("reorder", { reset: true });
    renderActiveView();
  };
  window.ankiQuickEditSession = function () {
    const cur = (window.D.settings && window.D.settings.ankiSessionMin) || 60;
    const val = prompt("Durée de la session (minutes) :", cur);
    if (val === null) return;
    window.D.settings.ankiSessionMin = Math.max(5, Math.min(240, parseInt(val) || cur));
    window.save(); renderActiveView();
  };

  // ====== VUE BIBLIOTHÈQUE ======
  function viewLibrary() {
    let list = window.D.exercices.slice().filter(c => c.type !== 'devoir');
    if (S.libFilter.mat) list = list.filter(c => c.mat === S.libFilter.mat);
    if (S.libFilter.stat) list = list.filter(c => c.statut === S.libFilter.stat);
    if (S.libFilter.profil) list = list.filter(c => (c.profil || "COURS") === S.libFilter.profil);
    if (S.libFilter.q) {
      const q = S.libFilter.q.toLowerCase();
      list = list.filter(c => ((c.titre || "") + ' ' + (c.question || "") + ' ' + c.id).toLowerCase().includes(q));
    }
    list.sort((a, b) => (a.dateProchaineRevision || "9999").localeCompare(b.dateProchaineRevision || "9999"));

    const groups = {};
    list.forEach(c => {
      const k = (c.mat || "?") + "|" + ((c.coursIds && c.coursIds[0]) || c.coursId || "—");
      if (!groups[k]) groups[k] = [];
      groups[k].push(c);
    });

    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${S.libFilter.mat === m.id ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const profOpts = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(p => `<option value="${p}" ${S.libFilter.profil === p ? 'selected' : ''}>${window.AnkiAlgo.DEFAULT_PROFILES[p].label}</option>`).join('');

    let html = `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Bibliothèque (${list.length})</h3>
          <div class="anki-block-actions">
            <button class="bp" onclick="window.openExoModal()">+ Nouvelle carte</button>
          </div>
        </div>
        <div class="anki-filters">
          <input class="fi" placeholder="🔍 Titre, énoncé, code..." value="${esc(S.libFilter.q)}" oninput="window.ankiLibFilter('q', this.value)">
          <select class="fi" onchange="window.ankiLibFilter('mat', this.value)"><option value="">Toutes matières</option>${matOpts}</select>
          <select class="fi" onchange="window.ankiLibFilter('stat', this.value)">
            <option value="">Tous statuts</option>
            <option value="actif" ${S.libFilter.stat === 'actif' ? 'selected' : ''}>🟢 Actif</option>
            <option value="attente" ${S.libFilter.stat === 'attente' ? 'selected' : ''}>⏳ Réservoir</option>
          </select>
          <select class="fi" onchange="window.ankiLibFilter('profil', this.value)"><option value="">Tous profils</option>${profOpts}</select>
        </div>
        <div class="anki-lib">
    `;

    if (!list.length) {
      html += '<div class="anki-empty">Aucune carte ne correspond aux filtres.</div>';
    } else {
      const orderedKeys = Object.keys(groups).sort();
      html += orderedKeys.map(k => {
        const [matId, coursId] = k.split('|');
        const m = mat(matId);
        const co = (window.D.cours || []).find(x => x.uid === coursId);
        const grpTitle = co ? `${co.uid} · ${co.title}` : (coursId === '—' ? 'Sans cours lié' : coursId);
        return `
          <div class="anki-lib-group">
            <div class="anki-lib-group-hdr" style="border-left:4px solid ${m.color};">
              <span class="anki-lib-grp-mat" style="background:${m.color}20;color:${m.color};">${m.label}</span>
              <span class="anki-lib-grp-t">${esc(grpTitle)}</span>
              <span class="anki-mut" style="margin-left:auto;">${groups[k].length}</span>
            </div>
            <div class="anki-lib-items">
              ${groups[k].map(c => renderLibRow(c)).join('')}
            </div>
          </div>
        `;
      }).join('');
    }
    html += '</div></div>';
    return html;
  }

  function renderLibRow(c) {
    const m = mat(c.mat);
    const next = c.dateProchaineRevision ? c.dateProchaineRevision : '—';
    const urg = window.AnkiAlgo.urgenceScore(c).total.toFixed(1);
    return `
      <div class="anki-lib-row">
        <span class="uid-badge anki-lib-id">${c.id}</span>
        <div class="anki-lib-text">
          <div class="anki-lib-title">${esc(c.titre || (c.question || '').substring(0, 70))}</div>
          <div class="anki-lib-meta">
            <span class="anki-tag" style="border-color:${m.color}80;color:${m.color};">${profileLabel(c.profil || 'COURS')}</span>
            <span class="anki-mut">⏱ ${window.AnkiAlgo.fmtDur(c.tempsCible || 60)} · ${pri(c.priorite || 2)} · prochaine ${next} · urg ${urg}</span>
          </div>
        </div>
        <div class="anki-lib-acts">
          <button class="cbt" title="Réviser" onclick="window.startAnkiSingle('${c.id}')">▶</button>
          <button class="cbt" title="Modifier" onclick="window.editExo('${c.id}')">✏️</button>
          <button class="cbt" title="Décaler" onclick="window.ankiAdjustNext('${c.id}')">📅</button>
          <button class="cbt" style="color:var(--red);border-color:var(--red);" title="Supprimer" onclick="window.delExo('${c.id}')">🗑</button>
        </div>
      </div>
    `;
  }
  window.ankiLibFilter = function (k, v) { S.libFilter[k] = v; renderActiveView(); };
  window.ankiAdjustNext = function (id) {
    const c = window.D.exercices.find(x => x.id === id);
    if (!c) return;
    const cur = c.dateProchaineRevision || window.AnkiAlgo.todayISO();
    const d = prompt(`Décale de combien de jours ? (négatif = avancer)\nDate actuelle : ${cur}`, "0");
    if (d === null) return;
    c.dateProchaineRevision = window.AnkiAlgo.addDays(cur, parseInt(d) || 0);
    window.AnkiAlgo.log("manual-shift", { id, from: cur, to: c.dateProchaineRevision });
    window.save(); renderActiveView();
  };

  // ====== VUE PRÉVISIONS (barres + calendrier jour par jour) ======
  function viewForecast() {
    const sch = window.AnkiAlgo.forecastSchedule(window.D.exercices, S.forecastDays);
    const dates = Object.keys(sch).sort();
    const charges = dates.map(d => sch[d].reduce((s, c) => s + (c.tempsCible || 60), 0));
    const max = Math.max(1, ...charges);
    const maxDay = (window.D.settings.ankiMaxPerDay || 75) * 60;

    return `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Prévisions (${S.forecastDays} jours)</h3>
          <div class="anki-block-actions">
            <button class="bs ${S.forecastDays === 7 ? 'on-bs' : ''}" onclick="window.ankiForecastDays(7)">7j</button>
            <button class="bs ${S.forecastDays === 14 ? 'on-bs' : ''}" onclick="window.ankiForecastDays(14)">14j</button>
            <button class="bs ${S.forecastDays === 30 ? 'on-bs' : ''}" onclick="window.ankiForecastDays(30)">30j</button>
            <button class="bs" onclick="window.ankiRebalance()" title="Étale les pics">⚖️ Rééquilibrer</button>
          </div>
        </div>
        <div class="anki-forecast-bars">
          ${dates.map((d, i) => {
            const total = charges[i];
            const pct = Math.round((total / max) * 100);
            const over = total > maxDay;
            const dd = d.substring(5).replace('-', '/');
            const isToday = d === window.AnkiAlgo.todayISO();
            return `<div class="anki-fc-col ${isToday ? 'today' : ''} ${S.expandedDay === d ? 'sel' : ''}" onclick="window.ankiToggleDay('${d}')" title="${d} — ${sch[d].length} cartes · ${window.AnkiAlgo.fmtDur(total)}">
              <div class="anki-fc-n">${sch[d].length || ''}</div>
              <div class="anki-fc-bar ${over ? 'over' : ''}" style="height:${Math.max(2, pct)}%;"></div>
              <div class="anki-fc-lbl">${dd}</div>
            </div>`;
          }).join('')}
        </div>

        <div class="anki-cal-list" style="margin-top:14px;">
          ${dates.map(d => {
            const cards = sch[d];
            const total = cards.reduce((s, c) => s + (c.tempsCible || 60), 0);
            const isToday = d === window.AnkiAlgo.todayISO();
            // Par défaut tout fermé ; ouvert SI l'utilisateur a cliqué
            const open = S.expandedDay === d;
            if (!cards.length) return '';
            return `
              <div class="anki-cal-day ${isToday ? 'today' : ''}">
                <div class="anki-cal-day-hdr" onclick="window.ankiToggleDay('${d}')">
                  <strong>${isToday ? "📍 Aujourd'hui" : d}</strong>
                  <span class="anki-mut">${cards.length} cartes · ${window.AnkiAlgo.fmtDur(total)}</span>
                  <span class="anki-mut">${open ? '▼' : '▶'}</span>
                </div>
                ${open ? `<div class="anki-cal-day-list">${cards.map((c, i) => renderCalCard(c, i)).join('')}</div>` : ''}
              </div>
            `;
          }).join('') || '<div class="anki-empty">Aucune révision prévue.</div>'}
        </div>
      </div>
    `;
  }
  function renderCalCard(c, i) {
    const m = mat(c.mat);
    return `
      <div class="anki-cal-row">
        <span class="anki-day-num">${i + 1}</span>
        <span class="anki-q-mat" style="background:${m.color};">${m.label}</span>
        <span class="uid-badge">${c.id}</span>
        <span class="anki-day-title">${esc(c.titre || (c.question || '').substring(0, 80))}</span>
        <span class="anki-mut">⏱ ${window.AnkiAlgo.fmtDur(c.tempsCible || 60)}</span>
        <button class="cbt" onclick="window.ankiAdjustNext('${c.id}')" title="Décaler">📅</button>
        <button class="cbt" onclick="window.startAnkiSingle('${c.id}')" title="Réviser">▶</button>
      </div>
    `;
  }
  window.ankiForecastDays = function (n) { S.forecastDays = n; renderActiveView(); };
  window.ankiToggleDay = function (d) { S.expandedDay = S.expandedDay === d ? null : d; renderActiveView(); };
  window.ankiRebalance = function () {
    const maxMin = (window.D.settings.ankiMaxPerDay || 75);
    const out = window.AnkiAlgo.rebalanceFuture(window.D.exercices, { days: 30, maxPerDay: maxMin * 60, dryRun: false });
    out.moves.forEach(m => window.AnkiAlgo.log("rebalance", m));
    window.save();
    window.sysAlert(`${out.moves.length} carte(s) déplacée(s) pour lisser la charge.`, "Rééquilibrage");
    renderActiveView();
  };

  // SVG line chart pour stats hebdo
  function renderStatsCurve(week, byDay) {
    const W = 600, H = 180, PAD_L = 32, PAD_R = 32, PAD_T = 14, PAD_B = 24;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const maxN = Math.max(1, ...week.map(d => byDay[d].total));
    const xStep = innerW / Math.max(1, week.length - 1);
    // Courbe quantité (échelle gauche, max=maxN)
    const ptsN = week.map((d, i) => {
      const x = PAD_L + i * xStep;
      const y = PAD_T + innerH - (byDay[d].total / maxN) * innerH;
      return { x, y, val: byDay[d].total, d };
    });
    // Courbe qualité moyenne (échelle droite, 0-10)
    const ptsQ = week.map((d, i) => {
      const x = PAD_L + i * xStep;
      const q = byDay[d].total ? byDay[d].sumQ / byDay[d].total : null;
      const y = q === null ? null : PAD_T + innerH - (q / 10) * innerH;
      return { x, y, q, d };
    });
    const pathN = ptsN.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
    const pathQ = ptsQ.filter(p => p.y !== null).map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
    // Aire sous la courbe quantité
    const areaN = `${pathN} L ${ptsN[ptsN.length-1].x},${PAD_T + innerH} L ${ptsN[0].x},${PAD_T + innerH} Z`;
    return `
      <div class="anki-curve-wrap">
        <svg viewBox="0 0 ${W} ${H}" class="anki-curve" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gradN" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--acc)" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="var(--acc)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${[0,0.25,0.5,0.75,1].map(t => `<line x1="${PAD_L}" x2="${W-PAD_R}" y1="${PAD_T + innerH * t}" y2="${PAD_T + innerH * t}" stroke="var(--bd)" stroke-width="1" stroke-dasharray="2,3"/>`).join('')}
          <path d="${areaN}" fill="url(#gradN)"/>
          <path d="${pathN}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
          ${pathQ ? `<path d="${pathQ}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4,3" stroke-linejoin="round"/>` : ''}
          ${ptsN.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--bg)" stroke="var(--acc)" stroke-width="2"/>`).join('')}
          ${ptsQ.filter(p => p.y !== null).map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--gold)"/>`).join('')}
          ${ptsN.map(p => `<text x="${p.x}" y="${H-6}" text-anchor="middle" fill="var(--mut)" font-size="10" font-family="DM Mono, monospace">${p.d.substring(8) + '/' + p.d.substring(5,7)}</text>`).join('')}
          ${ptsN.map(p => p.val ? `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="var(--acc)" font-size="11" font-weight="700">${p.val}</text>` : '').join('')}
        </svg>
        <div class="anki-curve-legend">
          <span><span class="anki-leg-dot" style="background:var(--acc);"></span> Nombre de cartes</span>
          <span><span class="anki-leg-dot" style="background:var(--gold);"></span> Qualité moy. (0-10)</span>
        </div>
      </div>
    `;
  }

  // ====== VUE STATS ======
  function viewStats() {
    const today = window.AnkiAlgo.todayISO();
    const exos = window.D.exercices || [];
    // Filtre des évaluations d'aujourd'hui
    const todayEvals = [];
    exos.forEach(c => {
      (c.historique || []).forEach(h => {
        if (h.date && h.date.substring(0, 10) === today) {
          todayEvals.push({ card: c, h });
        }
      });
    });
    const nOk = todayEvals.filter(e => e.h.qScore >= 8).length;
    const nMid = todayEvals.filter(e => e.h.qScore >= 4 && e.h.qScore < 8).length;
    const nBad = todayEvals.filter(e => e.h.qScore < 4).length;
    const total = todayEvals.length;

    // Temps réel total
    const tempsReel = todayEvals.reduce((s, e) => s + (e.h.tempsReel || 0), 0);
    // Temps prévu total (somme des tempsCible des cartes faites)
    const tempsPrevu = todayEvals.reduce((s, e) => s + (e.card.tempsCible || 0), 0);

    // Note d'efficacité : 0-100
    // Facteur exactitude : moyenne des qScore (0-10) → /10
    const moyQ = total ? todayEvals.reduce((s, e) => s + (e.h.qScore || 0), 0) / total : 0;
    const factExact = moyQ / 10; // 0-1
    // Facteur vitesse : tempsPrevu/tempsReel (cap 1.2)
    const factVit = tempsPrevu && tempsReel ? Math.min(1.2, tempsPrevu / tempsReel) : 1;
    // Facteur volume : min(1, total / 10) (10 cartes = volume idéal)
    const factVol = total ? Math.min(1, total / 10) : 0;
    // Note finale : exactitude pondère 50%, vitesse 25%, volume 25%
    const note = Math.round((factExact * 0.5 + (factVit / 1.2) * 0.25 + factVol * 0.25) * 100);
    const noteColor = note >= 75 ? 'var(--grn)' : note >= 50 ? 'var(--gold)' : 'var(--red)';

    // Stats par matière (7 derniers jours)
    const week = Array.from({ length: 7 }, (_, i) => window.AnkiAlgo.addDays(today, -6 + i));
    const byDay = {};
    week.forEach(d => byDay[d] = { ok: 0, mid: 0, bad: 0, total: 0, sumQ: 0 });
    exos.forEach(c => {
      (c.historique || []).forEach(h => {
        const d = h.date && h.date.substring(0, 10);
        if (byDay[d]) {
          byDay[d].total++;
          byDay[d].sumQ += (h.qScore || 0);
          if ((h.qScore || 0) >= 8) byDay[d].ok++;
          else if ((h.qScore || 0) >= 4) byDay[d].mid++;
          else byDay[d].bad++;
        }
      });
    });
    const maxDay = Math.max(1, ...week.map(d => byDay[d].total));

    // Stats par matière (depuis le début)
    const matStats = {};
    exos.forEach(c => {
      const k = c.mat || '?';
      if (!matStats[k]) matStats[k] = { total: 0, ok: 0, bad: 0, easeSum: 0, easeN: 0, cards: 0 };
      matStats[k].cards++;
      matStats[k].easeSum += c.ease || 2.5;
      matStats[k].easeN++;
      (c.historique || []).forEach(h => {
        matStats[k].total++;
        if ((h.qScore || 0) >= 8) matStats[k].ok++;
        if ((h.qScore || 0) < 4) matStats[k].bad++;
      });
    });

    return `
      <div class="anki-card-block">
        <h3>📊 Efficacité de la session du jour</h3>
        <div class="anki-stat-hero">
          <div class="anki-stat-note" style="color:${noteColor};">${total ? note + '/100' : '—'}</div>
          <div class="anki-mut">${total ? "Note d&apos;efficacité" : "Aucune carte révisée aujourd&apos;hui"}</div>
        </div>
        <div class="anki-stat-bars">
          <div class="anki-stat-bar-row">
            <span class="anki-stat-lbl">Exactitude</span>
            <div class="anki-stat-bar-bg"><div class="anki-stat-bar-fill" style="width:${factExact * 100}%;background:var(--grn);"></div></div>
            <span class="anki-stat-val">${(factExact * 100).toFixed(0)}%</span>
          </div>
          <div class="anki-stat-bar-row">
            <span class="anki-stat-lbl">Vitesse</span>
            <div class="anki-stat-bar-bg"><div class="anki-stat-bar-fill" style="width:${Math.min(100, (factVit / 1.2) * 100)}%;background:var(--acc);"></div></div>
            <span class="anki-stat-val">${(factVit * 100).toFixed(0)}%</span>
          </div>
          <div class="anki-stat-bar-row">
            <span class="anki-stat-lbl">Volume</span>
            <div class="anki-stat-bar-bg"><div class="anki-stat-bar-fill" style="width:${factVol * 100}%;background:var(--gold);"></div></div>
            <span class="anki-stat-val">${total}/10</span>
          </div>
        </div>
        <div class="anki-stat-grid">
          <div class="kpi"><div class="kpi-n" style="color:var(--grn);">${nOk}</div><div class="kpi-l">Parfait ≥8</div></div>
          <div class="kpi"><div class="kpi-n" style="color:var(--gold);">${nMid}</div><div class="kpi-l">Étourderie 4-7</div></div>
          <div class="kpi"><div class="kpi-n" style="color:var(--red);">${nBad}</div><div class="kpi-l">Blocage &lt;4</div></div>
          <div class="kpi"><div class="kpi-n">${window.AnkiAlgo.fmtDur(tempsReel)}</div><div class="kpi-l">Temps réel</div></div>
          <div class="kpi"><div class="kpi-n anki-mut">${window.AnkiAlgo.fmtDur(tempsPrevu)}</div><div class="kpi-l">Temps prévu</div></div>
        </div>
        <details class="anki-stat-details">
          <summary class="anki-mut" style="cursor:pointer;font-size:12px;">📐 Comment la note est calculée</summary>
          <pre class="anki-formula" style="white-space:pre-wrap;font-size:11px;">note = 50% × exactitude(moyQ/10) + 25% × vitesse(prévu/réel, max 1.2) + 25% × volume(min(1, n/10))
moyQ = ${moyQ.toFixed(1)} · prévu/réel = ${tempsPrevu && tempsReel ? (tempsPrevu/tempsReel).toFixed(2) : '—'} · n = ${total}</pre>
        </details>
      </div>

      <div class="anki-card-block">
        <h3>📈 Évolution sur 7 jours</h3>
        <p class="anki-mut" style="font-size:11px;margin-bottom:10px;">Courbe du nombre de cartes révisées par jour + courbe de la qualité moyenne (0-10).</p>
        ${renderStatsCurve(week, byDay)}
      </div>

      <div class="anki-card-block">
        <h3>🎯 Par matière</h3>
        <table class="anki-diag-table">
          <thead><tr><th>Matière</th><th>Cartes</th><th>Révisions</th><th>✅</th><th>❌</th><th>Ease moy.</th></tr></thead>
          <tbody>
            ${Object.keys(matStats).map(k => {
              const m = mat(k);
              const s = matStats[k];
              const easeMoy = (s.easeSum / s.easeN).toFixed(2);
              const easeCol = parseFloat(easeMoy) < 2.0 ? 'var(--red)' : parseFloat(easeMoy) < 2.4 ? 'var(--gold)' : 'var(--grn)';
              return `<tr>
                <td><span class="anki-q-mat" style="background:${m.color};">${m.label}</span> ${m.name}</td>
                <td>${s.cards}</td>
                <td>${s.total}</td>
                <td>${s.ok}</td>
                <td>${s.bad}</td>
                <td style="color:${easeCol};font-weight:700;">${easeMoy}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="anki-mut">Aucune donnée</td></tr>'}
          </tbody>
        </table>
        <p class="anki-mut" style="font-size:11px;margin-top:8px;">Ease faible (rouge) = matière où tu galères. L'algo va y mettre plus d'urgence automatiquement.</p>
      </div>
    `;
  }


  // ====== VUE DIAGNOSTIC ======
  function viewDiag() {
    const coefs = window.AnkiAlgo.getCoefs();
    const exos = window.D.exercices || [];
    const cands = window.AnkiAlgo.getCandidates(exos).slice(0, 30);
    const log = window.AnkiAlgo.LOG.slice(0, 20);

    return `
      <div class="anki-card-block">
        <h3>📖 Comment fonctionne le Synchrotron ?</h3>
        <details open class="anki-explain">
          <summary><b>🎯 Principe : le coefficient d'urgence règne</b></summary>
          <p>Chaque carte reçoit en temps réel un <b>score d'urgence</b> qui résume tout ce qui compte : retard, proximité de la date prévue, priorité que tu as donnée, nouveauté, et difficulté (ease). L'algorithme trie TOUTES tes cartes par ce score, prend les plus urgentes jusqu'à remplir 92% du budget temps de la session, puis intercale longues et courtes pour ne pas t'épuiser.</p>
        </details>
        <details class="anki-explain">
          <summary><b>📐 Formule du score d'urgence</b></summary>
          <pre class="anki-formula">urgence = ${coefs.W_retard}·retard + ${coefs.W_proche}·exp(-Δ/${coefs.TAU}) + ${coefs.W_priorite}·priorité + ${coefs.W_nouveau}·nouveau + ${coefs.W_ease}·(3−ease)</pre>
          <ul class="anki-explain-list">
            <li><b>retard</b> = jours de retard (0 si à jour, +1 par jour)</li>
            <li><b>Δ</b> = jours restants avant la date prévue (négatif si futur)</li>
            <li><b>priorité</b> = 2 si Urgence, 1 si Normale, 0.3 si Faible</li>
            <li><b>nouveau</b> = 1 si la carte est en réservoir, 0 sinon</li>
            <li><b>ease</b> = facilité (1.3 = très dur, 3.0 = très facile). Plus l'ease est bas, plus tu galères → urgence augmente.</li>
          </ul>
        </details>
        <details class="anki-explain">
          <summary><b>📊 Comment évoluent ease et intervalle ?</b></summary>
          <p>Quand tu évalues une carte (slider 1-10 ou bouton) :</p>
          <ul class="anki-explain-list">
            <li><b>qScore ≤ 3</b> (blocage) → reset à 0 jour, ease −0.20</li>
            <li><b>qScore 4-7</b> (étourderie) → intervalle court, ease s'ajuste</li>
            <li><b>qScore ≥ 8</b> (parfait) → intervalle long, ease +0.05 à +0.15</li>
          </ul>
          <p><b>Pénalité vitesse</b> : si tu mets > 1.5× le temps cible, intervalle ×0.7. Si > 2× → ×0.5. Si rapide (&lt; 0.7×) → bonus ×1.15.</p>
          <p><b>Profils</b> : chaque carte appartient à un profil (ANGLAIS/FORMULE/COURS/EXO) avec des étapes pré-définies (ex: ANGLAIS = [1,2,4,8,15,30] jours). Tu peux modifier ces étapes dans <b>Réglages</b>.</p>
        </details>
        <details class="anki-explain">
          <summary><b>🌅 Décalage automatique et load balancing</b></summary>
          <p>Si tu rates une journée, toutes les cartes <i>en retard</i> sont automatiquement glissées à aujourd'hui. Le bouton <b>⚖️ Rééquilibrer</b> dans Prévisions détecte les pics (jour avec > 75 min de révisions) et redistribue les cartes les moins prioritaires vers les jours adjacents (j-1, j+1, j-2, j+2...) jusqu'à lisser la charge.</p>
        </details>
        <details class="anki-explain">
          <summary><b>🃏 Intercalation longues / courtes / matières</b></summary>
          <p>Dans une session, l'algo construit la file ainsi :</p>
          <ol class="anki-explain-list">
            <li>Tri par urgence ↓ → on prend tant que ça rentre dans 92% du budget</li>
            <li>Remplissage avec max 5 cartes courtes (anglais) si reste du temps</li>
            <li>Intercalation : long → court → long → court (en gardant l'ordre d'urgence dans chaque catégorie)</li>
            <li>Le drag-drop dans le Cockpit te permet de réorganiser comme tu veux</li>
          </ol>
        </details>
        <details class="anki-explain">
          <summary><b>📝 Devoirs / DM : fonctionnement détaillé</b></summary>
          <p>Un DM est <b>UN seul objet</b> dans la base. Si tu indiques "découpe en 3 morceaux", l'algo le présente :</p>
          <ul class="anki-explain-list">
            <li><b>1 fois par jour</b> dans la file, avec affichage "session X/N"</li>
            <li>Temps par session = <code>durée totale / nombre de morceaux</code></li>
            <li>Tu peux <b>ajuster le temps de chaque session inline</b> (l'algo recalcule le temps total restant)</li>
            <li>Pas de slider qScore : juste <b>Fait / Partiel / À refaire</b></li>
            <li>L'ease/intervalle ne sont PAS modifiés (ce n'est pas une carte de mémorisation)</li>
            <li>Quand toutes les sessions sont faites → statut <code>fini</code>, le DM disparaît de la file</li>
          </ul>
          <p>Exemple : DM 90 min en 3 morceaux. Jour 1 : tu fais 35 min au lieu de 30. L'algo retient « 55 min restants », répartit sur 2 sessions → 27.5 min chacune.</p>
        </details>
        <details class="anki-explain">
          <summary><b>🎚 Slider 1-10 vs boutons 3 niveaux</b></summary>
          <p>Les 2 sont disponibles en même temps. Mapping :</p>
          <ul class="anki-explain-list">
            <li><b>1-3</b> (Blocage rouge) : reset (intervalle = 0), ease −0.20</li>
            <li><b>4-7</b> (Étourderie jaune) : intervalle court, ease ajusté selon score</li>
            <li><b>8-10</b> (Parfait vert) : intervalle long, ease +0.05 à +0.15</li>
          </ul>
          <p>Le slider permet une nuance plus fine : score=5 réduit l'intervalle de 0.55× vs score=7 qui le multiplie par 1.0.</p>
        </details>
      </div>

      <div class="anki-card-block">
        <h3>🔬 Top 30 — décomposition du score</h3>
        <div class="anki-coef-row">
          <span><b>W_retard</b> ${coefs.W_retard}</span>
          <span><b>W_proche</b> ${coefs.W_proche}</span>
          <span><b>τ</b> ${coefs.TAU}j</span>
          <span><b>W_priorité</b> ${coefs.W_priorite}</span>
          <span><b>W_nouveau</b> ${coefs.W_nouveau}</span>
          <span><b>W_ease</b> ${coefs.W_ease}</span>
        </div>
        <div class="anki-diag-table-wrap">
          <table class="anki-diag-table">
            <thead><tr><th>ID</th><th>Mat.</th><th>Titre</th><th>Date prév.</th><th>ease</th><th>int.</th><th>rep.</th><th>retard</th><th>proche</th><th>prio</th><th>new</th><th>ease·w</th><th>TOTAL</th></tr></thead>
            <tbody>
              ${cands.map(({ card, score }) => {
                const m = mat(card.mat);
                return `<tr>
                  <td><span class="uid-badge">${card.id}</span></td>
                  <td><span class="anki-q-mat" style="background:${m.color};">${m.label}</span></td>
                  <td>${esc((card.titre || card.question || '').substring(0, 40))}</td>
                  <td>${card.dateProchaineRevision || '—'}</td>
                  <td><b style="color:var(--acc);">${(card.ease || 2.5).toFixed(2)}</b></td>
                  <td><b>${card.intervalle || 0}j</b></td>
                  <td>${card.repetitions || 0}</td>
                  <td>${score.breakdown.retard}</td>
                  <td>${score.breakdown.proche}</td>
                  <td>${score.breakdown.priorite}</td>
                  <td>${score.breakdown.nouveau}</td>
                  <td>${score.breakdown.ease}</td>
                  <td><strong>${score.total}</strong></td>
                </tr>`;
              }).join('') || '<tr><td colspan="13" class="anki-mut">Aucune carte</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>📜 Journal de décisions (${log.length}/200)</h3>
          <button class="bs" onclick="window.AnkiAlgo.LOG.length=0;window.renderAnki();">Vider</button>
        </div>
        ${log.length ? log.map(l => `
          <div class="anki-log-row">
            <span class="anki-mut anki-log-time">${l.at.substring(11, 19)}</span>
            <span class="anki-log-action">${l.action}</span>
            <span class="anki-log-details">${esc(JSON.stringify(l.details))}</span>
          </div>
        `).join('') : '<div class="anki-empty">Aucune décision encore enregistrée. Lance une session de révision pour peupler le journal.</div>'}
      </div>
    `;
  }

  // ====== VUE RÉGLAGES ======
  function viewSettings() {
    const st = window.D.settings || {};
    if (!st.ankiProfiles) st.ankiProfiles = JSON.parse(JSON.stringify(window.AnkiAlgo.DEFAULT_PROFILES));
    if (!st.ankiCoefs) st.ankiCoefs = Object.assign({}, window.AnkiAlgo.DEFAULT_COEFS);
    const C = st.ankiCoefs;

    const coefRow = (k, label, step) => `
      <div class="anki-set-row">
        <label>${label} <code class="anki-mut">${k}</code></label>
        <input type="number" class="fi" step="${step || 0.1}" value="${C[k]}" onchange="window.D.settings.ankiCoefs.${k}=parseFloat(this.value)||0;window.save();window.renderAnki();">
      </div>
    `;

    const profilesHtml = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(k => {
      const p = st.ankiProfiles[k] || window.AnkiAlgo.DEFAULT_PROFILES[k];
      return `
        <div class="anki-prof">
          <div class="anki-prof-hdr"><strong>${p.label || k}</strong><span class="anki-mut">${k}</span></div>
          <label class="anki-mut" style="font-size:11px;">Étapes (jours)</label>
          <input class="fi" id="prof_${k}_steps" value="${(p.steps || []).join(', ')}" oninput="window.ankiSaveProfile('${k}')">
          <label class="anki-mut" style="font-size:11px;">Ease initiale</label>
          <input class="fi" type="number" step="0.1" min="1.3" max="3.0" id="prof_${k}_ease" value="${p.ease}" oninput="window.ankiSaveProfile('${k}')">
        </div>
      `;
    }).join('');

    return `
      <div class="anki-card-block">
        <h3>Maintenance / Démo</h3>
        <p class="anki-mut" style="font-size:12px;">Si tu utilises les données de démo et que les dates ne sont plus à jour (ex: tu reviens après plusieurs jours), recale-les sur aujourd'hui.</p>
        <button class="bs" onclick="window.ankiRecalDates()">📅 Recaler toutes les dates sur aujourd'hui</button>
        <button class="bs" onclick="window.ankiRebuildPieces()" style="margin-left:6px;">✂️ Re-découper les devoirs en morceaux</button>
      </div>

      <div class="anki-card-block">
        <h3>Session</h3>
        <div class="anki-set-row">
          <label>Durée de session (min)</label>
          <input type="number" class="fi" min="5" max="240" value="${st.ankiSessionMin || 60}" onchange="window.D.settings.ankiSessionMin=parseInt(this.value)||60;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Nouvelles cartes / session</label>
          <input type="number" class="fi" min="0" max="30" value="${st.ankiIncludeNew !== undefined ? st.ankiIncludeNew : 5}" onchange="window.D.settings.ankiIncludeNew=parseInt(this.value)||0;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Charge max / jour (min)</label>
          <input type="number" class="fi" min="15" max="240" value="${st.ankiMaxPerDay || 75}" onchange="window.D.settings.ankiMaxPerDay=parseInt(this.value)||75;window.save();">
        </div>
        <div class="anki-set-row">
          <label>Seuil d'urgence pour inclusion</label>
          <input type="number" class="fi" step="0.1" value="${st.ankiUrgenceSeuil || 1.5}" onchange="window.D.settings.ankiUrgenceSeuil=parseFloat(this.value)||1.5;window.save();window.renderAnki();">
        </div>
      </div>

      <div class="anki-card-block">
        <h3>Coefficients du score d'urgence</h3>
        <p class="anki-mut" style="font-size:12px;">Plus un poids est élevé, plus la composante influence l'ordre de passage.</p>
        ${coefRow('W_retard', 'Poids du retard (par jour)')}
        ${coefRow('W_proche', 'Poids de la proximité (approche)')}
        ${coefRow('TAU', 'τ — constante de temps (jours)', 0.5)}
        ${coefRow('W_priorite', 'Poids de la priorité user')}
        ${coefRow('W_nouveau', 'Bonus nouvelles cartes')}
        ${coefRow('W_ease', 'Poids de la difficulté (ease bas → monte)')}
        <button class="bs" style="margin-top:10px;" onclick="window.D.settings.ankiCoefs=Object.assign({},window.AnkiAlgo.DEFAULT_COEFS);window.save();window.renderAnki();">↺ Coefs par défaut</button>
      </div>

      <div class="anki-card-block">
        <h3>Auto-évaluation</h3>
        <div class="anki-set-row">
          <label>Afficher le slider 1-10</label>
          <input type="checkbox" ${st.ankiShowSlider !== false ? 'checked' : ''} onchange="window.D.settings.ankiShowSlider=this.checked;window.save();">
        </div>
        <p class="anki-mut" style="font-size:12px;">Boutons 3-niveaux toujours visibles. Slider 1-10 en complément pour granularité.</p>
      </div>

      <div class="anki-card-block">
        <h3>Profils d'intervalles</h3>
        <p class="anki-mut">Chaque carte appartient à un profil ; les étapes définissent quand elle revient après une réussite.</p>
        <div class="anki-prof-grid">${profilesHtml}</div>
        <button class="bs" onclick="window.ankiResetProfiles()" style="margin-top:10px;">↺ Profils par défaut</button>
      </div>
    `;
  }
  window.ankiSaveProfile = function (k) {
    const stepsRaw = $("prof_" + k + "_steps").value;
    const easeRaw = parseFloat($("prof_" + k + "_ease").value);
    const steps = stepsRaw.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
    if (!window.D.settings.ankiProfiles) window.D.settings.ankiProfiles = {};
    window.D.settings.ankiProfiles[k] = {
      steps: steps.length ? steps : window.AnkiAlgo.DEFAULT_PROFILES[k].steps,
      ease: isNaN(easeRaw) ? 2.5 : Math.max(1.3, Math.min(3.0, easeRaw)),
      label: window.AnkiAlgo.DEFAULT_PROFILES[k].label
    };
    window.save();
  };
  window.ankiResetProfiles = function () {
    window.D.settings.ankiProfiles = JSON.parse(JSON.stringify(window.AnkiAlgo.DEFAULT_PROFILES));
    window.save(); renderActiveView();
  };

  window.ankiRecalDates = function () {
    const today = window.AnkiAlgo.todayISO();
    let n = 0;
    (window.D.exercices || []).forEach(c => {
      if (c.statut !== 'actif') return;
      // Si dueDate < today : recaler à today
      // Si dueDate > today + 30 : trop loin, recaler aussi
      if (!c.dateProchaineRevision || c.dateProchaineRevision < today) {
        c.dateProchaineRevision = today;
        n++;
      }
    });
    window.AnkiAlgo.log("recal-dates", { n });
    window.save();
    window.sysAlert(`${n} carte(s) recalée(s) sur aujourd'hui (${today}).`, "Dates recalées");
    window.renderAnki();
  };

  window.ankiRebuildPieces = function () {
    const exos = window.D.exercices || [];
    // Supprime tous les morceaux existants
    window.D.exercices = exos.filter(c => c.type !== 'devoir-morceau');
    // Réinitialise les parents
    window.D.exercices.forEach(c => {
      if (c.type === 'devoir' && (c._morceauxTotal || 1) > 1) {
        delete c._morceauIndex;
        delete c._isMorceauParent;
      }
    });
    // Re-appelle le split (cette logique est dans app.js initData; on simule ici)
    const today = window.AnkiAlgo.todayISO();
    const devoirs = window.D.exercices.filter(c => c.type === 'devoir' && (c._morceauxTotal || 1) > 1);
    devoirs.forEach(parent => {
      const N = parent._morceauxTotal || 1;
      const piecesNew = Math.ceil((parent.tempsCible || 60) / N);
      // Si le parent a déjà été réduit auparavant, on le restore d'abord :
      parent.tempsCible = piecesNew;
      parent._morceauIndex = 1;
      parent._isMorceauParent = true;
      parent.dateProchaineRevision = today;
      for (let i = 1; i < N; i++) {
        const ids = window.D.exercices.map(x => x.id);
        const pieceId = window.AnkiAlgo.genExoUid(parent.mat, ids);
        window.D.exercices.unshift({
          id: pieceId,
          titre: (parent.titre || parent.question) + ' (' + (i + 1) + '/' + N + ')',
          question: parent.question,
          reponse: parent.reponse,
          mat: parent.mat,
          profil: parent.profil,
          tempsCible: piecesNew,
          priorite: parent.priorite,
          statut: 'actif',
          coursIds: parent.coursIds || [],
          intervalle: 0, ease: parent.ease || 2.5, repetitions: 0,
          dateProchaineRevision: window.AnkiAlgo.addDays(today, i),
          historique: [],
          type: 'devoir-morceau',
          _morceauOf: parent.id,
          _morceauIndex: i + 1,
          _morceauTotal: N,
          dateCreation: new Date().toISOString()
        });
      }
    });
    window.save();
    window.sysAlert(`${devoirs.length} devoir(s) re-découpé(s) en morceaux.`, "Re-découpage");
    window.renderAnki();
  };

  // ====== SESSION ======
  window.startAnkiSession = function () {
    const settings = window.D.settings || {};
    const plan = window.AnkiAlgo.buildSession(window.D.exercices, {
      sessionMinutes: settings.ankiSessionMin || 60,
      includeNew: settings.ankiIncludeNew !== undefined ? settings.ankiIncludeNew : 5,
      selectedIds: S.selectionIds.size ? Array.from(S.selectionIds) : null,
      manualOrder: S.manualOrder
    });
    if (!plan.cartes.length) return window.sysAlert("Aucune carte à réviser.", "Synchrotron");
    plan.cartes.forEach(c => {
      if (c.statut === "attente") {
        c.statut = "actif";
        if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO();
      }
    });
    S.queue = plan.cartes.slice();
    S.mode = "normal";
    S.stats = { ok: 0, mid: 0, bad: 0, total: plan.cartes.length };
    nextCard();
  };
  window.startAnkiSingle = function (id) {
    const c = window.D.exercices.find(x => x.id === id);
    if (!c) return;
    if (c.statut !== "actif") { c.statut = "actif"; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO(); }
    S.queue = [c]; S.mode = "single";
    S.stats = { ok: 0, mid: 0, bad: 0, total: 1 };
    nextCard();
  };
  window.startAnkiColle = function (coursId) {
    ensure();
    const q = window.D.exercices.filter(c => (c.coursIds || []).includes(coursId) || c.coursId === coursId);
    if (!q.length) return window.sysAlert("Aucune carte liée à ce cours.", "Mode Colle");
    S.queue = window.AnkiAlgo.smartOrder(q.slice());
    S.mode = "colle"; S.stats = { ok: 0, mid: 0, bad: 0, total: q.length };
    nextCard();
  };
  window.ankiSetQuickQueue = function (ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const cards = ids.map(id => window.D.exercices.find(x => x.id === id)).filter(Boolean);
    if (!cards.length) return;
    cards.forEach(c => { if (c.statut !== 'actif') { c.statut = 'actif'; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO(); } });
    S.queue = cards.slice(); S.mode = "quick";
    S.stats = { ok: 0, mid: 0, bad: 0, total: cards.length };
    window.save(); nextCard();
  };

  function nextCard() {
    if (!S.queue.length) return endSession();
    S.current = S.queue.shift();
    S.showAnswer = false; S.chronoElapsed = 0; S.chronoStart = Date.now();
    S.sliderValue = 7;
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = setInterval(() => {
      S.chronoElapsed = (Date.now() - S.chronoStart) / 1000;
      const el = $("ankiChrono");
      if (el) {
        el.textContent = fmtSec(S.chronoElapsed);
        const cible = (S.current && S.current.tempsCible) || 60;
        el.style.color = S.chronoElapsed > cible * 1.5 ? "var(--red)" : S.chronoElapsed > cible ? "var(--gold)" : "var(--grn)";
      }
    }, 200);
    renderSessionOverlay();
  }

  function renderSessionOverlay() {
    const c = S.current; if (!c) return;
    let ov = $("ovAnkiSession");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovAnkiSession"; ov.className = "ov"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const m = mat(c.mat);
    const linkedTitle = (c.coursIds || []).map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      return co ? co.uid + " · " + co.title : uid;
    }).join(' · ');
    const hasReponse = c.reponse && c.reponse.trim().length;
    const showSlider = (window.D.settings && window.D.settings.ankiShowSlider !== false);
    const isDevoir = c.type === 'devoir';
    const sessionMin = isDevoir
      ? Math.round(((c._dureeTotaleMin || (c.tempsCible / 60)) / (c._morceauxTotal || 1)))
      : ((c.tempsCible || 60) / 60);

    ov.innerHTML = `
      <div class="modal anki-session" style="border-top:5px solid ${m.color};">
        <div class="anki-sess-top">
          <div>
            <span class="uid-badge">${c.id}</span>
            <span class="anki-tag" style="background:${m.color}20;color:${m.color};border:1px solid ${m.color};">${m.label}</span>
            ${isDevoir ? `<span class="anki-tag" style="background:#b06af720;color:#b06af7;border:1px solid #b06af7;">📝 DM ${(c._morceauxFaits || 0) + 1}/${c._morceauxTotal || 1}</span>` : `<span class="anki-tag">${pri(c.priorite || 2)}</span>`}
          </div>
          <div class="anki-chrono" id="ankiChrono">00:00</div>
        </div>
        ${isDevoir ? `
          <div class="anki-devoir-bandeau">
            <div class="anki-mut" style="font-size:11px;">Temps prévu pour cette session :</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
              <input type="number" id="ankiDevoirTemps" min="1" max="240" step="5" value="${sessionMin}" style="width:70px;">
              <span class="anki-mut">min · Reste après celle-ci : <b>${Math.max(0, (c._morceauxTotal || 1) - (c._morceauxFaits || 0) - 1)} session(s)</b></span>
            </div>
          </div>
        ` : `<div class="anki-sess-meta">⏱ Cible ${window.AnkiAlgo.fmtDur(c.tempsCible || 60)} · ${profileLabel(c.profil || 'COURS')}${linkedTitle ? ' · 🔗 ' + esc(linkedTitle) : ''}</div>`}
        ${c.titre ? `<div class="anki-sess-titre">${esc(c.titre)}</div>` : ''}
        <div class="anki-sess-q">${esc(c.question || '')}</div>
        ${S.showAnswer ? `
          ${hasReponse ? `<div class="anki-sess-r"><div class="anki-mut" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Réponse</div><div>${esc(c.reponse)}</div></div>` : '<div class="anki-sess-r-empty">Auto-évaluation libre (pas de réponse enregistrée)</div>'}
          ${isDevoir ? `
            <div class="anki-mut" style="text-align:center;margin:14px 0 8px;font-size:12px;">Session de DM terminée ? Indique l'avancement :</div>
            <div class="anki-evals">
              <button class="anki-eval bad" onclick="window.evalCard(2)" title="Pas avancé ou bloqué"><span>⏸</span><small>À refaire</small></button>
              <button class="anki-eval mid" onclick="window.evalCard(6)" title="Partiellement fait"><span>📝</span><small>Partiel</small></button>
              <button class="anki-eval good" onclick="window.evalCard(9)" title="Session complétée"><span>✅</span><small>Fait</small></button>
            </div>
            <p class="anki-mut" style="font-size:11px;text-align:center;margin-top:8px;">Pour un DM, on n'évalue pas la mémoire mais l'avancement. L'ease/intervalle ne changent pas.</p>
          ` : `
            <div class="anki-mut" style="text-align:center;margin:14px 0 8px;font-size:12px;">Comment ça s'est passé ?</div>
            <div class="anki-evals">
              <button class="anki-eval bad" onclick="window.evalCard(2)"><span>❌</span><small>Blocage</small></button>
              <button class="anki-eval mid" onclick="window.evalCard(6)"><span>🟡</span><small>Étourderie</small></button>
              <button class="anki-eval good" onclick="window.evalCard(9)"><span>✅</span><small>Parfait</small></button>
            </div>
            ${showSlider ? `
              <div class="anki-slider-wrap">
                <div class="anki-slider-head">
                  <span class="anki-mut">Précision fine :</span>
                  <span class="anki-slider-val" id="ankiSliderVal">${S.sliderValue}</span><span class="anki-mut">/10</span>
                </div>
                <input type="range" min="1" max="10" value="${S.sliderValue}" class="anki-slider" id="ankiSlider"
                  oninput="document.getElementById('ankiSliderVal').textContent=this.value;window._ankiSlider=parseInt(this.value);">
                <button class="bp anki-slider-btn" onclick="window.evalCard(parseInt(document.getElementById('ankiSlider').value))">Valider (score précis)</button>
              </div>
            ` : ''}
          `}
        ` : `<button class="bp anki-reveal" onclick="window.revealAnki()">${isDevoir ? "J'ai fini cette session" : (hasReponse ? 'Afficher la réponse' : "J'ai fini · m'auto-évaluer")}</button>`}
        <div class="anki-sess-foot">
          <span class="anki-mut">Reste : ${S.queue.length} · ✅ ${S.stats.ok} · 🟡 ${S.stats.mid} · ❌ ${S.stats.bad}</span>
          <button class="bs anki-quit" onclick="window.abortAnkiSession()">Terminer maintenant</button>
        </div>
      </div>
    `;
  }

  window.revealAnki = function () { S.showAnswer = true; renderSessionOverlay(); };
  window.evalCard = function (qScore) {
    if (!S.current) return;
    qScore = Math.max(0, Math.min(10, qScore));
    if (S.chronoInt) { clearInterval(S.chronoInt); S.chronoInt = null; }
    const tps = S.chronoElapsed;
    const isDevoir = S.current.type === 'devoir';

    if (isDevoir) {
      // ⚙️ DM : on ne touche PAS ease/intervalle/repetitions (pas une carte de mémorisation)
      // On incrémente juste _morceauxFaits ; la prochaine session = lendemain
      S.current._morceauxFaits = (S.current._morceauxFaits || 0) + 1;
      const restants = (S.current._morceauxTotal || 1) - S.current._morceauxFaits;
      if (restants <= 0) {
        S.current.statut = 'fini';
        S.current.dateProchaineRevision = null;
      } else {
        S.current.dateProchaineRevision = window.AnkiAlgo.addDays(window.AnkiAlgo.todayISO(), 1);
      }
      S.current.historique = S.current.historique || [];
      S.current.historique.push({ date: new Date().toISOString(), qScore, tempsReel: Math.round(tps), pen: 1, mode: S.mode, type: 'devoir-session' });
      window.AnkiAlgo.log("devoir-session", {
        id: S.current.id,
        morceaux: S.current._morceauxFaits + "/" + S.current._morceauxTotal,
        prochaine: restants > 0 ? S.current.dateProchaineRevision : "TERMINÉ",
        tempsReel: window.AnkiAlgo.fmtDur(tps)
      });
      window.sysAlert(`📝 <b>${S.current.titre || S.current.id}</b><br>Session ${S.current._morceauxFaits}/${S.current._morceauxTotal} terminée.<br>${restants > 0 ? 'Prochaine session : <b>' + S.current.dateProchaineRevision + '</b>' : '✅ <b>DM TERMINÉ</b>'}`, "DM");
    } else {
      // 📚 Carte normale : update ease/intervalle/repetitions
      const easeAvant = S.current.ease || 2.5;
      const intAvant = S.current.intervalle || 0;
      const out = window.AnkiAlgo.computeNextInterval(S.current, qScore, tps);
      if (S.mode !== "colle") {
        S.current.intervalle = out.intervalle; S.current.ease = out.ease;
        S.current.repetitions = out.repetitions; S.current.dateProchaineRevision = out.dateProchaineRevision;
      }
      S.current.historique = S.current.historique || [];
      S.current.historique.push({ date: new Date().toISOString(), qScore, tempsReel: Math.round(tps), pen: out.penaliteVitesse, mode: S.mode });
      window.AnkiAlgo.log("eval", {
        id: S.current.id,
        qScore,
        ease: easeAvant.toFixed(2) + "→" + out.ease,
        intervalle: intAvant + "→" + out.intervalle + "j",
        next: out.dateProchaineRevision
      });
      // 🆕 Confirmation visible immédiate après chaque eval (mode single / quick)
      if (S.mode === 'single' || S.queue.length === 0) {
        const deltaEase = out.ease - easeAvant;
        const easeArrow = deltaEase > 0 ? '↑' : deltaEase < 0 ? '↓' : '=';
        const easeColor = deltaEase > 0 ? 'var(--grn)' : deltaEase < 0 ? 'var(--red)' : 'var(--mut)';
        window.sysAlert(
          `<b>${S.current.titre || S.current.id}</b><br><br>` +
          `🎯 Score : <b>${qScore}/10</b> (vitesse ×${out.penaliteVitesse})<br>` +
          `📊 Ease : ${easeAvant.toFixed(2)} → <b style="color:${easeColor};">${out.ease} ${easeArrow}</b><br>` +
          `📅 Intervalle : ${intAvant}j → <b>${out.intervalle}j</b><br>` +
          `🗓 Prochaine révision : <b>${out.dateProchaineRevision}</b>`,
          "Carte évaluée"
        );
      }
    }

    const btn = window.AnkiAlgo.qScoreToButton(qScore);
    if (btn === 0) S.stats.bad++; else if (btn === 1) S.stats.mid++; else S.stats.ok++;
    if (qScore <= 3 && S.mode !== "colle" && S.mode !== "single" && !isDevoir) S.queue.push(S.current);
    if (window.D.settings) window.D.settings.ankiLastSession = window.AnkiAlgo.todayISO();
    window.save(); nextCard();
  };
  window.abortAnkiSession = function () {
    if (S.chronoInt) clearInterval(S.chronoInt);
    const ov = $("ovAnkiSession"); if (ov) ov.classList.add("hidden");
    const s = S.stats;
    if (s.total) window.sysAlert(`Session terminée.<br>✅ ${s.ok} · 🟡 ${s.mid} · ❌ ${s.bad}<br>${s.total - S.queue.length}/${s.total} cartes faites.`, "Synchrotron");
    S.queue = []; S.current = null; S.selectionIds.clear(); S.manualOrder = null;
    window.renderAnki();
  };
  function endSession() { window.abortAnkiSession(); }

  // ====== CRUD ======
  let editingExoId = null;

  window.openExoModal = function () {
    ensure(); editingExoId = null; S.coursLinkSelection = new Set(); S.coursLinkQuery = "";
    showExoModal({});
  };
  window.openDevoirModal = function () {
    ensure(); editingExoId = null; S.coursLinkSelection = new Set(); S.coursLinkQuery = "";
    showExoModal({ type: 'devoir', tempsCible: 30 * 60, profil: 'EXO' });
  };
  window.editExo = function (id) {
    const c = window.D.exercices.find(x => x.id === id); if (!c) return;
    editingExoId = id;
    S.coursLinkSelection = new Set(c.coursIds || (c.coursId ? [c.coursId] : []));
    S.coursLinkQuery = ""; showExoModal(c);
  };
  window.delExo = function (id) {
    window.sysConfirm("Supprimer la carte " + id + " ?", () => {
      window.D.exercices = window.D.exercices.filter(c => c.id !== id && c._morceauOf !== id);
      window.save(); window.renderAnki();
    }, "Suppression");
  };

  function showExoModal(c) {
    let ov = $("ovExo");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovExo"; ov.className = "ov"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const isDevoir = c.type === 'devoir';
    const matOpts = '<option value="">— Choisir —</option>' + (window.D.matieres || []).map(m => `<option value="${m.id}" ${m.id === c.mat ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const profileOpts = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(p => `<option value="${p}" ${(c.profil || 'COURS') === p ? 'selected' : ''}>${window.AnkiAlgo.DEFAULT_PROFILES[p].label}</option>`).join('');
    const tempsMin = c.tempsCible ? (c.tempsCible / 60) : (isDevoir ? 30 : 1);

    ov.innerHTML = `
      <div class="modal anki-modal-exo">
        <h2>${editingExoId ? '✏️ Modifier' : (isDevoir ? '📝 Nouveau devoir' : '✨ Nouvelle carte')}</h2>
        <div class="fg">
          <label>Titre court</label>
          <input type="text" id="exoTitre" placeholder="Ex: ${isDevoir ? 'DM Mécanique' : 'Théorème énergie cinétique'}" value="${esc(c.titre || '')}">
        </div>
        <div class="fg">
          <label>${isDevoir ? 'Description' : 'Énoncé'} *</label>
          <textarea id="exoQ" rows="3">${esc(c.question || '')}</textarea>
        </div>
        <div class="fg">
          <label>Réponse (facultatif) <span class="anki-mut" style="font-weight:normal;">— laisse vide pour t'auto-évaluer</span></label>
          <textarea id="exoR" rows="2">${esc(c.reponse || '')}</textarea>
        </div>
        <div class="anki-modal-row">
          <div class="fg"><label>Matière *</label><select id="exoMat">${matOpts}</select></div>
          ${isDevoir ? '' : `<div class="fg"><label>Profil</label><select id="exoProf">${profileOpts}</select></div>`}
          <div class="fg"><label>Durée (min)</label><input type="number" id="exoTempsMin" min="1" max="600" step="0.5" value="${tempsMin}"></div>
        </div>
        <div class="anki-modal-row">
          <div class="fg"><label>Priorité</label>
            <select id="exoPri">
              <option value="1" ${c.priorite === 1 ? 'selected' : ''}>🔥 Urgence</option>
              <option value="2" ${(c.priorite || 2) === 2 ? 'selected' : ''}>⭐ Normale</option>
              <option value="3" ${c.priorite === 3 ? 'selected' : ''}>🌙 Faible</option>
            </select>
          </div>
          <div class="fg"><label>Statut</label>
            <select id="exoStat">
              <option value="attente" ${(c.statut || 'attente') === 'attente' ? 'selected' : ''}>⏳ Réservoir</option>
              <option value="actif" ${c.statut === 'actif' ? 'selected' : ''}>🟢 Actif</option>
            </select>
          </div>
          ${isDevoir ? `<div class="fg"><label>Date limite</label><input type="date" id="exoDateLim" value="${esc(c.dateLimite || '')}"></div>` : ''}
        </div>

        ${isDevoir ? `
          <div class="fg anki-decoupe">
            <label><input type="checkbox" id="exoDecoupe" ${c._morceauxTotal > 1 ? 'checked' : ''}> Découper en morceaux indépendants</label>
            <div id="exoDecoupeWrap" style="display:${c._morceauxTotal > 1 ? 'block' : 'none'};margin-top:6px;">
              <label class="anki-mut" style="font-size:11px;">Nombre de morceaux</label>
              <input type="number" id="exoMorceaux" min="2" max="20" value="${c._morceauxTotal || 3}">
              <p class="anki-mut" style="font-size:11px;margin-top:4px;">Chaque morceau est une tâche distincte dans la file, étalable sur plusieurs jours.</p>
            </div>
          </div>
        ` : ''}

        <div class="fg">
          <label>Cours liés (recherche · plusieurs possibles)</label>
          <input type="text" id="exoCoursSearch" placeholder="🔍 Titre, matière, classeur, code..." oninput="window.ankiCoursLinkSearch(this.value)">
          <div id="exoCoursSelected" class="anki-link-selected"></div>
          <div id="exoCoursResults" class="anki-link-results"></div>
        </div>

        ${editingExoId ? `<div class="fg"><label>Identifiant</label><div class="uidbox">${c.id}</div></div>` : ''}

        <div class="macts">
          <button class="bs" onclick="document.getElementById('ovExo').classList.add('hidden')">Annuler</button>
          <button class="bp" onclick="window.saveExo(${isDevoir ? 'true' : 'false'})">Enregistrer</button>
        </div>
      </div>
    `;
    // Decoupe toggle
    const dc = $("exoDecoupe");
    if (dc) dc.addEventListener('change', e => {
      $("exoDecoupeWrap").style.display = e.target.checked ? 'block' : 'none';
    });
    renderCoursLinkUI();
  }

  function renderCoursLinkUI() {
    const sel = $("exoCoursSelected"), res = $("exoCoursResults");
    if (!sel || !res) return;
    sel.innerHTML = Array.from(S.coursLinkSelection).map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      if (!co) return `<span class="anki-link-chip" onclick="window.ankiCoursLinkToggle('${uid}')">${uid} ✕</span>`;
      const m = mat(co.mat);
      return `<span class="anki-link-chip" style="background:${m.color}20;border:1px solid ${m.color};color:${m.color};" onclick="window.ankiCoursLinkToggle('${uid}')">${co.uid} · ${esc(co.title)} ✕</span>`;
    }).join('') || '<span class="anki-mut" style="font-size:11px;">Aucun cours lié.</span>';

    const q = (S.coursLinkQuery || '').toLowerCase().trim();
    if (!q) { res.innerHTML = ''; return; }
    const list = (window.D.cours || []).filter(c => {
      if (S.coursLinkSelection.has(c.uid)) return false;
      const matObj = mat(c.mat);
      const cl = (window.D.classeurs || []).find(x => x.id === c.cl) || {};
      return ((c.uid || '') + ' ' + (c.title || '') + ' ' + (matObj.name || '') + ' ' + (matObj.label || '') + ' ' + (cl.name || '')).toLowerCase().includes(q);
    }).slice(0, 12);
    if (!list.length) { res.innerHTML = '<div class="anki-mut" style="padding:8px;font-size:12px;">Aucun cours trouvé.</div>'; return; }
    res.innerHTML = list.map(c => {
      const m = mat(c.mat);
      const cl = (window.D.classeurs || []).find(x => x.id === c.cl) || {};
      return `<div class="anki-link-row" onclick="window.ankiCoursLinkToggle('${c.uid}')">
        <span class="anki-link-mat" style="background:${m.color}20;color:${m.color};">${m.label}</span>
        <span class="anki-link-id">${c.uid}</span>
        <span class="anki-link-title">${esc(c.title)}</span>
        <span class="anki-mut">${cl.name || ''}</span>
      </div>`;
    }).join('');
  }
  window.ankiCoursLinkSearch = function (v) { S.coursLinkQuery = v; renderCoursLinkUI(); };
  window.ankiCoursLinkToggle = function (uid) {
    if (S.coursLinkSelection.has(uid)) S.coursLinkSelection.delete(uid);
    else S.coursLinkSelection.add(uid);
    renderCoursLinkUI();
  };

  window.saveExo = function (isDevoir) {
    const titre = $("exoTitre").value.trim();
    const q = $("exoQ").value.trim();
    const r = $("exoR").value.trim();
    const matV = $("exoMat").value;
    const profil = isDevoir ? 'EXO' : ($("exoProf") ? $("exoProf").value : 'COURS');
    const tempsMin = parseFloat($("exoTempsMin").value) || 1;
    const temps = Math.round(tempsMin * 60);
    const prio = parseInt($("exoPri").value) || 2;
    const stat = $("exoStat").value || "attente";
    const coursIds = Array.from(S.coursLinkSelection);
    const decoupe = isDevoir && $("exoDecoupe") && $("exoDecoupe").checked;
    const morceaux = decoupe ? Math.max(2, parseInt($("exoMorceaux").value) || 3) : 1;
    const dateLim = isDevoir && $("exoDateLim") ? $("exoDateLim").value : null;

    if (!q || !matV) return window.sysAlert("Énoncé et matière obligatoires.", "Erreur");

    if (editingExoId) {
      const c = window.D.exercices.find(x => x.id === editingExoId); if (!c) return;
      Object.assign(c, { titre, question: q, reponse: r, mat: matV, profil, tempsCible: temps, priorite: prio, statut: stat, coursIds });
      if (isDevoir) { c.type = 'devoir'; c.dateLimite = dateLim; c._morceauxTotal = morceaux; if (!c._morceauxFaits) c._morceauxFaits = 0; }
      delete c.coursId;
      if (stat === 'actif' && !c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO();
    } else {
      const existing = window.D.exercices.map(x => x.id).concat((window.D.cours || []).map(x => x.uid));
      const newId = window.AnkiAlgo.genExoUid(matV, existing);
      const card = {
        id: newId, titre, question: q, reponse: r, mat: matV, profil, tempsCible: temps,
        priorite: prio, statut: stat, coursIds, intervalle: 0,
        ease: window.AnkiAlgo.getProfile(profil).ease,
        repetitions: 0, dateProchaineRevision: stat === 'actif' ? window.AnkiAlgo.todayISO() : null,
        historique: [], epinglee: false, dateCreation: new Date().toISOString()
      };
      if (isDevoir) { card.type = 'devoir'; card.dateLimite = dateLim; card._morceauxTotal = morceaux; card._morceauxFaits = 0; }
      window.D.exercices.unshift(card);
      // Si découpé : crée les morceaux comme cartes virtuelles
      if (isDevoir && morceaux > 1) {
        window.AnkiAlgo.splitDevoir(card, morceaux).forEach((m, idx) => {
          if (idx === 0) return; // on garde le parent visible
          const pieceId = window.AnkiAlgo.genExoUid(matV, window.D.exercices.map(x => x.id).concat([newId]));
          window.D.exercices.unshift({
            ...m, id: pieceId,
            dateProchaineRevision: window.AnkiAlgo.addDays(window.AnkiAlgo.todayISO(), idx),
            statut: 'actif', type: 'devoir-morceau', _morceauOf: newId
          });
        });
      }
    }
    window.save();
    const ov = $("ovExo"); if (ov) ov.classList.add("hidden");
    window.renderAnki();
  };

  window.quickAddAnkiCard = function (data) {
    ensure();
    const matV = data.mat || ((window.D.matieres[0] && window.D.matieres[0].id) || 'XX');
    const existing = window.D.exercices.map(x => x.id).concat((window.D.cours || []).map(x => x.uid));
    const id = window.AnkiAlgo.genExoUid(matV, existing);
    const profil = data.profil || "ANGLAIS";
    const card = {
      id, titre: data.titre || "", question: data.question || "", reponse: data.reponse || "",
      mat: matV, profil, tempsCible: data.tempsCible || 60, priorite: data.priorite || 2, statut: data.statut || "actif",
      coursIds: data.coursIds || [], intervalle: 0, ease: window.AnkiAlgo.getProfile(profil).ease, repetitions: 0,
      dateProchaineRevision: window.AnkiAlgo.todayISO(), historique: [], epinglee: false, dateCreation: new Date().toISOString()
    };
    window.D.exercices.unshift(card);
    window.save();
    return card;
  };
})();
