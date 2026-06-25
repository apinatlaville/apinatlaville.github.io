/**
 * ui-appearance.js — Deux thèmes : Minimaliste ou Classique.
 */
(function () {
  'use strict';

  var PRESET_PROFILES = {
    minimaliste: {
      themePreset: 'minimaliste',
      backdropTone: 'soft',
      backdropVignette: 'light',
      backdropBlur: 'medium',
      sidebarStyle: 'frosted',
      navActiveStyle: 'accent-pill',
      btnPrimaryStyle: 'solid',
      btnSecondaryStyle: 'neutral',
      btnToggleStyle: 'outline',
      surfaceStyle: 'layered',
      navLayout: 'sidebar-left',
      accentColor: '#5b9aff',
      theme: 'dark'
    },
    classique: {
      themePreset: 'classique',
      backdropTone: 'accent',
      backdropVignette: 'light',
      backdropBlur: 'medium',
      sidebarStyle: 'frosted',
      navActiveStyle: 'classic-blue',
      btnPrimaryStyle: 'classic-blue',
      btnSecondaryStyle: 'neutral',
      btnToggleStyle: 'outline',
      surfaceStyle: 'layered',
      navLayout: 'sidebar-left',
      accentColor: '#5b9aff',
      theme: 'dark'
    }
  };

  window.APPEARANCE_PRESETS = [
    {
      id: 'minimaliste',
      label: 'Minimaliste',
      hint: 'Pilule accent, boutons pleins, fond doux',
      profile: PRESET_PROFILES.minimaliste
    },
    {
      id: 'classique',
      label: 'Classique',
      hint: 'Liquid glass bleu, fond accent',
      profile: PRESET_PROFILES.classique
    }
  ];

  var NAV_ACTIVE = {
    'accent-pill': {
      '--finder-nav-on-bg': 'color-mix(in srgb, var(--acc) 22%, rgba(120, 120, 128, 0.2))',
      '--finder-nav-on-color': 'var(--acc)',
      '--finder-nav-on-border': 'rgba(130, 165, 255, 0.2)',
      '--finder-nav-on-shadow': 'none',
      '--finder-nav-idle-opacity': '1',
      '--finder-nav-idle-color': 'rgba(242, 245, 250, 0.98)'
    },
    'classic-blue': {
      '--finder-nav-on-bg': 'var(--classic-glass-bg)',
      '--finder-nav-on-color': 'var(--txt)',
      '--finder-nav-on-border': 'var(--classic-glass-border)',
      '--finder-nav-on-shadow': 'var(--classic-glass-shadow)',
      '--finder-nav-on-surface': 'var(--classic-glass-surface)',
      '--finder-nav-on-blur': 'var(--classic-glass-blur)',
      '--finder-nav-idle-opacity': '0.9'
    }
  };

  var BTN_PRIMARY = {
    solid: {
      '--finder-primary-bg': 'var(--acc)',
      '--finder-primary-hover': 'color-mix(in srgb, var(--acc) 88%, white)',
      '--finder-primary-color': '#fff',
      '--finder-primary-border': 'transparent',
      '--finder-primary-shadow': 'none',
      '--finder-primary-surface': 'none',
      '--finder-primary-blur': 'none',
      '--ui-accent-shadow': 'none'
    },
    'classic-blue': {
      '--finder-primary-bg': 'var(--classic-glass-btn-bg)',
      '--finder-primary-surface': 'var(--classic-glass-btn-surface)',
      '--finder-primary-hover': 'var(--classic-glass-btn-hover-bg)',
      '--finder-primary-color': 'var(--txt)',
      '--finder-primary-border': 'var(--classic-glass-btn-border)',
      '--finder-primary-shadow': 'var(--classic-glass-btn-shadow)',
      '--finder-primary-blur': 'var(--classic-glass-btn-blur)',
      '--ui-accent-shadow': 'var(--classic-glass-btn-shadow)'
    }
  };

  var BTN_SECONDARY = {
    neutral: {
      '--finder-secondary-bg': 'rgba(120, 120, 128, 0.2)',
      '--finder-secondary-hover': 'rgba(120, 120, 128, 0.28)',
      '--finder-secondary-border': 'transparent',
      '--finder-secondary-shadow': 'none',
      '--finder-secondary-blur': 'none'
    }
  };

  var BTN_TOGGLE = {
    outline: {
      '--finder-toggle-bg': 'transparent',
      '--finder-toggle-hover': 'rgba(255, 255, 255, 0.07)',
      '--finder-toggle-border': 'rgba(255, 255, 255, 0.14)',
      '--finder-toggle-shadow': 'none',
      '--finder-toggle-blur': 'none',
      '--finder-toggle-color': 'var(--txt)'
    }
  };

  var SURFACE = {
    layered: {
      '--finder-glass-blur': '48px',
      '--finder-glass-saturate': '1.1',
      '--finder-glass-surface': 'none',
      '--finder-glass-shadow': 'none',
      '--finder-layer-bg': 'rgba(120, 120, 128, 0.14)'
    }
  };

  var SIDEBAR = {
    frosted: {
      '--finder-sidebar-bg': 'rgba(28, 28, 30, 0.72)',
      '--finder-sidebar-border': 'rgba(255, 255, 255, 0.26)',
      '--finder-sidebar-blur': '76px',
      '--finder-sidebar-saturate': '1.2',
      '--finder-sidebar-surface': 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.03) 78%, rgba(255, 255, 255, 0.07) 100%)',
      '--finder-sidebar-shadow': '0 0 0 0.5px rgba(255, 255, 255, 0.14), 0 22px 56px rgba(0, 0, 0, 0.42), 0 6px 18px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
      '--finder-nav-idle-color': 'rgba(232, 236, 244, 0.9)'
    }
  };

  function pick(map, key, fallback) {
    return map[key] || map[fallback];
  }

  function mergeTokens(appearance) {
    var out = {};
    function add(pack) {
      if (!pack) return;
      Object.keys(pack).forEach(function (k) { out[k] = pack[k]; });
    }
    var navPack = pick(NAV_ACTIVE, appearance.navActiveStyle, 'accent-pill');
    add(navPack);
    add(pick(BTN_PRIMARY, appearance.btnPrimaryStyle, 'solid'));
    add(pick(BTN_SECONDARY, appearance.btnSecondaryStyle, 'neutral'));
    add(pick(BTN_TOGGLE, appearance.btnToggleStyle, 'outline'));
    add(pick(SURFACE, appearance.surfaceStyle, 'layered'));
    add(pick(SIDEBAR, appearance.sidebarStyle, 'frosted'));
    if (navPack['--finder-nav-idle-opacity']) out['--finder-nav-idle-opacity'] = navPack['--finder-nav-idle-opacity'];
    if (navPack['--finder-nav-idle-color']) out['--finder-nav-idle-color'] = navPack['--finder-nav-idle-color'];
    return out;
  }

  function aliasUiTokens(tokens) {
    tokens['--ui-on-bg'] = tokens['--finder-nav-on-bg'];
    tokens['--ui-on-border'] = tokens['--finder-nav-on-border'] || 'transparent';
    tokens['--ui-on-color'] = tokens['--finder-nav-on-color'] || 'var(--acc)';
    tokens['--ui-on-shadow'] = tokens['--finder-nav-on-shadow'] || 'none';
    tokens['--ui-layer-bg'] = tokens['--finder-layer-bg'];
    tokens['--ui-sidebar-bg'] = tokens['--finder-sidebar-bg'];
    tokens['--ui-accent-bg'] = tokens['--finder-primary-bg'];
    tokens['--ui-accent-bg-hover'] = tokens['--finder-primary-hover'];
    tokens['--ui-accent-border'] = tokens['--finder-primary-border'] || 'transparent';
    tokens['--ui-accent-color'] = tokens['--finder-primary-color'];
    tokens['--ui-accent-shadow'] = tokens['--finder-primary-shadow'] || 'none';
    tokens['--ui-surface-btn-bg'] = tokens['--finder-secondary-bg'];
    tokens['--ui-surface-btn-border'] = tokens['--finder-secondary-border'] || 'transparent';
    tokens['--ui-surface-btn-shadow'] = tokens['--finder-secondary-shadow'] || 'none';
    tokens['--ui-surface-blur'] = tokens['--finder-secondary-blur'] || 'none';
    tokens['--ui-chip-on-bg'] = tokens['--finder-nav-on-bg'];
    tokens['--ui-chip-on-border'] = 'transparent';
    tokens['--ui-chip-on-color'] = tokens['--finder-nav-on-color'] || 'var(--acc)';
    tokens['--ui-chip-on-shadow'] = 'none';
    tokens['--ui-tile-bg'] = tokens['--finder-layer-bg'];
    tokens['--ui-tile-border'] = 'transparent';
    tokens['--ui-tile-blur'] = tokens['--finder-secondary-blur'] || 'none';
    tokens['--ui-tile-shadow'] = 'none';
    tokens['--glass-blur'] = tokens['--finder-glass-blur'];
    tokens['--glass-saturate'] = tokens['--finder-glass-saturate'];
    tokens['--glass-surface'] = tokens['--finder-glass-surface'];
    tokens['--glass-shadow'] = tokens['--finder-glass-shadow'];
    return tokens;
  }

  function normalizeThemePreset(id) {
    return id === 'classique' ? 'classique' : 'minimaliste';
  }

  function inferLegacyThemePreset(settings) {
    var s = settings || {};
    if (s.appearance && s.appearance.themePreset === 'classique') return 'classique';
    if (s.appearance && s.appearance.themePreset === 'minimaliste') return 'minimaliste';
    if (s.appearance && (s.appearance.btnPrimaryStyle === 'classic-blue' || s.appearance.navActiveStyle === 'classic-blue')) {
      return 'classique';
    }
    if (s.uiStyle === 'classic' || s.uiStyle === 'character') return 'classique';
    return 'minimaliste';
  }

  function buildAppearance(settings) {
    var presetId = normalizeThemePreset(settings.themePreset || inferLegacyThemePreset(settings));
    var appearance = Object.assign({}, PRESET_PROFILES[presetId], { themePreset: presetId });
    appearance.navLayout = settings.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
    appearance.theme = settings.theme === 'light' ? 'light' : 'dark';
    appearance.accentColor = settings.appColor || '#5b9aff';
    return appearance;
  }

  function cleanLegacyAppearanceSettings(settings) {
    delete settings.uiStyle;
    delete settings.finderPreset;
    delete settings.btnStyle;
    delete settings.finderBackdropTone;
    delete settings.finderBackdropVignette;
    delete settings.backdropBlur;
    delete settings.appearance;
  }

  function injectAppearanceCss(tokens, appearance) {
    var el = document.getElementById('ui-appearance-vars');
    if (!el) {
      el = document.createElement('style');
      el.id = 'ui-appearance-vars';
      document.head.appendChild(el);
    }
    var selector = appearance.navLayout === 'sidebar-left'
      ? 'body.ui-finder.nav-sidebar-left'
      : 'body.ui-finder';
    var lines = [selector + ' {'];
    Object.keys(tokens).forEach(function (key) {
      lines.push('  ' + key + ': ' + tokens[key] + ';');
    });
    lines.push('}');
    el.textContent = lines.join('\n');
  }

  window.migrateAppearance = function (settings) {
    if (!settings) return buildAppearance({ themePreset: 'minimaliste' });

    var presetId = normalizeThemePreset(settings.themePreset || inferLegacyThemePreset(settings));
    var needsSave = !settings.appearanceVersion || settings.appearanceVersion < 2
      || settings.themePreset !== presetId
      || settings.appearance
      || settings.uiStyle != null
      || settings.finderPreset != null
      || settings.btnStyle != null;

    settings.themePreset = presetId;
    cleanLegacyAppearanceSettings(settings);
    settings.appearanceVersion = 2;
    if (needsSave) settings._needsAppearanceSave = true;

    return buildAppearance(settings);
  };

  window.resolveAppearancePreset = function (presetId) {
    return buildAppearance({
      themePreset: normalizeThemePreset(presetId),
      navLayout: 'sidebar-left',
      theme: 'dark',
      appColor: '#5b9aff'
    });
  };

  window.applyAppearance = function (settings) {
    if (!settings) return;
    var appearance = window.migrateAppearance(settings);

    document.body.classList.toggle('theme-light', appearance.theme === 'light');
    document.body.classList.toggle('theme-dark', appearance.theme !== 'light');
    settings.theme = appearance.theme;

    document.body.classList.remove(
      'ui-character', 'ui-minimal', 'ui-classic',
      'finder-preset-1', 'finder-preset-2', 'finder-preset-3', 'finder-preset-4', 'finder-preset-5'
    );
    document.body.classList.add('ui-finder');

    document.body.classList.remove(
      'backdrop-tone-soft', 'backdrop-tone-neutral', 'backdrop-tone-deep', 'backdrop-tone-warm', 'backdrop-tone-accent',
      'backdrop-vignette-off', 'backdrop-vignette-light', 'backdrop-vignette-medium'
    );
    document.body.classList.add('backdrop-tone-' + appearance.backdropTone);
    if (appearance.backdropVignette !== 'off') {
      document.body.classList.add('backdrop-vignette-' + appearance.backdropVignette);
    }

    var blurLevels = window.BACKDROP_BLUR_LEVELS || [
      { id: 'off', px: 0 }, { id: 'light', px: 24 }, { id: 'medium', px: 48 }, { id: 'strong', px: 72 }
    ];
    var blurLevel = blurLevels.find(function (l) { return l.id === appearance.backdropBlur; }) || blurLevels[2];
    document.body.classList.toggle('shell-backdrop-blur', blurLevel.px > 0);
    document.documentElement.style.setProperty('--shell-backdrop-blur', blurLevel.px + 'px');

    document.body.classList.remove(
      'btn-style-glow', 'btn-style-flat',
      'appearance-primary-solid', 'appearance-primary-soft',
      'appearance-primary-glow', 'appearance-primary-classic-blue'
    );
    document.body.classList.add('btn-style-flat');
    document.body.classList.toggle('appearance-toggle-classic', false);

    var primaryStyle = appearance.btnPrimaryStyle || 'solid';
    if (primaryStyle === 'solid' || primaryStyle === 'classic-blue') {
      document.body.classList.add('appearance-primary-' + primaryStyle);
    }

    if (appearance.accentColor) {
      document.documentElement.style.setProperty('--acc', appearance.accentColor);
      var hex = appearance.accentColor.replace('#', '');
      if (hex.length === 6) {
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        document.documentElement.style.setProperty('--glow', 'rgba(' + r + ',' + g + ',' + b + ',0.22)');
      }
    }

    injectAppearanceCss(aliasUiTokens(mergeTokens(appearance)), appearance);
  };

  window.applyThemePreset = function (presetId) {
    if (!window.D || !window.D.settings) return;
    var id = normalizeThemePreset(presetId);
    if (!PRESET_PROFILES[id]) return;
    window.D.settings.themePreset = id;
    cleanLegacyAppearanceSettings(window.D.settings);
    window.D.settings.appearanceVersion = 2;
    if (typeof window.save === 'function') window.save();
    if (typeof window.applySettings === 'function') window.applySettings();
  };

  window.bindSettingsThemePicker = function () {
    if (document.body._settingsThemeBound) return;
    document.body._settingsThemeBound = true;
    document.body.addEventListener('click', function (e) {
      var btn = e.target.closest('#settingsThemeRow [data-theme-preset]');
      if (!btn || typeof window.applyThemePreset !== 'function' || !window.D) return;
      e.preventDefault();
      window.applyThemePreset(btn.getAttribute('data-theme-preset'));
    });
  };

  if (document.body && typeof window.bindSettingsThemePicker === 'function') {
    window.bindSettingsThemePicker();
  }
})();
