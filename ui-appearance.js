/**
 * ui-appearance.js — Moteur visuel unifié (Phase A)
 * Un réglage → des tokens CSS → tout le site.
 */
(function () {
  'use strict';

  window.APPEARANCE_DEFAULT = {
    backdropTone: 'soft',
    backdropVignette: 'light',
    backdropBlur: 'medium',
    sidebarStyle: 'frosted',
    navActiveStyle: 'gray-pill',
    btnPrimaryStyle: 'solid',
    btnSecondaryStyle: 'neutral',
    surfaceStyle: 'layered',
    navLayout: 'sidebar-left',
    accentColor: '#5b9aff',
    theme: 'dark'
  };

  var NAV_ACTIVE = {
    'gray-pill': {
      '--finder-nav-on-bg': 'rgba(120, 120, 128, 0.32)',
      '--finder-nav-on-color': 'var(--acc)',
      '--finder-nav-on-border': 'transparent',
      '--finder-nav-on-shadow': 'none',
      '--finder-nav-idle-opacity': '0.55'
    },
    'white-pill': {
      '--finder-nav-on-bg': 'rgba(255, 255, 255, 0.11)',
      '--finder-nav-on-color': 'rgba(255, 255, 255, 0.96)',
      '--finder-nav-on-border': 'transparent',
      '--finder-nav-on-shadow': 'none',
      '--finder-nav-idle-opacity': '0.5'
    },
    'accent-pill': {
      '--finder-nav-on-bg': 'color-mix(in srgb, var(--acc) 22%, rgba(120, 120, 128, 0.2))',
      '--finder-nav-on-color': 'var(--acc)',
      '--finder-nav-on-border': 'rgba(130, 165, 255, 0.2)',
      '--finder-nav-on-shadow': 'none',
      '--finder-nav-idle-opacity': '0.52'
    },
    'classic-blue': {
      '--finder-nav-on-bg': 'rgba(91, 154, 255, 0.16)',
      '--finder-nav-on-color': 'var(--txt)',
      '--finder-nav-on-border': 'rgba(130, 165, 255, 0.22)',
      '--finder-nav-on-shadow': 'inset 0 1px 0 rgba(195, 215, 255, 0.18), 0 2px 8px rgba(91, 154, 255, 0.08)',
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
    soft: {
      '--finder-primary-bg': 'rgba(255, 255, 255, 0.14)',
      '--finder-primary-hover': 'rgba(255, 255, 255, 0.2)',
      '--finder-primary-color': 'rgba(255, 255, 255, 0.96)',
      '--finder-primary-border': 'transparent',
      '--finder-primary-shadow': 'none',
      '--finder-primary-surface': 'none',
      '--finder-primary-blur': 'none',
      '--ui-accent-shadow': 'none'
    },
    glow: {
      '--finder-primary-bg': 'var(--acc)',
      '--finder-primary-hover': 'color-mix(in srgb, var(--acc) 88%, white)',
      '--finder-primary-color': '#fff',
      '--finder-primary-border': 'transparent',
      '--finder-primary-shadow': '0 4px 20px var(--glow), 0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      '--finder-primary-surface': 'none',
      '--finder-primary-blur': 'none',
      '--ui-accent-shadow': '0 4px 20px var(--glow), 0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
    }
  };

  var BTN_SECONDARY = {
    neutral: {
      '--finder-secondary-bg': 'rgba(120, 120, 128, 0.2)',
      '--finder-secondary-hover': 'rgba(120, 120, 128, 0.28)',
      '--finder-secondary-border': 'transparent',
      '--finder-secondary-shadow': 'none',
      '--finder-secondary-blur': 'none'
    },
    outline: {
      '--finder-secondary-bg': 'transparent',
      '--finder-secondary-hover': 'rgba(255, 255, 255, 0.07)',
      '--finder-secondary-border': 'rgba(255, 255, 255, 0.14)',
      '--finder-secondary-shadow': 'none',
      '--finder-secondary-blur': 'none'
    },
    ghost: {
      '--finder-secondary-bg': 'transparent',
      '--finder-secondary-hover': 'rgba(255, 255, 255, 0.05)',
      '--finder-secondary-border': 'transparent',
      '--finder-secondary-shadow': 'none',
      '--finder-secondary-blur': 'none'
    }
  };

  var SURFACE = {
    layered: {
      '--finder-glass-blur': '48px',
      '--finder-glass-saturate': '1.1',
      '--finder-glass-surface': 'none',
      '--finder-glass-shadow': 'none',
      '--finder-layer-bg': 'rgba(120, 120, 128, 0.14)'
    },
    flat: {
      '--finder-glass-blur': '0px',
      '--finder-glass-saturate': '1',
      '--finder-glass-surface': 'none',
      '--finder-glass-shadow': 'none',
      '--finder-layer-bg': 'rgba(255, 255, 255, 0.04)'
    },
    glass: {
      '--finder-glass-blur': '64px',
      '--finder-glass-saturate': '1.2',
      '--finder-glass-surface': 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 60%)',
      '--finder-glass-shadow': '0 8px 32px rgba(0, 0, 0, 0.22)',
      '--finder-layer-bg': 'rgba(255, 255, 255, 0.05)'
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
    },
    flat: {
      '--finder-sidebar-bg': 'rgba(18, 18, 20, 0.94)',
      '--finder-sidebar-border': 'transparent',
      '--finder-sidebar-blur': '0px',
      '--finder-sidebar-saturate': '1',
      '--finder-sidebar-surface': 'none',
      '--finder-sidebar-shadow': 'none',
      '--finder-nav-idle-color': 'rgba(232, 236, 244, 0.88)'
    },
    solid: {
      '--finder-sidebar-bg': 'rgba(22, 22, 24, 0.78)',
      '--finder-sidebar-border': 'transparent',
      '--finder-sidebar-blur': '40px',
      '--finder-sidebar-saturate': '1.08',
      '--finder-sidebar-surface': 'none',
      '--finder-sidebar-shadow': 'none',
      '--finder-nav-idle-color': 'rgba(232, 236, 244, 0.9)'
    }
  };

  function pick(map, key, fallback) {
    return map[key] || map[fallback];
  }

  function mergeTokens(appearance) {
    var a = appearance;
    var out = {};
    function add(pack) {
      if (!pack) return;
      Object.keys(pack).forEach(function (k) { out[k] = pack[k]; });
    }
    add(pick(NAV_ACTIVE, a.navActiveStyle, 'gray-pill'));
    add(pick(BTN_PRIMARY, a.btnPrimaryStyle, 'solid'));
    add(pick(BTN_SECONDARY, a.btnSecondaryStyle, 'neutral'));
    add(pick(SURFACE, a.surfaceStyle, 'layered'));
    add(pick(SIDEBAR, a.sidebarStyle, 'frosted'));
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

  function normalizeAppearance(raw) {
    var a = Object.assign({}, window.APPEARANCE_DEFAULT, raw || {});
    var tones = ['soft', 'neutral', 'deep', 'warm', 'accent'];
    var vignettes = ['off', 'light', 'medium'];
    var blurs = ['off', 'light', 'medium', 'strong'];
    if (tones.indexOf(a.backdropTone) < 0) a.backdropTone = 'soft';
    if (vignettes.indexOf(a.backdropVignette) < 0) a.backdropVignette = 'light';
    if (blurs.indexOf(a.backdropBlur) < 0) a.backdropBlur = 'medium';
    if (!NAV_ACTIVE[a.navActiveStyle]) a.navActiveStyle = 'gray-pill';
    if (!BTN_PRIMARY[a.btnPrimaryStyle]) a.btnPrimaryStyle = 'solid';
    if (!BTN_SECONDARY[a.btnSecondaryStyle]) a.btnSecondaryStyle = 'neutral';
    if (!SURFACE[a.surfaceStyle]) a.surfaceStyle = 'layered';
    if (!SIDEBAR[a.sidebarStyle]) a.sidebarStyle = 'frosted';
    a.navLayout = a.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
    a.theme = a.theme === 'light' ? 'light' : 'dark';
    if (!a.accentColor) a.accentColor = '#5b9aff';
    return a;
  }

  function legacyToAppearance(settings) {
    var s = settings || {};
    var ui = typeof window.normalizeUiStyle === 'function'
      ? window.normalizeUiStyle(s.uiStyle)
      : 'finder';
    var preset = String(s.finderPreset == null ? '1' : s.finderPreset);
    var btn = s.btnStyle === 'glow' ? 'glow' : 'solid';

    var a = Object.assign({}, window.APPEARANCE_DEFAULT);

    a.backdropTone = s.finderBackdropTone || a.backdropTone;
    a.backdropVignette = s.finderBackdropVignette || a.backdropVignette;
    a.backdropBlur = s.backdropBlur || a.backdropBlur;
    a.navLayout = s.navLayout === 'sidebar-left' ? 'sidebar-left' : (s.navLayout || a.navLayout);
    a.accentColor = s.appColor || a.accentColor;
    a.theme = s.theme === 'light' ? 'light' : 'dark';

    if (ui === 'classic') {
      a.navActiveStyle = 'classic-blue';
      a.btnPrimaryStyle = btn;
      a.btnSecondaryStyle = 'outline';
      a.surfaceStyle = 'layered';
      a.sidebarStyle = 'frosted';
      return a;
    }

    a.btnPrimaryStyle = btn;

    if (preset === '2') {
      a.navActiveStyle = 'white-pill';
      a.btnPrimaryStyle = 'soft';
      a.btnSecondaryStyle = 'ghost';
      a.surfaceStyle = 'layered';
      a.sidebarStyle = 'solid';
    } else if (preset === '3') {
      a.navActiveStyle = 'accent-pill';
      a.btnPrimaryStyle = btn === 'glow' ? 'glow' : 'solid';
      a.btnSecondaryStyle = 'neutral';
      a.surfaceStyle = 'glass';
      a.sidebarStyle = 'frosted';
    } else if (preset === '4') {
      a.navActiveStyle = 'gray-pill';
      a.surfaceStyle = 'glass';
      a.sidebarStyle = 'frosted';
    } else if (preset === '5') {
      a.navActiveStyle = 'white-pill';
      a.btnPrimaryStyle = 'soft';
      a.btnSecondaryStyle = 'ghost';
      a.surfaceStyle = 'flat';
      a.sidebarStyle = 'flat';
    } else {
      a.navActiveStyle = 'gray-pill';
      a.btnPrimaryStyle = btn === 'glow' ? 'glow' : 'solid';
      a.btnSecondaryStyle = 'neutral';
      a.surfaceStyle = 'layered';
      a.sidebarStyle = 'frosted';
    }

    return a;
  }

  function appearanceToLegacyPreset(a) {
    if (a.navActiveStyle === 'white-pill' && a.surfaceStyle === 'flat') return '5';
    if (a.surfaceStyle === 'glass' && a.navActiveStyle === 'accent-pill') return '3';
    if (a.surfaceStyle === 'glass') return '4';
    if (a.navActiveStyle === 'white-pill') return '2';
    return '1';
  }

  window.syncLegacyFromAppearance = function (settings) {
    if (!settings || !settings.appearance) return;
    var a = settings.appearance;
    settings.finderPreset = appearanceToLegacyPreset(a);
    settings.btnStyle = a.btnPrimaryStyle === 'glow' ? 'glow' : 'flat';
    settings.finderBackdropTone = a.backdropTone;
    settings.finderBackdropVignette = a.backdropVignette;
    settings.backdropBlur = a.backdropBlur;
    settings.navLayout = a.navLayout;
    settings.appColor = a.accentColor;
    settings.theme = a.theme;
  };

  window.migrateAppearance = function (settings) {
    if (!settings) return window.APPEARANCE_DEFAULT;

    if (!settings.appearanceVersion || settings.appearanceVersion < 1) {
      settings.uiStyle = 'finder';
      settings.finderPreset = '1';
      settings.btnStyle = 'flat';
      settings.finderBackdropTone = 'soft';
      settings.finderBackdropVignette = 'light';
      settings.navLayout = 'sidebar-left';
      settings.appColor = settings.appColor || '#5b9aff';
      settings.appearance = Object.assign({}, window.APPEARANCE_DEFAULT);
      settings.appearanceVersion = 1;
      settings._needsAppearanceSave = true;
    }

    var legacy = legacyToAppearance(settings);
    var a = Object.assign({}, settings.appearance || {}, legacy);
    if (settings.theme) a.theme = settings.theme === 'light' ? 'light' : 'dark';
    if (settings.navLayout) a.navLayout = settings.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
    if (settings.appColor) a.accentColor = settings.appColor;
    if (settings.finderBackdropTone) a.backdropTone = settings.finderBackdropTone;
    if (settings.finderBackdropVignette) a.backdropVignette = settings.finderBackdropVignette;
    if (settings.backdropBlur) a.backdropBlur = settings.backdropBlur;
    settings.appearance = normalizeAppearance(a);
    window.syncLegacyFromAppearance(settings);
    return settings.appearance;
  };

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

  window.applyAppearance = function (settings) {
    if (!settings) return;
    var appearance = window.migrateAppearance(settings);

    if (appearance.theme === 'light') {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    }
    settings.theme = appearance.theme;

    var uiStyle = typeof window.normalizeUiStyle === 'function'
      ? window.normalizeUiStyle(settings.uiStyle)
      : 'finder';

    document.body.classList.remove(
      'ui-character', 'ui-minimal', 'ui-classic', 'ui-finder',
      'finder-preset-1', 'finder-preset-2', 'finder-preset-3', 'finder-preset-4', 'finder-preset-5'
    );
    document.body.classList.add(uiStyle === 'classic' ? 'ui-classic' : 'ui-finder');

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

    document.body.classList.remove('btn-style-glow', 'btn-style-flat');
    if (appearance.btnPrimaryStyle === 'glow') {
      document.body.classList.add('btn-style-glow');
    } else {
      document.body.classList.add('btn-style-flat');
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

    if (uiStyle === 'finder') {
      injectAppearanceCss(aliasUiTokens(mergeTokens(appearance)), appearance);
    } else {
      var styleEl = document.getElementById('ui-appearance-vars');
      if (styleEl) styleEl.textContent = '';
    }
  };

  window.exportAppearanceProfile = function (settings) {
    window.migrateAppearance(settings);
    return JSON.stringify(settings.appearance, null, 2);
  };
})();
