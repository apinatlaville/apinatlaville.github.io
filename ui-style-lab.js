/**
 * Labo UI — galerie thèmes, boutons, navigation, presets Finder.
 */
window.FINDER_PRESETS = [
  { id: '1', name: 'Photos', desc: 'Comme Apple Photos : pilule grise, texte couleur principale, zéro bordure.' },
  { id: '2', name: 'Blanc', desc: 'Texte clair sur pilule discrète, boutons très neutres.' },
  { id: '3', name: 'Accent', desc: 'Pilule teintée accent · boutons verre chaleureux (glow léger, relief).' },
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

window.BTN_STYLES = [
  { id: 'glow', name: 'Glow bleu', desc: 'Bleu lumineux avec relief — boutons Paramètres, .bp, toggles.' },
  { id: 'flat', name: 'Plat (preset)', desc: 'Style Finder neutre selon le preset choisi.' }
];

window.normalizeBtnStyle = function (id, uiStyle) {
  const s = String(id == null ? '' : id);
  if (s === 'glow' || s === 'flat') return s;
  return window.normalizeUiStyle(uiStyle) === 'finder' ? 'flat' : 'glow';
};

function labApplySettings() {
  if (!window.D || !window.D.settings) return;
  window.save();
  window.applySettings();
}

window.setFinderPreset = function (id) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.finderPreset = window.normalizeFinderPreset(id);
  window.D.settings.uiStyle = 'finder';
  labApplySettings();
};

window.setFinderBackdropTone = function (id) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.finderBackdropTone = window.normalizeFinderBackdropTone(id);
  window.D.settings.uiStyle = 'finder';
  labApplySettings();
};

window.setFinderBackdropVignette = function (id) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.finderBackdropVignette = window.normalizeFinderBackdropVignette(id);
  window.D.settings.uiStyle = 'finder';
  labApplySettings();
};

window.cycleFinderBackdropBlur = function () {
  if (!window.D || !window.D.settings) return;
  const levels = window.BACKDROP_BLUR_LEVELS;
  const cur = window.normalizeBackdropBlur(window.D.settings.backdropBlur);
  const idx = levels.findIndex(l => l.id === cur);
  window.D.settings.backdropBlur = levels[(idx + 1) % levels.length].id;
  window.D.settings.uiStyle = 'finder';
  labApplySettings();
};

window.setLabTheme = function (theme) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.theme = theme === 'light' ? 'light' : 'dark';
  labApplySettings();
};

window.setLabUiStyle = function (style) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.uiStyle = style === 'finder' ? 'finder' : 'classic';
  labApplySettings();
};

window.setLabNavLayout = function (layout) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.navLayout = layout === 'sidebar-left' ? 'sidebar-left' : 'top';
  labApplySettings();
};

window.setLabAccent = function (color) {
  if (!window.D || !window.D.settings) return;
  window.D.settings.appColor = color;
  labApplySettings();
};

function labChip(active, label, onclick) {
  return '<button type="button" class="ui-lab-chip' + (active ? ' is-active' : '') + '" onclick="' + onclick + '">' + label + '</button>';
}

function labSection(title, icon, desc, body) {
  return (
    '<section class="ui-lab-section">' +
    '<h3 class="ui-lab-section-title"><span data-icon="' + icon + '"></span> ' + title + '</h3>' +
    (desc ? '<p class="ui-lab-section-desc">' + desc + '</p>' : '') +
    body +
    '</section>'
  );
}

