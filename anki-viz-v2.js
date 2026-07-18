/**
 * anki-viz-v2.js — Carte mentale Synchrotron V2 (fenêtres ★, priorité, phases)
 * Documentation interactive · même style glass que V1 · moteur AnkiAlgoV2
 */
(function () {
  "use strict";

  function injectStyles() {
    if (document.getElementById("anki-viz-v2-styles")) return;
    const css = `
      #paneAnkiVizV2 .av-wrap {
        max-width: 980px; margin: 0 auto; padding: 24px 16px 80px;
        display: flex; flex-direction: column; align-items: stretch; gap: 0;
      }
      #paneAnkiVizV2 .av-head { text-align: center; margin-bottom: 12px; }
      #paneAnkiVizV2 .av-head h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em; color: var(--txt); }
      #paneAnkiVizV2 .av-head p { color: var(--mut); margin: 6px 0 0; font-size: 13px; max-width: 640px; margin-left: auto; margin-right: auto; line-height: 1.5; }
      #paneAnkiVizV2 .av-v2-banner {
        margin: 0 auto 20px; max-width: 720px; padding: 12px 16px; border-radius: 12px;
        background: rgba(255,200,80,0.08); border: 1px solid rgba(255,200,80,0.35);
        font-size: 13px; line-height: 1.55; text-align: left;
      }
      #paneAnkiVizV2 .av-node {
        position: relative;
        background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%, transparent 48%),
          linear-gradient(220deg, rgba(91,154,255,0.07) 0%, transparent 55%), rgba(155,185,255,0.055);
        backdrop-filter: blur(32px) saturate(1.9); -webkit-backdrop-filter: blur(32px) saturate(1.9);
        border: 0.5px solid rgba(130,165,255,0.18); border-radius: 14px; padding: 16px 18px;
        color: var(--txt);
        box-shadow: inset 0 1px 0 rgba(195,215,255,0.16), inset 0 0 24px rgba(91,154,255,0.04), 0 4px 28px rgba(0,0,0,0.22);
      }
      #paneAnkiVizV2 .av-node.accent-gold { border-color: rgba(255,200,80,0.35); }
      #paneAnkiVizV2 .av-node.accent-core { border-color: rgba(168,138,240,0.32); }
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
        align-self: center; width: 2px; height: 38px;
        background: linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.08));
      }
      #paneAnkiVizV2 .av-formula {
        font-family: 'Menlo','Consolas',monospace; background: rgba(0,0,0,0.30);
        border: 1px dashed rgba(255,255,255,0.18); padding: 10px 14px; border-radius: 8px;
        margin: 10px 0; font-size: 13px; color: rgba(255,255,255,0.82); white-space: pre-wrap;
      }
      #paneAnkiVizV2 .av-tag {
        display: inline-block; padding: 2px 8px; border-radius: 6px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
        font-size: 11px; color: var(--mut); margin-right: 4px;
      }
      #paneAnkiVizV2 .av-coef-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 8px; margin: 8px 0; }
      #paneAnkiVizV2 .av-coef-card {
        background: rgba(10,14,28,0.28); border: 0.5px solid rgba(130,165,255,0.16);
        border-radius: 10px; padding: 8px 10px;
      }
      #paneAnkiVizV2 .av-coef-card label { font-size: 11px; color: var(--mut); font-family: monospace; }
      #paneAnkiVizV2 .av-coef-card input, #paneAnkiVizV2 .av-coef-card select {
        background: rgba(0,0,0,0.30); border: 1px solid rgba(255,255,255,0.20);
        color: var(--txt); padding: 6px 8px; border-radius: 6px; font-size: 13px; width: 100%;
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
      #paneAnkiVizV2 .av-reset {
        background: transparent; border: 1px solid rgba(255,255,255,0.25);
        color: var(--mut); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
      }
      #paneAnkiVizV2 .av-sim-row {
        display: grid; grid-template-columns: 1fr 90px 90px 70px 1fr; gap: 8px; align-items: center;
        padding: 6px 0; border-bottom: 1px dashed rgba(255,255,255,0.08); font-size: 12px;
      }
      #paneAnkiVizV2 .av-sim-bar { height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
      #paneAnkiVizV2 .av-sim-bar div { height: 100%; background: linear-gradient(90deg, #5b8def, #a88af0); border-radius: 4px; }
      #paneAnkiVizV2 .av-star-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
      #paneAnkiVizV2 .av-star-table th, #paneAnkiVizV2 .av-star-table td {
        padding: 6px 10px; border-bottom: 0.5px solid rgba(255,255,255,0.10); text-align: left;
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
      #paneAnkiVizV2 .av-branches { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 8px; }
      @media (max-width: 640px) { #paneAnkiVizV2 .av-branches { grid-template-columns: 1fr; } }
      #paneAnkiVizV2 .av-branch-good { border-color: rgba(92,212,154,0.42) !important; }
      #paneAnkiVizV2 .av-branch-bad { border-color: rgba(240,112,112,0.42) !important; }
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

  /** Cartes simulées pour la priorité V2 */
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
      statut: "actif", repetitions: sim.phase === "learning" ? 1 : sim.phase === "consolidation" ? 5 : 12,
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

  function starWindowRows() {
    const A = A2();
    if (!A) return "";
    const scale = A.horizonScale();
    const horizon = v2Settings().horizon === "2y" ? "2 ans (cycle)" : "1 an (redouble)";
    return [5, 4, 3, 2, 1].map(stars => {
      const w = A.scaledWindow(stars);
      const base = A.STAR_WINDOWS[stars];
      return `<tr>
        <td>★${stars}</td>
        <td>${w.openAfter} j</td>
        <td>${w.width} j</td>
        <td style="color:var(--mut);font-size:11px;">base ${base.openAfter}+${base.width} · ×${scale.toFixed(2)}</td>
      </tr>`;
    }).join("") + `<tr><td colspan="4" style="font-size:11px;color:var(--mut);padding-top:8px;">Horizon actuel : <b>${horizon}</b></td></tr>`;
  }

  function nodeIntro() {
    return `
      <div class="av-v2-banner">
        <b>V2 en une phrase :</b> ta note fixe <i>quand</i> la carte revient (SM-2) · les ★ fixent <i>dans quelle fenêtre</i> elle doit repasser · le soir, l'algo prend le <b>haut du classement « prio »</b> sans que tu choisisses.<br><br>
        <b>Ce qui a disparu vs V1 :</b> plus de score d'urgence composite (I_R + 6 coefficients W_*). Un seul nombre <code>prio</code> pour trier la session.
      </div>
    `;
  }

  function nodePiles() {
    const A = A2();
    let devoir = 0, main = 0, quick = 0, reservoir = 0;
    if (window.D && A) {
      (window.D.devoirs || []).forEach(c => { if (c.statut === "actif") devoir++; });
      (window.D.exercices || []).forEach(c => {
        if (A.isReservoir(c)) reservoir++;
        else if (c.statut === "actif") {
          const k = A.cardKind(c);
          if (k === "quick") quick++; else if (k === "main") main++;
        }
      });
    }
    return `
      <div class="av-node">
        <div class="av-num">1</div>
        <div class="av-node-title">${window.iconLabel('download', 'Les cartes — 3 piles + réservoir')}</div>
        <p class="av-node-sub">Mêmes données que V1 · règles différentes pour choisir la session</p>
        <div class="av-node-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            <div style="padding:12px;border-radius:10px;background:rgba(233,79,100,0.1);border:1px solid rgba(233,79,100,0.35);">
              <div style="font-size:11px;color:#e94f64;font-weight:700;">W- DEVOIRS</div>
              <div style="font-size:22px;font-weight:700;">${devoir}</div>
              <p style="font-size:12px;margin:6px 0 0;">Agenda calendaire · pas de fenêtres ★ · priorité = date limite</p>
            </div>
            <div style="padding:12px;border-radius:10px;background:rgba(66,181,107,0.1);border:1px solid rgba(66,181,107,0.35);">
              <div style="font-size:11px;color:#42b56b;font-weight:700;">X- PRINCIPALES</div>
              <div style="font-size:22px;font-weight:700;">${main}</div>
              <p style="font-size:12px;margin:6px 0 0;">Cœur V2 : phases + fenêtres ★ + tri par <code>prio</code></p>
            </div>
            <div style="padding:12px;border-radius:10px;background:rgba(91,141,239,0.1);border:1px solid rgba(91,141,239,0.35);">
              <div style="font-size:11px;color:#5b8def;font-weight:700;">Y- RAPIDES</div>
              <div style="font-size:22px;font-weight:700;">${quick}</div>
              <p style="font-size:12px;margin:6px 0 0;">Midi = onglet Rapide · soir = tissées entre les X-</p>
            </div>
          </div>
          <p style="margin-top:12px;font-size:12px;"><span class="av-tag">${window.iconLabel('hourglass', reservoir + ' en réservoir')}</span> Les X- naissent en réservoir — tu actives quand tu veux. Pas d'injection auto de nouvelles cartes.</p>
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

    return `
      <div class="av-node accent-gold">
        <div class="av-num">2</div>
        <div class="av-node-title">${window.iconLabel('moon', 'Ton soir — sans réfléchir')}</div>
        <p class="av-node-sub">Durée réglable chaque soir · pas de quota forcé les soirs DM</p>
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
            <label><input type="checkbox" id="av2PullForward" ${pull ? "checked" : ""}> Avancer si budget large</label>
          </div>

          <h4 style="font-size:11px;color:var(--mut);text-transform:uppercase;margin:16px 0 8px;">Ordre de remplissage</h4>
          <ol style="padding-left:20px;font-size:13px;line-height:1.7;">
            <li><b>W- forcés</b> — urgence calendaire ≥ ${seuil} (DM/colle imminent). Depuis l'Agenda tu peux aussi lancer un DM seul.</li>
            <li><b>X-/Y- éligibles ce soir</b> — retard ou fenêtre active (+ « bientôt » si tu as du temps et pullForward coché).</li>
            <li><b>Tri</b> — toujours par <code>prio</code> décroissant (voir nœud 3).</li>
            <li><b>Tissage</b> — Y- courtes entre les X- longs.</li>
          </ol>
          <p style="font-size:12px;color:var(--mut);margin-top:10px;">Soirée DM courte ? Lance le devoir depuis l'Agenda, mets 30 min — pas de remplissage forcé derrière. Soirée longue ? L'algo peut avancer des cartes « soon ».</p>
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
        <div><span class="av-phase-pill av-phase-${c.phase}">${c.phase}</span></div>
        <div class="av-win-${c.ws}">${c.ws}</div>
        <div><b>${fmt(sc.priority, 0)}</b></div>
        <div class="av-sim-bar"><div style="width:${Math.min(100, sc.priority / maxP * 100).toFixed(0)}%"></div></div>
      </div>
    `).join("");

    return `
      <div class="av-node accent-core">
        <div class="av-num">3</div>
        <div class="av-node-title">${window.iconLabel('layout-list', 'Priorité — le seul score de tri')}</div>
        <p class="av-node-sub">Affiché sur chaque carte : <code>prio 5200 · mature · ★5 · …</code></p>
        <div class="av-node-body">
          <div class="av-formula"><b>prio</b> = somme simple (pas de coefficients à régler)

① Retard        → +10 000 + 100 × jours de retard
② Fenêtre active → +5 000 (+ bonus si fin de fenêtre proche)
③ Bientôt (soon) → +2 000  (seulement si pullForward)
④ Importance ★  → +200 × étoiles (1→5)
⑤ Ease bas      → +(2,8 − ease) × 60</div>

          <p><b>Lecture :</b> une carte en retard domine toujours. Dans la fenêtre active, ★5 monte au-dessus de ★2. L'ease bas départage à priorité égale — carte difficile = revue plus tôt.</p>

          <h4 style="font-size:11px;color:var(--mut);text-transform:uppercase;margin:14px 0 6px;">Simulation — 6 situations</h4>
          <div data-testid="viz-v2-sim">${rows}</div>
          <p style="font-size:11px;color:var(--mut);margin-top:8px;">Barres normalisées sur la carte la plus prioritaire du lot.</p>
        </div>
      </div>
    `;
  }

  function nodeFenetresPhases() {
    return `
      <div class="av-node accent-gold">
        <div class="av-num">4</div>
        <div class="av-node-title">${window.iconLabel('star', 'Étoiles = fenêtres · Phases = maturité')}</div>
        <p class="av-node-sub">Les ★ ne pondèrent plus 4 axes — elles définissent quand la carte redevient « due » sur le long terme</p>
        <div class="av-node-body">
          <h4 style="font-size:11px;color:var(--mut);text-transform:uppercase;">Les 3 phases</h4>
          <ul style="font-size:13px;line-height:1.65;">
            <li><span class="av-phase-pill av-phase-learning">learning</span> — rep &lt; 3 ou ease &lt; 2,2 · intervalles serrés (SM-2 classique)</li>
            <li><span class="av-phase-pill av-phase-consolidation">consolidation</span> — rep 3–7 · encore des paliers</li>
            <li><span class="av-phase-pill av-phase-mature">mature</span> — rep ≥ 8 · <b>fenêtres ★</b> : la carte s'ouvre, tu peux la revoir n'importe quand dans l'intervalle, pas obligé le 1er jour</li>
          </ul>

          <h4 style="font-size:11px;color:var(--mut);text-transform:uppercase;margin-top:14px;">Fenêtres par étoile (horizon actuel)</h4>
          <table class="av-star-table">
            <thead><tr><th>★</th><th>Ouverture après succès</th><th>Largeur fenêtre</th><th>Détail</th></tr></thead>
            <tbody>${starWindowRows()}</tbody>
          </table>

          <div class="av-formula" style="margin-top:14px;"><b>Exemple ★5 (horizon 1 an) :</b>
Après une bonne note en phase mature → prochaine révision planifiée ~J+11
Fenêtre ouverte ~28 jours → tu peux la voir tomber n'importe quand dedans
Si tu la rates après la fin de fenêtre → <span class="av-win-overdue">overdue</span> → prio explose</div>

          <p style="font-size:12px;margin-top:10px;"><b>États fenêtre :</b>
            <span class="av-win-overdue">overdue</span> retard ·
            <span class="av-win-active">active</span> dedans ·
            <span class="av-win-soon">soon</span> dans ~3 j ·
            <span class="av-win-later">later</span> pas encore</p>
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

    return `
      <div class="av-node">
        <div class="av-num">5</div>
        <div class="av-node-title">${window.iconLabel('brain', 'Mémoire — ta note → intervalle (SM-2)')}</div>
        <p class="av-node-sub">Partagé avec V1 · indépendant du tri « prio » du soir</p>
        <div class="av-node-body">
          <p>Quand tu notes une carte, le moteur met à jour <code>ease</code>, <code>intervalle</code>, <code>repetitions</code>, <code>dateProchaineRevision</code>. En phase mature, V2 ajoute aussi <code>_v2WindowOpen</code> / <code>_v2WindowClose</code>.</p>
          <div class="av-formula">qScore ≤ 3 → reset (intervalle 0, revient vite)
qScore 4–10 → intervalle × ease × qFactor × pénalité chrono
V2 mature + succès → date = début fenêtre ★</div>
          <h4 style="font-size:11px;color:var(--mut);margin:12px 0 6px;">Paliers par profil (début de vie carte)</h4>
          <div class="av-coef-grid">${profileRows || "—"}</div>
        </div>
      </div>
    `;
  }

  function nodeEvaluation() {
    const C = A2() ? A2().getCoefs() : {};
    const blocRows = BLOCAGE_SPEC.map(s => `
      <div class="av-coef-card">
        <label>${esc(s.key)}</label>
        <input type="number" step="${s.step}" value="${C[s.key] != null ? C[s.key] : ""}"
               oninput="window._ankiVizV2Coef('${esc(s.key)}', this.value)">
      </div>
    `).join("");

    return `
      <div class="av-node">
        <div class="av-num">6</div>
        <div class="av-node-title">${window.iconLabel('timer', 'Notation & ease élastique')}</div>
        <p class="av-node-sub">Échec = ease baisse + flag _blocageActif → prio haute jusqu'à réussite</p>
        <div class="av-node-body">
          <div class="av-branches">
            <div class="av-node av-branch-good">
              <b style="color:#5cd49a;">Réussite ≥ ${C.BLOCAGE_QSCORE_VALIDATE || 8}</b>
              <p style="font-size:12px;margin:8px 0 0;">Intervalle progresse · fenêtre ★ recalculée si mature · blocage levé</p>
            </div>
            <div class="av-node av-branch-bad">
              <b style="color:#f07070;">Échec ≤ ${C.BLOCAGE_QSCORE_TRIGGER || 3}</b>
              <p style="font-size:12px;margin:8px 0 0;">Ease −${C.EASE_DROP_FAIL || 0.2} · _blocageActif → remonte en tête via <code>prio</code> (plus via un score I_R séparé)</p>
            </div>
          </div>
          <h4 style="font-size:11px;color:var(--mut);margin:14px 0 6px;">Paramètres blocage (partagés V1/V2)</h4>
          <div class="av-coef-grid">${blocRows}</div>
        </div>
      </div>
    `;
  }

  function nodeModes() {
    return `
      <div class="av-node">
        <div class="av-num">7</div>
        <div class="av-node-title">${window.iconLabel('mouse-pointer-click', 'Modes d\'usage')}</div>
        <div class="av-node-body">
          <ul style="font-size:13px;line-height:1.7;">
            <li><b>Auto (Cockpit)</b> — l'algo remplit la session · tu lances Play</li>
            <li><b>Manuel</b> — tu coches · tri par prio · ordre libre</li>
            <li><b>Play chapitre</b> — filtre un cours → toutes les cartes actives du chapitre, tri prio</li>
            <li><b>Agenda / DM</b> — devoir seul ou forcé si date proche · durée à la carte</li>
            <li><b>Rapide (midi)</b> — onglet Y- · hors Synchrotron</li>
          </ul>
          <p style="font-size:12px;color:var(--mut);">Session figée dans <code>D.sessionEnCoursV2</code> · Undo disponible · compare avec V1 via l'onglet <b>v1 vs V2</b>.</p>
        </div>
      </div>
    `;
  }

  function explainSection() {
    return `
      <section class="anki-explain-wrap" style="margin-top:24px;">
        <h3>${window.iconLabel('book-open', 'Résumé V2 vs V1')}</h3>
        <table class="av-star-table" style="margin-top:10px;">
          <thead><tr><th></th><th>V1 (Synchrotron)</th><th>V2 (Sync. V2)</th></tr></thead>
          <tbody>
            <tr><td>Tri session X-</td><td>Score urgence (I_R + coefs)</td><td><b>prio</b> unique</td></tr>
            <tr><td>Rôle des ★</td><td>Poids dans le score + intervalles</td><td><b>Fenêtres</b> de révision long terme</td></tr>
            <tr><td>Coefficients W_*</td><td>6+ réglages</td><td><b>Aucun</b> pour le tri</td></tr>
            <tr><td>Soirée DM</td><td>Idem</td><td>Pas de quota · lance depuis Agenda</td></tr>
            <tr><td>Données</td><td colspan="2" style="text-align:center;">Mêmes cartes Firebase · deux moteurs en parallèle</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:var(--mut);margin-top:14px;text-align:center;">Synchrotron V2 · carte mentale · ${new Date().toLocaleDateString("fr-FR")}</p>
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
    });
    bindNum("av2Marge", el => {
      let v = parseFloat(el.value);
      if (isNaN(v) || !window.D) return;
      v = Math.max(0.5, Math.min(1, v));
      if (!window.D.settings) window.D.settings = {};
      window.D.settings.margeBudget = v;
      if (typeof window.save === "function") window.save();
    });
    const hz = document.getElementById("av2Horizon");
    if (hz) hz.addEventListener("change", () => {
      if (!window.D.settings.algoV2) window.D.settings.algoV2 = {};
      window.D.settings.algoV2.horizon = hz.value;
      if (typeof window.save === "function") window.save();
      window.renderAnkiVizV2();
    });
    const pf = document.getElementById("av2PullForward");
    if (pf) pf.addEventListener("change", () => {
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
          <h2>${window.iconLabel('map', 'Carte mentale — Synchrotron')}</h2>
          <p>Comment l'algo choisit tes cartes le soir · fenêtres ★ · priorité · phases · sans coefficients d'urgence</p>
        </div>
        ${nodeIntro()}
        ${nodePiles()}
        <div class="av-link"></div>
        ${nodeSoir()}
        <div class="av-link"></div>
        ${nodePriorite()}
        <div class="av-link"></div>
        ${nodeFenetresPhases()}
        <div class="av-link"></div>
        ${nodeMemoire()}
        <div class="av-link"></div>
        ${nodeEvaluation()}
        <div class="av-link"></div>
        ${nodeModes()}
        ${explainSection()}
      </div>
    `;
    bindControls();
    if (window.hydrateIcons) window.hydrateIcons(root);
  };
})();
