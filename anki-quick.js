/**
 * =========================================================================================
 * 🃏 anki-quick.js — Créateur de cartes rapides (anglais, formules, micro-révisions)
 * =========================================================================================
 * Transforme l'onglet "Bêta" en atelier de création + révision express.
 * Crée directement des cartes dans window.D.exercices (profil ANGLAIS par défaut).
 * Conserve l'affichage flip-card legacy de PC_FLASHCARDS (rétrocompat).
 * =========================================================================================
 */
(function () {
  const $ = id => document.getElementById(id);

  const Q = { mat: "", profil: "ANGLAIS", filterMat: "", filterProf: "ANGLAIS" };

  function ensure() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Q.mat && window.D.matieres && window.D.matieres.length) Q.mat = window.D.matieres[0].id;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // Remplace window.renderFlashcards (l'ancien existe déjà — on ECRASE)
  window.renderFlashcards = function () {
    ensure();
    const root = $("paneFlashcards");
    if (!root) return;

    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${Q.mat === m.id ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const profOpts = window.AnkiAlgo && window.AnkiAlgo.DEFAULT_PROFILES
      ? Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(p => `<option value="${p}" ${Q.profil === p ? 'selected' : ''}>${window.AnkiAlgo.DEFAULT_PROFILES[p].label}</option>`).join('')
      : '<option value="ANGLAIS" selected>Anglais</option>';

    const filterMatOpts = '<option value="">Toutes</option>' + (window.D.matieres || []).map(m => `<option value="${m.id}" ${Q.filterMat === m.id ? 'selected' : ''}>${m.label}</option>`).join('');
    const filterProfOpts = '<option value="">Tous profils</option>' + (window.AnkiAlgo ? Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(p => `<option value="${p}" ${Q.filterProf === p ? 'selected' : ''}>${window.AnkiAlgo.DEFAULT_PROFILES[p].label}</option>`).join('') : '');

    root.innerHTML = `
      <div class="quick-head">
        <h2>🃏 Atelier de cartes rapides</h2>
        <p>Crée des cartes en quelques secondes (vocabulaire, formules, mini-révisions). Réponse facultative — tu t'auto-évalues.</p>
      </div>

      <div class="quick-create">
        <div class="quick-create-row">
          <input type="text" id="qkQ" placeholder="Question / recto (ex: « to elicit »)">
          <input type="text" id="qkR" placeholder="Réponse / verso (facultatif — ex: « provoquer une réaction »)">
        </div>
        <div class="quick-create-row">
          <select id="qkMat">${matOpts}</select>
          <select id="qkProf">${profOpts}</select>
          <input type="number" id="qkTemps" min="5" max="600" value="20" title="Temps cible (s)">
          <button class="bp" onclick="window.quickAdd()">+ Créer</button>
        </div>
        <div class="quick-mut">💡 Astuce : Entrée dans le champ Réponse pour créer rapidement.</div>
      </div>

      <div class="quick-filters">
        <input type="text" id="qkSearch" placeholder="🔍 Filtrer..." oninput="window.quickFilter()">
        <select id="qkFltMat" onchange="window.quickFilterMat(this.value)">${filterMatOpts}</select>
        <select id="qkFltProf" onchange="window.quickFilterProf(this.value)">${filterProfOpts}</select>
        <button class="bs" onclick="window.quickStartAll()">▶ Réviser le lot filtré</button>
      </div>

      <div class="quick-grid" id="qkGrid"></div>
    `;
    renderGrid();
    bindEnter();
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
    const profil = $("qkProf").value;
    const temps = parseInt($("qkTemps").value) || 20;
    if (!window.quickAddAnkiCard) { window.sysAlert("Module Anki non chargé.", "Erreur"); return; }
    window.quickAddAnkiCard({ question: q, reponse: r, mat, profil, tempsCible: temps, statut: "actif", priorite: 2 });
    $("qkQ").value = ''; $("qkR").value = '';
    $("qkQ").focus();
    renderGrid();
  };

  window.quickFilter = function () { renderGrid(); };
  window.quickFilterMat = function (v) { Q.filterMat = v; renderGrid(); };
  window.quickFilterProf = function (v) { Q.filterProf = v; renderGrid(); };

  function getFiltered() {
    const q = ($("qkSearch") && $("qkSearch").value || '').toLowerCase().trim();
    let list = (window.D.exercices || []).slice();
    if (Q.filterMat) list = list.filter(c => c.mat === Q.filterMat);
    if (Q.filterProf) list = list.filter(c => (c.profil || 'COURS') === Q.filterProf);
    if (q) list = list.filter(c => (c.question + ' ' + (c.reponse || '') + ' ' + (c.titre || '') + ' ' + c.id).toLowerCase().includes(q));
    list.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
    return list;
  }

  function renderGrid() {
    const grid = $("qkGrid");
    if (!grid) return;
    const list = getFiltered();
    if (!list.length) {
      grid.innerHTML = '<div class="anki-empty">Aucune carte. Crée la première ci-dessus 👆</div>';
      return;
    }
    grid.innerHTML = list.map(c => {
      const m = (window.D.matieres || []).find(x => x.id === c.mat) || { color: '#666', label: c.mat };
      const prof = window.AnkiAlgo && window.AnkiAlgo.DEFAULT_PROFILES[c.profil || 'COURS'];
      return `
        <div class="qk-card" onclick="this.classList.toggle('flipped')">
          <div class="qk-inner">
            <div class="qk-front">
              <div class="qk-top">
                <span class="qk-mat" style="background:${m.color};">${m.label}</span>
                <span class="qk-id">${c.id}</span>
              </div>
              <div class="qk-q">${esc(c.question)}</div>
              <div class="qk-foot">
                <span class="anki-mut">${prof ? prof.label : (c.profil || 'COURS')}</span>
                <span class="qk-actions" onclick="event.stopPropagation();">
                  <button class="cbt" onclick="window.startAnkiSingle('${c.id}')" title="Réviser cette carte">▶</button>
                  <button class="cbt" onclick="window.editExo('${c.id}')" title="Modifier">✏️</button>
                  <button class="cbt" style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${c.id}')" title="Supprimer">🗑</button>
                </span>
              </div>
            </div>
            <div class="qk-back">
              <div class="qk-r">${c.reponse ? esc(c.reponse) : '<em style="color:var(--mut);">Pas de réponse — auto-évaluation libre</em>'}</div>
              <div class="anki-mut" style="font-size:11px;text-align:center;">⏱ ${c.tempsCible || 60}s</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.quickStartAll = function () {
    const list = getFiltered().filter(c => c.statut === 'actif' || c.statut === 'attente');
    if (!list.length) return window.sysAlert("Aucune carte à réviser dans ce filtre.", "Atelier");
    // Active les cartes du réservoir
    list.forEach(c => { if (c.statut === 'attente') { c.statut = 'actif'; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO(); } });
    window.save();
    // Pousser dans la file de session de anki-app
    // (utilise les API publiques de anki-app)
    if (window.startAnkiSingle && list.length === 1) {
      window.startAnkiSingle(list[0].id);
    } else {
      // Multi : lance une session en sélection
      const ids = list.map(c => c.id);
      // injection temporaire via sélection
      if (window.D.settings) window.D.settings.ankiSessionMin = Math.max(15, Math.ceil(list.reduce((s, c) => s + (c.tempsCible || 60), 0) / 60));
      window._quickQueue = ids;
      // Lance directement via startAnkiSession en bypassant le selectedIds
      if (window.AnkiAlgo) {
        // Construit une queue manuelle :
        const cards = list.slice();
        // Utilise interleave pour mélanger les matières
        const ordered = window.AnkiAlgo.interleave(cards);
        // Pousse dans S manuellement via une fonction publique simple : startAnkiSingle en boucle
        // Le plus propre : appelle séquentiellement via session
        // Solution simple : crée une mini-session via les internals exposés
        runQuickSession(ordered);
      }
    }
  };

  // Mini session locale qui passe par evalCard du module principal :
  function runQuickSession(cards) {
    // On délègue à anki-app via une astuce : on définit S.queue indirectement
    // en utilisant l'API publique startAnkiSingle pour la 1ère carte puis on
    // empile la suite via une callback simple : on déclenche la 1ère et
    // l'utilisateur chaîne. Plus simple : on simule en appelant startAnkiSession
    // après avoir mis ces ids dans la sélection.
    if (!window.AnkiAlgo) return;
    // On utilise l'API officielle : tout passer en "sélection" puis startAnkiSession
    // Cela suppose que anki-app expose une fonction ankiSetSelection
    if (typeof window.ankiSetQuickQueue === 'function') {
      window.ankiSetQuickQueue(cards.map(c => c.id));
    } else {
      // fallback : on prend la première carte
      window.startAnkiSingle(cards[0].id);
    }
  }
})();