function renderLabControls(s) {
  const ui = window.normalizeUiStyle(s.uiStyle);
  const theme = s.theme === 'light' ? 'light' : 'dark';
  const nav = s.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
  const preset = window.normalizeFinderPreset(s.finderPreset);
  const blurId = window.normalizeBackdropBlur(s.backdropBlur);
  const blurLevel = window.BACKDROP_BLUR_LEVELS.find(l => l.id === blurId) || window.BACKDROP_BLUR_LEVELS[2];
  const accent = s.appColor || '#5b9aff';

  let swatches = '';
  (window.COLORS || []).forEach(function (c) {
    swatches += '<button type="button" class="ui-lab-swatch' + (c === accent ? ' is-active' : '') + '" style="background:' + c + '" title="' + c + '" onclick="window.setLabAccent(\'' + c + '\')"></button>';
  });

  return labSection(
    'Réglages globaux',
    'sliders',
    'Modifie le thème de toute l\'application en direct. L\'aperçu ci-dessous suit ces réglages.',
    '<div class="ui-lab-status-row">' +
      '<span class="ui-lab-badge"><span class="ui-lab-badge-dot" style="background:' + accent + '"></span> ' + (window.UI_STYLE_LABELS[ui] || ui) + '</span>' +
      '<span class="ui-lab-badge">' + (theme === 'light' ? 'Clair' : 'Sombre') + '</span>' +
      '<span class="ui-lab-badge">' + (nav === 'sidebar-left' ? 'Barre latérale' : 'Barre du haut') + '</span>' +
      (ui === 'finder' ? '<span class="ui-lab-badge">Preset Finder ' + preset + '</span>' : '') +
      '<span class="ui-lab-badge">Flou ' + blurLevel.label + '</span>' +
    '</div>' +
    '<div class="ui-lab-controls">' +
      '<div class="ui-lab-control-group">' +
        '<span class="ui-lab-control-label">Thème des boutons</span>' +
        '<div class="ui-lab-chip-row">' +
          labChip(ui === 'classic', 'Classique', "window.setLabUiStyle('classic')") +
          labChip(ui === 'finder', 'Finder', "window.setLabUiStyle('finder')") +
        '</div>' +
      '</div>' +
      '<div class="ui-lab-control-group">' +
        '<span class="ui-lab-control-label">Mode clair / sombre</span>' +
        '<div class="ui-lab-chip-row">' +
          labChip(theme === 'dark', 'Sombre', "window.setLabTheme('dark')") +
          labChip(theme === 'light', 'Clair', "window.setLabTheme('light')") +
        '</div>' +
      '</div>' +
      '<div class="ui-lab-control-group">' +
        '<span class="ui-lab-control-label">Navigation</span>' +
        '<div class="ui-lab-chip-row">' +
          labChip(nav === 'top', 'Barre du haut', "window.setLabNavLayout('top')") +
          labChip(nav === 'sidebar-left', 'Barre latérale (Finder)', "window.setLabNavLayout('sidebar-left')") +
        '</div>' +
      '</div>' +
      '<div class="ui-lab-control-group">' +
        '<span class="ui-lab-control-label">Couleur d\'accent</span>' +
        '<div class="ui-lab-swatch-row">' + swatches + '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderLabButtons() {
  return labSection(
    'Boutons',
    'mouse-pointer-click',
    'Échantillons avec le thème actuellement appliqué à l\'application.',
    '<div class="ui-lab-btn-grid">' +
      '<div class="ui-lab-sample"><label>Principal .bp</label><button type="button" class="bp" tabindex="-1">Enregistrer</button></div>' +
      '<div class="ui-lab-sample"><label>Secondaire .bs</label><button type="button" class="bs" tabindex="-1">Annuler</button></div>' +
      '<div class="ui-lab-sample"><label>Désactivé</label><button type="button" class="bp" disabled tabindex="-1">Indisponible</button></div>' +
      '<div class="ui-lab-sample"><label>Danger</label><button type="button" class="bp bp-danger" tabindex="-1">Supprimer</button></div>' +
      '<div class="ui-lab-sample"><label>Or .bp-gold</label><button type="button" class="bp bp-gold" tabindex="-1">Session auto</button></div>' +
      '<div class="ui-lab-sample"><label>Icône .btn-settings</label><div class="ui-lab-sample-row">' +
        '<button type="button" class="btn-settings" tabindex="-1" aria-label="Réglages"><span data-icon="settings"></span></button>' +
        '<button type="button" class="btn-settings" tabindex="-1" aria-label="Actualiser"><span data-icon="refresh-cw"></span></button>' +
      '</div></div>' +
      '<div class="ui-lab-sample"><label>Dock Synchrotron</label><div class="ui-lab-sample-row" style="flex-direction:column;align-items:stretch;">' +
        '<button type="button" class="bp sync-dock-btn sync-dock-btn-primary" tabindex="-1">Primaire</button>' +
        '<button type="button" class="bp sync-dock-btn sync-dock-btn-gold" tabindex="-1">Or</button>' +
        '<button type="button" class="sync-dock-btn sync-dock-btn-ghost" tabindex="-1">Fantôme</button>' +
      '</div></div>' +
      '<div class="ui-lab-sample"><label>Dialogue système</label><div class="ui-lab-sample-row">' +
        '<button type="button" class="bs" tabindex="-1" onclick="window.sysAlert(\'Exemple alerte.\', \'Info\')">Alerte</button>' +
        '<button type="button" class="bp" tabindex="-1" onclick="window.sysConfirm(\'Confirmer cette action ?\', function(){}, \'Test\')">Confirmer</button>' +
      '</div></div>' +
    '</div>'
  );
}

function renderLabNavigation(s) {
  const nav = s.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
  const sidebarBlock =
    '<div class="ui-lab-nav-demo">' +
      '<button type="button" class="tab on" tabindex="-1"><span data-icon="home"></span> Accueil</button>' +
      '<button type="button" class="tab" tabindex="-1"><span data-icon="clipboard-list"></span> Base Doc.</button>' +
      '<button type="button" class="tab tab-anki" tabindex="-1"><span data-icon="dna"></span> Synchrotron</button>' +
      '<button type="button" class="tab tab-test on" tabindex="-1" style="display:none"><span data-icon="flask-conical"></span> Labo</button>' +
    '</div>';

  const topBlock =
    '<div class="ui-lab-topnav-demo">' +
      '<div class="search-bar">' +
        '<div class="search-field"><span data-icon="search"></span><input type="text" placeholder="Rechercher…" tabindex="-1" readonly></div>' +
        '<div class="search-field"><span data-icon="map-pin"></span><input type="text" placeholder="Code PH-8X2" tabindex="-1" readonly></div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button type="button" class="tab on" tabindex="-1"><span data-icon="home"></span> Accueil</button>' +
        '<button type="button" class="tab" tabindex="-1"><span data-icon="zap"></span> Rapide</button>' +
        '<button type="button" class="tab tab-anki" tabindex="-1"><span data-icon="dna"></span> Sync.</button>' +
      '</div>' +
    '</div>';

  return labSection(
    'Navigation & recherche',
    'layout-list',
    'Aperçu des onglets et champs de recherche — changez « Navigation » ci-dessus pour comparer.',
  '<div class="ui-lab-compare-grid">' +
    '<div><h4 style="font-size:13px;font-weight:600;margin:0 0 8px;color:var(--mut);">Barre latérale</h4>' + sidebarBlock + '</div>' +
    '<div><h4 style="font-size:13px;font-weight:600;margin:0 0 8px;color:var(--mut);">Barre du haut</h4>' + topBlock + '</div>' +
  '</div>' +
  '<p class="ui-lab-section-desc" style="margin-top:4px;">Actif : <b>' + (nav === 'sidebar-left' ? 'Barre latérale' : 'Barre du haut') + '</b></p>'
  );
}

function renderLabComponents() {
  return labSection(
    'Composants',
    'layers',
    'Badges, notices, pastilles de couleur et champs.',
    '<div class="ui-lab-notice-grid">' +
      '<div class="ui-notice ui-notice--info"><div class="ui-notice-title"><span data-icon="lightbulb"></span> Info</div>Message informatif.</div>' +
      '<div class="ui-notice ui-notice--success"><div class="ui-notice-title"><span data-icon="circle-check"></span> Succès</div>Action réussie.</div>' +
      '<div class="ui-notice ui-notice--warn"><div class="ui-notice-title"><span data-icon="alert-triangle"></span> Attention</div>Avertissement.</div>' +
      '<div class="ui-notice ui-notice--error"><div class="ui-notice-title"><span data-icon="circle-x"></span> Erreur</div>Échec réseau.</div>' +
    '</div>' +
    '<div class="ui-lab-sample-row" style="margin-top:8px;flex-wrap:wrap;">' +
      '<span class="ui-badge ui-badge--default">Badge</span>' +
      '<span class="ui-badge ui-badge--accent">Accent</span>' +
      '<span class="ui-badge ui-badge--gold">Or</span>' +
      '<span class="ui-badge ui-badge--red">Urgent</span>' +
    '</div>' +
    '<div class="ui-lab-sample-row" style="margin-top:12px;">' +
      '<div class="theme-swatch on" style="background:var(--acc)" title="Actif"></div>' +
      '<div class="theme-swatch" style="background:#50d890" title="Vert"></div>' +
      '<div class="theme-swatch" style="background:#f06060" title="Rouge"></div>' +
    '</div>' +
    '<div class="ui-lab-topnav-demo" style="margin-top:12px;max-width:420px;">' +
      '<div class="code-boxes" style="justify-content:center;">' +
        '<input type="text" class="code-box" value="P" maxlength="1" readonly tabindex="-1">' +
        '<input type="text" class="code-box" value="H" maxlength="1" readonly tabindex="-1">' +
        '<span class="code-dash">-</span>' +
        '<input type="text" class="code-box" value="8" maxlength="1" readonly tabindex="-1">' +
        '<input type="text" class="code-box" value="X" maxlength="1" readonly tabindex="-1">' +
        '<input type="text" class="code-box" value="2" maxlength="1" readonly tabindex="-1">' +
      '</div>' +
    '</div>'
  );
}

function renderLabThemeCompare() {
  return labSection(
    'Classique vs Finder',
    'palette',
    'Comparaison isolée des deux familles de boutons (indépendante du réglage global).',
    '<div class="ui-lab-compare-grid">' +
      '<div class="ui-lab-theme-sandbox ui-lab-theme-sandbox--classic">' +
        '<h4>Classique</h4>' +
        '<div class="ui-style-preview" style="margin-bottom:12px;">' +
          '<span class="ui-preview-pill ui-preview-classic" style="opacity:1;transform:none;">Pilule active</span>' +
          '<span class="ui-preview-pill ui-preview-finder">Finder</span>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<button type="button" class="bp ui-btn-accent" tabindex="-1">Principal</button>' +
          '<button type="button" class="bs ui-btn-surface" tabindex="-1">Secondaire</button>' +
        '</div>' +
      '</div>' +
      '<div class="ui-lab-theme-sandbox ui-lab-theme-sandbox--finder finder-style-card finder-preset-1" style="padding:16px;">' +
        '<h4 style="margin:0 0 12px;">Finder (preset 1)</h4>' +
        '<div class="ui-style-preview" style="margin-bottom:12px;">' +
          '<span class="ui-preview-pill ui-preview-classic">Classique</span>' +
          '<span class="ui-preview-pill ui-preview-finder" style="opacity:1;transform:none;">Pilule active</span>' +
        '</div>' +
        '<div class="finder-style-samples" style="margin:0;">' +
          '<div><label>Principal</label><button type="button" class="bp" tabindex="-1">Commencer</button></div>' +
          '<div><label>Secondaire</label><button type="button" class="bs" tabindex="-1">Scanner</button></div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderLabFinderPresets(cur, ui) {
  let html = labSection(
    'Presets Finder (1–5)',
    'sparkles',
    'Style minimal Apple. Chaque carte montre principal, secondaire et navigation sidebar. Preset actif : <b>' + cur + '</b>' + (ui === 'finder' ? ' · appliqué' : ' · activez le thème Finder pour l\'utiliser partout') + '.',
    '<div class="finder-style-grid">'
  );

  window.FINDER_PRESETS.forEach(function (p) {
    const active = p.id === cur ? ' is-active' : '';
    html += (
      '<div class="finder-style-card finder-preset-' + p.id + active + '" data-preset="' + p.id + '">' +
        '<h3>' + p.id + '. ' + p.name + '</h3>' +
        '<p>' + p.desc + '</p>' +
        '<div class="finder-style-samples">' +
          '<div><label>Principal</label><button type="button" class="bp" tabindex="-1">Commencer</button></div>' +
          '<div><label>Secondaire</label><button type="button" class="bs" tabindex="-1">Scanner</button></div>' +
          '<div><label>Navigation (sidebar)</label>' +
            '<div class="finder-style-nav-row">' +
              '<button type="button" class="ui-btn-nav-demo on" tabindex="-1"><span data-icon="home"></span> Accueil</button>' +
              '<button type="button" class="ui-btn-nav-demo" tabindex="-1"><span data-icon="layout-list"></span> Inactif</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="bp finder-style-pick" onclick="window.setFinderPreset(\'' + p.id + '\')">' +
          (p.id === cur ? '✓ Style actif' : 'Choisir ce style') +
        '</button>' +
      '</div>'
    );
  });

  html += '</div>';
  return html;
}

function renderLabBackdrop(tone, vignette, blurLevel) {
  let html = labSection(
    'Fond de l\'application',
    'image',
    'Adoucit le dégradé derrière la sidebar et les onglets. Flou actuel : <b>' + blurLevel.label + '</b> (' + blurLevel.px + 'px).',
    '<div class="finder-backdrop-row">' +
      '<span class="finder-backdrop-row-lbl">Flou du fond</span>' +
      '<button type="button" class="bs finder-backdrop-blur-btn" onclick="window.cycleFinderBackdropBlur()">' + blurLevel.label + '</button>' +
    '</div>' +
    '<div class="finder-backdrop-section">' +
      '<span class="finder-backdrop-section-lbl">Ton</span>' +
      '<div class="finder-backdrop-grid">'
  );

  window.FINDER_BACKDROP_TONES.forEach(function (t) {
    const active = t.id === tone ? ' is-active' : '';
    html += (
      '<button type="button" class="finder-backdrop-swatch backdrop-tone-' + t.id + active + '" onclick="window.setFinderBackdropTone(\'' + t.id + '\')" title="' + t.desc + '">' +
        '<span class="finder-backdrop-swatch-inner"></span>' +
        '<span class="finder-backdrop-swatch-name">' + t.name + '</span>' +
      '</button>'
    );
  });

  html += '</div></div><div class="finder-backdrop-section"><span class="finder-backdrop-section-lbl">Vignette</span><div class="finder-backdrop-chips">';

  window.FINDER_BACKDROP_VIGNETTES.forEach(function (v) {
    const active = v.id === vignette ? ' is-active' : '';
    html += '<button type="button" class="finder-backdrop-chip' + active + '" onclick="window.setFinderBackdropVignette(\'' + v.id + '\')" title="' + v.desc + '">' + v.name + '</button>';
  });

  html += '</div></div>';
  return html;
}

window.renderStyleLab = function () {
  const root = document.getElementById('styleLabRoot');
  if (!root) return;

  if (!window.D || !window.D.settings) {
    root.innerHTML = '<p class="ui-lab-section-desc">Ouvrez l\'application (connexion ou mode local) pour utiliser le labo UI.</p>';
    return;
  }

  const s = window.D.settings;
  const cur = window.normalizeFinderPreset(s.finderPreset);
  const ui = window.normalizeUiStyle(s.uiStyle);
  const tone = window.normalizeFinderBackdropTone(s.finderBackdropTone);
  const vignette = window.normalizeFinderBackdropVignette(s.finderBackdropVignette);
  const blurId = window.normalizeBackdropBlur(s.backdropBlur);
  const blurLevel = window.BACKDROP_BLUR_LEVELS.find(l => l.id === blurId) || window.BACKDROP_BLUR_LEVELS[2];

  root.innerHTML =
    '<div class="ui-design-lab">' +
      '<div class="ui-lab-hero">' +
        '<h2><span data-icon="flask-conical"></span> Labo UI</h2>' +
        '<p>Galerie unique : thèmes, boutons, navigation, composants et presets Finder. Les changements s\'appliquent à toute l\'application.</p>' +
      '</div>' +
      renderLabControls(s) +
      renderLabButtons() +
      renderLabNavigation(s) +
      renderLabComponents() +
      renderLabThemeCompare() +
      renderLabFinderPresets(cur, ui) +
      renderLabBackdrop(tone, vignette, blurLevel) +
    '</div>';

  if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);

  const details = document.querySelector('#paneTest .ui-lab-details summary [data-icon]');
  if (details && typeof window.hydrateIcons === 'function') window.hydrateIcons(details.parentElement);
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
