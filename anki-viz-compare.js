/**
 * anki-viz-compare.js — Comparaison côte à côte Synchrotron v1 vs V2
 */
(function () {
  const esc = s => window.escHtml(s);

  window.renderAnkiCompare = function () {
    const root = document.getElementById("paneAnkiCompare");
    if (!root) return;
    const A1 = window.AnkiAlgo;
    const A2 = window.AnkiAlgoV2;
    const cards = (A2 && A2.allCards) ? A2.allCards(window.D) : [];
    const sample = cards.filter(c => A2 && A2.isActive(c) && A2.cardKind(c) === "main").slice(0, 5);
    const today = A2 ? A2.todayISO() : "";

    let sampleRows = "";
    if (sample.length && A1 && A2) {
      sampleRows = sample.map(c => {
        const u1 = A1.urgenceScore ? A1.urgenceScore(c, today).total : "—";
        const p2 = A2.priorityScore(c, today);
        return `<tr><td>${esc(c.id)}</td><td>${typeof u1 === "number" ? u1.toFixed(1) : u1}</td><td><b>${p2.priority.toFixed(0)}</b></td><td>${p2.raw.phase}</td><td>${p2.raw.windowState}</td></tr>`;
      }).join("");
    }

    root.innerHTML = `
      <div class="av-compare-head">
        <h2>${window.iconLabel('git-compare', 'Synchrotron v1 vs V2')}</h2>
        <p class="anki-mut">Mêmes cartes · deux moteurs · tu testes celui qui te convient.</p>
      </div>
      <div class="av-compare-grid">
        <div class="av-compare-col">
          <h3>${window.iconLabel('dna', 'V1 — actuel')}</h3>
          <ul>
            <li>Score d'urgence composite (I_R + ★ + ease + nouveau)</li>
            <li>Coefficients <code>W_*</code>, <code>K_PROCHE</code>, <code>GAMMA_RETARD</code></li>
            <li>Session = tri par score + phases devoir / main / Y-</li>
            <li>Onglet <b>Synchrotron</b></li>
          </ul>
          <button class="bp" onclick="window.switchTab('anki')">${window.iconLabel('arrow-right', 'Ouvrir V1')}</button>
          <button class="bs" onclick="window.switchTab('ankiViz')">${window.iconLabel('map', 'Carte mentale V1')}</button>
        </div>
        <div class="av-compare-col" style="border-color:var(--gold);">
          <h3>${window.iconLabel('sparkles', 'V2 — beta')}</h3>
          <ul>
            <li>Ta note → ease / intervalle (même moteur SM-2)</li>
            <li>★ = fenêtres de révision (toutes les étoiles)</li>
            <li>Phases : apprentissage → consolidation → mature</li>
            <li>Priorité unique (retard → fenêtre → ★ → ease)</li>
            <li>★ = fenêtres de révision (doc : onglet Carte V2)</li>
            <li>Onglet <b>Synchrotron V2</b></li>
          </ul>
          <button class="bp" style="background:var(--gold);color:#1a2030;" onclick="window.switchTab('ankiV2')">${window.iconLabel('arrow-right', 'Ouvrir V2')}</button>
          <button class="bs" onclick="window.switchTab('ankiVizV2')">${window.iconLabel('map', 'Carte mentale V2')}</button>
        </div>
      </div>
      ${sampleRows ? `
      <div class="anki-card-block" style="margin-top:16px;">
        <h3>Échantillon live (5 cartes X- actives)</h3>
        <table class="av-compare-table">
          <thead><tr><th>Carte</th><th>Score v1 (urgence)</th><th>Priorité v2</th><th>Phase</th><th>Fenêtre</th></tr></thead>
          <tbody>${sampleRows}</tbody>
        </table>
      </div>` : '<p class="anki-mut">Charge des cartes actives pour voir un échantillon comparatif.</p>'}
    `;
    if (window.hydrateIcons) window.hydrateIcons(root);
  };
})();
