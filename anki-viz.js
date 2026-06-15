/**
 * =========================================================================================
 * 🗺  anki-viz.js — Carte mentale interactive du moteur Synchrotron v4 (PC*)
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
        margin: 0; font-size: 28px; letter-spacing: .5px;
        background: linear-gradient(90deg,#b06af7,#5b8def 60%,#42b56b);
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      #paneAnkiViz .av-head p {
        color: var(--mut); margin: 6px 0 0; font-size: 13px;
      }

      /* Nœud générique = bloc glassmorphism */
      #paneAnkiViz .av-node {
        position: relative;
        background: rgba(255,255,255,0.04);
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 14px;
        padding: 16px 18px;
        margin: 0;
        color: var(--txt);
        box-shadow: 0 4px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05);
      }
      #paneAnkiViz .av-node.accent-input    { border-color: rgba(176,106,247,0.45); }
      #paneAnkiViz .av-node.accent-filter   { border-color: rgba(91,141,239,0.45); }
      #paneAnkiViz .av-node.accent-core     { border-color: rgba(255,170,51,0.55); box-shadow: 0 4px 32px rgba(255,170,51,0.10), inset 0 1px 0 rgba(255,255,255,0.06); }
      #paneAnkiViz .av-node.accent-order    { border-color: rgba(66,181,107,0.45); }
      #paneAnkiViz .av-node.accent-eval     { border-color: rgba(233,79,100,0.40); }
      #paneAnkiViz .av-node.accent-safe     { border-color: rgba(91,141,239,0.40); }

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

      /* Bifurcation Y du Nœud 5 */
      #paneAnkiViz .av-fork {
        position: relative; align-self: center; width: 70%; height: 36px;
      }
      #paneAnkiViz .av-fork::before, #paneAnkiViz .av-fork::after {
        content: ""; position: absolute; top: 0; width: 50%; height: 100%;
        border-bottom: 2px solid rgba(255,255,255,0.30);
      }
      #paneAnkiViz .av-fork::before { left: 0;  border-left:  2px solid rgba(255,255,255,0.30); border-radius: 0 0 0 12px; }
      #paneAnkiViz .av-fork::after  { right: 0; border-right: 2px solid rgba(255,255,255,0.30); border-radius: 0 0 12px 0; }
      #paneAnkiViz .av-fork-stem {
        position: absolute; left: 50%; top: -28px; transform: translateX(-50%);
        width: 2px; height: 32px;
        background: linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08));
      }
      #paneAnkiViz .av-branches {
        display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 6px;
      }
      #paneAnkiViz .av-branch-good { border-color: rgba(66,181,107,0.55) !important; }
      #paneAnkiViz .av-branch-bad  { border-color: rgba(233,79,100,0.55) !important; }
      #paneAnkiViz .av-branch-label {
        font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
        font-weight: 700; margin-bottom: 6px;
      }
      #paneAnkiViz .av-branch-good .av-branch-label { color: #42b56b; }
      #paneAnkiViz .av-branch-bad  .av-branch-label { color: #e94f64; }

      /* Badges et tags */
      #paneAnkiViz .av-badge {
        display: inline-block; padding: 3px 10px; border-radius: 999px;
        font-weight: 700; font-size: 12px;
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);
        color: var(--txt);
      }
      #paneAnkiViz .av-badge.live { background: rgba(255,170,51,0.18); border-color: rgba(255,170,51,0.55); color: #ffaa33; }
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
        font-size: 13px; color: #ffaa33;
        white-space: pre-wrap; word-break: break-word;
      }
      #paneAnkiViz .av-formula b { color: var(--txt); }

      /* Tableau de coefficients (Nœud 3) */
      #paneAnkiViz .av-coef-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr));
        gap: 8px; margin: 8px 0;
      }
      #paneAnkiViz .av-coef-card {
        background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.10);
        border-radius: 8px; padding: 8px 10px;
        display: flex; flex-direction: column; gap: 4px;
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
        outline: none; border-color: rgba(255,170,51,0.7);
        box-shadow: 0 0 0 2px rgba(255,170,51,0.18);
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
        height: 100%; background: linear-gradient(90deg,#5b8def,#ffaa33,#e94f64);
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
        background: rgba(255,255,255,0.03);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 14px;
        padding: 24px 28px;
      }
      #paneAnkiViz .anki-explain-wrap h3 {
        margin: 0 0 12px; font-size: 18px;
        border-bottom: 1px solid rgba(255,255,255,0.10); padding-bottom: 8px;
      }
      #paneAnkiViz .anki-explain-wrap h4 {
        margin: 18px 0 6px; font-size: 14px; color: #ffaa33;
        text-transform: uppercase; letter-spacing: 1.2px;
      }
      #paneAnkiViz .anki-explain-wrap p { margin: 4px 0; font-size: 13px; line-height: 1.65; color: var(--txt); }
      #paneAnkiViz .anki-explain-wrap code {
        background: rgba(0,0,0,0.30); padding: 2px 6px; border-radius: 4px;
        font-size: 12px; color: #ffaa33;
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
      #paneAnkiViz .av-inline-input input:focus { outline: none; border-color: rgba(176,106,247,0.7); }
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
    { key: "W_priorite",     label: "Poids priorité",   step: 0.1,  hint: "Multiplicateur de la priorité utilisateur (1=urgent → +2)" },
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
    if (!window.D) window.D = {};
    if (!window.D.settings) window.D.settings = {};
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
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[c]); }
  function fmt(v, digits) { return (typeof v === "number" ? v.toFixed(digits != null ? digits : 2) : "—"); }

  function reservoirCount() {
    try {
      const A = window.AnkiAlgo;
      if (!window.D || !Array.isArray(window.D.exercices)) return 0;
      if (A && A.isReservoir) return window.D.exercices.filter(c => A.isReservoir(c)).length;
      return window.D.exercices.filter(c => c.statut === "reservoir" || c.statut === "attente").length;
    } catch (e) { return 0; }
  }
  function activeCount() {
    try {
      if (!window.D || !Array.isArray(window.D.exercices)) return 0;
      return window.D.exercices.filter(c => c.statut === "actif").length;
    } catch (e) { return 0; }
  }

  // Exemples simulés pour démontrer la formule I_R (recalculés en live)
  const SIM_CARDS = [
    { id: "X-aller-trop-tôt", intervalle: 30, joursEcoules: 12, priorite: 2, ease: 2.5, blocage: false, label: "🛌 Loin du jour J (30j, J+12)" },
    { id: "X-presque-jour-J", intervalle: 7,  joursEcoules: 6,  priorite: 2, ease: 2.5, blocage: false, label: "🟡 Approche (7j, J+6)" },
    { id: "X-jour-J",         intervalle: 5,  joursEcoules: 5,  priorite: 2, ease: 2.5, blocage: false, label: "✅ Jour J pile (5j, J+5)" },
    { id: "X-leger-retard",   intervalle: 30, joursEcoules: 33, priorite: 2, ease: 2.5, blocage: false, label: "⚠ Léger retard sur long (30j, +3j)" },
    { id: "X-petit-retard",   intervalle: 1,  joursEcoules: 2,  priorite: 2, ease: 2.5, blocage: false, label: "🔥 Petit retard agressif (1j, +1j)" },
    { id: "X-bloque",         intervalle: 2,  joursEcoules: 2,  priorite: 2, ease: 1.5, blocage: true,  label: "⚡ En blocage (ease boosté)" }
  ];

  function simulateUrgence(c) {
    const A = window.AnkiAlgo;
    if (!A) return { total: 0, raw: { IR: 0 } };
    // On reproduit urgenceScore localement sans toucher aux vraies cartes
    const C = A.getCoefs();
    const IR = c.joursEcoules / Math.max(1, c.intervalle);
    const urgenceTemps = IR <= 1
      ? Math.exp((C.K_PROCHE || 3) * (IR - 1))
      : 1 + (C.GAMMA_RETARD || 2.5) * (IR - 1);
    const priFactor = c.priorite === 1 ? 2 : c.priorite === 2 ? 1 : 0.3;
    const easeEff = c.blocage ? (C.BLOCAGE_BOOST_EASE_VAL || 1.3) : c.ease;
    const easeFactor = Math.max(0, 3 - easeEff);
    const nouveau = 0;
    const total =
      (C.W_urgenceTemps || 4) * urgenceTemps +
      (C.W_priorite     || 2) * priFactor +
      (C.W_nouveau      || 1) * nouveau +
      (C.W_ease         || 0.8) * easeFactor;
    return { total, IR, urgenceTemps, priFactor, easeFactor };
  }

  // ------------------------------------------------------------------------------
  // 4) Rendu des nœuds
  // ------------------------------------------------------------------------------
  function nodeEntreeReservoir() {
    const n = reservoirCount();
    return `
      <div class="av-node accent-input">
        <div class="av-num">1</div>
        <div class="av-node-title">📥 Entrée & Réservoir</div>
        <p class="av-node-sub">Le stock initial · isolé du moteur automatique</p>
        <div class="av-node-body">
          <p>Toute carte créée naît avec <code>statut = "reservoir"</code>. Tant qu'elle n'est pas activée explicitement, elle n'apparaît <b>jamais</b> dans une session générée — elle ne pollue pas la file, ne déclenche pas de décalage, ne pèse pas sur le budget temps.</p>
          <p style="margin-top:8px;">L'activation se fait depuis l'onglet <span class="av-tag">⏳ Réservoir</span> (un clic / sélection multiple / matière entière). Au moment de l'activation : <code>statut → "actif"</code> et <code>dateProchaineRevision = aujourd'hui</code>.</p>
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <span class="av-badge live" data-testid="viz-badge-reservoir">⏳ ${n} carte(s) en réservoir</span>
            <span class="av-badge">🟢 ${activeCount()} actives</span>
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
    return `
      <div class="av-node accent-filter">
        <div class="av-num">2</div>
        <div class="av-node-title">🎯 Sélection & Marge budget</div>
        <p class="av-node-sub">Filtre temporel · garde-fou anti-surcharge</p>
        <div class="av-node-body">
          <p>La session prend les cartes triées par urgence et les empile tant que la somme des <code>tempsCible</code> ne dépasse pas un budget plafonné.</p>
          <div class="av-formula"><b>Budget Réel</b> = Temps demandé × <b>Marge Budget</b>
= ${sessionMin} min × <b>${marge.toFixed(2)}</b>
≈ ${Math.floor(budgetReel/60)} min ${budgetReel%60}s</div>
          <div class="av-inline-input">
            <label for="avMarge">Marge Budget (0.5 → 1.0) :</label>
            <input type="number" id="avMarge" data-testid="viz-input-marge"
                   min="0.5" max="1.0" step="0.05" value="${marge.toFixed(2)}">
            <button class="av-reset" data-testid="viz-reset-marge" onclick="window._ankiVizResetMarge()">↺ 0.92</button>
          </div>
          <p style="margin-top:8px; font-size:11px; color:var(--mut);">Une marge de 0.85 signifie : « j'accepte de ne planifier que 85% du temps demandé pour garder du tampon ».</p>
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
        <div class="av-sim-name">${esc(c.label)}</div>
        <div class="av-sim-num">I_R=${fmt(r.IR, 2)}</div>
        <div class="av-sim-num">u(t)=${fmt(r.urgenceTemps, 2)}</div>
        <div class="av-sim-score">${fmt(r.total, 1)}</div>
        <div class="av-sim-bar"><div style="width:${Math.min(100, r.total / maxScore * 100).toFixed(0)}%"></div></div>
      </div>
    `).join("");
    return `
      <div class="av-node accent-core">
        <div class="av-num">3</div>
        <div class="av-node-title">🧠 Score d'urgence — Index de Délai Relatif (I_R)</div>
        <p class="av-node-sub">Le nœud central · unifie « retard » et « proximité » en une seule métrique continue</p>
        <div class="av-node-body">
          <div class="av-formula"><b>I_R</b> = Jours écoulés ÷ Intervalle prévu

· I_R &lt; 1 (en avance) → u(t) = exp(<b>K_PROCHE</b> · (I_R − 1))
· I_R = 1 (jour J)       → u(t) = 1
· I_R &gt; 1 (en retard)  → u(t) = 1 + <b>GAMMA_RETARD</b> · (I_R − 1)

<b>Score total</b> = W_urgenceTemps·u(t) + W_priorite·pri + W_ease·(3−ease) + W_nouveau·nouveau</div>

          <p><b>Pourquoi cette unification ?</b> Une carte d'1 jour qui prend 1 jour de retard (I_R = 2) doit remonter <b>plus vite</b> qu'une carte de 30 jours qui en prend 3 (I_R ≈ 1.1) — la perte relative est bien plus grande. La formule capte ça naturellement.</p>

          <h4 style="font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">Coefficients pilotables en direct</h4>
          <div class="av-coef-grid">${coefRows}</div>
          <div style="text-align:right; margin-top:6px;">
            <button class="av-reset" data-testid="viz-reset-coefs" onclick="window._ankiVizResetCoefs()">↺ Restaurer les défauts</button>
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
        <div class="av-node-title">🔀 Ordonnancement glouton — Entrelacement des matières</div>
        <p class="av-node-sub">Évite deux exercices de la même matière à la suite, respecte l'enveloppe d'urgence</p>
        <div class="av-node-body">
          <p>Une fois le pool de cartes choisi (urgence + budget), on applique un peigne glouton qui pioche à chaque tour la carte la plus urgente d'une matière <b>différente</b> de la précédente.</p>
          <p style="margin-top:6px;"><i>Si toutes les cartes restantes appartiennent à la même matière, le doublon est accepté par obligation.</i></p>

          <div class="av-interleave" data-testid="viz-interleave-demo">
            <div class="av-il-row">
              <span class="av-il-label">Entrée (urgence) :</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;border-color:#5b8def;">MA</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;border-color:#5b8def;">MA</span>
              <span class="av-il-pill" style="background:rgba(233,79,100,0.20);color:#e94f64;border-color:#e94f64;">PH</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;border-color:#5b8def;">MA</span>
              <span class="av-il-pill" style="background:rgba(66,181,107,0.20);color:#42b56b;border-color:#42b56b;">CH</span>
            </div>
            <div class="av-il-row">
              <span class="av-il-label">Sortie tressée :</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;border-color:#5b8def;">MA</span>
              <span class="av-il-arrow">→</span>
              <span class="av-il-pill" style="background:rgba(233,79,100,0.20);color:#e94f64;border-color:#e94f64;">PH</span>
              <span class="av-il-arrow">→</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;border-color:#5b8def;">MA</span>
              <span class="av-il-arrow">→</span>
              <span class="av-il-pill" style="background:rgba(66,181,107,0.20);color:#42b56b;border-color:#42b56b;">CH</span>
              <span class="av-il-arrow">→</span>
              <span class="av-il-pill" style="background:rgba(91,141,239,0.20);color:#5b8def;border-color:#5b8def;">MA</span>
            </div>
          </div>

          <p style="margin-top:10px; font-size:12px; color:var(--mut);"><b>Bénéfice cognitif :</b> l'<i>interleaving</i> améliore la rétention long terme (Rohrer &amp; Taylor 2007) — alterner des problèmes de natures différentes force le cerveau à <b>re-discriminer</b> à chaque carte au lieu d'enchaîner mécaniquement.</p>
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
        <div class="av-node-title">⏱️ Évaluation & Ease élastique</div>
        <p class="av-node-sub">Bifurcation : la note de l'étudiant règle l'intervalle ET l'urgence future</p>
        <div class="av-node-body">

          <div class="av-fork"><div class="av-fork-stem"></div></div>

          <div class="av-branches">
            <div class="av-node av-branch-good">
              <div class="av-branch-label">✅ Réussite — qScore ≥ ${C.BLOCAGE_QSCORE_VALIDATE || 8}</div>
              <p>L'intervalle progresse selon SM-2 modifié : <code>intervalle × ease × qFactor</code>.</p>
              <p>L'ease bouge peu : <code>ease ± 0.05</code> selon que tu es légèrement au-dessous ou au-dessus du seuil parfait.</p>
              <p>Si la carte était <code>_blocageActif</code>, le flag est <b>levé immédiatement</b> et le compteur revient à 0.</p>
            </div>
            <div class="av-node av-branch-bad">
              <div class="av-branch-label">⚡ Blocage — qScore ≤ ${C.BLOCAGE_QSCORE_TRIGGER || 3}</div>
              <p><b>Anti-Ease-Hell :</b> l'ease ne baisse que de <code>${C.EASE_DROP_FAIL != null ? C.EASE_DROP_FAIL : 0.05}</code> (au lieu des −0.20 d'Anki vanilla).</p>
              <p>On pose le flag <code>_blocageActif = true</code>. Tant qu'il est actif, <b>urgenceScore</b> calcule comme si <code>ease = ${C.BLOCAGE_BOOST_EASE_VAL || 1.3}</code> → la carte est propulsée en tête de file dès J+1 / J+2.</p>
              <p>Le flag est levé à la première note ≥ <b>${C.BLOCAGE_QSCORE_VALIDATE || 8}</b> OU après <b>${C.BLOCAGE_TIMEOUT_REV || 5}</b> tentatives infructueuses (timeout pour éviter un blocage éternel).</p>
            </div>
          </div>

          <h4 style="font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">Paramètres de l'ease élastique</h4>
          <div class="av-coef-grid">${blocRows}</div>
          <p style="margin-top:10px; font-size:12px; color:var(--mut);"><b>Idée clé :</b> on découple le <i>traitement temporaire</i> (boost via flag) de la <i>baisse durable</i> (ease persistant). Une carte longue qui bloque ne revient pas à vie sur ta tête, mais elle revient <b>vite</b> jusqu'à ce que tu la maîtrises.</p>
        </div>
      </div>
    `;
  }

  function nodePersistanceSecurite() {
    return `
      <div class="av-node accent-safe">
        <div class="av-num">6</div>
        <div class="av-node-title">🛡️ Persistance & Sécurité — Le droit à l'erreur</div>
        <p class="av-node-sub">Deux garde-fous pour ne jamais perdre ton flux de révision</p>
        <div class="av-node-body">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div style="background:rgba(91,141,239,0.10); border:1px solid rgba(91,141,239,0.35); border-radius:8px; padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#5b8def; font-weight:700;">📌 Session figée</div>
              <p style="margin:6px 0 0; font-size:12px;">Le bouton <span class="av-tag">📌 Générer la session du soir</span> écrit <code>window.D.sessionEnCours</code> dans la base. La file <code>S.queue</code> survit à un changement d'onglet, à un refresh navigateur, à une fermeture d'app. Le bandeau <span class="av-tag">▶ Reprendre</span> apparaît au retour.</p>
              <p style="margin:6px 0 0; font-size:11px; color:var(--mut);"><b>Chrono auto-pause :</b> sur <code>visibilitychange</code> (tu changes d'onglet navigateur) ET sur changement de vue Anki interne.</p>
            </div>
            <div style="background:rgba(255,170,51,0.10); border:1px solid rgba(255,170,51,0.40); border-radius:8px; padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#ffaa33; font-weight:700;">↺ Bouton Undo</div>
              <p style="margin:6px 0 0; font-size:12px;">Avant CHAQUE écriture en base, un deep-clone de la carte est mis dans <code>S.dernierExerciceModifie</code>.</p>
              <p style="margin:6px 0 0; font-size:12px;">Un clic sur <span class="av-tag">↺ Annuler la dernière notation</span> :</p>
              <ul style="padding-left:18px; margin:4px 0; font-size:12px;">
                <li>Restaure la carte (ease, intervalle, repetitions, flag blocage, historique)</li>
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
        <h3>📚 Pourquoi Synchrotron v4 — fondements scientifiques</h3>

        <h4>1. L'unification par l'Index de Délai Relatif (I_R)</h4>
        <p>Les implémentations classiques de la répétition espacée (SM-2, Anki vanilla) utilisent deux notions disjointes : le <b>retard absolu</b> (en jours) et la <b>proximité de l'échéance</b>. Le résultat est une discontinuité au jour J et une difficulté à comparer deux retards de natures différentes.</p>
        <p>L'<b>Index de Délai Relatif</b> <code>I_R = Δt / I</code> ramène tout sur la même échelle. Une carte d'intervalle 1 jour avec 1 jour de retard a un <code>I_R = 2</code>, ce qui signifie que <i>la moitié de sa vie utile a été consommée par l'attente</i>. Une carte d'intervalle 30 jours avec 3 jours de retard a un <code>I_R = 1.1</code>, soit <i>seulement 10% au-delà</i>. La formule <code>1 + γ·(I_R − 1)</code> traduit fidèlement cette intuition : <b>les petits intervalles en retard montent plus vite que les grands</b>, ce qui est exactement ce qu'on veut.</p>
        <p>En zone <code>I_R &lt; 1</code> (en avance), la décroissance exponentielle <code>exp(K·(I_R − 1))</code> garantit une courbe lisse et monotone : pas de saut brutal au jour J. Les cartes émergent doucement.</p>

        <h4>2. La flexibilité cognitive par l'entrelacement (interleaving)</h4>
        <p>Rohrer &amp; Taylor (2007) ont démontré que pour les apprentissages procéduraux complexes (mathématiques, physique), <b>l'entrelacement bat le blocage par catégorie</b> de 43% sur la rétention long terme. L'enchaînement mécanique de problèmes similaires crée une illusion de fluidité (« blocked practice ») qui ne survit pas au transfert vers d'autres contextes.</p>
        <p>L'algorithme glouton de Synchrotron v4 préserve l'enveloppe d'urgence (les cartes les plus pressantes restent prioritaires) tout en cassant la monotonie matière : <code>MA → PH → MA → CH → MA</code> au lieu de <code>MA → MA → MA → PH → CH</code>. Le coût de switch entre matières force la <b>re-discrimination active</b> à chaque carte.</p>

        <h4>3. La préservation de la mémoire long terme — l'élasticité de l'ease</h4>
        <p>Anki vanilla baisse l'<code>ease</code> de 0.20 à chaque échec, ce qui condamne progressivement les cartes difficiles à des intervalles ridiculement courts (l'<b>Ease Hell</b>). C'est mathématiquement insoutenable : une carte longue qui bloque une fois revient à vie sur la tête de l'utilisateur.</p>
        <p>Synchrotron v4 sépare deux échelles de temps :</p>
        <ul>
          <li><b>Court terme (boost) :</b> le flag <code>_blocageActif</code> propulse temporairement la carte en haut de la file via un <code>ease</code> virtuel à 1.3. Elle revient J+1, J+2, jusqu'à validation.</li>
          <li><b>Long terme (ease persistant) :</b> baisse de fond de seulement <code>0.05</code>, ce qui préserve l'historique macro et empêche la dégénérescence.</li>
        </ul>
        <p>Le timeout (<code>BLOCAGE_TIMEOUT_REV</code>) garantit qu'aucune carte ne reste éternellement boostée : après N tentatives infructueuses, on libère le flag et on laisse le calcul standard reprendre. C'est une boucle de sécurité, pas une condamnation.</p>

        <h4>4. Pourquoi le réservoir strict ?</h4>
        <p>Les bases Anki classiques mélangent « nouvelles cartes » et cartes dues, ce qui crée un effet pervers : créer trop de cartes en avance pour les concours rend les sessions ingérables (60+ cartes en attente). En isolant strictement le réservoir, l'utilisateur garde la <b>maîtrise consciente</b> de ce qui entre en révision. C'est aussi compatible avec un workflow papier : créer une carte = simplement noter qu'un exercice du livre existe, sans engagement.</p>

        <p style="margin-top:18px; font-size:11px; color:var(--mut); text-align:center;">Synchrotron v4 · Carte mentale générée à la volée — toutes les valeurs ci-dessus sont en direct depuis l'état réel de l'application.</p>
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
      if (root) root.innerHTML = '<div style="padding:40px; text-align:center; color:var(--mut);">⚠️ <code>anki-algo.js</code> doit être chargé avant <code>anki-viz.js</code>.</div>';
      return;
    }
    const root = document.getElementById("paneAnkiViz");
    if (!root) return;
    root.innerHTML = `
      <div class="av-wrap" data-testid="viz-root">
        <div class="av-head">
          <h2>🗺 Carte mentale Synchrotron v4</h2>
          <p>Cycle de vie d'une carte · de la création au verdict · contrôles en direct</p>
        </div>

        ${nodeEntreeReservoir()}
        <div class="av-link"></div>
        ${nodeBudgetMarge()}
        <div class="av-link"></div>
        ${nodeUrgenceIR()}
        <div class="av-link"></div>
        ${nodeEntrelacement()}
        <div class="av-link"></div>
        ${nodeEvaluationEase()}
        <div class="av-link"></div>
        ${nodePersistanceSecurite()}

        ${explainSection()}
      </div>
    `;
    bindLiveControls();
  };

  function bindLiveControls() {
    // Marge budget
    const m = document.getElementById("avMarge");
    if (m) m.addEventListener("input", e => {
      let v = parseFloat(e.target.value);
      if (isNaN(v)) return;
      v = Math.max(0.5, Math.min(1.0, v));
      if (!window.D) window.D = {};
      if (!window.D.settings) window.D.settings = {};
      window.D.settings.margeBudget = v;
      if (typeof window.save === "function") window.save();
      // refresh just the budget node sentence to reflect the new value
      const sessionMin = (window.D.settings.ankiSessionMin) || 60;
      const budgetSec = Math.round(sessionMin * v * 60);
      const formulaEl = e.target.closest(".av-node-body").querySelector(".av-formula");
      if (formulaEl) {
        formulaEl.innerHTML = `<b>Budget Réel</b> = Temps demandé × <b>Marge Budget</b>\n= ${sessionMin} min × <b>${v.toFixed(2)}</b>\n≈ ${Math.floor(budgetSec/60)} min ${budgetSec%60}s`;
      }
    });
  }

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
        <div class="av-sim-name">${esc(c.label)}</div>
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

