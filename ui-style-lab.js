/**
 * Labo Styles Finder — dans l'onglet Test Finder (thème Classique inchangé).
 */
window.FINDER_PRESETS = [
  { id: '1', name: 'Photos', desc: 'Comme Apple Photos : pilule grise, texte couleur principale, zéro bordure.' },
  { id: '2', name: 'Blanc', desc: 'Texte clair sur pilule discrète, boutons très neutres.' },
  { id: '3', name: 'Accent', desc: 'Pilule légèrement teintée avec la couleur principale des paramètres.' },
  { id: '4', name: 'Flou', desc: 'Sidebar vitrée + flou léger, même minimalisme sur les pilules.' },
  { id: '5', name: 'Plat', desc: 'Ultra épuré, fond quasi opaque, aucun effet décoratif.' }
];

window.FINDER_BACKDROP_TONES = [
  { id: 'soft', name: 'Doux', desc: 'Dégradés atténués, moins agressif.' },
  { id: 'neutral', name: 'Neutre', desc: 'Graphite équilibré, sobre.' },
  { id: 'deep', name: 'Profond', desc: 'Tons sombres avec vignette naturelle.' },
  { id: 'warm', name: 'Chaud', desc: 'Légère teinte ambrée.' },
  { id: 'accent', name: 'Accent', desc: 'Glow bleu plus visible (défaut Classique).' }
];

window.FINDER_BACKDROP_VIGNETTES = [
  { id: 'off', name: 'Aucune', desc: 'Fond plat, sans assombrissement des bords.' },
  { id: 'light', name: 'Légère', desc: 'Vignette douce pour adoucir les bords.' },
  { id: 'medium', name: 'Moyenne', desc: 'Encadrement plus marqué, effet cinéma.' }
];

window.normalizeFinderPreset = function (id) {
  const s = String(id == null ? '1' : id);
  return window.FINDER_PRESETS.some(p => p.id === s) ? s : '1';
};

window.normalizeFinderBackdropTone = function (id) {
  const s = String(id == null ? 'soft' : id);
  return window.FINDER_BACKDROP_TONES.some(t => t.id === s) ? s : 'soft';
};

window.normalizeFinderBackdropVignette = function (id) {
  const s = String(id == null ? 'light' : id);
  return window.FINDER_BACKDROP_VIGNETTES.some(v => v.id === s) ? s : 'light';
};

window.setFinderPreset = function (id) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.finderPreset = window.normalizeFinderPreset(id);
  window.D.settings.uiStyle = 'finder';
  window.save();
  window.applySettings();
  if (typeof window.renderStyleLab === 'function') window.renderStyleLab();
};

window.setFinderBackdropTone = function (id) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.finderBackdropTone = window.normalizeFinderBackdropTone(id);
  window.D.settings.uiStyle = 'finder';
  window.save();
  window.applySettings();
  if (typeof window.renderStyleLab === 'function') window.renderStyleLab();
};

window.setFinderBackdropVignette = function (id) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.finderBackdropVignette = window.normalizeFinderBackdropVignette(id);
  window.D.settings.uiStyle = 'finder';
  window.save();
  window.applySettings();
  if (typeof window.renderStyleLab === 'function') window.renderStyleLab();
};

window.cycleFinderBackdropBlur = function () {
  if (!window.D || !window.D.settings) return;
  const levels = window.BACKDROP_BLUR_LEVELS;
  const cur = window.normalizeBackdropBlur(window.D.settings.backdropBlur);
  const idx = levels.findIndex(l => l.id === cur);
  window.D.settings.backdropBlur = levels[(idx + 1) % levels.length].id;
  window.D.settings.uiStyle = 'finder';
  window.save();
  window.applySettings();
  if (typeof window.renderStyleLab === 'function') window.renderStyleLab();
};

