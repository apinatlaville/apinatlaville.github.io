/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * FICHIER ACTUEL : anki-app.js (UI Mode Synchrotron)
 *
 * 🏗️ ARCHITECTURE :
 *  - Utilise window.AnkiAlgo (anki-algo.js) pour TOUS les calculs.
 *  - Lit/écrit dans window.D.exercices (sync Firebase via window.save()).
 *  - N'écrase AUCUNE fonctionnalité existante.
 *
 * 👉 RÔLE :
 *   - Onglet "🧬 Synchrotron" : Cockpit du jour + Réservoir + CRUD exos
 *   - Session de révision (chrono + auto-éval Vitesse/Exactitude)
 *   - Mini "Mode Colle" (scan d'un cours → révise toutes ses cartes liées)
 * =========================================================================================
 */

(function () {
  const $ = (id) => document.getElementById(id);

  // ============ Etat session ============
  const S = {
    queue: [],         // cartes à réviser dans la session courante
    current: null,     // carte courante
    showAnswer: false,
    chronoStart: 0,
    chronoElapsed: 0,
    chronoInterval: null,
    mode: "cockpit",   // 'cockpit' | 'colle' | 'reservoir-init'
    sessionStats: { total: 0, ok: 0, etourderie: 0, blocage: 0 },
  };

  // ============ Helpers ============
  function ensureArrays() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
  }

  function fmtSec(s) {
    s = Math.max(0, Math.round(s));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function matColor(matId) {
    const m = (window.D.matieres || []).find((x) => x.id === matId);
    return m ? m.color : "#5b8df7";
  }

  function matLabel(matId) {
    const m = (window.D.matieres || []).find((x) => x.id === matId);
    return m ? m.label : matId;
  }

  function priLabel(p) {
    return p === 1 ? "🔥 Urgence" : p === 3 ? "🌙 Faible" : "🟡 Normale";
  }

  // ============ Render principal de l'onglet ============
  window.renderAnki = function () {
    ensureArrays();
    const root = $("paneAnki");
    if (!root) return;
    const cockpit = window.AnkiAlgo.buildCockpit(
      window.D.exercices,
      window.D.devoirs,
      (window.D.settings && window.D.settings.ankiQuotaMin) || 90
    );
    const exos = window.D.exercices;
    const actifs = exos.filter((c) => c.statut === "actif").length;
    const reservoir = exos.filter((c) => c.statut === "attente").length;

    root.innerHTML = `
      <div class="anki-hero">
        <h2 style="font-family:'Syne';">🧬 Mode Synchrotron <span style="color:var(--mut);font-size:13px;font-weight:normal;">(Répétition Espacée PC*)</span></h2>
        <p style="color:var(--mut);font-size:13px;margin:4px 0 14px;">Rappel actif · Espacement optimal · Entrelacement matières · Pénalité Vitesse.</p>
      </div>

      <div class="anki-stats-grid">
        <div class="dash-card dash-acc"><div class="dash-num">${cockpit.cartesDues.length}</div><div class="dash-lbl">À réviser maintenant</div></div>
        <div class="dash-card"><div class="dash-num" style="color:var(--gold);">${reservoir}</div><div class="dash-lbl">Dans le réservoir</div></div>
        <div class="dash-card"><div class="dash-num" style="color:var(--grn);">${actifs}</div><div class="dash-lbl">Cartes actives</div></div>
        <div class="dash-card"><div class="dash-num" style="color:var(--red);">${fmtSec(cockpit.tempsTotalPrev)}</div><div class="dash-lbl">Charge prévue</div></div>
      </div>

      <div class="anki-cockpit">
        <h3 style="font-family:'Syne';margin:18px 0 8px;">🎛️ Cockpit du jour</h3>
        <div class="anki-cockpit-row">
          <div><span style="color:var(--red);">●</span> Taxe d'entretien : <b>${fmtSec(cockpit.tempsTaxe)}</b> (${cockpit.cartesDues.length} cartes)</div>
          <div><span style="color:var(--gold);">●</span> Devoirs planifiés : <b>${fmtSec(cockpit.tempsDevoirs)}</b> (${cockpit.devoirsRetenus.length})</div>
          <div><span style="color:var(--grn);">●</span> Nouvelles cartes : <b>${fmtSec(cockpit.tempsComblement)}</b> (${cockpit.nouvellesCartes.length})</div>
          <div><span style="color:var(--mut);">●</span> Quota : <b>${fmtSec(cockpit.quotaSecondes)}</b></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          <button class="bp" onclick="window.startAnkiCockpit()" ${cockpit.cartesDues.length + cockpit.nouvellesCartes.length === 0 ? "disabled style='opacity:.5;'" : ""}>▶ Lancer la session du jour</button>
          <button class="bs" onclick="window.startAnkiReservoirInit()">🌱 Activer des cartes du réservoir</button>
          <button class="bs" onclick="window.openExoModal()">＋ Nouvelle carte</button>
          <button class="bs" onclick="window.renderAnkiHeatmap()">📅 Prévision (14j)</button>
        </div>
      </div>

      <div class="anki-heatmap" id="ankiHeatmap" style="margin-top:18px;"></div>

      <h3 style="font-family:'Syne';margin:24px 0 8px;">🗂️ Toutes les cartes</h3>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <select class="fi" id="ankiFltMat" onchange="window.renderAnki()">
          <option value="">Toutes matières</option>
          ${(window.D.matieres || []).map((m) => `<option value="${m.id}" ${(window._ankiFltMat || "") === m.id ? "selected" : ""}>${m.label} — ${m.name}</option>`).join("")}
        </select>
        <select class="fi" id="ankiFltStat" onchange="window.renderAnki()">
          <option value="">Tous statuts</option>
          <option value="actif" ${window._ankiFltStat === "actif" ? "selected" : ""}>🟢 Actif</option>
          <option value="attente" ${window._ankiFltStat === "attente" ? "selected" : ""}>⏳ Réservoir</option>
        </select>
      </div>
      <div class="anki-cards-grid" id="ankiCardsGrid"></div>
    `;

    // capture des filtres
    const fm = $("ankiFltMat"); if (fm) fm.addEventListener("change", (e) => { window._ankiFltMat = e.target.value; });
    const fs = $("ankiFltStat"); if (fs) fs.addEventListener("change", (e) => { window._ankiFltStat = e.target.value; });

    renderAnkiCardsGrid();
  };

  function renderAnkiCardsGrid() {
    const grid = $("ankiCardsGrid");
    if (!grid) return;
    let list = window.D.exercices.slice();
    if (window._ankiFltMat) list = list.filter((c) => c.mat === window._ankiFltMat);
    if (window._ankiFltStat) list = list.filter((c) => c.statut === window._ankiFltStat);
    list.sort((a, b) => (a.dateProchaineRevision || "9999").localeCompare(b.dateProchaineRevision || "9999"));

    if (!list.length) {
      grid.innerHTML = `<div class="empty"><h3>Aucune carte</h3><p>Crée ta première carte avec « + Nouvelle carte ».</p></div>`;
      return;
    }
    grid.innerHTML = list
      .map((c) => {
        const col = matColor(c.mat);
        const due = window.AnkiAlgo.isDue(c, window.AnkiAlgo.todayISO());
        return `
        <div class="anki-card" style="border-left:4px solid ${col};">
          <div class="anki-card-top">
            <span class="uid-badge">${c.id}</span>
            <span class="bm" style="background:${col}20;color:${col};border:1px solid ${col}60;">${matLabel(c.mat)}</span>
            <span class="bm" style="font-size:10px;">${priLabel(c.priorite || 2)}</span>
            ${c.statut === "actif" ? (due ? '<span class="bm" style="background:rgba(240,96,96,.15);color:var(--red);border:1px solid var(--red);">DUE</span>' : '<span class="bm" style="background:rgba(80,216,144,.15);color:var(--grn);border:1px solid var(--grn);">Actif</span>') : '<span class="bm" style="background:rgba(240,192,96,.15);color:var(--gold);border:1px solid var(--gold);">Réservoir</span>'}
          </div>
          <div class="anki-card-q">${escapeHtml(c.question || "(sans énoncé)")}</div>
          <div class="anki-card-meta">⏱ ${c.tempsCible || 60}s · Intervalle ${c.intervalle || 0}j · ${c.coursId ? "Lien : " + c.coursId : "—"}</div>
          <div class="cacts" onclick="event.stopPropagation();">
            <button class="cbt" onclick="window.startAnkiSingle('${c.id}')" title="Réviser cette carte">▶</button>
            <button class="cbt" onclick="window.editExo('${c.id}')" title="Modifier">✏️</button>
            <button class="cbt" style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${c.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ============ Heatmap ============
  window.renderAnkiHeatmap = function () {
    const el = $("ankiHeatmap");
    if (!el) return;
    const map = window.AnkiAlgo.forecastLoad(window.D.exercices, 14);
    const max = Math.max(1, ...Object.values(map));
    el.innerHTML = `
      <h3 style="font-family:'Syne';margin:0 0 8px;">📅 Prévision de charge (14 jours)</h3>
      <div class="anki-heatmap-bars">
        ${Object.entries(map).map(([d, sec]) => {
          const pct = Math.round((sec / max) * 100);
          const dd = d.substring(5);
          return `<div class="anki-heatmap-col" title="${d} — ${fmtSec(sec)}">
            <div class="anki-heatmap-bar" style="height:${pct}%;"></div>
            <div class="anki-heatmap-lbl">${dd}</div>
          </div>`;
        }).join("")}
      </div>
    `;
  };

  // ============ Session ============
  window.startAnkiCockpit = function () {
    ensureArrays();
    const cockpit = window.AnkiAlgo.buildCockpit(
      window.D.exercices,
      window.D.devoirs,
      (window.D.settings && window.D.settings.ankiQuotaMin) || 90
    );
    // activer les nouvelles cartes piochées
    cockpit.nouvellesCartes.forEach((c) => {
      c.statut = "actif";
      if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO();
    });
    // file = dues + nouvelles (entrelacement)
    const queue = shuffle([...cockpit.cartesDues, ...cockpit.nouvellesCartes]);
    if (!queue.length) {
      window.sysAlert("Rien à réviser pour aujourd'hui ! 🎉", "Synchrotron");
      return;
    }
    S.queue = queue;
    S.mode = "cockpit";
    S.sessionStats = { total: queue.length, ok: 0, etourderie: 0, blocage: 0 };
    nextCard();
  };

  window.startAnkiSingle = function (id) {
    const c = window.D.exercices.find((x) => x.id === id);
    if (!c) return;
    if (c.statut !== "actif") c.statut = "actif";
    S.queue = [c];
    S.mode = "single";
    S.sessionStats = { total: 1, ok: 0, etourderie: 0, blocage: 0 };
    nextCard();
  };

  // Mode Colle : révise toutes les cartes liées à un cours
  window.startAnkiColle = function (coursId) {
    ensureArrays();
    const queue = window.D.exercices.filter((c) => c.coursId === coursId);
    if (!queue.length) {
      window.sysAlert("Aucune carte liée à ce cours.", "Mode Colle");
      return;
    }
    S.queue = shuffle(queue.slice());
    S.mode = "colle";
    S.sessionStats = { total: queue.length, ok: 0, etourderie: 0, blocage: 0 };
    nextCard();
  };

  window.startAnkiReservoirInit = function () {
    ensureArrays();
    const reservoir = window.D.exercices.filter((c) => c.statut === "attente");
    if (!reservoir.length) {
      window.sysAlert("Réservoir vide. Crée d'abord des cartes.", "Réservoir");
      return;
    }
    // Active jusqu'à 10 nouvelles cartes
    const toActivate = reservoir.slice(0, 10);
    toActivate.forEach((c) => {
      c.statut = "actif";
      c.dateProchaineRevision = window.AnkiAlgo.todayISO();
    });
    window.save();
    window.renderAnki();
    window.sysAlert(toActivate.length + " carte(s) activée(s) et prête(s) à être révisée(s).", "Réservoir");
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextCard() {
    if (!S.queue.length) return endSession();
    S.current = S.queue.shift();
    S.showAnswer = false;
    S.chronoElapsed = 0;
    S.chronoStart = Date.now();
    if (S.chronoInterval) clearInterval(S.chronoInterval);
    S.chronoInterval = setInterval(() => {
      S.chronoElapsed = (Date.now() - S.chronoStart) / 1000;
      const el = $("ankiChrono");
      if (el) {
        el.textContent = fmtSec(S.chronoElapsed);
        const cible = S.current.tempsCible || 60;
        if (S.chronoElapsed > cible * 1.5) el.style.color = "var(--red)";
        else if (S.chronoElapsed > cible) el.style.color = "var(--gold)";
        else el.style.color = "var(--grn)";
      }
    }, 200);
    renderSessionOverlay();
  }

  function renderSessionOverlay() {
    const c = S.current;
    if (!c) return;
    let ov = $("ovAnkiSession");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "ovAnkiSession";
      ov.className = "ov";
      document.body.appendChild(ov);
    }
    ov.classList.remove("hidden");
    const col = matColor(c.mat);
    ov.innerHTML = `
      <div class="modal anki-modal" style="border-top:5px solid ${col};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <span class="uid-badge">${c.id}</span>
            <span class="bm" style="background:${col}20;color:${col};border:1px solid ${col}60;">${matLabel(c.mat)}</span>
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:26px;font-weight:bold;color:var(--grn);" id="ankiChrono">00:00</div>
        </div>
        <div style="font-size:12px;color:var(--mut);margin-bottom:6px;">⏱ Cible : ${c.tempsCible || 60}s · ${priLabel(c.priorite || 2)}</div>
        <div class="anki-question">${escapeHtml(c.question || "")}</div>
        ${S.showAnswer ? `
          <div class="anki-answer">
            <div style="font-size:11px;color:var(--mut);text-transform:uppercase;margin-bottom:4px;">Réponse / Piège</div>
            <div>${escapeHtml(c.reponse || "")}</div>
          </div>
          <div style="font-size:12px;color:var(--mut);margin:14px 0 6px;text-align:center;">Auto-évaluation (honnête) :</div>
          <div class="anki-eval-row">
            <button class="anki-eval anki-eval-bad" onclick="window.evalCard(0)">❌<br><small>Blocage</small></button>
            <button class="anki-eval anki-eval-mid" onclick="window.evalCard(1)">🟡<br><small>Étourderie</small></button>
            <button class="anki-eval anki-eval-good" onclick="window.evalCard(2)">✅<br><small>Parfait</small></button>
          </div>
        ` : `
          <button class="bp" style="width:100%;margin-top:14px;" onclick="window.revealAnki()">Afficher la réponse</button>
        `}
        <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:11px;color:var(--mut);">
          <span>Reste : ${S.queue.length}</span>
          <button class="bs" onclick="window.abortAnkiSession()" style="padding:4px 10px;font-size:11px;border-color:var(--red);color:var(--red);">Quitter</button>
        </div>
      </div>
    `;
  }

  window.revealAnki = function () {
    S.showAnswer = true;
    renderSessionOverlay();
  };

  window.evalCard = function (qualite) {
    if (!S.current) return;
    if (S.chronoInterval) { clearInterval(S.chronoInterval); S.chronoInterval = null; }
    const tempsReel = S.chronoElapsed;
    const out = window.AnkiAlgo.computeNextInterval(S.current, qualite, tempsReel);

    // En mode Colle : on ne dérégle PAS les intervalles algorithmiques
    if (S.mode !== "colle") {
      S.current.intervalle = out.intervalle;
      S.current.ease = out.ease;
      S.current.repetitions = out.repetitions;
      S.current.dateProchaineRevision = out.dateProchaineRevision;
    }
    S.current.historique = S.current.historique || [];
    S.current.historique.push({
      date: new Date().toISOString(),
      qualite: qualite,
      tempsReel: Math.round(tempsReel),
      penaliteVitesse: out.penaliteVitesse,
      modeColle: S.mode === "colle",
    });

    if (qualite === 0) S.sessionStats.blocage++;
    else if (qualite === 1) S.sessionStats.etourderie++;
    else S.sessionStats.ok++;

    // Carte ratée → la remettre en fin de file (sauf mode colle qui rotation libre)
    if (qualite === 0 && S.mode !== "colle") S.queue.push(S.current);

    window.save();
    nextCard();
  };

  window.abortAnkiSession = function () {
    if (S.chronoInterval) clearInterval(S.chronoInterval);
    const ov = $("ovAnkiSession");
    if (ov) ov.classList.add("hidden");
    S.queue = [];
    S.current = null;
    window.renderAnki();
  };

  function endSession() {
    if (S.chronoInterval) clearInterval(S.chronoInterval);
    const ov = $("ovAnkiSession");
    if (ov) ov.classList.add("hidden");
    const st = S.sessionStats;
    window.save();
    window.sysAlert(
      `Session terminée 🎉<br><br>✅ Parfait : ${st.ok}<br>🟡 Étourderie : ${st.etourderie}<br>❌ Blocage : ${st.blocage}<br><br>Total révisé : ${st.total}`,
      "Synchrotron"
    );
    window.renderAnki();
  }

  // ============ CRUD Exercices ============
  let editingExoId = null;

  window.openExoModal = function () {
    ensureArrays();
    editingExoId = null;
    showExoModal({});
  };

  window.editExo = function (id) {
    const c = window.D.exercices.find((x) => x.id === id);
    if (!c) return;
    editingExoId = id;
    showExoModal(c);
  };

  window.delExo = function (id) {
    window.sysConfirm("Supprimer la carte " + id + " ?", () => {
      window.D.exercices = window.D.exercices.filter((c) => c.id !== id);
      window.save();
      window.renderAnki();
    }, "Suppression");
  };

  function showExoModal(c) {
    let ov = $("ovExo");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "ovExo";
      ov.className = "ov";
      document.body.appendChild(ov);
    }
    ov.classList.remove("hidden");
    const matOpts = (window.D.matieres || [])
      .map((m) => `<option value="${m.id}" ${m.id === c.mat ? "selected" : ""}>${m.label} — ${m.name}</option>`)
      .join("");
    const coursOpts = '<option value="">— Aucun —</option>' + (window.D.cours || [])
      .map((co) => `<option value="${co.uid}" ${co.uid === c.coursId ? "selected" : ""}>${co.uid} · ${co.title}</option>`)
      .join("");

    ov.innerHTML = `
      <div class="modal">
        <h2 style="margin-bottom:15px;">${editingExoId ? "✏️ Modifier" : "✨ Nouvelle"} carte</h2>
        <div class="fg"><label>Énoncé / Injonction *</label><textarea id="exoQ" rows="3" placeholder="Démontre le théorème de l'énergie cinétique...">${escapeHtml(c.question || "")}</textarea></div>
        <div class="fg"><label>Réponse / Piège à éviter *</label><textarea id="exoR" rows="2" placeholder="Solution finale, point clé...">${escapeHtml(c.reponse || "")}</textarea></div>
        <div style="display:flex;gap:10px;">
          <div class="fg" style="flex:1;"><label>Matière *</label><select id="exoMat"><option value="">—</option>${matOpts}</select></div>
          <div class="fg" style="flex:1;"><label>Temps cible (s) *</label><input type="number" id="exoTemps" min="5" max="3600" value="${c.tempsCible || 60}"></div>
        </div>
        <div style="display:flex;gap:10px;">
          <div class="fg" style="flex:1;"><label>Priorité</label>
            <select id="exoPri">
              <option value="1" ${c.priorite === 1 ? "selected" : ""}>🔥 Urgence</option>
              <option value="2" ${(c.priorite || 2) === 2 ? "selected" : ""}>🟡 Normale</option>
              <option value="3" ${c.priorite === 3 ? "selected" : ""}>🌙 Faible</option>
            </select>
          </div>
          <div class="fg" style="flex:1;"><label>Statut</label>
            <select id="exoStat">
              <option value="attente" ${(c.statut || "attente") === "attente" ? "selected" : ""}>⏳ Réservoir</option>
              <option value="actif" ${c.statut === "actif" ? "selected" : ""}>🟢 Actif</option>
            </select>
          </div>
        </div>
        <div class="fg"><label>Lien avec un cours (optionnel)</label><select id="exoCours">${coursOpts}</select></div>
        ${editingExoId ? `<div class="fg"><label>Identifiant</label><div class="uidbox">${c.id}</div></div>` : ""}
        <div class="macts">
          <button class="bs" onclick="document.getElementById('ovExo').classList.add('hidden')">Annuler</button>
          <button class="bp" onclick="window.saveExo()">Enregistrer</button>
        </div>
      </div>
    `;
  }

  window.saveExo = function () {
    const q = $("exoQ").value.trim();
    const r = $("exoR").value.trim();
    const mat = $("exoMat").value;
    const temps = parseInt($("exoTemps").value) || 60;
    const pri = parseInt($("exoPri").value) || 2;
    const stat = $("exoStat").value || "attente";
    const cours = $("exoCours").value || "";

    if (!q || !r || !mat) {
      return window.sysAlert("Énoncé, réponse et matière obligatoires.", "Erreur de saisie");
    }

    if (editingExoId) {
      const c = window.D.exercices.find((x) => x.id === editingExoId);
      if (!c) return;
      c.question = q; c.reponse = r; c.mat = mat;
      c.tempsCible = temps; c.priorite = pri; c.statut = stat; c.coursId = cours;
      if (stat === "actif" && !c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO();
    } else {
      const existingIds = window.D.exercices.map((x) => x.id).concat((window.D.cours || []).map((x) => x.uid));
      const newId = window.AnkiAlgo.genExoUid(mat, existingIds);
      window.D.exercices.unshift({
        id: newId,
        coursId: cours,
        mat: mat,
        question: q,
        reponse: r,
        tempsCible: temps,
        priorite: pri,
        statut: stat,
        intervalle: 0,
        ease: 2.5,
        repetitions: 0,
        dateProchaineRevision: stat === "actif" ? window.AnkiAlgo.todayISO() : null,
        historique: [],
        epinglee: false,
      });
    }
    window.save();
    const ov = $("ovExo");
    if (ov) ov.classList.add("hidden");
    window.renderAnki();
  };
})();