/* =============================================================================================
 * 🔧 INSTRUCTIONS D'INTÉGRATION (à faire UNE seule fois dans ton repo)
 * =============================================================================================
 *
 *  ── 1) Dans index.html — ajoute le bouton d'onglet ───────────────────────────────────────────
 *  Après la ligne :
 *      <button class="tab" onclick="window.switchTab('anki')" data-tab="anki" style="color:#b06af7;">🧬 Synchrotron</button>
 *  Insère :
 *      <button class="tab" onclick="window.switchTab('ankiViz')" data-tab="ankiViz" style="color:#ffaa33;">🗺 Carte mentale</button>
 *
 *  ── 2) Dans index.html — ajoute le pane ──────────────────────────────────────────────────────
 *  Après la ligne :
 *      <div class="pane" id="paneAnki"></div>
 *  Insère :
 *      <div class="pane" id="paneAnkiViz"></div>
 *
 *  ── 3) Dans index.html — charge le script ────────────────────────────────────────────────────
 *  Dans le bloc qui charge déjà anki-algo.js / anki-app.js / anki-quick.js
 *  (vers la ligne 620+, dans le bootstrap des scripts) — ajoute APRÈS anki-app.js :
 *      const scriptAnkiViz = document.createElement('script');
 *      scriptAnkiViz.src = 'anki-viz.js?v=' + v;
 *      document.body.appendChild(scriptAnkiViz);
 *
 *  ── 4) Dans app.js — branche l'onglet ────────────────────────────────────────────────────────
 *  Dans la fonction `window.switchTab`, dans l'objet `map`, ajoute la ligne :
 *      ankiViz: 'paneAnkiViz',
 *  Puis dans la cascade `if (tab === ...)` plus bas, ajoute :
 *      if (tab === 'ankiViz' && typeof window.renderAnkiViz === 'function') window.renderAnkiViz();
 *
 *  → C'est tout. Aucune modification de anki-algo.js, anki-app.js, anki-quick.js requise.
 * ============================================================================================= */
