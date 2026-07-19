/**
 * anki-viz-v2.js — Carte mentale Synchrotron (complète)
 * Documentation interactive : piles · cycle de vie · phases · fenêtres ★ · SM-2 · prio · session · modes
 */
(function () {
  "use strict";

  function injectStyles() {
    if (document.getElementById("anki-viz-v2-styles")) return;
    const css = `
      #paneAnkiVizV2 .av-wrap {
        max-width: 980px; margin: 0 auto; padding: 20px 16px 80px;
        display: flex; flex-direction: column; align-items: stretch; gap: 0;
      }
      #paneAnkiVizV2 .av-head { text-align: center; margin-bottom: 10px; }
      #paneAnkiVizV2 .av-head h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em; color: var(--txt); }
      #paneAnkiVizV2 .av-head p { color: var(--mut); margin: 6px 0 0; font-size: 13px; max-width: 720px; margin-left: auto; margin-right: auto; line-height: 1.5; }

      #paneAnkiVizV2 .av-toc {
        position: sticky; top: 0; z-index: 5;
        display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
        padding: 10px 0 14px; margin-bottom: 8px;
        background: linear-gradient(180deg, var(--bg) 70%, transparent);
      }
      #paneAnkiVizV2 .av-toc a {
        text-decoration: none; font-size: 11px; font-weight: 700;
        padding: 5px 10px; border-radius: 999px;
        border: 1px solid var(--bd); background: var(--s2); color: var(--mut);
        white-space: nowrap;
      }
      #paneAnkiVizV2 .av-toc a:hover { color: var(--txt); border-color: var(--acc); }

      #paneAnkiVizV2 .av-v2-banner {
        margin: 0 auto 18px; max-width: 760px; padding: 14px 16px; border-radius: 12px;
        background: rgba(255,200,80,0.08); border: 1px solid rgba(255,200,80,0.35);
        font-size: 13px; line-height: 1.55; text-align: left;
      }

      #paneAnkiVizV2 .av-map {
        display: grid; gap: 10px; margin: 0 0 18px;
        padding: 16px; border-radius: 14px;
        border: 1px solid rgba(130,165,255,0.2);
        background: rgba(91,154,255,0.05);
      }
      #paneAnkiVizV2 .av-map-row {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center;
      }
      #paneAnkiVizV2 .av-map-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: 700;
        border: 1px solid var(--bd); background: var(--s2); color: var(--txt);
      }
      #paneAnkiVizV2 .av-map-chip.core { border-color: rgba(168,138,240,0.45); background: rgba(168,138,240,0.12); }
      #paneAnkiVizV2 .av-map-chip.gold { border-color: rgba(255,200,80,0.45); background: rgba(255,200,80,0.1); }
      #paneAnkiVizV2 .av-map-chip.good { border-color: rgba(92,212,154,0.45); background: rgba(92,212,154,0.1); }
      #paneAnkiVizV2 .av-map-arrow {
        color: var(--mut); font-size: 14px; font-weight: 700; padding: 0 2px;
      }
      #paneAnkiVizV2 .av-map-caption {
        text-align: center; font-size: 11px; color: var(--mut); margin: 0;
      }

      #paneAnkiVizV2 .av-node {
        position: relative; scroll-margin-top: 64px;
        background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%, transparent 48%),
          linear-gradient(220deg, rgba(91,154,255,0.07) 0%, transparent 55%), rgba(155,185,255,0.055);
        backdrop-filter: blur(32px) saturate(1.9); -webkit-backdrop-filter: blur(32px) saturate(1.9);
        border: 0.5px solid rgba(130,165,255,0.18); border-radius: 14px; padding: 16px 18px;
        color: var(--txt);
        box-shadow: inset 0 1px 0 rgba(195,215,255,0.16), inset 0 0 24px rgba(91,154,255,0.04), 0 4px 28px rgba(0,0,0,0.22);
      }
      #paneAnkiVizV2 .av-node.accent-gold { border-color: rgba(255,200,80,0.35); }
      #paneAnkiVizV2 .av-node.accent-core { border-color: rgba(168,138,240,0.32); }
      #paneAnkiVizV2 .av-node.accent-good { border-color: rgba(92,212,154,0.32); }
      #paneAnkiVizV2 .av-num {
        position: absolute; top: -12px; left: 14px; width: 28px; height: 28px; border-radius: 50%;
        background: var(--bg); border: 1px solid rgba(255,255,255,0.20);
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 13px; color: var(--txt);
      }
      #paneAnkiVizV2 .av-node-title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      #paneAnkiVizV2 .av-node-sub { font-size: 12px; color: var(--mut); margin: 0 0 12px; }
      #paneAnkiVizV2 .av-node-body { font-size: 13px; line-height: 1.55; }
      #paneAnkiVizV2 .av-link {
        align-self: center; width: 2px; height: 28px;
        background: linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08));
      }
      #paneAnkiVizV2 .av-h4 {
        font-size: 11px; color: var(--mut); text-transform: uppercase; letter-spacing: .04em;
        margin: 14px 0 8px; font-weight: 700;
      }
      #paneAnkiVizV2 .av-formula {
        font-family: 'Menlo','Consolas',monospace; background: rgba(0,0,0,0.30);
        border: 1px dashed rgba(255,255,255,0.18); padding: 10px 14px; border-radius: 8px;
        margin: 10px 0; font-size: 12px; color: rgba(255,255,255,0.82); white-space: pre-wrap;
      }
      #paneAnkiVizV2 .av-tag {
        display: inline-block; padding: 2px 8px; border-radius: 6px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
        font-size: 11px; color: var(--mut); margin: 0 4px 4px 0;
      }
      #paneAnkiVizV2 .av-coef-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 8px; margin: 8px 0; }
      #paneAnkiVizV2 .av-coef-card {
        background: rgba(10,14,28,0.28); border: 0.5px solid rgba(130,165,255,0.16);
        border-radius: 10px; padding: 8px 10px;
      }
      #paneAnkiVizV2 .av-coef-card label { font-size: 11px; color: var(--mut); font-family: monospace; display:block; margin-bottom:4px; }
      #paneAnkiVizV2 .av-coef-card input, #paneAnkiVizV2 .av-coef-card select {
        background: rgba(0,0,0,0.30); border: 1px solid rgba(255,255,255,0.20);
        color: var(--txt); padding: 6px 8px; border-radius: 6px; font-size: 13px; width: 100%; box-sizing: border-box;
      }
      #paneAnkiVizV2 .av-inline-input {
        display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;
        background: rgba(0,0,0,0.20); border: 1px solid rgba(255,255,255,0.15);
        padding: 6px 10px; border-radius: 8px; margin-top: 10px;
      }
      #paneAnkiVizV2 .av-inline-input label { font-size: 12px; color: var(--mut); }
      #paneAnkiVizV2 .av-inline-input input, #paneAnkiVizV2 .av-inline-input select {
        background: rgba(0,0,0,0.30); border: 1px solid rgba(255,255,255,0.20);
        color: var(--txt); padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 13px;
      }
      #paneAnkiVizV2 .av-sim-row {
        display: grid; grid-template-columns: 1.2fr 110px 80px 60px 1fr; gap: 8px; align-items: center;
        padding: 6px 0; border-bottom: 1px dashed rgba(255,255,255,0.08); font-size: 12px;
      }
      #paneAnkiVizV2 .av-sim-bar { height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
      #paneAnkiVizV2 .av-sim-bar div { height: 100%; background: linear-gradient(90deg, #5b8def, #a88af0); border-radius: 4px; }
      #paneAnkiVizV2 .av-star-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
      #paneAnkiVizV2 .av-star-table th, #paneAnkiVizV2 .av-star-table td {
        padding: 6px 10px; border-bottom: 0.5px solid rgba(255,255,255,0.10); text-align: left; vertical-align: top;
      }
      #paneAnkiVizV2 .av-star-table th { color: var(--mut); font-size: 10px; text-transform: uppercase; }
      #paneAnkiVizV2 .av-phase-pill {
        display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700;
      }
      #paneAnkiVizV2 .av-phase-learning { background: rgba(91,141,239,0.2); color: #8ab4ff; }
      #paneAnkiVizV2 .av-phase-consolidation { background: rgba(255,170,51,0.2); color: #ffcc66; }
      #paneAnkiVizV2 .av-phase-mature { background: rgba(92,212,154,0.2); color: #5cd49a; }
      #paneAnkiVizV2 .av-win-overdue { color: #f07070; font-weight: 700; }
      #paneAnkiVizV2 .av-win-active { color: #5cd49a; font-weight: 700; }
      #paneAnkiVizV2 .av-win-soon { color: #ffaa33; }
      #paneAnkiVizV2 .av-win-later { color: var(--mut); }
      #paneAnkiVizV2 .av-branches { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
      #paneAnkiVizV2 .av-branch-good { border-color: rgba(92,212,154,0.42) !important; }
      #paneAnkiVizV2 .av-branch-bad { border-color: rgba(240,112,112,0.42) !important; }
      #paneAnkiVizV2 .av-steps {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin: 8px 0;
      }
      #paneAnkiVizV2 .av-step {
        padding: 10px; border-radius: 10px; border: 1px solid var(--bd); background: rgba(0,0,0,0.18);
        font-size: 12px; line-height: 1.45;
      }
      #paneAnkiVizV2 .av-step b { display: block; margin-bottom: 4px; font-size: 12px; }
      #paneAnkiVizV2 .av-gloss {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;
      }
      #paneAnkiVizV2 .av-gloss dt { font-weight: 700; font-size: 12px; margin: 0 0 2px; }
      #paneAnkiVizV2 .av-gloss dd { margin: 0 0 8px; font-size: 12px; color: var(--mut); line-height: 1.4; }
      #paneAnkiVizV2 .av-pile-grid {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      }
      @media (max-width: 720px) {
        #paneAnkiVizV2 .av-pile-grid { grid-template-columns: 1fr; }
        #paneAnkiVizV2 .av-branches { grid-template-columns: 1fr; }
        #paneAnkiVizV2 .av-sim-row { grid-template-columns: 1fr 1fr; }
      }
      #paneAnkiVizV2 .sw-editor { margin-top: 8px; }
      #paneAnkiVizV2 .sw-intro { font-size: 12px; color: var(--mut); line-height: 1.5; margin: 0 0 12px; }
      #paneAnkiVizV2 .sw-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
      #paneAnkiVizV2 .sw-card {
        background: rgba(10,14,28,0.28); border: 0.5px solid rgba(255,200,80,0.22);
        border-radius: 12px; padding: 12px 14px;
      }
      #paneAnkiVizV2 .sw-card-hdr { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }
      #paneAnkiVizV2 .sw-card-hint { font-size: 11px; color: var(--mut); }
      #paneAnkiVizV2 .sw-timeline { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,0.06); }
      #paneAnkiVizV2 .sw-tl-wait { background: rgba(138,180,255,0.35); height: 100%; transition: width .2s ease; }
      #paneAnkiVizV2 .sw-tl-win { background: linear-gradient(90deg, #ffcc66, #5cd49a); height: 100%; transition: width .2s ease; }
      #paneAnkiVizV2 .sw-tl-legend { display: flex; justify-content: space-between; font-size: 10px; color: var(--mut); margin: 4px 0 10px; }
      #paneAnkiVizV2 .sw-fields { display: flex; flex-wrap: wrap; gap: 12px; }
      #paneAnkiVizV2 .sw-fields label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--mut); }
      #paneAnkiVizV2 .sw-input { width: 72px !important; font-family: monospace; }
      #paneAnkiVizV2 .sw-unit { font-size: 11px; color: var(--mut); }
      #paneAnkiVizV2 .sw-preview { margin-top: 8px; font-size: 12px; color: var(--txt); }
      #paneAnkiVizV2 .sw-actions { margin-top: 12px; }
    `;
    const tag = document.createElement("style");
    tag.id = "anki-viz-v2-styles";
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  const esc = s => window.escHtml(s);
  function fmt(v, d) { return typeof v === "number" ? v.toFixed(d != null ? d : 0) : "—"; }
  function A2() { return window.AnkiAlgoV2; }

  function v2Settings() {
    return A2() ? A2().getSettings() : { horizon: "1y", sessionMinDefault: 90, pullForward: true, margeBudget: 0.92 };
  }
  function sessionMinV2() {
    const st = v2Settings();
    return st.sessionMinDefault || (window.D && window.D.settings && window.D.settings.ankiSessionMin) || 90;
  }
  function margeBudget() {
    if (window.D && window.D.settings && typeof window.D.settings.margeBudget === "number") return window.D.settings.margeBudget;
    return v2Settings().margeBudget || 0.92;
  }

  const BLOCAGE_SPEC = [
    { key: "EASE_DROP_FAIL", label: "Δ ease échec", step: 0.01 },
    { key: "BLOCAGE_QSCORE_TRIGGER", label: "qScore blocage", step: 1 },
    { key: "BLOCAGE_QSCORE_VALIDATE", label: "qScore libération", step: 1 },
    { key: "BLOCAGE_TIMEOUT_REV", label: "Timeout révisions", step: 1 }
  ];

  const SIM_CARDS = [
    { label: "En retard 5 j", phase: "consolidation", importance: 4, ease: 2.5, ws: "overdue", late: 5 },
    { label: "Fenêtre active ★5", phase: "mature", importance: 5, ease: 2.5, ws: "active", late: 0 },
    { label: "Bientôt (soon)", phase: "mature", importance: 3, ease: 2.4, ws: "soon", late: 0 },
    { label: "Plus tard", phase: "mature", importance: 2, ease: 2.6, ws: "later", late: 0 },
    { label: "Apprentissage J", phase: "learning", importance: 3, ease: 2.2, ws: "active", late: 0 },
    { label: "Ease bas", phase: "consolidation", importance: 3, ease: 1.6, ws: "active", late: 0 }
  ];

  function simulatePriority(sim, ref) {
    const A = A2();
    if (!A) return { priority: 0, breakdown: {}, raw: {} };
    const today = ref || A.todayISO();
    const card = {
      statut: "actif",
      repetitions: sim.phase === "learning" ? 1 : sim.phase === "consolidation" ? 5 : 12,
      ease: sim.ease, importance: sim.importance, intervalle: 30,
      dateProchaineRevision: sim.ws === "overdue" ? A.addDays(today, -sim.late) : today,
      _v2WindowOpen: sim.phase === "mature" && sim.ws !== "overdue" ? today : null,
      _v2WindowClose: sim.phase === "mature" && sim.ws === "active" ? A.addDays(today, 20) : null
    };
    if (sim.ws === "later") {
      card._v2WindowOpen = A.addDays(today, 14);
      card._v2WindowClose = A.addDays(today, 40);
      card.dateProchaineRevision = card._v2WindowOpen;
    }
    if (sim.ws === "soon") {
      card._v2WindowOpen = A.addDays(today, 2);
      card._v2WindowClose = A.addDays(today, 25);
      card.dateProchaineRevision = card._v2WindowOpen;
    }
    return A.priorityScore(card, today);
  }

  function phaseLabel(p) {
    if (p === "learning") return "apprentissage";
    if (p === "consolidation") return "consolidation";
    if (p === "mature") return "mature";
    return p;
  }

  function nodeToc() {
    const items = [
      ["#av-vue", "Vue d’ensemble"],
      ["#av-piles", "3 piles"],
      ["#av-cycle", "Cycle de vie"],
      ["#av-phases", "Phases"],
      ["#av-fenetres", "Fenêtres ★"],
      ["#av-memoire", "Notation SM-2"],
      ["#av-prio", "Priorité"],
      ["#av-soir", "Session du soir"],
      ["#av-modes", "Modes"],
      ["#av-prev", "Prévisions"],
      ["#av-gloss", "Glossaire"]
    ];
    return `<nav class="av-toc" aria-label="Sommaire carte mentale">${
      items.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join("")
    }</nav>`;
  }

  function nodeIntro() {
    return `
      <div class="av-v2-banner" id="av-vue">
        <b>Synchrotron en une phrase :</b> tu notes une carte (0–10) → l’algo fixe <i>quand</i> elle revient (SM-2) ·
        les ★ fixent <i>dans quelle fenêtre</i> (une fois mature) · le soir, le Cockpit prend le <b>haut du classement « prio »</b> dans ton budget de temps.<br><br>
        <b>Cette page</b> décrit le moteur <b>tel qu’il est dans le code</b> (pas un schéma théorique). Le fil est volontairement linéaire : c’est un enchaînement causal (piles → phase → fenêtre → note → prio → session).
      </div>
      <div class="av-map" aria-label="Schéma global Synchrotron">
        <div class="av-map-row">
          <span class="av-map-chip">X- Réservoir</span>
          <span class="av-map-arrow">→</span>
          <span class="av-map-chip good">Actif</span>
          <span class="av-map-arrow">→</span>
          <span class="av-map-chip">Apprentissage</span>
          <span class="av-map-arrow">→</span>
          <span class="av-map-chip gold">Consolidation</span>
          <span class="av-map-arrow">→</span>
          <span class="av-map-chip good">Mature + fenêtres ★</span>
        </div>
        <div class="av-map-row">
          <span class="av-map-chip">Note 0–10</span>
          <span class="av-map-arrow">→</span>
          <span class="av-map-chip core">SM-2 (ease / intervalle)</span>
          <span class="av-map-arrow">→</span>
          <span class="av-map-chip core">prio</span>
          <span class="av-map-arrow">→</span>
          <span class="av-map-chip gold">Session du soir</span>
        </div>
        <p class="av-map-caption">Deux fils liés : maturité de la carte (haut) · construction de la soirée (bas). Utilise le sommaire pour sauter.</p>
      </div>
    `;
  }

  function nodePiles() {
    const A = A2();
    let devoir = 0, main = 0, quick = 0, reservoir = 0, fini = 0;
    if (window.D && A) {
      (window.D.devoirs || []).forEach(c => {
        if (c.statut === "actif") devoir++;
        else if (c.statut === "fini" || c.statut === "termine" || c.statut === "terminé") fini++;
      });
      (window.D.exercices || []).forEach(c => {
        if (A.isReservoir(c)) reservoir++;
        else if (c.statut === "actif") {
          const k = A.cardKind(c);
          if (k === "quick") quick++; else if (k === "main") main++;
        }
      });
    }
    return `
      <div class="av-node" id="av-piles">
        <div class="av-num">1</div>
        <div class="av-node-title">${window.iconLabel("layers", "Les 3 piles + le réservoir")}</div>
        <p class="av-node-sub">Trois familles de cartes · mêmes données Firebase · règles différentes</p>
        <div class="av-node-body">
          <div class="av-pile-grid">
            <div style="padding:12px;border-radius:10px;background:rgba(233,79,100,0.1);border:1px solid rgba(233,79,100,0.35);">
              <div style="font-size:11px;color:#e94f64;font-weight:700;">W- DEVOIRS</div>
              <div style="font-size:22px;font-weight:700;">${devoir}</div>
              <p style="font-size:12px;margin:6px 0 0;">Agenda calendaire · découpés en morceaux · pas de fenêtres ★ · priorité = date limite / urgence</p>
            </div>
            <div style="padding:12px;border-radius:10px;background:rgba(66,181,107,0.1);border:1px solid rgba(66,181,107,0.35);">
              <div style="font-size:11px;color:#42b56b;font-weight:700;">X- PRINCIPALES</div>
              <div style="font-size:22px;font-weight:700;">${main}</div>
              <p style="font-size:12px;margin:6px 0 0;">Cœur Synchrotron : phases · fenêtres ★ · tri par <code>prio</code> · session du soir</p>
            </div>
            <div style="padding:12px;border-radius:10px;background:rgba(91,141,239,0.1);border:1px solid rgba(91,141,239,0.35);">
              <div style="font-size:11px;color:#5b8def;font-weight:700;">Y- RAPIDES</div>
              <div style="font-size:22px;font-weight:700;">${quick}</div>
              <p style="font-size:12px;margin:6px 0 0;">Créées <b>actives</b> depuis Rapide · le soir = tissées entre les X- si éligibles (plafond réglable)</p>
            </div>
          </div>
          <p style="margin-top:12px;font-size:12px;">
            <span class="av-tag">${window.iconLabel("hourglass", reservoir + " en réservoir")}</span>
            <span class="av-tag">${fini} DM terminés</span>
          </p>
          <p style="font-size:12px;color:var(--mut);margin:8px 0 0;">
            Les <b>X-</b> naissent en réservoir (tu actives). Les <b>Y-</b> Rapide naissent déjà actives. Le Cockpit V2 <b>n’injecte pas</b> automatiquement du réservoir dans la session.
          </p>
        </div>
      </div>
    `;
  }

  function nodeCycle() {
    return `
      <div class="av-node accent-good" id="av-cycle">
        <div class="av-num">2</div>
        <div class="av-node-title">${window.iconLabel("folders", "Cycle de vie d’une carte")}</div>
        <p class="av-node-sub">Deux axes : le <b>statut produit</b> (réservoir / actif / fini) et la <b>phase mémoire</b> (calculée)</p>
        <div class="av-node-body">
          <div class="av-h4">Statut (tu le contrôles)</div>
          <div class="av-steps">
            <div class="av-step"><b>Réservoir</b>En attente · hors sessions auto · activation = due aujourd’hui</div>
            <div class="av-step"><b>Actif</b>Entre dans Cockpit · Prévisions · priorité · notation SRS</div>
            <div class="av-step"><b>Fini</b>Réservé aux DM (W-) terminés · plus dans le flux</div>
          </div>
          <div class="av-h4">Phase mémoire (calculée, pas un onglet)</div>
          <div class="av-formula">phase = f(repetitions, ease)   — code getPhase()

apprentissage  si  rep &lt; 3  OU  ease &lt; 2,2
consolidation  sinon si  rep &lt; 8  OU  ease &lt; 2,4
mature         sinon  (rep ≥ 8 ET ease ≥ 2,4)

Ex. : rep=10 et ease=2,3 → encore consolidation (ease trop bas)</div>
          <p style="font-size:12px;margin:0;">Un échec baisse l’ease → la carte peut <b>retomber en apprentissage</b> ; hors mature, les fenêtres ★ sont effacées.</p>
          <div class="av-map" style="margin-top:12px;">
            <div class="av-map-row">
              <span class="av-map-chip">Création</span>
              <span class="av-map-arrow">→</span>
              <span class="av-map-chip">Réservoir</span>
              <span class="av-map-arrow">→</span>
              <span class="av-map-chip good">Activer</span>
              <span class="av-map-arrow">→</span>
              <span class="av-map-chip">révisions…</span>
              <span class="av-map-arrow">→</span>
              <span class="av-map-chip gold">Mature ★</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function nodePhases() {
    return `
      <div class="av-node accent-gold" id="av-phases">
        <div class="av-num">3</div>
        <div class="av-node-title">${window.iconLabel("layers", "Les 3 phases mémoire")}</div>
        <p class="av-node-sub">Apprentissage → consolidation → mature · ce n’est pas 3 boîtes séparées, c’est l’âge + la solidité de la carte</p>
        <div class="av-node-body">
          <table class="av-star-table">
            <thead><tr><th>Phase</th><th>Condition</th><th>Comportement</th></tr></thead>
            <tbody>
              <tr>
                <td><span class="av-phase-pill av-phase-learning">apprentissage</span><br><span class="av-tag">learning</span></td>
                <td>rep &lt; 3 <b>ou</b> ease &lt; 2,2</td>
                <td>SM-2 classique · date exacte · « soon » si due ≤ 1 jour</td>
              </tr>
              <tr>
                <td><span class="av-phase-pill av-phase-consolidation">consolidation</span></td>
                <td>sinon si rep &lt; 8 <b>ou</b> ease &lt; 2,4</td>
                <td>Encore des paliers · date exacte · « soon » jusqu’à 4 jours</td>
              </tr>
              <tr>
                <td><span class="av-phase-pill av-phase-mature">mature</span></td>
                <td>rep ≥ 8 <b>et</b> ease ≥ 2,4</td>
                <td>Après un succès : <b>fenêtres ★</b> (tu peux revoir n’importe quand dans la bande)</td>
              </tr>
            </tbody>
          </table>
          <p style="font-size:12px;color:var(--mut);margin:10px 0 0;">
            Affiché sur les cartes : <code>prio 5200 · mature · ★5 · …</code> — la phase est en anglais dans le code, les libellés ci-dessus sont la lecture FR.
          </p>
        </div>
      </div>
    `;
  }

  function nodeFenetres() {
    return `
      <div class="av-node accent-gold" id="av-fenetres">
        <div class="av-num">4</div>
        <div class="av-node-title">${window.iconLabel("star", "Étoiles ★ = fenêtres de révision")}</div>
        <p class="av-node-sub">En mature, les ★ ne « pondèrent » plus 4 scores : elles définissent <b>quand</b> la carte s’ouvre et <b>combien de temps</b> elle reste due</p>
        <div class="av-node-body">
          <div class="av-formula"><b>Après un succès en mature (qScore &gt; 3) :</b>
w = fenêtre ★ × horizon   (1 an → ×0,55 · 2 ans → ×1)
openAfter_eff = max(w.openAfter, min(intervalle_SM2, w.openAfter + 5))
ouverture = J + openAfter_eff
fermeture = ouverture + w.width
dateProchaineRevision = début de fenêtre

Tu peux réviser n’importe quand pendant la largeur.
Après fermeture sans révision → overdue → prio explose.</div>

          <div class="av-h4">États (windowState)</div>
          <p style="font-size:12px;margin:0 0 8px;">
            <span class="av-win-overdue">overdue</span> en retard ·
            <span class="av-win-active">active</span> due maintenant ·
            <span class="av-win-soon">soon</span> bientôt ·
            <span class="av-win-later">later</span> pas encore
          </p>
          <ul style="font-size:12px;line-height:1.65;margin:0;padding-left:18px;">
            <li><b>Apprentissage</b> : overdue / due aujourd’hui / soon ≤ 1 j / later</li>
            <li><b>Consolidation</b> : idem, soon jusqu’à ~4 j</li>
            <li><b>Mature</b> : basé sur <code>_v2WindowOpen</code> / <code>_v2WindowClose</code> (soon ≤ 3 j avant ouverture)</li>
          </ul>

          <div class="av-h4">Régler les fenêtres par ★</div>
          <p style="font-size:12px;margin:0 0 8px;color:var(--mut);">Valeurs en base cycle 2 ans — l’horizon les réduit ensuite. Plus de ★ → revient plus tôt.</p>
          ${(A2() && A2().renderStarWindowsEditor) ? A2().renderStarWindowsEditor({ idPrefix: "vizSw" }) : ""}
        </div>
      </div>
    `;
  }

  function nodeMemoire() {
    const A = A2();
    const profiles = (A && A.DEFAULT_PROFILES) || {};
    const profileRows = Object.keys(profiles).map(k => {
      const p = profiles[k];
      return `<div class="av-coef-card"><label>${esc(k)}</label><div style="font-family:monospace;font-size:12px;color:#ffaa33;">[${(p.steps || []).slice(0, 6).join(", ")}] j</div></div>`;
    }).join("");
    const C = A ? A.getCoefs() : {};

    return `
      <div class="av-node" id="av-memoire">
        <div class="av-num">5</div>
        <div class="av-node-title">${window.iconLabel("brain", "Notation → mémoire (SM-2)")}</div>
        <p class="av-node-sub">Indépendant du tri « prio » du soir · met à jour ease, intervalle, repetitions, date</p>
        <div class="av-node-body">
          <p>Quand tu notes (0–10, ou boutons ≈ 2 / 6 / 9), le moteur met à jour :</p>
          <p style="font-size:12px;">
            <span class="av-tag">ease</span>
            <span class="av-tag">intervalle</span>
            <span class="av-tag">repetitions</span>
            <span class="av-tag">dateProchaineRevision</span>
            <span class="av-tag">_v2Window* (si mature)</span>
            <span class="av-tag">historique[]</span>
          </p>
          <div class="av-formula">qScore ≤ 3 → échec : reset intervalle, ease −${C.EASE_DROP_FAIL != null ? C.EASE_DROP_FAIL : 0.2}, _blocageActif
qScore 4–10 → succès : paliers profil puis intervalle × ease × facteurs
mature + succès → date = début de fenêtre ★ (pas un jour unique)</div>

          <div class="av-branches">
            <div class="av-node av-branch-good">
              <b style="color:#5cd49a;">Succès &gt; ${C.BLOCAGE_QSCORE_TRIGGER || 3}</b>
              <p style="font-size:12px;margin:8px 0 0;">Intervalle progresse (paliers puis × ease × qFactor × pénalité tempo × multiplicateur ★). Si mature → fenêtre ★. Le flag blocage ne se lève qu’à note ≥ ${C.BLOCAGE_QSCORE_VALIDATE || 8} <b>ou</b> après ${C.BLOCAGE_TIMEOUT_REV || 5} tentatives (timeout).</p>
            </div>
            <div class="av-node av-branch-bad">
              <b style="color:#f07070;">Échec ≤ ${C.BLOCAGE_QSCORE_TRIGGER || 3}</b>
              <p style="font-size:12px;margin:8px 0 0;">Reset intervalle · ease −${C.EASE_DROP_FAIL != null ? C.EASE_DROP_FAIL : 0.2} · <code>_blocageActif</code>. En V2 le flag <b>n’entre pas</b> dans <code>prio</code> : c’est surtout la baisse d’ease (et un éventuel retard) qui fait remonter la carte.</p>
            </div>
          </div>

          <div class="av-h4">Paliers de début (profils X-)</div>
          <div class="av-coef-grid">${profileRows || "—"}</div>
          <p style="font-size:11px;color:var(--mut);margin:0;">Les Y- utilisent des paliers selon les ★ (profil rapide), pas ces profils COURS/EXO…</p>

          <div class="av-h4">Paramètres de blocage (réglables)</div>
          <div class="av-coef-grid">${
            BLOCAGE_SPEC.map(s => `
              <div class="av-coef-card">
                <label>${esc(s.label)} · ${esc(s.key)}</label>
                <input type="number" step="${s.step}" value="${C[s.key] != null ? C[s.key] : ""}"
                       oninput="window._ankiVizV2Coef('${esc(s.key)}', this.value)">
              </div>
            `).join("")
          }</div>
        </div>
      </div>
    `;
  }

  function nodePriorite() {
    const sims = SIM_CARDS.map(c => ({ c, sc: simulatePriority(c) }));
    const maxP = Math.max(...sims.map(s => s.sc.priority), 1);
    const rows = sims.map(({ c, sc }) => `
      <div class="av-sim-row">
        <div>${esc(c.label)} · ★${c.importance}</div>
        <div><span class="av-phase-pill av-phase-${c.phase}">${phaseLabel(c.phase)}</span></div>
        <div class="av-win-${c.ws}">${c.ws}</div>
        <div><b>${fmt(sc.priority, 0)}</b></div>
        <div class="av-sim-bar"><div style="width:${Math.min(100, sc.priority / maxP * 100).toFixed(0)}%"></div></div>
      </div>
    `).join("");

    return `
      <div class="av-node accent-core" id="av-prio">
        <div class="av-num">6</div>
        <div class="av-node-title">${window.iconLabel("layout-list", "Priorité — le seul score de tri")}</div>
        <p class="av-node-sub">Un nombre <code>prio</code> · plus de score d’urgence composite V1 (I_R + coefs W_*)</p>
        <div class="av-node-body">
          <div class="av-formula"><b>prio</b> = somme simple (priorityScore)

① Retard (overdue)     → +10 000 + 100 × jours de retard
② Fenêtre active       → +5 000
   + si mature et fin de fenêtre dans ≤ 5 j → +(5 − joursRestants) × 80
③ Bientôt (soon)       → +2 000  (éligible session seulement si pullForward)
④ Importance ★         → +200 × étoiles (1→5)
⑤ Ease bas             → +(2,8 − ease) × 60

Pas de terme _blocageActif dans prio V2.</div>
          <p><b>Lecture :</b> une carte en retard domine toujours. Dans la fenêtre active, ★5 passe avant ★2. L’ease bas départage à priorité égale. Fin de fenêtre mature = petit bonus pour ne pas la rater.</p>
          <div class="av-h4">Simulation — 6 situations</div>
          <div data-testid="viz-v2-sim">${rows}</div>
          <p style="font-size:11px;color:var(--mut);margin-top:8px;">Barres normalisées sur la carte la plus prioritaire du lot.</p>
        </div>
      </div>
    `;
  }

  function nodeSoir() {
    const marge = margeBudget();
    const sessionMin = sessionMinV2();
    const budgetSec = Math.round(sessionMin * marge * 60);
    const pull = v2Settings().pullForward !== false;
    const seuil = (window.D && window.D.settings && window.D.settings.seuilDevoirForce) || 35;
    const maxQuick = (window.D && window.D.settings && window.D.settings.ankiMaxAnglaisFill != null)
      ? Math.max(0, parseInt(window.D.settings.ankiMaxAnglaisFill, 10) || 0)
      : 5;

    return `
      <div class="av-node accent-gold" id="av-soir">
        <div class="av-num">7</div>
        <div class="av-node-title">${window.iconLabel("moon", "Session du soir — comment elle se remplit")}</div>
        <p class="av-node-sub">Cockpit · budget temps · ordre fixe · pas de quota forcé les soirs DM</p>
        <div class="av-node-body">
          <div class="av-formula"><b>Budget</b> = durée du soir × marge
= ${sessionMin} min × ${marge.toFixed(2)} ≈ ${Math.floor(budgetSec / 60)} min ${budgetSec % 60}s</div>

          <div class="av-inline-input">
            <label>Durée défaut (min)</label>
            <input type="number" id="av2SessionMin" min="15" max="300" step="5" value="${sessionMin}">
            <label>Marge</label>
            <input type="number" id="av2Marge" min="0.5" max="1" step="0.05" value="${marge.toFixed(2)}">
            <label>Horizon</label>
            <select id="av2Horizon">
              <option value="1y" ${v2Settings().horizon === "1y" ? "selected" : ""}>1 an</option>
              <option value="2y" ${v2Settings().horizon === "2y" ? "selected" : ""}>2 ans</option>
            </select>
            <label><input type="checkbox" id="av2PullForward" ${pull ? "checked" : ""}> Avancer si budget large (soon)</label>
          </div>

          <div class="av-h4">Ordre de remplissage (buildSession — code réel)</div>
          <ol style="padding-left:20px;font-size:13px;line-height:1.75;margin:0;">
            <li><b>W- forcés</b> — <code>urgenceDevoir</code> ≥ ${seuil} (deadline + morceaux restants) · 1er bout même si ça surcharge un peu</li>
            <li><b>X- éligibles</b> — overdue / active (+ soon si pullForward) · tri <code>prio</code></li>
            <li><b>W- extra forcés</b> puis <b>W- latents</b> — d’autres bouts si le budget le permet</li>
            <li><b>Y- éligibles</b> — même règle overdue/active/soon · tissées dans le long pool (plafond ${maxQuick})</li>
            <li><b>Y- extras</b> — s’il reste du budget après le tissage, encore des Y- en fin de file</li>
          </ol>
          <p style="font-size:12px;color:var(--mut);margin:10px 0 0;">
            Éligible = <code>overdue</code> ou <code>active</code> · <code>soon</code> seulement si « Avancer » est coché (X- et Y-).
            Soirée DM courte ? Lance depuis l’Agenda. Soirée longue ? l’algo peut tirer des cartes soon.
          </p>
        </div>
      </div>
    `;
  }

  function nodeModes() {
    return `
      <div class="av-node" id="av-modes">
        <div class="av-num">8</div>
        <div class="av-node-title">${window.iconLabel("mouse-pointer-click", "Où ça vit dans l’appli")}</div>
        <p class="av-node-sub">Chaque sous-onglet Synchrotron a un rôle précis</p>
        <div class="av-node-body">
          <div class="av-steps">
            <div class="av-step"><b>Cockpit</b>Construit la session auto · Play · durée du soir</div>
            <div class="av-step"><b>Agenda</b>Devoirs W- · découpage · lancement DM seul</div>
            <div class="av-step"><b>Réservoir</b>Cartes en attente d’activation</div>
            <div class="av-step"><b>Bibliothèque</b>Parcourir / éditer toutes les cartes</div>
            <div class="av-step"><b>Prévisions</b>Charge à venir (jours / cours / selon la note)</div>
            <div class="av-step"><b>Stats / Réglages</b>Suivi + paramètres algo</div>
          </div>
          <div class="av-h4">Modes de session</div>
          <ul style="font-size:13px;line-height:1.7;margin:0;padding-left:18px;">
            <li><b>Auto (Cockpit)</b> — l’algo remplit · tu lances Play</li>
            <li><b>Manuel</b> — tu coches · tri prio · ordre libre dans le budget</li>
            <li><b>Play chapitre</b> — toutes les cartes actives d’un cours, tri prio (sans filtre « ce soir »)</li>
            <li><b>Agenda / DM</b> — devoir seul ou forcé si date proche</li>
            <li><b>Rapide</b> — onglet Y- à part (midi)</li>
          </ul>
          <p style="font-size:12px;color:var(--mut);margin:10px 0 0;">
            Session figée dans <code>D.sessionEnCoursV2</code> · Undo disponible après une note.
          </p>
        </div>
      </div>
    `;
  }

  function nodePrevisions() {
    return `
      <div class="av-node accent-core" id="av-prev">
        <div class="av-num">9</div>
        <div class="av-node-title">${window.iconLabel("calendar", "Prévisions — charge à venir")}</div>
        <p class="av-node-sub">Simulation du calendrier · même moteur que la session (fenêtres ★ incluses)</p>
        <div class="av-node-body">
          <div class="av-steps">
            <div class="av-step"><b>Jours</b>Combien de cartes / minutes sur N jours (hyp. note = 7)</div>
            <div class="av-step"><b>Par cours</b>Répartition de la charge par chapitre</div>
            <div class="av-step"><b>Selon la note</b>Si tu notes X ce soir → prochaine date / fenêtre (<code>projectAfterScore</code>)</div>
          </div>
          <div class="av-formula">forecastSchedule : projette chaque carte active
mature → première occurrence = ouverture de fenêtre (ou aujourd’hui si déjà due)
après chaque « révision simulée » → computeNextInterval(qScore=7)

projectAfterScore(carte, note) → intervalle, ease, date, fenêtre, phase</div>
          <p style="font-size:12px;color:var(--mut);margin:0;">Les DM projettent leurs morceaux restants jour par jour. Les cartes inactives / réservoir n’apparaissent pas.</p>
        </div>
      </div>
    `;
  }

  function nodeGlossaire() {
    return `
      <div class="av-node" id="av-gloss">
        <div class="av-num">10</div>
        <div class="av-node-title">${window.iconLabel("book-open", "Glossaire rapide")}</div>
        <p class="av-node-sub">Les mots que tu vois dans l’UI ↔ ce qu’ils veulent dire</p>
        <div class="av-node-body">
          <dl class="av-gloss">
            <div><dt>Ease</dt><dd>Facilité de la carte. Plus haut → intervalles plus longs. Baisse après un échec.</dd></div>
            <div><dt>Intervalle</dt><dd>Jours avant la prochaine révision (SM-2), avant application des fenêtres ★.</dd></div>
            <div><dt>Repetitions</dt><dd>Nombre de réussites cumulées · sert à calculer la phase.</dd></div>
            <div><dt>prio</dt><dd>Score unique de tri pour la session du soir.</dd></div>
            <div><dt>Fenêtre ★</dt><dd>Bande de jours où une carte mature est « due ».</dd></div>
            <div><dt>pullForward</dt><dd>Si budget large, tirer aussi les cartes « soon ».</dd></div>
            <div><dt>_blocageActif</dt><dd>Flag après échec · levé à note ≥ validate ou après timeout de révisions. N’entre pas dans prio V2 (l’ease baisse, elle).</dd></div>
            <div><dt>Horizon 1 an / 2 ans</dt><dd>Échelle les fenêtres ★ : ×0,55 (1 an) ou ×1 (2 ans).</dd></div>
            <div><dt>Importance ★1–5</dt><dd>Poids dans prio + taille/timing des fenêtres mature.</dd></div>
            <div><dt>Morceaux (DM)</dt><dd>Découpage d’un devoir W- en sessions successives.</dd></div>
          </dl>
        </div>
      </div>
    `;
  }

  function explainSection() {
    return `
      <section class="anki-explain-wrap" style="margin-top:20px;" id="av-v1v2">
        <h3>${window.iconLabel("scale", "Rappel V2 vs ancien V1")}</h3>
        <table class="av-star-table" style="margin-top:10px;">
          <thead><tr><th></th><th>Ancien V1</th><th>Synchrotron actuel (V2)</th></tr></thead>
          <tbody>
            <tr><td>Tri session X-</td><td>Score urgence (I_R + coefs)</td><td><b>prio</b> unique</td></tr>
            <tr><td>Rôle des ★</td><td>Poids score + intervalles</td><td><b>Fenêtres</b> long terme (+ poids prio)</td></tr>
            <tr><td>Coefficients W_*</td><td>6+ réglages</td><td><b>Aucun</b> pour le tri</td></tr>
            <tr><td>Phases</td><td>Moins visibles</td><td>apprentissage → consolidation → mature</td></tr>
            <tr><td>Données</td><td colspan="2" style="text-align:center;">Mêmes cartes · un seul moteur V2</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:var(--mut);margin-top:14px;text-align:center;">
          Carte mentale Synchrotron · ${new Date().toLocaleDateString("fr-FR")}
        </p>
      </section>
    `;
  }

  function bindControls() {
    const bindNum = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => fn(el));
    };
    bindNum("av2SessionMin", el => {
      let v = parseInt(el.value, 10);
      if (isNaN(v) || !window.D) return;
      v = Math.max(15, Math.min(300, v));
      if (!window.D.settings) window.D.settings = {};
      if (!window.D.settings.algoV2) window.D.settings.algoV2 = {};
      window.D.settings.algoV2.sessionMinDefault = v;
      window.D.settings.ankiSessionMin = v;
      if (typeof window.save === "function") window.save();
      window.renderAnkiVizV2();
    });
    bindNum("av2Marge", el => {
      let v = parseFloat(el.value);
      if (isNaN(v) || !window.D) return;
      v = Math.max(0.5, Math.min(1, v));
      if (!window.D.settings) window.D.settings = {};
      window.D.settings.margeBudget = v;
      if (typeof window.save === "function") window.save();
      window.renderAnkiVizV2();
    });
    const hz = document.getElementById("av2Horizon");
    if (hz) hz.addEventListener("change", () => {
      if (!window.D.settings) window.D.settings = {};
      if (!window.D.settings.algoV2) window.D.settings.algoV2 = {};
      window.D.settings.algoV2.horizon = hz.value;
      if (typeof window.save === "function") window.save();
      window.renderAnkiVizV2();
    });
    const pf = document.getElementById("av2PullForward");
    if (pf) pf.addEventListener("change", () => {
      if (!window.D.settings) window.D.settings = {};
      if (!window.D.settings.algoV2) window.D.settings.algoV2 = {};
      window.D.settings.algoV2.pullForward = pf.checked;
      if (typeof window.save === "function") window.save();
    });
  }

  window._ankiVizV2Coef = function (key, raw) {
    const v = parseFloat(raw);
    if (isNaN(v) || !window.D || !window.D.settings) return;
    if (!window.D.settings.ankiCoefs) window.D.settings.ankiCoefs = {};
    window.D.settings.ankiCoefs[key] = v;
    if (typeof window.save === "function") window.save();
  };

  window.renderAnkiVizV2 = function () {
    injectStyles();
    const root = document.getElementById("paneAnkiVizV2");
    if (!root) return;
    if (!A2()) {
      root.innerHTML = '<p style="padding:40px;text-align:center;color:var(--mut);">Charge <code>anki-algo-v2.js</code> avant cette page.</p>';
      return;
    }
    root.innerHTML = `
      <div class="av-wrap" data-testid="viz-v2-root">
        <div class="av-head">
          <h2>${window.iconLabel("map", "Carte mentale — Synchrotron")}</h2>
          <p>Vue complète du moteur : piles · cycle · phases · fenêtres ★ · notation · priorité · session · modes · prévisions</p>
        </div>
        ${nodeToc()}
        ${nodeIntro()}
        ${nodePiles()}
        <div class="av-link"></div>
        ${nodeCycle()}
        <div class="av-link"></div>
        ${nodePhases()}
        <div class="av-link"></div>
        ${nodeFenetres()}
        <div class="av-link"></div>
        ${nodeMemoire()}
        <div class="av-link"></div>
        ${nodePriorite()}
        <div class="av-link"></div>
        ${nodeSoir()}
        <div class="av-link"></div>
        ${nodeModes()}
        <div class="av-link"></div>
        ${nodePrevisions()}
        <div class="av-link"></div>
        ${nodeGlossaire()}
        ${explainSection()}
      </div>
    `;
    bindControls();
    if (window.hydrateIcons) window.hydrateIcons(root);
  };
})();