window.renderStyleLab = function () {
  const root = document.getElementById('styleLabRoot');
  if (!root) return;
  const cur = window.normalizeFinderPreset(window.D?.settings?.finderPreset);
  const ui = window.normalizeUiStyle(window.D?.settings?.uiStyle);
  const tone = window.normalizeFinderBackdropTone(window.D?.settings?.finderBackdropTone);
  const vignette = window.normalizeFinderBackdropVignette(window.D?.settings?.finderBackdropVignette);
  const blurId = window.normalizeBackdropBlur(window.D?.settings?.backdropBlur);
  const blurLevel = window.BACKDROP_BLUR_LEVELS.find(l => l.id === blurId) || window.BACKDROP_BLUR_LEVELS[2];

  let html = `
    <p class="finder-style-lab-intro">
      Style <b>minimal Apple</b> (pas un Classique modifié). Chaque carte : bouton <b>principal</b>, <b>secondaire</b>, <b>navigation</b> type sidebar.
      La couleur d'accent vient de tes <b>Paramètres</b>. Preset actif : <b>${cur}</b>${ui === 'finder' ? ' · appliqué' : ' · active le thème Finder pour l\'utiliser partout'}.
    </p>
    <div class="finder-style-grid">
  `;

  window.FINDER_PRESETS.forEach(function (p) {
    const active = p.id === cur ? ' is-active' : '';
    html += `
      <div class="finder-style-card finder-preset-${p.id}${active}" data-preset="${p.id}">
        <h3>${p.id}. ${p.name}</h3>
        <p>${p.desc}</p>
        <div class="finder-style-samples">
          <div>
            <label>Principal</label>
            <button type="button" class="bp" tabindex="-1">Commencer</button>
          </div>
          <div>
            <label>Secondaire</label>
            <button type="button" class="bs" tabindex="-1">Scanner</button>
          </div>
          <div>
            <label>Navigation (sidebar)</label>
            <div class="finder-style-nav-row">
              <button type="button" class="ui-btn-nav-demo on" tabindex="-1"><span data-icon="home"></span> Accueil</button>
              <button type="button" class="ui-btn-nav-demo" tabindex="-1"><span data-icon="layout-grid"></span> Inactif</button>
            </div>
          </div>
        </div>
        <button type="button" class="bp finder-style-pick" onclick="window.setFinderPreset('${p.id}')">
          ${p.id === cur ? '✓ Style actif' : 'Choisir ce style'}
        </button>
      </div>
    `;
  });

  html += '</div>';

  html += `
    <h4 class="finder-backdrop-lab-title">Fond de l'application</h4>
    <p class="finder-backdrop-lab-intro">Adoucit le fond derrière la sidebar et les onglets. Flou actuel : <b>${blurLevel.label}</b> (${blurLevel.px}px).</p>
    <div class="finder-backdrop-row">
      <span class="finder-backdrop-row-lbl">Flou du fond</span>
      <button type="button" class="bs finder-backdrop-blur-btn" onclick="window.cycleFinderBackdropBlur()">${blurLevel.label}</button>
    </div>
    <div class="finder-backdrop-section">
      <span class="finder-backdrop-section-lbl">Ton</span>
      <div class="finder-backdrop-grid">
  `;

  window.FINDER_BACKDROP_TONES.forEach(function (t) {
    const active = t.id === tone ? ' is-active' : '';
    html += `
      <button type="button" class="finder-backdrop-swatch backdrop-tone-${t.id}${active}" onclick="window.setFinderBackdropTone('${t.id}')" title="${t.desc}">
        <span class="finder-backdrop-swatch-inner"></span>
        <span class="finder-backdrop-swatch-name">${t.name}</span>
      </button>
    `;
  });

  html += `
      </div>
    </div>
    <div class="finder-backdrop-section">
      <span class="finder-backdrop-section-lbl">Vignette</span>
      <div class="finder-backdrop-chips">
  `;

  window.FINDER_BACKDROP_VIGNETTES.forEach(function (v) {
    const active = v.id === vignette ? ' is-active' : '';
    html += `
      <button type="button" class="finder-backdrop-chip${active}" onclick="window.setFinderBackdropVignette('${v.id}')" title="${v.desc}">${v.name}</button>
    `;
  });

  html += `
      </div>
    </div>
  `;

  root.innerHTML = html;
  if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
};

(function bootStyleLab() {
  function init() {
    if (window._activeTab === 'test' && typeof window.renderStyleLab === 'function') {
      window.renderStyleLab();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
