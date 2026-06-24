/**
 * =========================================================================================
 * anki-viz.js — Carte mentale interactive du moteur Synchrotron v4 (PC*)
 * =========================================================================================
 * - 100% HTML/CSS pur (aucune dépendance externe : pas de Vis.js, D3, Canvas, SVG complexe)
 * - Glassmorphism cohérent avec le reste de l'app (backdrop-filter blur)
 * - 6 nœuds descendants reliés par des lignes verticales/bifurquées en CSS pseudo-éléments
 * - Contrôles en direct :
 *     · Marge budget (Nœud 2)        → window.D.settings.margeBudget
 *     · Coefficients d'urgence (N3)  → window.D.settings.ankiCoefs (override de ALGO.DEFAULT_COEFS)
 * - Recalcule à la volée des exemples d'urgence lorsque l'on touche un coefficient
 * - Documentation scientifique en pied de page
 *
 * Intégration : voir tout en bas de ce fichier (3 lignes à ajouter dans index.html + 1 ligne dans app.js)
 * Expose : window.renderAnkiViz()  — appelée par switchTab('ankiViz')
 * =========================================================================================
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------------------
  // 1) Injection unique des styles glassmorphism
  // ------------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("anki-viz-styles")) return;
    const css = `
      /* === Carte mentale Synchrotron v4 === */
      #paneAnkiViz .av-wrap {
        max-width: 980px; margin: 0 auto; padding: 24px 16px 80px;
        display: flex; flex-direction: column; align-items: stretch; gap: 0;
      }
      #paneAnkiViz .av-head { text-align: center; margin-bottom: 8px; }
      #paneAnkiViz .av-head h2 {
        margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em;
        color: var(--txt);
      }
      #paneAnkiViz .av-head p {
        color: var(--mut); margin: 6px 0 0; font-size: 13px;
      }

      /* Nœud générique = bloc glassmorphism bleuté */
      #paneAnkiViz .av-node {
        position: relative;
        background:
          linear-gradient(145deg, rgba(255,255,255,0.06) 0%, transparent 48%),
          linear-gradient(220deg, rgba(91,154,255,0.07) 0%, transparent 55%),
          rgba(155,185,255,0.055);
        backdrop-filter: blur(32px) saturate(1.9);
        -webkit-backdrop-filter: blur(32px) saturate(1.9);
        border: 0.5px solid rgba(130,165,255,0.18);
        border-radius: 14px;
        padding: 16px 18px;
        margin: 0;
        color: var(--txt);
        box-shadow:
          inset 0 1px 0 rgba(195,215,255,0.16),
          inset 0 0 24px rgba(91,154,255,0.04),
          0 4px 28px rgba(0,0,0,0.22);
      }
      #paneAnkiViz .av-node.accent-input    { border-color: rgba(130,165,255,0.28); }
      #paneAnkiViz .av-node.accent-filter   { border-color: rgba(130,165,255,0.24); }
      #paneAnkiViz .av-node.accent-core     { border-color: rgba(168,138,240,0.32); box-shadow: inset 0 1px 0 rgba(200,180,255,0.14), 0 4px 32px rgba(91,154,255,0.08); }
      #paneAnkiViz .av-node.accent-order    { border-color: rgba(130,165,255,0.26); }
      #paneAnkiViz .av-node.accent-eval     { border-color: rgba(130,165,255,0.24); }
      #paneAnkiViz .av-node.accent-safe     { border-color: rgba(130,165,255,0.22); }

      /* Numéro du nœud (badge top-left) */
      #paneAnkiViz .av-num {
        position: absolute; top: -12px; left: 14px;
        width: 28px; height: 28px; border-radius: 50%;
        background: var(--bg); border: 1px solid rgba(255,255,255,0.20);
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 13px; color: var(--txt);
        box-shadow: 0 2px 8px rgba(0,0,0,0.30);
      }
      #paneAnkiViz .av-node-title {
        font-size: 18px; font-weight: 700; margin: 0 0 4px;
        letter-spacing: .3px;
      }
      #paneAnkiViz .av-node-sub {
        font-size: 12px; color: var(--mut); margin: 0 0 12px;
      }
      #paneAnkiViz .av-node-body { font-size: 13px; line-height: 1.55; }

      /* Lignes de liaison verticales entre nœuds (CSS pur) */
      #paneAnkiViz .av-link {
        align-self: center; width: 2px; height: 38px;
        background: linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08));
        position: relative;
      }
      #paneAnkiViz .av-link::after {
        content: ""; position: absolute; left: 50%; bottom: -2px;
        transform: translateX(-50%);
        width: 8px; height: 8px; border-right: 2px solid rgba(255,255,255,0.30);
        border-bottom: 2px solid rgba(255,255,255,0.30);
        transform: translateX(-50%) rotate(45deg);
      }

      /* === Bifurcation Y du Nœud 5 (refonte v4.1) === */
      /* Approche : un wrapper qui contient (1) un tronc central tombant du haut,
         (2) une barre horizontale au milieu de la hauteur reliant 25% à 75%,
         (3) deux jambes verticales courtes à 25% et 75% qui descendent jusqu'aux branches. */
      #paneAnkiViz .av-fork-wrap {
        position: relative; width: 100%; height: 52px; margin: 0 auto;
      }
      /* Tronc central (haut → centre vertical) */
      #paneAnkiViz .av-fork-wrap::before {
        content: ""; position: absolute;
        left: 50%; top: 0; height: 28px; width: 2px;
        transform: translateX(-50%);
        background: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.18));
      }
      /* Barre horizontale (25% → 75%) */
      #paneAnkiViz .av-fork-wrap::after {
        content: ""; position: absolute;
        left: 25%; right: 25%; top: 28px; height: 2px;
        background: rgba(255,255,255,0.30);
      }
      /* Les 2 jambes en éléments réels (les pseudos sont déjà utilisés) */
      #paneAnkiViz .av-fork-leg {
        position: absolute; top: 28px; width: 2px; height: 24px;
        background: linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10));
      }
      #paneAnkiViz .av-fork-leg.l { left: 25%; transform: translateX(-50%); }
      #paneAnkiViz .av-fork-leg.r { left: 75%; transform: translateX(-50%); }
      #paneAnkiViz .av-branches {
        display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 6px;
      }
      #paneAnkiViz .av-branch-good {
        border-color: rgba(92,212,154,0.42) !important;
        background:
          linear-gradient(145deg, rgba(92,212,154,0.08) 0%, transparent 55%),
          rgba(92,212,154,0.05) !important;
        box-shadow: inset 0 0 28px rgba(92,212,154,0.05), 0 4px 20px rgba(0,0,0,0.16) !important;
      }
      #paneAnkiViz .av-branch-bad {
        border-color: rgba(240,112,112,0.42) !important;
        background:
          linear-gradient(145deg, rgba(240,112,112,0.08) 0%, transparent 55%),
          rgba(240,112,112,0.05) !important;
        box-shadow: inset 0 0 28px rgba(240,112,112,0.05), 0 4px 20px rgba(0,0,0,0.16) !important;
      }
      #paneAnkiViz .av-branch-label {
        font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
        font-weight: 700; margin-bottom: 6px;
      }
      #paneAnkiViz .av-branch-good .av-branch-label { color: #5cd49a; }
      #paneAnkiViz .av-branch-bad  .av-branch-label { color: #f07070; }

      /* Badges et tags */
      #paneAnkiViz .av-badge {
        display: inline-block; padding: 3px 10px; border-radius: 999px;
        font-weight: 700; font-size: 12px;
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);
        color: var(--txt);
      }
      #paneAnkiViz .av-badge.live { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.28); color: var(--txt); }
      #paneAnkiViz .av-tag {
        display: inline-block; padding: 2px 8px; border-radius: 6px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
        font-size: 11px; color: var(--mut); margin-right: 4px;
      }

      /* Formule mathématique */
      #paneAnkiViz .av-formula {
        font-family: 'Menlo','Consolas',monospace;
        background: rgba(0,0,0,0.30); border: 1px dashed rgba(255,255,255,0.18);
        padding: 10px 14px; border-radius: 8px; margin: 10px 0;
        font-size: 13px; color: rgba(255,255,255,0.82);
        white-space: pre-wrap; word-break: break-word;
      }
      #paneAnkiViz .av-formula b { color: var(--txt); }

      /* Tableau de coefficients (Nœud 3) */
      #paneAnkiViz .av-coef-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr));
        gap: 8px; margin: 8px 0;
      }
      #paneAnkiViz .av-coef-card {
        background: rgba(10,14,28,0.28); border: 0.5px solid rgba(130,165,255,0.16);
        border-radius: 10px; padding: 8px 10px;
        display: flex; flex-direction: column; gap: 4px;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
      #paneAnkiViz .av-coef-card label {
        font-size: 11px; color: var(--mut); font-family: 'Menlo','Consolas',monospace;
      }
      #paneAnkiViz .av-coef-card .av-coef-desc { font-size: 11px; color: var(--mut); }
      #paneAnkiViz .av-coef-card input[type="number"] {
        background: rgba(0,0,0,0.30); border: 1px solid rgba(255,255,255,0.20);
        color: var(--txt); padding: 6px 8px; border-radius: 6px; font-size: 13px;
        font-family: 'Menlo','Consolas',monospace;
      }
      #paneAnkiViz .av-coef-card input[type="number"]:focus {
        outline: none; border-color: rgba(255,255,255,0.45);
        box-shadow: 0 0 0 2px rgba(255,255,255,0.08);
      }
      #paneAnkiViz .av-reset {
        background: transparent; border: 1px solid rgba(255,255,255,0.25);
        color: var(--mut); padding: 6px 12px; border-radius: 6px;
        font-size: 12px; cursor: pointer; transition: 0.15s;
      }
      #paneAnkiViz .av-reset:hover { color: var(--txt); border-color: rgba(255,255,255,0.5); }

      /* Exemples d'urgence (cartes simulées) */
      #paneAnkiViz .av-sim {
        margin-top: 12px; background: rgba(0,0,0,0.22);
        border: 1px solid rgba(255,255,255,0.10); border-radius: 8px;
        padding: 10px 12px;
      }
      #paneAnkiViz .av-sim h4 {
        margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;
        color: var(--mut); font-weight: 700;
      }
      #paneAnkiViz .av-sim-row {
        display: grid; grid-template-columns: 1fr 80px 90px 90px 1fr;
        gap: 8px; align-items: center; padding: 6px 0;
        border-bottom: 1px dashed rgba(255,255,255,0.08); font-size: 12px;
      }
      #paneAnkiViz .av-sim-row:last-child { border-bottom: none; }
      #paneAnkiViz .av-sim-row .av-sim-name { font-weight: 700; }
      #paneAnkiViz .av-sim-row .av-sim-num { font-family: 'Menlo','Consolas',monospace; text-align: right; color: var(--mut); }
      #paneAnkiViz .av-sim-row .av-sim-score { font-family: 'Menlo','Consolas',monospace; font-weight: 700; text-align: right; }
      #paneAnkiViz .av-sim-row .av-sim-bar {
        height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;
      }
      #paneAnkiViz .av-sim-row .av-sim-bar > div {
        height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0.65));
        transition: width .25s ease;
      }

      /* Schéma d'entrelacement (Nœud 4) */
      #paneAnkiViz .av-interleave {
        display: flex; flex-direction: column; gap: 8px; margin-top: 10px;
      }
      #paneAnkiViz .av-il-row {
        display: flex; align-items: center; gap: 6px;
        font-family: 'Menlo','Consolas',monospace; font-size: 13px;
      }
      #paneAnkiViz .av-il-row .av-il-label {
        width: 90px; color: var(--mut); font-size: 11px;
      }
      #paneAnkiViz .av-il-pill {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 38px; height: 28px; border-radius: 8px;
        font-weight: 700; font-size: 12px;
        border: 1px solid rgba(255,255,255,0.20);
      }
      #paneAnkiViz .av-il-arrow { color: var(--mut); }

      /* Documentation scientifique en pied de page */
      #paneAnkiViz .anki-explain-wrap {
        margin-top: 48px;
        background:
          linear-gradient(145deg, rgba(255,255,255,0.04) 0%, transparent 48%),
          rgba(155,185,255,0.04);
        backdrop-filter: blur(24px) saturate(1.85);
        -webkit-backdrop-filter: blur(24px) saturate(1.85);
        border: 0.5px solid rgba(130,165,255,0.16);
        border-radius: 14px;
        padding: 24px 28px;
        box-shadow: var(--glass-shadow, 0 4px 24px rgba(0,0,0,0.18));
      }
      #paneAnkiViz .anki-explain-wrap h3 {
        margin: 0 0 12px; font-size: 18px;
        border-bottom: 1px solid rgba(255,255,255,0.10); padding-bottom: 8px;
      }
      #paneAnkiViz .anki-explain-wrap h4 {
        margin: 18px 0 6px; font-size: 14px; color: rgba(255,255,255,0.72);
        text-transform: uppercase; letter-spacing: 1.2px;
      }
      #paneAnkiViz .anki-explain-wrap p { margin: 4px 0; font-size: 13px; line-height: 1.65; color: var(--txt); }
      #paneAnkiViz .anki-explain-wrap code {
        background: rgba(0,0,0,0.30); padding: 2px 6px; border-radius: 4px;
        font-size: 12px; color: rgba(255,255,255,0.75);
      }
      #paneAnkiViz .anki-explain-wrap ul { padding-left: 22px; margin: 6px 0; }
      #paneAnkiViz .anki-explain-wrap li { margin: 4px 0; font-size: 13px; }

      /* Petits inputs inline */
      #paneAnkiViz .av-inline-input {
        display: inline-flex; align-items: center; gap: 8px;
        background: rgba(0,0,0,0.20); border: 1px solid rgba(255,255,255,0.15);
        padding: 6px 10px; border-radius: 8px; margin-top: 10px;
      }
      #paneAnkiViz .av-inline-input label { font-size: 12px; color: var(--mut); }
      #paneAnkiViz .av-inline-input input {
        background: rgba(0,0,0,0.30); border: 1px solid rgba(255,255,255,0.20);
        color: var(--txt); padding: 4px 8px; border-radius: 4px; width: 80px;
        font-family: 'Menlo','Consolas',monospace; font-size: 13px;
      }
      #paneAnkiViz .av-inline-input input:focus { outline: none; border-color: rgba(255,255,255,0.45); }
    `;
    const tag = document.createElement("style");
    tag.id = "anki-viz-styles";
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // ------------------------------------------------------------------------------
  // 2) Spécification des coefficients exposés à l'édition
  // ------------------------------------------------------------------------------
  // On édite ce qui est rangé dans window.D.settings.ankiCoefs (override de ALGO.DEFAULT_COEFS)
  const COEF_SPEC = [
    { key: "W_urgenceTemps", label: "Poids global I_R", step: 0.1,  hint: "Importance globale de l'axe temporel (Index de Délai Relatif)" },
    { key: "K_PROCHE",       label: "K (montée exp.)",  step: 0.1,  hint: "Exposant exp(K·(I_R−1)) quand I_R < 1 (en avance)" },
    { key: "GAMMA_RETARD",   label: "γ (retard lin.)",  step: 0.1,  hint: "Pente linéaire quand I_R > 1 — agressivité du retard" },
    { key: "W_priorite",     label: "Poids importance", step: 0.1,  hint: "Poids des étoiles (1★→0.35 · 5★→2.0) dans le score d'urgence" },
    { key: "W_ease",         label: "Poids ease",       step: 0.1,  hint: "Boost pour les cartes à ease bas (difficiles)" },
    { key: "W_nouveau",      label: "Poids nouveauté",  step: 0.1,  hint: "Bonus aux cartes fraîchement activées du réservoir" }
  ];
  const BLOCAGE_SPEC = [
    { key: "EASE_DROP_FAIL",          label: "Δ ease en échec",   step: 0.01, hint: "Baisse de fond de l'ease à chaque qScore ≤ trigger (très douce)" },
    { key: "BLOCAGE_QSCORE_TRIGGER",  label: "qScore déclencheur",step: 1,    hint: "qScore ≤ X → flag _blocageActif posé" },
    { key: "BLOCAGE_QSCORE_VALIDATE", label: "qScore libérateur", step: 1,    hint: "qScore ≥ X → flag levé" },
    { key: "BLOCAGE_TIMEOUT_REV",     label: "Timeout (révisions)", step: 1,  hint: "Nb max de révisions sous blocage avant libération auto" }
  ];

  function getCoef(key) {
    const A = window.AnkiAlgo;
    if (!A) return 0;
    const C = A.getCoefs ? A.getCoefs() : A.DEFAULT_COEFS;
    return C[key];
  }
  function setCoef(key, value) {
    if (!window.D || !window.D.settings) return;
    if (!window.D.settings.ankiCoefs) window.D.settings.ankiCoefs = {};
    window.D.settings.ankiCoefs[key] = value;
    if (typeof window.save === "function") window.save();
  }
  function resetCoefs() {
    if (window.D && window.D.settings) window.D.settings.ankiCoefs = {};
    if (typeof window.save === "function") window.save();
    window.renderAnkiViz();
  }

  // ------------------------------------------------------------------------------
  // 3) Helpers de rendu
  // ------------------------------------------------------------------------------
  const esc = s => window.escHtml(s);
  function fmt(v, digits) { return (typeof v === "number" ? v.toFixed(digits != null ? digits : 2) : "—"); }

  function allCards() {
    const A = window.AnkiAlgo;
    if (A && A.allCards) return A.allCards(window.D);
    if (!window.D) return [];
    return (window.D.exercices || []).concat(window.D.devoirs || []);
  }

  function reservoirCount() {
    try {
      const A = window.AnkiAlgo;
      if (!window.D || !Array.isArray(window.D.exercices)) return 0;
      const mainRes = window.D.exercices.filter(c => A && A.isReservoir && A.isReservoir(c) && A.cardKind(c) === 'main');
      const quickRes = window.D.exercices.filter(c => A && A.isReservoir && A.isReservoir(c) && A.cardKind(c) === 'quick');
      return mainRes.length + quickRes.length;
    } catch (e) { return 0; }
  }
  function activeCount() {
    try {
      return allCards().filter(c => c.statut === "actif").length;
    } catch (e) { return 0; }
  }
  // Comptes par pile (données séparées : W- → D.devoirs, X-/Y- → D.exercices)
  function pileCounts() {
    const A = window.AnkiAlgo;
    if (!window.D || !A || !A.cardKind) {
      return { devoir: 0, main: 0, quick: 0 };
    }
    const out = { devoir: 0, main: 0, quick: 0 };
    (window.D.devoirs || []).forEach(c => {
      if (c.statut === 'actif') out.devoir++;
    });
    (window.D.exercices || []).forEach(c => {
      if (c.statut !== 'actif') return;
      const k = A.cardKind(c);
      if (k === 'quick') out.quick++;
      else if (k === 'main') out.main++;
    });
    return out;
  }
  function devoirsAgenda() {
    const A = window.AnkiAlgo;
    if (!window.D || !Array.isArray(window.D.devoirs) || !A || !A.cardKind) return [];
    return window.D.devoirs
      .filter(c => c.statut === 'actif')
      .map(c => ({ card: c, urg: A.urgenceDevoir(c) }))
      .sort((a, b) => b.urg.total - a.urg.total);
  }

  // Exemples simulés pour démontrer la formule I_R (recalculés en live)
  const SIM_CARDS = [
    { id: "X-aller-trop-tôt", intervalle: 30, joursEcoules: 12, importance: 3, ease: 2.5, blocage: false, icon: "bed", label: "Loin du jour J (30j, J+12)" },
    { id: "X-presque-jour-J", intervalle: 7,  joursEcoules: 6,  importance: 3, ease: 2.5, blocage: false, icon: "status-yellow", label: "Approche (7j, J+6)" },
    { id: "X-jour-J",         intervalle: 5,  joursEcoules: 5,  importance: 3, ease: 2.5, blocage: false, icon: "circle-check", label: "Jour J pile (5j, J+5)" },
    { id: "X-leger-retard",   intervalle: 30, joursEcoules: 33, importance: 3, ease: 2.5, blocage: false, icon: "alert-triangle", label: "Léger retard sur long (30j, +3j)" },
    { id: "X-petit-retard",   intervalle: 1,  joursEcoules: 2,  importance: 3, ease: 2.5, blocage: false, icon: "flame", label: "Petit retard agressif (1j, +1j)" },
    { id: "X-bloque",         intervalle: 2,  joursEcoules: 2,  importance: 3, ease: 1.5, blocage: true,  icon: "zap", label: "En blocage (ease boosté)" }
  ];

  function simCardLabel(c) {
    if (c.icon === "status-yellow") return window.statusLabel("yellow", esc(c.label));
    return window.iconLabel(c.icon, esc(c.label));
  }

  function simulateUrgence(c) {
    const A = window.AnkiAlgo;
    if (!A) return { total: 0, IR: 0, urgenceTemps: 0, priFactor: 0, easeFactor: 0 };
    const today = A.todayISO();
    const card = {
      intervalle: c.intervalle,
      ease: c.ease,
      importance: c.importance != null ? c.importance : 3,
      statut: "actif",
      _blocageActif: !!c.blocage,
      _lastReviewDate: A.addDays(today, -Math.max(0, c.joursEcoules || 0))
    };
    const score = A.urgenceScore(card);
    if (typeof score === "number") return { total: score, IR: 0, urgenceTemps: 0, priFactor: 0, easeFactor: 0 };
    return {
      total: score.total,
      IR: score.raw.IR,
      urgenceTemps: score.raw.urgenceTemps,
      priFactor: score.raw.priFactor,
      easeFactor: score.raw.easeFactor
    };
  }

  // ------------------------------------------------------------------------------
  // 4) Rendu des nœuds
  // ------------------------------------------------------------------------------
  function nodeEntreeReservoir() {
    const n = reservoirCount();
    const piles = pileCounts();
    return `
      <div class="av-node accent-input">
        <div class="av-num">1</div>
        <div class="av-node-title">${window.iconLabel('download', 'Entrée — Réservoir & les 3 piles de cartes')}</div>
        <p class="av-node-sub">Synchrotron (X-/W-) → réservoir · Rapide (Y-) → actif direct · 3 piles séparées par préfixe</p>
        <div class="av-node-body">

          <p>Le moteur Synchrotron v4.2 distingue strictement <b>3 catégories</b> de cartes qui suivent des règles totalement différentes :</p>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-top:12px;" data-testid="viz-three-piles">
            <div style="background:rgba(233,79,100,0.10); border:1px solid rgba(233,79,100,0.45); border-radius:10px; padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#e94f64; font-weight:700;">${window.iconLabel('pin', 'Pile DEVOIRS')}</div>
              <div style="font-size:24px; font-weight:700; margin:4px 0;">${piles.devoir}</div>
              <p style="font-size:11px; margin:0; color:var(--mut);"><code>id prefix W-</code> · <code>type === 'devoir'</code></p>
              <p style="font-size:12px; margin:8px 0 0;">DM, colles, exercices à rendre. Calendrier strict, <i>hors</i> du système de répétition espacée — c'est l'agenda qui dicte.</p>
              <p style="font-size:11px; margin:6px 0 0; color:var(--mut);">→ <b>Phase 0</b> (forcés en session, prioritaires)</p>
            </div>
            <div style="background:rgba(66,181,107,0.10); border:1px solid rgba(66,181,107,0.45); border-radius:10px; padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#42b56b; font-weight:700;">${window.iconLabel('brain', 'Pile PRINCIPALES')}</div>
              <div style="font-size:24px; font-weight:700; margin:4px 0;">${piles.main}</div>
              <p style="font-size:11px; margin:0; color:var(--mut);"><code>id prefix X-</code></p>
              <p style="font-size:12px; margin:8px 0 0;">Le cœur du système : exercices types, cours à mémoriser. Suivent la <b>répétition espacée</b> (I_R + ease élastique).</p>
              <p style="font-size:11px; margin:6px 0 0; color:var(--mut);">→ <b>Phase 1a</b> (tri par urgence I_R)</p>
            </div>
            <div style="background:rgba(91,141,239,0.10); border:1px solid rgba(91,141,239,0.45); border-radius:10px; padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#5b8def; font-weight:700;">${window.iconLabel('languages', 'Pile RAPIDES')}</div>
              <div style="font-size:24px; font-weight:700; margin:4px 0;">${piles.quick}</div>
              <p style="font-size:11px; margin:0; color:var(--mut);"><code>id prefix Y-</code></p>
              <p style="font-size:12px; margin:8px 0 0;">Petites cartes (~30s) créées via l'onglet <span class="av-tag">${window.iconLabel('zap', 'Rapide')}</span> — <b>réservoir Y-</b> par matière (activation manuelle), puis comblage en fin de session Synchrotron.</p>
              <p style="font-size:11px; margin:6px 0 0; color:var(--mut);">→ <b>Phase 2</b> (comblage)</p>
            </div>
          </div>

          <div style="margin-top:14px; padding:10px 12px; background:rgba(255,170,51,0.10); border:1px solid rgba(255,170,51,0.35); border-radius:8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#ffaa33; font-weight:700;">${window.iconLabel('hourglass', 'Réservoir (toutes piles confondues)')}</div>
            <p style="font-size:12px; margin:6px 0 0;">Les cartes Synchrotron (X-) naissent avec <code>statut = "reservoir"</code> (onglet ${window.iconLabel('hourglass', 'Réservoir')}). Les Y- ont leur propre réservoir dans l'onglet ${window.iconLabel('zap', 'Rapide')}. Les W- vivent dans <code>D.devoirs</code> (Agenda). Champ canonique : <code>importance</code> (1–5★), plus <code>priorite</code> legacy.</p>
            <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap;">
              <span class="av-badge live" data-testid="viz-badge-reservoir">${window.iconLabel('hourglass', n + ' en réservoir')}</span>
              <span class="av-badge">${window.statusLabel('green', activeCount() + ' actives au total')}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function nodeBudgetMarge() {
    const marge = (window.D && window.D.settings && typeof window.D.settings.margeBudget === "number")
      ? window.D.settings.margeBudget : 0.92;
    const sessionMin = (window.D && window.D.settings && window.D.settings.ankiSessionMin) || 60;
    const budgetReel = Math.round(sessionMin * marge * 60);
    const seuil = (window.D && window.D.settings && window.D.settings.seuilDevoirForce) || 35;

    // Mini-agenda live : devoirs urgents vs latents
    const devs = devoirsAgenda();
    const agendaRows = devs.slice(0, 6).map(({ card, urg }) => {
      const isForce = urg.total >= seuil;
      const color = isForce ? '#e94f64' : '#ffaa33';
      const label = isForce ? 'FORCÉ Phase 0' : 'Latent Phase 1b';
      const jr = urg.joursRestants;
      const jrLabel = jr == null ? '?' : (jr <= 0 ? `J${jr === 0 ? '' : jr}` : `J+${jr}`);
      return `
        <div style="display:grid; grid-template-columns:1fr 70px 110px 80px; gap:8px; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,0.08); font-size:12px;">
          <div><b>${esc(card.titre || card.id)}</b> <span class="av-tag">${esc(card.mat || '?')}</span></div>
          <div style="font-family:monospace; text-align:right; color:var(--mut);">${jrLabel}</div>
          <div style="font-family:monospace; color:${color}; font-weight:700;">urg ${fmt(urg.total, 0)} (${label})</div>
          <div style="font-size:11px; color:var(--mut); text-align:right;">${(card._morceauxTotal || 1) - (card._morceauxFaits || 0)} morceau(x)</div>
        </div>
      `;
    }).join('');

    return `
      <div class="av-node accent-filter">
        <div class="av-num">2</div>
        <div class="av-node-title">${window.iconLabel('target', 'Cockpit du soir — construction de la session')}</div>
        <p class="av-node-sub">Budget plafond · Devoirs via ${window.iconHtml('clipboard-list', 14, 'icon-sm')} Agenda · X- par I_R · Y- tissées ENTRE les gros exos</p>
        <div class="av-node-body">

          <div class="av-formula"><b>Budget Réel</b> = Temps demandé × <b>Marge Budget</b>
= ${sessionMin} min × <b>${marge.toFixed(2)}</b>
≈ ${Math.floor(budgetReel/60)} min ${budgetReel%60}s</div>

          <div class="av-inline-input">
            <label for="avMarge">Marge Budget (0.5 → 1.0) :</label>
            <input type="number" id="avMarge" data-testid="viz-input-marge"
                   min="0.5" max="1.0" step="0.05" value="${marge.toFixed(2)}">
            <button class="av-reset" data-testid="viz-reset-marge" onclick="window._ankiVizResetMarge()">${window.iconLabel('undo-2', '0.92')}</button>
          </div>

          <h4 style="font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:18px 0 8px;">Déroulé du soir (comme ta synthèse PC*)</h4>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="background:rgba(255,80,80,0.10); border-left:3px solid #ff5050; padding:10px 12px; border-radius:0 8px 8px 0;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#ff5050; font-weight:700;">① Taxe d'entretien + W- FORCÉS (tête de file)</div>
              <p style="font-size:12px; margin:6px 0 0;">Les cartes X-/Y- <b>en retard</b> passent en premier (taxe d'entretien). <code>shiftProgramIfMissedDaily</code> les bascule sur aujourd'hui <b>au plus une fois par jour</b> (pas à chaque changement d'onglet). W- forcés si urgence ≥ <code>seuilDevoirForce</code> (défaut <b>${seuil}</b>).</p>
              <div class="av-inline-input">
                <label>seuilDevoirForce :</label>
                <input type="number" id="avSeuilDevoir" data-testid="viz-seuil-devoir"
                       min="0" max="100" step="5" value="${seuil}">
                <button class="av-reset" onclick="window._ankiVizResetSeuilDevoir()">${window.iconLabel('undo-2', '35')}</button>
              </div>
            </div>
            <div style="background:rgba(66,181,107,0.08); border-left:3px solid #42b56b; padding:10px 12px; border-radius:0 8px 8px 0;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#42b56b; font-weight:700;">② X- PRINCIPALES (cœur I_R)</div>
              <p style="font-size:12px; margin:6px 0 0;">Cartes préfixe <code>X-</code> triées par score I_R (retards d'abord, puis urgence ↓). On remplit le budget restant. Exactitude + vitesse (chrono) modifient l'intervalle futur — voir Nœuds 3, 3b et 5.</p>
            </div>
            <div style="background:rgba(255,170,51,0.08); border-left:3px solid #ffaa33; padding:10px 12px; border-radius:0 8px 8px 0;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#ffaa33; font-weight:700;">③ W- OPPORTUNISTES (si budget reste)</div>
              <p style="font-size:12px; margin:6px 0 0;">Devoirs calendaires non forcés (urgence &lt; ${seuil}) — un DM dans 7 jours peut entrer dans un jour creux. Jamais de surcharge : skippés si le budget est plein.</p>
            </div>
            <div style="background:rgba(91,141,239,0.08); border-left:3px solid #5b8def; padding:10px 12px; border-radius:0 8px 8px 0;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#5b8def; font-weight:700;">④ TISSAGE X- ↔ Y- (<code>weaveSession</code>)</div>
              <p style="font-size:12px; margin:6px 0 0;">Les cartes <code>Y-</code> (~30s) ne sont <b>PAS</b> reléguées en bloc final : elles sont <b>insérées entre les gros exos</b> X- (et W- latents), en alternance long/court, en évitant deux fois la même matière d'affilée. Plafond de tissage : <code>ankiMaxAnglaisFill</code> (défaut <b>5</b>).</p>
              <div class="av-interleave" style="margin-top:8px;">
                <div class="av-il-row">
                  <span class="av-il-label">Exemple tissé :</span>
                  <span class="av-il-pill" style="background:rgba(66,181,107,0.25);color:#42b56b;">X- MA 20min</span>
                  <span class="av-il-arrow">→</span>
                  <span class="av-il-pill" style="background:rgba(91,141,239,0.25);color:#5b8def;">Y- AN 30s</span>
                  <span class="av-il-arrow">→</span>
                  <span class="av-il-pill" style="background:rgba(233,79,100,0.25);color:#e94f64;">X- PH 15min</span>
                  <span class="av-il-arrow">→</span>
                  <span class="av-il-pill" style="background:rgba(91,141,239,0.25);color:#5b8def;">Y- AN 30s</span>
                </div>
              </div>
            </div>
            <div style="background:rgba(255,255,255,0.04); border-left:3px solid rgba(255,255,255,0.28); padding:10px 12px; border-radius:0 8px 8px 0;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,0.72); font-weight:700;">⑤ COMBLAGE FINAL Y- (bonus)</div>
              <p style="font-size:12px; margin:6px 0 0;">Si, après le tissage, il reste du budget et des Y- disponibles (au-delà du plafond de tissage), elles sont ajoutées <b>en fin de session</b>. Deux rôles pour les rapides : <i>intercaler</i> la charge cognitive ET <i>combler</i> les minutes restantes.</p>
            </div>
            <div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.12); padding:10px 12px; border-radius:8px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--mut); font-weight:700;">⑥ Réservoir (comblement manuel)</div>
              <p style="font-size:12px; margin:6px 0 0;">Les cartes X- en <code>statut = reservoir</code> n'entrent jamais automatiquement. Tu les actives depuis ${window.iconLabel('hourglass', 'Réservoir')} quand tu veux les intégrer — équivalent du « comblement » de ta synthèse initiale, mais <b>conscient</b> plutôt qu'automatique.</p>
            </div>
          </div>

          ${devs.length ? `
            <h4 style="font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:18px 0 8px;">${window.iconLabel('calendar', 'Agenda — Devoirs actifs en cours')}</h4>
            <div data-testid="viz-agenda-devoirs" style="background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:8px 12px;">
              <div style="display:grid; grid-template-columns:1fr 70px 110px 80px; gap:8px; padding:4px 0; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--mut); border-bottom:1px solid rgba(255,255,255,0.10);">
                <div>Devoir</div><div style="text-align:right;">Échéance</div><div>Urgence calendaire</div><div style="text-align:right;">Restant</div>
              </div>
              ${agendaRows}
            </div>
          ` : `
            <p class="av-coef-desc" style="margin-top:14px;">${window.iconLabel('calendar', 'Aperçu ci-dessous — vue complète dans Synchrotron → onglet')} <span class="av-tag">${window.iconLabel('clipboard-list', 'Agenda')}</span>.</p>
          `}
        </div>
      </div>
    `;
  }

  // Nouveau Nœud 3bis : délais de répétition (steps SM-2 par profil + qFactor)
  function nodeDelaisRepetition() {
    const A = window.AnkiAlgo;
    const profiles = A.DEFAULT_PROFILES || {};
    const profileRows = Object.keys(profiles).map(k => {
      const p = profiles[k];
      const steps = (p.steps || []).slice(0, 8).join(", ");
      return `
        <div class="av-coef-card" style="grid-column:span 2;">
          <label>${esc(k)} — ${esc(p.label || '')}</label>
          <div style="font-family:'Menlo','Consolas',monospace; font-size:12px; color:#ffaa33;">[${esc(steps)}${(p.steps||[]).length>8?' …':''}] j</div>
          <div class="av-coef-desc">ease init = <b>${p.ease}</b> · ${esc(p.note || '')}</div>
        </div>
      `;
    }).join("");
    return `
      <div class="av-node accent-core">
        <div class="av-num">3b</div>
        <div class="av-node-title">${window.iconLabel('calendar', 'Délais de répétition — SM-2 modifié')}</div>
        <p class="av-node-sub">Comment l'intervalle progresse à chaque révision réussie</p>
        <div class="av-node-body">
          <p>Pour les premières répétitions, l'algorithme suit un <b>tableau de paliers fixes</b> par profil (mémoire à court terme). Au-delà, il bascule sur la <b>multiplication par l'ease</b> (mémoire à long terme façon SuperMemo-2).</p>

          <div class="av-formula"><b>Si</b> repetitions &lt; nb_paliers :
   intervalle = paliers[repetitions]   ← table fixe (chargement initial)
<b>Sinon</b> :
   intervalle = intervalle × <b>ease</b> × <b>qFactor</b> × pénalité_vitesse

avec qFactor =
   · qScore ≤ 3 → 0       (reset, intervalle remis à 0)
   · qScore = 4 → 0.45    · qScore = 7 → 1.00
   · qScore = 8 → 1.12    · qScore = 9 → 1.20
   · qScore = 10 → 1.40   (interpolation linéaire entre)

pénalité_vitesse =
   · tempsReel &gt; 2× cible → ×0.5
   · tempsReel &gt; 1.5× cible → ×0.7
   · tempsReel &lt; 0.7× cible → ×1.15  (bonus rapidité)</div>

          <p><b>Lecture concrète :</b> une carte cours réussie à 7/10 en temps cible passe par les paliers 1j → 3j → 7j → 14j puis double à ~2.5× son intervalle précédent à chaque réussite. À 9/10, elle accélère de 20%. À 3/10, elle est remise au début.</p>

          <h4 style="font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">Paliers par profil</h4>
          <div class="av-coef-grid">${profileRows || '<div class="av-coef-desc">Profils non chargés.</div>'}</div>

          <div style="margin-top:12px; padding:10px 12px; background:rgba(66,181,107,0.10); border:1px solid rgba(66,181,107,0.30); border-radius:8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#42b56b; font-weight:700;">${window.iconLabel('lightbulb', 'Note importante — les DM ne suivent PAS cette logique')}</div>
            <p style="font-size:12px; margin:6px 0 0;">Les exos de type <code>devoir</code> sont des tâches à durée fixe (pas de mémorisation espacée). Leur <code>ease</code> et <code>intervalle</code> ne bougent jamais ; on incrémente seulement <code>_morceauxFaits</code> et la prochaine session est planifiée au lendemain (J+1).</p>
          </div>
        </div>
      </div>
    `;
  }

  function nodeUrgenceIR() {
    const C = window.AnkiAlgo.getCoefs();
    const coefRows = COEF_SPEC.map(s => {
      const cur = C[s.key];
      const def = window.AnkiAlgo.DEFAULT_COEFS[s.key];
      return `
        <div class="av-coef-card">
          <label>${esc(s.key)}</label>
          <input type="number" data-testid="viz-coef-${esc(s.key)}"
                 step="${s.step}" value="${cur}" data-key="${esc(s.key)}"
                 oninput="window._ankiVizCoefChange('${esc(s.key)}', this.value)">
          <div class="av-coef-desc">${esc(s.hint)} <span class="av-tag" style="margin-left:4px;">défaut ${def}</span></div>
        </div>
      `;
    }).join("");
    // Simulation live
    const sims = SIM_CARDS.map(c => {
      const r = simulateUrgence(c);
      return { c, r };
    });
    const maxScore = Math.max(...sims.map(s => s.r.total), 1);
    const simRows = sims.map(({ c, r }) => `
      <div class="av-sim-row">
        <div class="av-sim-name">${simCardLabel(c)}</div>
        <div class="av-sim-num">I_R=${fmt(r.IR, 2)}</div>
        <div class="av-sim-num">u(t)=${fmt(r.urgenceTemps, 2)}</div>
        <div class="av-sim-score">${fmt(r.total, 1)}</div>
        <div class="av-sim-bar"><div style="width:${Math.min(100, r.total / maxScore * 100).toFixed(0)}%"></div></div>
      </div>
    `).join("");
    return `
      <div class="av-node accent-core">
        <div class="av-num">3</div>
        <div class="av-node-title">${window.iconLabel('brain', "Score d'urgence — Index de Délai Relatif (I_R)")}</div>
        <p class="av-node-sub">Le nœud central · unifie « retard » et « proximité » en une seule métrique continue</p>
        <div class="av-node-body">
          <div class="av-formula"><b>I_R</b> = Jours écoulés ÷ Intervalle prévu

· I_R &lt; 1 (en avance) → u(t) = exp(<b>K_PROCHE</b> · (I_R − 1))
· I_R = 1 (jour J)       → u(t) = 1
· I_R &gt; 1 (en retard)  → u(t) = 1 + <b>GAMMA_RETARD</b> · (I_R − 1)

<b>Score total</b> = W_urgenceTemps·u(t) + W_priorite·importance + W_ease·(3−ease) + W_nouveau·nouveau</div>

          <p><b>Pourquoi cette unification ?</b> Une carte d'1 jour qui prend 1 jour de retard (I_R = 2) doit remonter <b>plus vite</b> qu'une carte de 30 jours qui en prend 3 (I_R ≈ 1.1) — la perte relative est bien plus grande. La formule capte ça naturellement.</p>

          <h4 style="font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">Coefficients pilotables en direct</h4>
          <div class="av-coef-grid">${coefRows}</div>
          <div style="text-align:right; margin-top:6px;">
            <button class="av-reset" data-testid="viz-reset-coefs" onclick="window._ankiVizResetCoefs()">${window.iconLabel('undo-2', 'Restaurer les défauts')}</button>
          </div>

          <div class="av-sim" data-testid="viz-sim-block">
            <h4>Simulation à la volée — 6 cartes types</h4>
            ${simRows}
            <p style="margin-top:8px; font-size:11px; color:var(--mut);">Modifie un coefficient ci-dessus : les scores recalculent instantanément. La barre est normalisée sur la plus haute valeur.</p>
          </div>
        </div>
      </div>
    `;
  }

  function nodeEntrelacement() {
    return `
      <div class="av-node accent-order">
        <div class="av-num">4</div>
        <div class="av-node-title"><span class="icon-inline-label">${window.iconHtml('move-vertical', 16, 'icon-sm')}Entrelacement — long/court + matières (<code>weaveSession</code>)</span></div>
        <p class="av-node-sub">Rohrer &amp; Taylor (2007) : mélanger matières ET formats bat le blocage par catégorie</p>
        <div class="av-node-body">
          <p>Après sélection par urgence et budget, le noyau de session (X- + W- latents + Y- tissées) passe par <code>ALGO.weaveSession(longs, shorts)</code> :</p>
          <ul style="padding-left:18px;font-size:13px;line-height:1.6;">
            <li><b>Alternance long ↔ court</b> : un gros exo X- (10–30 min) puis une carte Y- (~30s), et ainsi de suite.</li>
            <li><b>Évitement matière consécutive</b> : on pioche la carte la plus urgente dont la matière ≠ la précédente (sinon doublon accepté).</li>
            <li><b>Les W- forcés</b> restent <i>avant</i> le tissage — jamais mélangés dans cette étape.</li>
          </ul>

          <div class="av-interleave" data-testid="viz-interleave-demo">
            <div class="av-il-row">
              <span class="av-il-label">Pools triés ↓ :</span>
              <span class="av-il-pill" style="background:rgba(66,181,107,0.20);color:#42b56b;">X- long</span>
              <span class="av-il-pill" style="background:rgba(66,181,107,0.20);color:#42b56b;">X- long</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;">Y- court</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;">Y- court</span>
            </div>
            <div class="av-il-row">
              <span class="av-il-label">File tissée :</span>
              <span class="av-il-pill" style="background:rgba(66,181,107,0.20);color:#42b56b;">X-</span>
              <span class="av-il-arrow">→</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;">Y-</span>
              <span class="av-il-arrow">→</span>
              <span class="av-il-pill" style="background:rgba(66,181,107,0.20);color:#42b56b;">X-</span>
              <span class="av-il-arrow">→</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;">Y-</span>
            </div>
          </div>

          <p style="margin-top:12px;font-size:12px;"><b>3 modes de révision distincts :</b></p>
          <ul style="padding-left:18px;font-size:12px;color:var(--mut);">
            <li><span class="av-tag">${window.iconLabel('sliders', 'Cockpit')}</span> — session complète (ci-dessus)</li>
            <li><span class="av-tag">${window.iconLabel('zap', 'Rapide')}</span> — Y- seules (onglet dédié, hors tissage X-)</li>
            <li><span class="av-tag">${window.iconLabel('mouse-pointer-click', 'Personnalisée')}</span> — cartes cochées manuellement dans le Cockpit</li>
          </ul>
        </div>
      </div>
    `;
  }

  function nodeEvaluationEase() {
    const C = window.AnkiAlgo.getCoefs();
    const blocRows = BLOCAGE_SPEC.map(s => {
      const cur = C[s.key];
      const def = window.AnkiAlgo.DEFAULT_COEFS[s.key];
      return `
        <div class="av-coef-card">
          <label>${esc(s.key)}</label>
          <input type="number" data-testid="viz-bloc-${esc(s.key)}"
                 step="${s.step}" value="${cur}" data-key="${esc(s.key)}"
                 oninput="window._ankiVizCoefChange('${esc(s.key)}', this.value)">
          <div class="av-coef-desc">${esc(s.hint)} <span class="av-tag" style="margin-left:4px;">défaut ${def}</span></div>
        </div>
      `;
    }).join("");
    return `
      <div class="av-node accent-eval">
        <div class="av-num">5</div>
        <div class="av-node-title">${window.iconLabel('timer', 'Évaluation & Ease élastique')}</div>
        <p class="av-node-sub">Bifurcation : la note de l'étudiant règle l'intervalle ET l'urgence future</p>
        <div class="av-node-body">

          <div class="av-fork-wrap" data-testid="viz-fork">
            <div class="av-fork-leg l"></div>
            <div class="av-fork-leg r"></div>
          </div>

          <div class="av-branches">
            <div class="av-node av-branch-good">
              <div class="av-branch-label">${window.iconLabel('circle-check', 'Réussite — qScore ≥ ' + (C.BLOCAGE_QSCORE_VALIDATE || 8))}</div>
              <p>L'intervalle progresse selon SM-2 modifié : <code>intervalle × ease × qFactor</code>.</p>
              <p>L'ease bouge peu : <code>ease ± 0.05</code> selon que tu es légèrement au-dessous ou au-dessus du seuil parfait.</p>
              <p>Si la carte était <code>_blocageActif</code>, le flag est <b>levé immédiatement</b> et le compteur revient à 0.</p>
            </div>
            <div class="av-node av-branch-bad">
              <div class="av-branch-label">${window.iconLabel('zap', 'Blocage — qScore ≤ ' + (C.BLOCAGE_QSCORE_TRIGGER || 3))}</div>
              <p><b>Anti-Ease-Hell :</b> l'ease baisse de <code>${C.EASE_DROP_FAIL != null ? C.EASE_DROP_FAIL : 0.20}</code> (paramétrable), complété par le boost temporaire ci-dessous.</p>
              <p>On pose le flag <code>_blocageActif = true</code>. Tant qu'il est actif, <b>urgenceScore</b> calcule comme si <code>ease = ${C.BLOCAGE_BOOST_EASE_VAL || 1.3}</code> → la carte est propulsée en tête de file dès J+1 / J+2.</p>
              <p>Le flag est levé à la première note ≥ <b>${C.BLOCAGE_QSCORE_VALIDATE || 8}</b> OU après <b>${C.BLOCAGE_TIMEOUT_REV || 5}</b> tentatives infructueuses (timeout pour éviter un blocage éternel).</p>
            </div>
          </div>

          <h4 style="font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">Paramètres de l'ease élastique</h4>
          <div class="av-coef-grid">${blocRows}</div>
          <p style="margin-top:10px; font-size:12px; color:var(--mut);"><b>Idée clé :</b> on découple le <i>traitement temporaire</i> (boost via flag) de la <i>baisse durable</i> (ease persistant). Une carte longue qui bloque ne revient pas à vie sur ta tête, mais elle revient <b>vite</b> jusqu'à ce que tu la maîtrises.</p>

          <div style="margin-top:14px; padding:10px 12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.14); border-radius:8px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,0.72); font-weight:700;">${window.iconLabel('target', 'Mode "single" / "quick" — révision d\'une seule carte hors session')}</div>
            <p style="font-size:12px; margin:6px 0 0;">Si tu cliques sur une carte spécifique (depuis la file, la bibliothèque, ou la liste du réservoir) sans avoir lancé de session complète, elle s'ouvre seule dans l'overlay. Tu la révises, tu la notes, et :</p>
            <ul style="padding-left:18px; margin:6px 0; font-size:12px;">
              <li>L'<b>évaluation modifie quand même</b> ease / intervalle / repetitions / dateProchaineRevision dans <code>D.exercices</code> (sauf en mode <code>colle</code> qui se contente d'enregistrer le score).</li>
              <li>L'historique de la carte (<code>card.historique</code>) reçoit la nouvelle entrée comme dans une session classique.</li>
              <li>En mode single, une carte ratée (qScore ≤ 3) <b>n'est PAS réinjectée</b> dans la file (puisqu'il n'y a pas de file). Elle revient via son nouveau <code>dateProchaineRevision</code>.</li>
              <li>Le compteur de session (<code>S.stats</code>) n'est pas incrémenté, mais une <b>confirmation visuelle</b> apparaît avec le détail du calcul (ease avant/après, intervalle, blocage levé ou posé).</li>
              <li>Le snapshot d'Undo (<code>S.dernierExerciceModifie</code>) fonctionne aussi : tu peux annuler ta dernière notation même en mode single.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // Nouveau Nœud 7 : Statistiques & Diagnostic
  function nodeStatistiques() {
    const A = window.AnkiAlgo;
    // Stats globales depuis la base
    const exos = allCards();
    let totalHist = 0, okCount = 0, midCount = 0, badCount = 0, blocages = 0;
    exos.forEach(c => {
      if (Array.isArray(c.historique)) {
        c.historique.forEach(h => {
          totalHist++;
          if (typeof h.qScore === "number") {
            if (h.qScore <= 3)      badCount++;
            else if (h.qScore <= 7) midCount++;
            else                    okCount++;
          }
        });
      }
      if (c._blocageActif) blocages++;
    });
    const reussite = totalHist > 0 ? Math.round((okCount / totalHist) * 100) : 0;
    const logCount = (A && A.LOG) ? A.LOG.length : 0;
    return `
      <div class="av-node accent-filter">
        <div class="av-num">7</div>
        <div class="av-node-title">${window.iconLabel('bar-chart', 'Statistiques & Diagnostic')}</div>
        <p class="av-node-sub">Trois échelles d'observation : globale, par carte, et journal des décisions</p>
        <div class="av-node-body">

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); gap:10px; margin-bottom:14px;" data-testid="viz-stats-kpis">
            <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px; text-align:center;">
              <div style="font-size:24px; font-weight:700; color:#42b56b;">${okCount}</div>
              <div style="font-size:10px; text-transform:uppercase; color:var(--mut); letter-spacing:1px;">Réussites (≥8)</div>
            </div>
            <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px; text-align:center;">
              <div style="font-size:24px; font-weight:700; color:#ffaa33;">${midCount}</div>
              <div style="font-size:10px; text-transform:uppercase; color:var(--mut); letter-spacing:1px;">Moyens (4-7)</div>
            </div>
            <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px; text-align:center;">
              <div style="font-size:24px; font-weight:700; color:#e94f64;">${badCount}</div>
              <div style="font-size:10px; text-transform:uppercase; color:var(--mut); letter-spacing:1px;">Blocages (≤3)</div>
            </div>
            <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px; text-align:center;">
              <div style="font-size:24px; font-weight:700; color:#5b8def;">${reussite}%</div>
              <div style="font-size:10px; text-transform:uppercase; color:var(--mut); letter-spacing:1px;">Taux réussite</div>
            </div>
            <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px; text-align:center;">
              <div style="font-size:24px; font-weight:700; color:rgba(255,255,255,0.85);">${blocages}</div>
              <div style="font-size:10px; text-transform:uppercase; color:var(--mut); letter-spacing:1px;">En blocage actif</div>
            </div>
            <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px; text-align:center;">
              <div style="font-size:24px; font-weight:700; color:var(--txt);">${logCount}</div>
              <div style="font-size:10px; text-transform:uppercase; color:var(--mut); letter-spacing:1px;">Logs ALGO</div>
            </div>
          </div>

          <p><b>Trois niveaux de lecture</b> permettent de comprendre ce qui se passe :</p>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:8px;">
            <div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px;">
              <div style="font-size:11px; color:var(--mut); text-transform:uppercase; letter-spacing:1px; font-weight:700;">1. Session courante</div>
              <p style="font-size:12px; margin:6px 0 0;">L'objet <code>S.stats = {ok, mid, bad, total}</code> compte les notations <b>de la session en cours</b>. Affiché en pied de chaque carte (<i>Reste : N · ${window.statusLabel('green', 'x')} · ${window.statusLabel('yellow', 'y')} · ${window.statusLabel('red', 'z')}</i>) et dans le résumé final.</p>
            </div>
            <div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px;">
              <div style="font-size:11px; color:var(--mut); text-transform:uppercase; letter-spacing:1px; font-weight:700;">2. Historique par carte</div>
              <p style="font-size:12px; margin:6px 0 0;">Chaque carte stocke <code>card.historique[]</code> avec à chaque entrée : <code>date</code>, <code>qScore</code>, <code>tempsReel</code>, <code>pen</code> (pénalité vitesse), <code>mode</code>. Permet de calculer ton taux personnel par matière / par carte sur l'onglet Stats.</p>
            </div>
            <div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.10); border-radius:8px; padding:10px;">
              <div style="font-size:11px; color:var(--mut); text-transform:uppercase; letter-spacing:1px; font-weight:700;">3. Journal de décisions</div>
              <p style="font-size:12px; margin:6px 0 0;"><code>ALGO.LOG[]</code> trace les décisions du moteur : sessions générées, activations réservoir, évaluations (avec ease avant/après), décalages automatiques, levées de blocage. Visible dans cette carte mentale (nœud 7).</p>
            </div>
          </div>

          <p style="margin-top:12px; font-size:12px; color:var(--mut);"><b>Garde-fou Undo :</b> l'historique de la carte <b>est conservé</b> (y compris la notation annulée). Les paramètres (ease, intervalle, repetitions, blocage) sont restaurés, et une entrée <code>↺ undo</code> est ajoutée à l'historique.</p>
        </div>
      </div>
    `;
  }

  function nodePersistanceSecurite() {
    return `
      <div class="av-node accent-safe">
        <div class="av-num">6</div>
        <div class="av-node-title">${window.iconLabel('shield', "Persistance & Sécurité — Le droit à l'erreur")}</div>
        <p class="av-node-sub">Deux garde-fous pour ne jamais perdre ton flux de révision</p>
        <div class="av-node-body">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div style="background:rgba(91,141,239,0.10); border:1px solid rgba(91,141,239,0.35); border-radius:8px; padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#5b8def; font-weight:700;">${window.iconLabel('pin', 'Session figée')}</div>
              <p style="margin:6px 0 0; font-size:12px;">Le bouton <span class="av-tag">${window.iconLabel('pin', 'Générer la session du soir')}</span> écrit <code>window.D.sessionEnCours</code> dans la base. La file <code>S.queue</code> survit à un changement d'onglet, à un refresh navigateur, à une fermeture d'app. Le bandeau <span class="av-tag">${window.iconLabel('play', 'Reprendre')}</span> apparaît au retour.</p>
              <p style="margin:6px 0 0; font-size:11px; color:var(--mut);"><b>Chrono auto-pause :</b> sur <code>visibilitychange</code> (tu changes d'onglet navigateur) ET sur changement de vue Anki interne.</p>
            </div>
            <div style="background:rgba(255,170,51,0.10); border:1px solid rgba(255,170,51,0.40); border-radius:8px; padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#ffaa33; font-weight:700;">${window.iconLabel('undo-2', 'Bouton Undo')}</div>
              <p style="margin:6px 0 0; font-size:12px;">Avant CHAQUE écriture en base, un deep-clone de la carte est mis dans <code>S.dernierExerciceModifie</code>.</p>
              <p style="margin:6px 0 0; font-size:12px;">Un clic sur <span class="av-tag">${window.iconLabel('undo-2', 'Annuler la dernière notation')}</span> :</p>
              <ul style="padding-left:18px; margin:4px 0; font-size:12px;">
                <li>Restaure ease / intervalle / repetitions / flag blocage (l'historique reste intact + entrée <code>↺ undo</code>)</li>
                <li>La réinjecte en tête de <code>S.queue</code></li>
                <li>Décrémente les compteurs ok/mid/bad de la session</li>
                <li>Sauvegarde + repersistance immédiate</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function explainSection() {
    return `
      <section class="anki-explain-wrap" data-testid="viz-explain">
        <h3>${window.iconLabel('book-open', 'Synthèse PC* — fondements & architecture')}</h3>

        <h4>Les 3 piliers cognitifs</h4>
        <ul>
          <li><b>Rappel actif</b> (Roediger &amp; Karpicke 2006) — l'app affiche une injonction (« Démontrer… »), pas un cours à relire. Tu travailles sur brouillon, puis auto-évaluation.</li>
          <li><b>Répétition espacée</b> (Cepeda 2008) — intervalle optimal calculé par carte (I_R + SM-2 modifié). Réviser chaque jour serait inefficace.</li>
          <li><b>Entrelacement</b> (Rohrer &amp; Taylor 2007) — mélanger matières <i>et</i> formats (X- long + Y- court) force le cerveau à choisir la bonne méthode sous pression (+20% à +76% vs blocage).</li>
        </ul>

        <h4>Algorithme PC* : exactitude + vitesse</h4>
        <p>Contrairement à Anki vanilla (mémoire seule), chaque évaluation combine :</p>
        <ul>
          <li><b>Exactitude</b> — qScore 0–10 (blocage → reset intervalle)</li>
          <li><b>Vitesse</b> — chronomètre vs <code>tempsCible</code> : trop lent → intervalle pénalisé (fluidité exigée pour l'X/ENS)</li>
        </ul>

        <h4>Les 3 types de cartes (préfixes W / X / Y)</h4>
        <ul>
          <li><code>W-</code> <b>Devoirs</b> — agenda calendaire, onglet ${window.iconHtml('clipboard-list', 14, 'icon-sm')} Agenda, pas d'I_R</li>
          <li><code>X-</code> <b>Principales</b> — cœur du système, I_R + ease élastique, naissent en réservoir</li>
          <li><code>Y-</code> <b>Rapides</b> — tissées entre les X-, créées actives via onglet ${window.iconLabel('zap', 'Rapide')}</li>
        </ul>

        <h4>1. L'Index de Délai Relatif (I_R)</h4>
        <p><code>I_R = jours écoulés / intervalle prévu</code> — unifie retard et proximité. Les petits intervalles en retard montent plus vite que les grands.</p>

        <h4>2. Ease élastique (anti-Ease Hell)</h4>
        <p>Baisse paramétrable (défaut −0.20) + boost temporaire <code>_blocageActif</code> pour remonter vite sans condamner à vie.</p>

        <h4>3. Réservoir strict</h4>
        <p>Les X- créées ne entrent qu'après activation consciente — tu contrôles la charge. Exception : Y- Rapide = actives directement.</p>

        <p style="margin-top:18px; font-size:11px; color:var(--mut); text-align:center;">Synchrotron v4 · Carte mentale live — valeurs synchronisées avec l'application.</p>
      </section>
    `;
  }

  // ------------------------------------------------------------------------------
  // 5) Render principal + handlers exposés
  // ------------------------------------------------------------------------------
  window.renderAnkiViz = function () {
    injectStyles();
    if (!window.AnkiAlgo) {
      const root = document.getElementById("paneAnkiViz");
      if (root) root.innerHTML = '<div style="padding:40px; text-align:center; color:var(--mut);"><span class="icon-inline-label">' + window.iconHtml('alert-triangle', 16, 'icon-sm') + '<code>anki-algo.js</code> doit être chargé avant <code>anki-viz.js</code>.</span></div>';
      return;
    }
    const root = document.getElementById("paneAnkiViz");
    if (!root) return;
    root.innerHTML = `
      <div class="av-wrap" data-testid="viz-root">
        <div class="av-head">
          <h2>${window.iconLabel('map', 'Carte mentale Synchrotron v4')}</h2>
          <p>Cycle de vie d'une carte · de la création au verdict · contrôles en direct</p>
        </div>

        ${nodeEntreeReservoir()}
        <div class="av-link"></div>
        ${nodeBudgetMarge()}
        <div class="av-link"></div>
        ${nodeUrgenceIR()}
        <div class="av-link"></div>
        ${nodeDelaisRepetition()}
        <div class="av-link"></div>
        ${nodeEntrelacement()}
        <div class="av-link"></div>
        ${nodeEvaluationEase()}
        <div class="av-link"></div>
        ${nodePersistanceSecurite()}
        <div class="av-link"></div>
        ${nodeStatistiques()}

        ${explainSection()}
      </div>
    `;
    bindLiveControls();
    if (window.hydrateIcons) window.hydrateIcons(root);
  };

  function bindLiveControls() {
    // Marge budget
    const m = document.getElementById("avMarge");
    if (m) m.addEventListener("input", e => {
      let v = parseFloat(e.target.value);
      if (isNaN(v)) return;
      v = Math.max(0.5, Math.min(1.0, v));
      if (!window.D || !window.D.settings) return;
      window.D.settings.margeBudget = v;
      if (typeof window.save === "function") window.save();
      const sessionMin = (window.D.settings.ankiSessionMin) || 60;
      const budgetSec = Math.round(sessionMin * v * 60);
      const formulaEl = e.target.closest(".av-node-body").querySelector(".av-formula");
      if (formulaEl) {
        formulaEl.innerHTML = `<b>Budget Réel</b> = Temps demandé × <b>Marge Budget</b>\n= ${sessionMin} min × <b>${v.toFixed(2)}</b>\n≈ ${Math.floor(budgetSec/60)} min ${budgetSec%60}s`;
      }
    });
    // Seuil devoir forcé
    const sd = document.getElementById("avSeuilDevoir");
    if (sd) sd.addEventListener("input", e => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v)) return;
      v = Math.max(0, Math.min(100, v));
      if (!window.D || !window.D.settings) return;
      window.D.settings.seuilDevoirForce = v;
      if (typeof window.save === "function") window.save();
      // refresh complet pour mettre à jour les labels FORCÉ/Latent
      window.renderAnkiViz();
    });
  }

  window._ankiVizResetSeuilDevoir = function () {
    if (!window.D || !window.D.settings) return;
    window.D.settings.seuilDevoirForce = 35;
    if (typeof window.save === "function") window.save();
    window.renderAnkiViz();
  };

  // Handler global : changement d'un coefficient
  window._ankiVizCoefChange = function (key, raw) {
    const v = parseFloat(raw);
    if (isNaN(v)) return;
    setCoef(key, v);
    // Re-render uniquement les zones impactées : simulation N3 + sous-titres N5
    refreshSimulation();
    refreshEvalLabels();
  };
  window._ankiVizResetCoefs = function () {
    if (!window.D || !window.D.settings) return resetCoefs();
    resetCoefs();
  };
  window._ankiVizResetMarge = function () {
    if (!window.D) window.D = {};
    if (!window.D.settings) window.D.settings = {};
    window.D.settings.margeBudget = 0.92;
    if (typeof window.save === "function") window.save();
    window.renderAnkiViz();
  };

  // Re-render léger de la simulation et des labels qui dépendent des coefs
  function refreshSimulation() {
    const block = document.querySelector("[data-testid='viz-sim-block']");
    if (!block) return;
    const sims = SIM_CARDS.map(c => ({ c, r: simulateUrgence(c) }));
    const maxScore = Math.max(...sims.map(s => s.r.total), 1);
    const rows = sims.map(({ c, r }) => `
      <div class="av-sim-row">
        <div class="av-sim-name">${simCardLabel(c)}</div>
        <div class="av-sim-num">I_R=${fmt(r.IR, 2)}</div>
        <div class="av-sim-num">u(t)=${fmt(r.urgenceTemps, 2)}</div>
        <div class="av-sim-score">${fmt(r.total, 1)}</div>
        <div class="av-sim-bar"><div style="width:${Math.min(100, r.total / maxScore * 100).toFixed(0)}%"></div></div>
      </div>
    `).join("");
    block.innerHTML = `
      <h4>Simulation à la volée — 6 cartes types</h4>
      ${rows}
      <p style="margin-top:8px; font-size:11px; color:var(--mut);">Modifie un coefficient ci-dessus : les scores recalculent instantanément. La barre est normalisée sur la plus haute valeur.</p>
    `;
  }
  function refreshEvalLabels() {
    // Re-render uniquement le Nœud 5 (étiquettes dépendantes des seuils)
    const all = document.querySelectorAll("#paneAnkiViz .av-node.accent-eval");
    if (!all.length) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = nodeEvaluationEase();
    const fresh = tmp.firstElementChild;
    all[0].replaceWith(fresh);
  }

})();

/* Intégré : onglet Carte mentale · renderAnkiViz() · paneAnkiViz */
