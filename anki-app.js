/**
 * =========================================================================================
 * 🧠 anki-app.js — UI Mode Synchrotron (PC*)
 * =========================================================================================
 * Architecture :
 *   - 3 sous-vues : Cockpit · Bibliothèque · Prévisions
 *   - Création/édition de cartes (réponse facultative, multi-cours liés via recherche)
 *   - Session paramétrable en durée, lecture 1-par-1, terminable à tout moment
 *   - Calendrier précis (ordre + chaque carte), report manuel, ajustement d'intervalle
 *   - Réglages : quota, intervalles par profil, charge max/jour
 *   - Style intégré (var(--acc), var(--s1)...) — pas d'aspect "IA"
 *
 * Données stockées dans window.D.exercices (sync via window.save()).
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
    coursLinkQuery: ""
  };

  // ===== Helpers =====
  function ensureArrays() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
  }
  function fmtSec(s) {
    s = Math.max(0, Math.round(s));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function fmtMin(s) {
    const m = Math.round(s / 60);
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0");
  }
  function mat(id) { return (window.D.matieres || []).find(m => m.id === id) || { color: "#666", label: id, name: id }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function pri(p) { return p === 1 ? "🔥 Urgence" : p === 3 ? "🌙 Faible" : "⭐ Normale"; }
  function profileLabel(p) {
    const prof = window.AnkiAlgo.getProfile(p);
    return prof ? prof.label : p;
  }

  // ===== Vue principale =====
  window.renderAnki = function () {
    ensureArrays();
    const root = $("paneAnki");
    if (!root) return;

    const exos = window.D.exercices;
    const actifs = exos.filter(c => c.statut === "actif").length;
    const reservoir = exos.filter(c => c.statut === "attente").length;
    const due = window.AnkiAlgo.getDueCards(exos);
    const sessionMin = (window.D.settings && window.D.settings.ankiSessionMin) || 60;

    root.innerHTML = `
      <div class="anki-head">
        <h2>🧬 Synchrotron <span class="anki-sub">— Répétition espacée PC*</span></h2>
        <p>Rappel actif · Espacement adaptatif · Entrelacement matières · Vitesse + Exactitude.</p>
      </div>

      <div class="anki-nav">
        <button class="anki-tab ${S.view === 'cockpit' ? 'on' : ''}" onclick="window.ankiSetView('cockpit')">🎛 Cockpit</button>
        <button class="anki-tab ${S.view === 'library' ? 'on' : ''}" onclick="window.ankiSetView('library')">📚 Bibliothèque</button>
        <button class="anki-tab ${S.view === 'forecast' ? 'on' : ''}" onclick="window.ankiSetView('forecast')">📅 Prévisions</button>
        <button class="anki-tab ${S.view === 'settings' ? 'on' : ''}" onclick="window.ankiSetView('settings')">⚙️ Réglages</button>
      </div>

      <div class="anki-kpis">
        <div class="kpi"><div class="kpi-n" style="color:var(--red);">${due.length}</div><div class="kpi-l">À réviser</div></div>
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
    if (S.view === "cockpit") c.innerHTML = viewCockpit();
    else if (S.view === "library") c.innerHTML = viewLibrary();
    else if (S.view === "forecast") c.innerHTML = viewForecast();
    else if (S.view === "settings") c.innerHTML = viewSettings();
    bindViewEvents();
  }

  // ===== VUE COCKPIT =====
  function viewCockpit() {
    const settings = (window.D.settings || {});
    const sessionMin = settings.ankiSessionMin || 60;
    const includeNew = settings.ankiIncludeNew !== undefined ? settings.ankiIncludeNew : 5;
    const selectedIds = Array.from(S.selectionIds);
    const plan = window.AnkiAlgo.buildSession(window.D.exercices, {
      sessionMinutes: sessionMin,
      includeNew: includeNew,
      selectedIds: selectedIds.length ? selectedIds : null
    });

    const cartes = plan.cartes;
    const total = plan.tempsTotalPrev;

    let html = `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <div>
            <h3>Session du jour</h3>
            <p class="anki-mut">${cartes.length} cartes · durée estimée ${fmtMin(total)} · ${plan.countDue} dues, ${plan.countNew} nouvelles</p>
          </div>
          <div class="anki-block-actions">
            <button class="bs" onclick="window.ankiQuickEditSession()">⏱ ${sessionMin} min</button>
            <button class="bp" onclick="window.startAnkiSession()" ${cartes.length === 0 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>▶ Commencer</button>
          </div>
        </div>
        <div class="anki-queue">
          ${cartes.length === 0 ? '<div class="anki-empty">Rien à réviser aujourd\'hui 🎉</div>' : cartes.map((c, i) => renderQueueRow(c, i)).join('')}
        </div>
        ${plan.reportees.length ? `<div class="anki-mut" style="margin-top:8px;font-size:11px;">${plan.reportees.length} carte(s) en file d'attente (hors budget temps)</div>` : ""}
      </div>
    `;

    // Sélection libre de cartes à inclure
    const dueAll = window.AnkiAlgo.getDueCards(window.D.exercices);
    const reservoirAll = window.D.exercices.filter(c => c.statut === "attente");
    html += `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Sélection manuelle</h3>
          <div class="anki-block-actions">
            <button class="bs" onclick="window.ankiSelectClear()">Vider</button>
            <button class="bs" onclick="window.ankiSelectAllDue()">Cocher toutes les dues</button>
          </div>
        </div>
        <p class="anki-mut" style="margin-bottom:8px;">Coche les cartes à inclure dans la session (laisse vide pour automatique).</p>
        <div class="anki-pick-grid">
          ${[...dueAll, ...reservoirAll].slice(0, 50).map(c => renderPickCard(c)).join('') || '<div class="anki-empty">Aucune carte disponible</div>'}
        </div>
      </div>
    `;

    return html;
  }

  function renderQueueRow(c, i) {
    const m = mat(c.mat);
    const due = window.AnkiAlgo.todayISO();
    const isLate = c.dateProchaineRevision && c.dateProchaineRevision < due;
    return `
      <div class="anki-q-row" onclick="window.startAnkiSingle('${c.id}')">
        <div class="anki-q-num">${i + 1}</div>
        <div class="anki-q-mat" style="background:${m.color};">${m.label}</div>
        <div class="anki-q-body">
          <div class="anki-q-title">${esc(c.titre || c.question.substring(0, 60))}</div>
          <div class="anki-q-meta">${c.id} · ⏱ ${c.tempsCible || 60}s · ${pri(c.priorite || 2)} ${isLate ? '· <span style="color:var(--red);">en retard</span>' : ''}</div>
        </div>
        <div class="anki-q-go">▶</div>
      </div>
    `;
  }

  function renderPickCard(c) {
    const m = mat(c.mat);
    const checked = S.selectionIds.has(c.id);
    return `
      <label class="anki-pick ${checked ? 'on' : ''}">
        <input type="checkbox" ${checked ? 'checked' : ''} onchange="window.ankiTogglePick('${c.id}')">
        <span class="anki-pick-mat" style="background:${m.color}20;color:${m.color};border:1px solid ${m.color};">${m.label}</span>
        <span class="anki-pick-id">${c.id}</span>
        <span class="anki-pick-q">${esc(c.titre || c.question.substring(0, 40))}</span>
      </label>
    `;
  }

  window.ankiTogglePick = function (id) {
    if (S.selectionIds.has(id)) S.selectionIds.delete(id);
    else S.selectionIds.add(id);
    renderActiveView();
  };
  window.ankiSelectClear = function () { S.selectionIds.clear(); renderActiveView(); };
  window.ankiSelectAllDue = function () {
    window.AnkiAlgo.getDueCards(window.D.exercices).forEach(c => S.selectionIds.add(c.id));
    renderActiveView();
  };

  window.ankiQuickEditSession = function () {
    const cur = (window.D.settings && window.D.settings.ankiSessionMin) || 60;
    const val = prompt("Durée souhaitée de la session (en minutes) :", cur);
    if (val === null) return;
    const n = parseInt(val) || cur;
    window.D.settings.ankiSessionMin = Math.max(5, Math.min(240, n));
    window.save();
    renderActiveView();
  };

  // ===== VUE BIBLIOTHÈQUE =====
  function viewLibrary() {
    let list = window.D.exercices.slice();
    if (S.libFilter.mat) list = list.filter(c => c.mat === S.libFilter.mat);
    if (S.libFilter.stat) list = list.filter(c => c.statut === S.libFilter.stat);
    if (S.libFilter.profil) list = list.filter(c => (c.profil || "COURS") === S.libFilter.profil);
    if (S.libFilter.q) {
      const q = S.libFilter.q.toLowerCase();
      list = list.filter(c => (c.titre || "").toLowerCase().includes(q)
        || (c.question || "").toLowerCase().includes(q)
        || (c.id || "").toLowerCase().includes(q));
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
    return `
      <div class="anki-lib-row">
        <span class="uid-badge anki-lib-id">${c.id}</span>
        <div class="anki-lib-text">
          <div class="anki-lib-title">${esc(c.titre || c.question.substring(0, 70))}</div>
          <div class="anki-lib-meta">
            <span class="anki-tag" style="border-color:${m.color}80;color:${m.color};">${profileLabel(c.profil || 'COURS')}</span>
            <span class="anki-mut">⏱ ${c.tempsCible || 60}s · ${pri(c.priorite || 2)} · prochaine : ${next} · ${c.statut === 'actif' ? '🟢 actif' : '⏳ réservoir'}</span>
          </div>
        </div>
        <div class="anki-lib-acts">
          <button class="cbt" title="Réviser" onclick="window.startAnkiSingle('${c.id}')">▶</button>
          <button class="cbt" title="Modifier" onclick="window.editExo('${c.id}')">✏️</button>
          <button class="cbt" title="Avancer/retarder" onclick="window.ankiAdjustNext('${c.id}')">📅</button>
          <button class="cbt" style="color:var(--red);border-color:var(--red);" title="Supprimer" onclick="window.delExo('${c.id}')">🗑</button>
        </div>
      </div>
    `;
  }

  window.ankiLibFilter = function (key, val) {
    S.libFilter[key] = val;
    renderActiveView();
  };

  window.ankiAdjustNext = function (id) {
    const c = window.D.exercices.find(x => x.id === id);
    if (!c) return;
    const cur = c.dateProchaineRevision || window.AnkiAlgo.todayISO();
    const days = prompt(`Décale la prochaine révision de combien de jours ? (négatif = avance)\n\nDate actuelle : ${cur}`, "0");
    if (days === null) return;
    const n = parseInt(days) || 0;
    c.dateProchaineRevision = window.AnkiAlgo.addDays(cur, n);
    window.save();
    renderActiveView();
  };

  // ===== VUE PRÉVISIONS =====
  function viewForecast() {
    const schedule = window.AnkiAlgo.forecastSchedule(window.D.exercices, S.forecastDays);
    const dates = Object.keys(schedule).sort();
    const max = Math.max(1, ...dates.map(d => schedule[d].reduce((s, c) => s + (c.tempsCible || 60), 0)));

    const html = `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Prévisions (${S.forecastDays} jours)</h3>
          <div class="anki-block-actions">
            <button class="bs" onclick="window.ankiForecastDays(7)">7j</button>
            <button class="bs" onclick="window.ankiForecastDays(14)">14j</button>
            <button class="bs" onclick="window.ankiForecastDays(30)">30j</button>
            <button class="bs" onclick="window.ankiRebalance()" title="Étale les pics sur les jours moins chargés">⚖️ Rééquilibrer</button>
          </div>
        </div>
        <div class="anki-forecast-bars">
          ${dates.map(d => {
            const total = schedule[d].reduce((s, c) => s + (c.tempsCible || 60), 0);
            const pct = Math.round((total / max) * 100);
            const dd = d.substring(5).replace('-', '/');
            const isToday = d === window.AnkiAlgo.todayISO();
            return `<div class="anki-fc-col ${isToday ? 'today' : ''}" onclick="window.ankiToggleDay('${d}')" title="${d} — ${schedule[d].length} cartes — ${fmtMin(total)}">
              <div class="anki-fc-bar" style="height:${Math.max(2, pct)}%;"></div>
              <div class="anki-fc-lbl">${dd}</div>
              <div class="anki-fc-n">${schedule[d].length || ''}</div>
            </div>`;
          }).join('')}
        </div>
        <div id="anki-day-detail" style="margin-top:14px;"></div>
      </div>
    `;
    return html;
  }

  window.ankiForecastDays = function (n) { S.forecastDays = n; renderActiveView(); };

  window.ankiToggleDay = function (d) {
    const schedule = window.AnkiAlgo.forecastSchedule(window.D.exercices, S.forecastDays);
    const cards = schedule[d] || [];
    const total = cards.reduce((s, c) => s + (c.tempsCible || 60), 0);
    const el = $("anki-day-detail");
    if (!el) return;
    if (!cards.length) {
      el.innerHTML = `<div class="anki-empty">${d} — aucune carte prévue</div>`;
      return;
    }
    el.innerHTML = `
      <div class="anki-day-hdr">
        <h4>📅 ${d} — ${cards.length} carte(s) · ${fmtMin(total)}</h4>
      </div>
      <div class="anki-day-list">
        ${cards.map((c, i) => {
          const m = mat(c.mat);
          return `
            <div class="anki-day-row">
              <span class="anki-day-num">${i + 1}</span>
              <span class="anki-q-mat" style="background:${m.color};">${m.label}</span>
              <span class="uid-badge">${c.id}</span>
              <span class="anki-day-title">${esc(c.titre || c.question.substring(0, 80))}</span>
              <span class="anki-mut">⏱ ${c.tempsCible || 60}s</span>
              <button class="cbt" onclick="window.ankiAdjustNext('${c.id}')" title="Décaler">📅</button>
              <button class="cbt" onclick="window.startAnkiSingle('${c.id}')" title="Réviser maintenant">▶</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  window.ankiRebalance = function () {
    const maxMin = (window.D.settings.ankiMaxPerDay || 75);
    const out = window.AnkiAlgo.rebalanceFuture(window.D.exercices, { days: 30, maxPerDay: maxMin * 60, dryRun: false });
    window.save();
    window.sysAlert(`Rééquilibrage : ${out.moves.length} carte(s) déplacée(s) pour lisser la charge (limite ${maxMin} min/jour).`, "Synchrotron");
    renderActiveView();
  };

  // ===== VUE RÉGLAGES =====
  function viewSettings() {
    const st = window.D.settings || {};
    if (!st.ankiProfiles) st.ankiProfiles = JSON.parse(JSON.stringify(window.AnkiAlgo.DEFAULT_PROFILES));

    const profilesHtml = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(k => {
      const p = st.ankiProfiles[k] || window.AnkiAlgo.DEFAULT_PROFILES[k];
      return `
        <div class="anki-prof">
          <div class="anki-prof-hdr">
            <strong>${p.label || k}</strong>
            <span class="anki-mut">${k}</span>
          </div>
          <label class="anki-mut" style="font-size:11px;">Étapes (jours, séparés par virgules)</label>
          <input class="fi" id="prof_${k}_steps" value="${(p.steps || []).join(', ')}" oninput="window.ankiSaveProfile('${k}')">
          <label class="anki-mut" style="font-size:11px;">Facilité initiale (ease)</label>
          <input class="fi" type="number" step="0.1" min="1.3" max="3.0" id="prof_${k}_ease" value="${p.ease}" oninput="window.ankiSaveProfile('${k}')">
        </div>
      `;
    }).join('');

    return `
      <div class="anki-card-block">
        <h3>Réglages globaux</h3>
        <div class="anki-set-row">
          <label>Durée de session par défaut (min)</label>
          <input type="number" class="fi" min="5" max="240" value="${st.ankiSessionMin || 60}" onchange="window.D.settings.ankiSessionMin=parseInt(this.value)||60;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Quota quotidien max (cockpit, min)</label>
          <input type="number" class="fi" min="15" max="240" value="${st.ankiQuotaMin || 90}" onchange="window.D.settings.ankiQuotaMin=parseInt(this.value)||90;window.save();">
        </div>
        <div class="anki-set-row">
          <label>Nouvelles cartes par jour</label>
          <input type="number" class="fi" min="0" max="30" value="${st.ankiIncludeNew !== undefined ? st.ankiIncludeNew : 5}" onchange="window.D.settings.ankiIncludeNew=parseInt(this.value)||0;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Charge max/jour pour rééquilibrage (min)</label>
          <input type="number" class="fi" min="15" max="240" value="${st.ankiMaxPerDay || 75}" onchange="window.D.settings.ankiMaxPerDay=parseInt(this.value)||75;window.save();">
        </div>
      </div>

      <div class="anki-card-block">
        <h3>Profils d'intervalles</h3>
        <p class="anki-mut">Chaque carte appartient à un profil. Tu peux ajuster les étapes (en jours) au cas par cas.</p>
        <div class="anki-prof-grid">${profilesHtml}</div>
        <button class="bs" onclick="window.ankiResetProfiles()" style="margin-top:10px;">↺ Réinitialiser les profils par défaut</button>
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
    window.save();
    renderActiveView();
  };

  // ===== SESSION =====
  window.startAnkiSession = function () {
    const settings = window.D.settings || {};
    const plan = window.AnkiAlgo.buildSession(window.D.exercices, {
      sessionMinutes: settings.ankiSessionMin || 60,
      includeNew: settings.ankiIncludeNew !== undefined ? settings.ankiIncludeNew : 5,
      selectedIds: S.selectionIds.size ? Array.from(S.selectionIds) : null
    });
    if (!plan.cartes.length) return window.sysAlert("Aucune carte à réviser.", "Synchrotron");
    // Active les nouvelles cartes piochées
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
    S.queue = [c];
    S.mode = "single";
    S.stats = { ok: 0, mid: 0, bad: 0, total: 1 };
    nextCard();
  };

  // API publique : démarre une session avec un ordre précis d'IDs (utilisée par anki-quick.js)
  window.ankiSetQuickQueue = function (ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const cards = ids.map(id => window.D.exercices.find(x => x.id === id)).filter(Boolean);
    if (!cards.length) return;
    cards.forEach(c => {
      if (c.statut !== 'actif') { c.statut = 'actif'; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO(); }
    });
    S.queue = cards.slice();
    S.mode = "quick";
    S.stats = { ok: 0, mid: 0, bad: 0, total: cards.length };
    window.save();
    nextCard();
  };

  window.startAnkiColle = function (coursId) {
    ensureArrays();
    const q = window.D.exercices.filter(c => (c.coursIds || []).includes(coursId) || c.coursId === coursId);
    if (!q.length) return window.sysAlert("Aucune carte liée à ce cours.", "Mode Colle");
    S.queue = window.AnkiAlgo.interleave(q.slice());
    S.mode = "colle";
    S.stats = { ok: 0, mid: 0, bad: 0, total: q.length };
    nextCard();
  };

  function nextCard() {
    if (!S.queue.length) return endSession();
    S.current = S.queue.shift();
    S.showAnswer = false;
    S.chronoElapsed = 0; S.chronoStart = Date.now();
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
    ov.innerHTML = `
      <div class="modal anki-session" style="border-top:5px solid ${m.color};">
        <div class="anki-sess-top">
          <div>
            <span class="uid-badge">${c.id}</span>
            <span class="anki-tag" style="background:${m.color}20;color:${m.color};border:1px solid ${m.color};">${m.label}</span>
            <span class="anki-tag">${pri(c.priorite || 2)}</span>
          </div>
          <div class="anki-chrono" id="ankiChrono">00:00</div>
        </div>
        <div class="anki-sess-meta">⏱ Cible ${c.tempsCible || 60}s · ${profileLabel(c.profil || 'COURS')}${linkedTitle ? ' · 🔗 ' + esc(linkedTitle) : ''}</div>
        ${c.titre ? `<div class="anki-sess-titre">${esc(c.titre)}</div>` : ''}
        <div class="anki-sess-q">${esc(c.question || '')}</div>
        ${S.showAnswer ? `
          ${hasReponse ? `<div class="anki-sess-r"><div class="anki-mut" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Réponse</div><div>${esc(c.reponse)}</div></div>` : '<div class="anki-sess-r-empty">Auto-évaluation libre (pas de réponse enregistrée)</div>'}
          <div class="anki-mut" style="text-align:center;margin:14px 0 8px;font-size:12px;">Comment ça s'est passé ?</div>
          <div class="anki-evals">
            <button class="anki-eval bad" onclick="window.evalCard(0)"><span>❌</span><small>Blocage</small></button>
            <button class="anki-eval mid" onclick="window.evalCard(1)"><span>🟡</span><small>Étourderie</small></button>
            <button class="anki-eval good" onclick="window.evalCard(2)"><span>✅</span><small>Parfait</small></button>
          </div>
        ` : `<button class="bp anki-reveal" onclick="window.revealAnki()">${hasReponse ? 'Afficher la réponse' : "J'ai fini, m'auto-évaluer"}</button>`}
        <div class="anki-sess-foot">
          <span class="anki-mut">Reste : ${S.queue.length} · ✅ ${S.stats.ok} · 🟡 ${S.stats.mid} · ❌ ${S.stats.bad}</span>
          <button class="bs anki-quit" onclick="window.abortAnkiSession()">Terminer maintenant</button>
        </div>
      </div>
    `;
  }

  window.revealAnki = function () { S.showAnswer = true; renderSessionOverlay(); };

  window.evalCard = function (q) {
    if (!S.current) return;
    if (S.chronoInt) { clearInterval(S.chronoInt); S.chronoInt = null; }
    const tps = S.chronoElapsed;
    const out = window.AnkiAlgo.computeNextInterval(S.current, q, tps);
    if (S.mode !== "colle") {
      S.current.intervalle = out.intervalle;
      S.current.ease = out.ease;
      S.current.repetitions = out.repetitions;
      S.current.dateProchaineRevision = out.dateProchaineRevision;
    }
    S.current.historique = S.current.historique || [];
    S.current.historique.push({ date: new Date().toISOString(), qualite: q, tempsReel: Math.round(tps), penaliteVitesse: out.penaliteVitesse, mode: S.mode });
    if (q === 0) S.stats.bad++; else if (q === 1) S.stats.mid++; else S.stats.ok++;
    if (q === 0 && S.mode !== "colle") S.queue.push(S.current);
    window.save();
    nextCard();
  };

  window.abortAnkiSession = function () {
    if (S.chronoInt) clearInterval(S.chronoInt);
    const ov = $("ovAnkiSession"); if (ov) ov.classList.add("hidden");
    const s = S.stats;
    if (s.total) window.sysAlert(`Session terminée.<br>✅ ${s.ok} · 🟡 ${s.mid} · ❌ ${s.bad}<br>${s.total - S.queue.length}/${s.total} cartes faites.`, "Synchrotron");
    S.queue = []; S.current = null;
    S.selectionIds.clear();
    window.renderAnki();
  };

  function endSession() { window.abortAnkiSession(); }

  // ===== CRUD =====
  let editingExoId = null;

  window.openExoModal = function () {
    ensureArrays();
    editingExoId = null;
    S.coursLinkSelection = new Set();
    S.coursLinkQuery = "";
    showExoModal({});
  };

  window.editExo = function (id) {
    const c = window.D.exercices.find(x => x.id === id);
    if (!c) return;
    editingExoId = id;
    S.coursLinkSelection = new Set(c.coursIds || (c.coursId ? [c.coursId] : []));
    S.coursLinkQuery = "";
    showExoModal(c);
  };

  window.delExo = function (id) {
    window.sysConfirm("Supprimer la carte " + id + " ?", () => {
      window.D.exercices = window.D.exercices.filter(c => c.id !== id);
      window.save(); window.renderAnki();
    }, "Suppression");
  };

  function showExoModal(c) {
    let ov = $("ovExo");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovExo"; ov.className = "ov"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const matOpts = '<option value="">— Choisir —</option>' + (window.D.matieres || []).map(m => `<option value="${m.id}" ${m.id === c.mat ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const profileOpts = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(p => `<option value="${p}" ${(c.profil || 'COURS') === p ? 'selected' : ''}>${window.AnkiAlgo.DEFAULT_PROFILES[p].label}</option>`).join('');

    ov.innerHTML = `
      <div class="modal anki-modal-exo">
        <h2>${editingExoId ? '✏️ Modifier' : '✨ Nouvelle'} carte</h2>
        <div class="fg">
          <label>Titre court (optionnel — affiché dans la file)</label>
          <input type="text" id="exoTitre" placeholder="Ex: Théorème énergie cinétique" value="${esc(c.titre || '')}">
        </div>
        <div class="fg">
          <label>Énoncé / Injonction *</label>
          <textarea id="exoQ" rows="3" placeholder="Démontre le théorème...">${esc(c.question || '')}</textarea>
        </div>
        <div class="fg">
          <label>Réponse (facultative) <span class="anki-mut" style="font-weight:normal;">— laisse vide pour t'auto-évaluer librement</span></label>
          <textarea id="exoR" rows="2" placeholder="Solution finale, point clé...">${esc(c.reponse || '')}</textarea>
        </div>
        <div class="anki-modal-row">
          <div class="fg"><label>Matière *</label><select id="exoMat">${matOpts}</select></div>
          <div class="fg"><label>Profil</label><select id="exoProf">${profileOpts}</select></div>
          <div class="fg"><label>Temps cible (s)</label><input type="number" id="exoTemps" min="5" max="3600" value="${c.tempsCible || 60}"></div>
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
        </div>

        <div class="fg">
          <label>Cours liés (recherche · plusieurs possibles)</label>
          <input type="text" id="exoCoursSearch" placeholder="🔍 Titre, matière, classeur, code (PH-A1B)..." oninput="window.ankiCoursLinkSearch(this.value)">
          <div id="exoCoursSelected" class="anki-link-selected"></div>
          <div id="exoCoursResults" class="anki-link-results"></div>
        </div>

        ${editingExoId ? `<div class="fg"><label>Identifiant</label><div class="uidbox">${c.id}</div></div>` : ''}

        <div class="macts">
          <button class="bs" onclick="document.getElementById('ovExo').classList.add('hidden')">Annuler</button>
          <button class="bp" onclick="window.saveExo()">Enregistrer</button>
        </div>
      </div>
    `;
    renderCoursLinkUI();
  }

  function renderCoursLinkUI() {
    const sel = $("exoCoursSelected");
    const res = $("exoCoursResults");
    if (!sel || !res) return;
    sel.innerHTML = Array.from(S.coursLinkSelection).map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      if (!co) return `<span class="anki-link-chip" onclick="window.ankiCoursLinkToggle('${uid}')">${uid} ✕</span>`;
      const m = mat(co.mat);
      return `<span class="anki-link-chip" style="background:${m.color}20;border:1px solid ${m.color};color:${m.color};" onclick="window.ankiCoursLinkToggle('${uid}')">${co.uid} · ${esc(co.title)} ✕</span>`;
    }).join('') || '<span class="anki-mut" style="font-size:11px;">Aucun cours lié pour le moment.</span>';

    const q = (S.coursLinkQuery || '').toLowerCase().trim();
    if (!q) { res.innerHTML = ''; return; }
    const list = (window.D.cours || []).filter(c => {
      if (S.coursLinkSelection.has(c.uid)) return false;
      const matObj = mat(c.mat);
      const cl = (window.D.classeurs || []).find(x => x.id === c.cl) || {};
      return (
        (c.uid || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (matObj.name || '').toLowerCase().includes(q) ||
        (matObj.label || '').toLowerCase().includes(q) ||
        (cl.name || '').toLowerCase().includes(q)
      );
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

  window.saveExo = function () {
    const titre = $("exoTitre").value.trim();
    const q = $("exoQ").value.trim();
    const r = $("exoR").value.trim();
    const mat = $("exoMat").value;
    const profil = $("exoProf").value || "COURS";
    const temps = parseInt($("exoTemps").value) || 60;
    const pri = parseInt($("exoPri").value) || 2;
    const stat = $("exoStat").value || "attente";
    const coursIds = Array.from(S.coursLinkSelection);

    if (!q || !mat) return window.sysAlert("Énoncé et matière obligatoires.", "Erreur");

    if (editingExoId) {
      const c = window.D.exercices.find(x => x.id === editingExoId);
      if (!c) return;
      Object.assign(c, { titre, question: q, reponse: r, mat, profil, tempsCible: temps, priorite: pri, statut: stat, coursIds });
      delete c.coursId;
      if (stat === 'actif' && !c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO();
    } else {
      const existing = window.D.exercices.map(x => x.id).concat((window.D.cours || []).map(x => x.uid));
      const newId = window.AnkiAlgo.genExoUid(mat, existing);
      window.D.exercices.unshift({
        id: newId, titre, question: q, reponse: r, mat, profil, tempsCible: temps, priorite: pri, statut: stat,
        coursIds, intervalle: 0, ease: window.AnkiAlgo.getProfile(profil).ease,
        repetitions: 0, dateProchaineRevision: stat === 'actif' ? window.AnkiAlgo.todayISO() : null,
        historique: [], epinglee: false, dateCreation: new Date().toISOString()
      });
    }
    window.save();
    const ov = $("ovExo"); if (ov) ov.classList.add("hidden");
    window.renderAnki();
  };

  // ===== Création rapide depuis un autre onglet (Bêta/Quick) =====
  // Utilisée par anki-quick.js
  window.quickAddAnkiCard = function (data) {
    ensureArrays();
    const mat = data.mat || ((window.D.matieres[0] && window.D.matieres[0].id) || 'XX');
    const existing = window.D.exercices.map(x => x.id).concat((window.D.cours || []).map(x => x.uid));
    const id = window.AnkiAlgo.genExoUid(mat, existing);
    const profil = data.profil || "ANGLAIS";
    const card = {
      id, titre: data.titre || "", question: data.question || "", reponse: data.reponse || "",
      mat, profil, tempsCible: data.tempsCible || 20, priorite: data.priorite || 2, statut: data.statut || "actif",
      coursIds: data.coursIds || [], intervalle: 0, ease: window.AnkiAlgo.getProfile(profil).ease, repetitions: 0,
      dateProchaineRevision: window.AnkiAlgo.todayISO(), historique: [], epinglee: false, dateCreation: new Date().toISOString()
    };
    window.D.exercices.unshift(card);
    window.save();
    return card;
  };

  function bindViewEvents() { /* placeholders for delegations if needed */ }
})();
