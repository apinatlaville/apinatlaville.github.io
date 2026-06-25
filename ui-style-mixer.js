/**
 * Style Mixeur — session temporaire, axes indépendants Classique / Finder.
 * Export : bloc STYLE_MIXER_PROFILE v1 en bas de l'onglet.
 */
(function () {
  'use strict';

  var AXIS_KEYS = [
    'btnPrimary', 'btnSecondary', 'tabs', 'chips', 'tiles',
    'panes', 'focus', 'hover', 'sidebar', 'layers'
  ];

  window.STYLE_MIXER_AXIS_LABELS = {
    btnPrimary: 'Boutons principaux (.bp)',
    btnSecondary: 'Boutons secondaires (.bs)',
    tabs: 'Onglets / navigation active',
    chips: 'Chips & filtres actifs',
    tiles: 'Tuiles KPI / dash-cards',
    panes: 'Panneaux contenu (coque)',
    focus: 'Focus champs (recherche, code)',
    hover: 'Survol cartes / tuiles',
    sidebar: 'Barre latérale (si activée)',
    layers: 'Couches internes (set-row, hero)'
  };

  /** Tokens Finder par preset (alignés sur ui-finder-presets.css) */
  var FINDER_PRESET = {
    '1': {
      btnPrimary: { bg: 'var(--acc)', color: '#fff', border: 'none', shadow: 'none', hover: 'color-mix(in srgb, var(--acc) 88%, white)' },
      btnSecondary: { bg: 'rgba(120, 120, 128, 0.2)', color: 'var(--txt)', border: 'transparent', shadow: 'none', blur: 'none', hover: 'rgba(120, 120, 128, 0.28)' },
      tabs: { onBg: 'rgba(120, 120, 128, 0.32)', onColor: 'var(--acc)', onBorder: 'transparent', onShadow: 'none', useBorder: '0' },
      chips: { onBg: 'rgba(120, 120, 128, 0.32)', onColor: 'var(--acc)', onBorder: 'transparent', onShadow: 'none' },
      tiles: { bg: 'rgba(120, 120, 128, 0.14)', border: 'transparent', blur: 'none', shadow: 'none' },
      panes: { bg: 'rgba(255, 255, 255, 0.035)', border: 'rgba(255, 255, 255, 0.07)', shadow: 'none', blur: 'blur(28px) saturate(1.1)' },
      focus: { ring: '0 0 0 3px rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.32)' },
      hover: { border: 'rgba(255, 255, 255, 0.14)', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 10px 28px rgba(0, 0, 0, 0.3), 0 2px 5px rgba(0, 0, 0, 0.18)' },
      sidebar: { bg: 'rgba(28, 28, 30, 0.72)', border: 'transparent' },
      layers: { bg: 'rgba(120, 120, 128, 0.14)', border: 'transparent' }
    },
    '2': {
      btnPrimary: { bg: 'rgba(255, 255, 255, 0.14)', color: 'rgba(255, 255, 255, 0.96)', border: 'none', shadow: 'none', hover: 'rgba(255, 255, 255, 0.2)' },
      btnSecondary: { bg: 'rgba(255, 255, 255, 0.06)', color: 'var(--txt)', border: 'transparent', shadow: 'none', blur: 'none', hover: 'rgba(255, 255, 255, 0.1)' },
      tabs: { onBg: 'rgba(255, 255, 255, 0.11)', onColor: 'rgba(255, 255, 255, 0.96)', onBorder: 'transparent', onShadow: 'none', useBorder: '0' },
      chips: { onBg: 'rgba(255, 255, 255, 0.11)', onColor: 'rgba(255, 255, 255, 0.96)', onBorder: 'transparent', onShadow: 'none' },
      tiles: { bg: 'rgba(255, 255, 255, 0.06)', border: 'transparent', blur: 'none', shadow: 'none' },
      panes: { bg: 'rgba(255, 255, 255, 0.035)', border: 'rgba(255, 255, 255, 0.07)', shadow: 'none', blur: 'blur(28px) saturate(1.1)' },
      focus: { ring: '0 0 0 3px rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.32)' },
      hover: { border: 'rgba(255, 255, 255, 0.14)', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 10px 28px rgba(0, 0, 0, 0.3)' },
      sidebar: { bg: 'rgba(22, 22, 24, 0.78)', border: 'transparent' },
      layers: { bg: 'rgba(255, 255, 255, 0.06)', border: 'transparent' }
    },
    '3': {
      btnPrimary: { bg: 'var(--acc)', color: '#fff', border: 'none', shadow: 'none', hover: 'color-mix(in srgb, var(--acc) 90%, white)' },
      btnSecondary: { bg: 'color-mix(in srgb, var(--acc) 8%, rgba(120, 120, 128, 0.16))', color: 'var(--txt)', border: 'transparent', shadow: 'none', blur: 'none', hover: 'color-mix(in srgb, var(--acc) 14%, rgba(120, 120, 128, 0.22))' },
      tabs: { onBg: 'color-mix(in srgb, var(--acc) 22%, rgba(120, 120, 128, 0.2))', onColor: 'var(--acc)', onBorder: 'transparent', onShadow: 'none', useBorder: '0' },
      chips: { onBg: 'color-mix(in srgb, var(--acc) 22%, rgba(120, 120, 128, 0.2))', onColor: 'var(--acc)', onBorder: 'transparent', onShadow: 'none' },
      tiles: { bg: 'color-mix(in srgb, var(--acc) 6%, rgba(120, 120, 128, 0.12))', border: 'transparent', blur: 'none', shadow: 'none' },
      panes: { bg: 'rgba(255, 255, 255, 0.04)', border: 'rgba(255, 255, 255, 0.08)', shadow: 'none', blur: 'blur(32px) saturate(1.12)' },
      focus: { ring: '0 0 0 3px rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.32)' },
      hover: { border: 'rgba(255, 255, 255, 0.14)', shadow: '0 10px 28px rgba(0, 0, 0, 0.28)' },
      sidebar: { bg: 'rgba(26, 28, 34, 0.65)', border: 'transparent' },
      layers: { bg: 'color-mix(in srgb, var(--acc) 6%, rgba(120, 120, 128, 0.12))', border: 'transparent' }
    },
    '4': {
      btnPrimary: { bg: 'var(--acc)', color: '#fff', border: 'none', shadow: 'none', hover: 'color-mix(in srgb, var(--acc) 86%, white)' },
      btnSecondary: { bg: 'rgba(255, 255, 255, 0.07)', color: 'var(--txt)', border: 'rgba(255, 255, 255, 0.08)', shadow: 'none', blur: 'blur(24px) saturate(1.12)', hover: 'rgba(255, 255, 255, 0.11)' },
      tabs: { onBg: 'rgba(255, 255, 255, 0.1)', onColor: 'var(--acc)', onBorder: 'transparent', onShadow: 'none', useBorder: '0' },
      chips: { onBg: 'rgba(255, 255, 255, 0.1)', onColor: 'var(--acc)', onBorder: 'transparent', onShadow: 'none' },
      tiles: { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.08)', blur: 'blur(24px) saturate(1.12)', shadow: 'none' },
      panes: { bg: 'rgba(255, 255, 255, 0.04)', border: 'rgba(255, 255, 255, 0.08)', shadow: '0 8px 32px rgba(0, 0, 0, 0.22)', blur: 'blur(32px) saturate(1.12)' },
      focus: { ring: '0 0 0 3px rgba(255, 255, 255, 0.12)', border: 'rgba(255, 255, 255, 0.35)' },
      hover: { border: 'rgba(255, 255, 255, 0.16)', shadow: '0 10px 28px rgba(0, 0, 0, 0.3)' },
      sidebar: { bg: 'rgba(32, 34, 40, 0.42)', border: 'rgba(255, 255, 255, 0.06)' },
      layers: { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.08)' }
    },
    '5': {
      btnPrimary: { bg: 'rgba(255, 255, 255, 0.12)', color: 'rgba(255, 255, 255, 0.95)', border: 'none', shadow: 'none', hover: 'rgba(255, 255, 255, 0.17)' },
      btnSecondary: { bg: 'transparent', color: 'var(--txt)', border: 'transparent', shadow: 'none', blur: 'none', hover: 'rgba(255, 255, 255, 0.06)' },
      tabs: { onBg: 'rgba(255, 255, 255, 0.09)', onColor: 'rgba(255, 255, 255, 0.95)', onBorder: 'transparent', onShadow: 'none', useBorder: '0' },
      chips: { onBg: 'rgba(255, 255, 255, 0.09)', onColor: 'rgba(255, 255, 255, 0.95)', onBorder: 'transparent', onShadow: 'none' },
      tiles: { bg: 'rgba(255, 255, 255, 0.04)', border: 'transparent', blur: 'none', shadow: 'none' },
      panes: { bg: 'rgba(18, 18, 20, 0.94)', border: 'transparent', shadow: 'none', blur: 'none' },
      focus: { ring: '0 0 0 3px rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.28)' },
      hover: { border: 'rgba(255, 255, 255, 0.1)', shadow: '0 4px 12px rgba(0, 0, 0, 0.2)' },
      sidebar: { bg: 'rgba(18, 18, 20, 0.94)', border: 'transparent' },
      layers: { bg: 'rgba(255, 255, 255, 0.04)', border: 'transparent' }
    }
  };

  var CLASSIC = {
    btnPrimary: { bg: 'var(--acc)', color: '#fff', border: 'none', shadow: '0 2px 14px rgba(91, 154, 255, 0.28)', hover: 'color-mix(in srgb, var(--acc) 88%, #fff)' },
    btnSecondary: { bg: 'rgba(255, 255, 255, 0.08)', color: 'var(--txt)', border: 'rgba(255, 255, 255, 0.13)', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 1px 4px rgba(0, 0, 0, 0.24)', blur: 'blur(28px) saturate(1.15)', hover: 'rgba(255, 255, 255, 0.12)' },
    tabs: { onBg: 'rgba(91, 154, 255, 0.16)', onColor: 'var(--txt)', onBorder: 'rgba(130, 165, 255, 0.22)', onShadow: 'inset 0 1px 0 rgba(195, 215, 255, 0.18), 0 2px 12px rgba(91, 154, 255, 0.08)', useBorder: '1' },
    chips: { onBg: 'rgba(91, 154, 255, 0.22)', onColor: 'var(--txt)', onBorder: 'rgba(91, 154, 255, 0.38)', onShadow: 'none' },
    tiles: { bg: 'var(--s2)', border: 'var(--bd)', blur: 'none', shadow: 'none' },
    panes: { bg: 'rgba(155, 185, 255, 0.055)', border: 'rgba(130, 165, 255, 0.14)', shadow: 'var(--glass-shadow)', blur: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))' },
    focus: { ring: '0 0 0 3px color-mix(in srgb, var(--acc) 35%, transparent)', border: 'color-mix(in srgb, var(--acc) 55%, transparent)' },
    hover: { border: 'rgba(130, 165, 255, 0.22)', shadow: '0 4px 24px rgba(0, 0, 0, 0.2)' },
    sidebar: { bg: 'rgba(42, 42, 46, 0.48)', border: 'var(--bd)' },
    layers: { bg: 'rgba(155, 185, 255, 0.055)', border: 'rgba(130, 165, 255, 0.14)' }
  };

  function axisTokens(session, axisKey) {
    var ax = session.axes[axisKey];
    var preset = window.normalizeFinderPreset(ax.preset || '1');
    if (ax.family === 'classic') {
      return Object.assign({}, CLASSIC[axisKey]);
    }
    var presetBlock = FINDER_PRESET[preset] || FINDER_PRESET['1'];
    return Object.assign({}, presetBlock[axisKey] || FINDER_PRESET['1'][axisKey]);
  }

  function defaultAxis(family, preset) {
    return { family: family || 'classic', preset: preset || '1' };
  }

  window.styleMixerDefaultSession = function () {
    return {
      theme: 'dark',
      navLayout: 'top',
      appColor: '#5b9aff',
      backdropTone: 'soft',
      backdropVignette: 'light',
      backdropBlur: 'medium',
      axes: {
        btnPrimary: defaultAxis('classic'),
        btnSecondary: defaultAxis('classic'),
        tabs: defaultAxis('classic'),
        chips: defaultAxis('classic'),
        tiles: defaultAxis('classic'),
        panes: defaultAxis('classic'),
        focus: defaultAxis('classic'),
        hover: defaultAxis('classic'),
        sidebar: defaultAxis('finder', '1'),
        layers: defaultAxis('finder', '1')
      }
    };
  };

  window.styleMixerSessionFromSettings = function () {
    if (!window.D || !window.D.settings) return window.styleMixerDefaultSession();
    var s = window.D.settings;
    var ui = window.normalizeUiStyle(s.uiStyle);
    var family = ui === 'finder' ? 'finder' : 'classic';
    var preset = window.normalizeFinderPreset(s.finderPreset);
    var ax = defaultAxis(family, preset);
    var session = window.styleMixerDefaultSession();
    session.theme = 'dark';
    session.navLayout = s.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
    session.appColor = s.appColor || '#5b9aff';
    session.backdropBlur = window.normalizeBackdropBlur(s.backdropBlur);
    if (ui === 'finder') {
      session.backdropTone = window.normalizeFinderBackdropTone(s.finderBackdropTone);
      session.backdropVignette = window.normalizeFinderBackdropVignette(s.finderBackdropVignette);
    } else {
      session.backdropTone = 'classic';
      session.backdropVignette = 'off';
    }
    AXIS_KEYS.forEach(function (k) { session.axes[k] = { family: ax.family, preset: ax.preset }; });
    return session;
  };

  function ensureSession() {
    if (!window._styleMixerSession) {
      window._styleMixerSession = window.styleMixerSessionFromSettings();
    }
    return window._styleMixerSession;
  }

  function setCssVar(el, name, value) {
    if (value != null && value !== '') el.style.setProperty(name, value);
    else el.style.removeProperty(name);
  }

  window.applyStyleMixerToElement = function (el, session) {
    if (!el || !session) return;
    el.classList.add('style-mixer-scope', 'theme-dark');
    el.classList.remove('theme-light');

    AXIS_KEYS.forEach(function (axis) {
      var ax = session.axes[axis];
      var cap = axis.charAt(0).toUpperCase() + axis.slice(1);
      el.dataset['mix' + cap] = ax.family;
      el.dataset['mix' + cap + 'Preset'] = ax.preset || '1';
      var t = axisTokens(session, axis);
      if (!t) return;
      if (axis === 'tabs' && t.useBorder != null) {
        el.dataset.mixTabsUseborder = t.useBorder;
      }
      Object.keys(t).forEach(function (prop) {
        setCssVar(el, '--mix-' + axis + '-' + prop, t[prop]);
      });
    });

    el.dataset.mixBackdropTone = session.backdropTone;
    el.dataset.mixBackdropVignette = session.backdropVignette;
    el.dataset.mixBackdropBlur = session.backdropBlur;

    if (session.appColor) {
      el.style.setProperty('--acc', session.appColor);
    }
  };

  function applyBackdropClasses(session) {
    var body = document.body;
    var tones = ['classic', 'soft', 'neutral', 'deep', 'warm', 'accent'];
    tones.forEach(function (t) { body.classList.remove('backdrop-tone-' + t); });
    body.classList.remove('backdrop-vignette-off', 'backdrop-vignette-light', 'backdrop-vignette-medium');
    if (session.backdropTone && session.backdropTone !== 'classic') {
      body.classList.add('backdrop-tone-' + session.backdropTone);
    }
    if (session.backdropVignette && session.backdropVignette !== 'off') {
      body.classList.add('backdrop-vignette-' + session.backdropVignette);
    }
    var blurId = window.normalizeBackdropBlur(session.backdropBlur);
    var blurLevel = window.BACKDROP_BLUR_LEVELS.find(function (l) { return l.id === blurId; }) || window.BACKDROP_BLUR_LEVELS[2];
    body.classList.toggle('shell-backdrop-blur', blurLevel.px > 0);
    document.documentElement.style.setProperty('--shell-backdrop-blur', blurLevel.px + 'px');
  }

  function applyNavLayoutSession(session) {
    var nav = session.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
    document.body.classList.toggle('nav-sidebar-left', nav === 'sidebar-left');
    var pageFloat = document.getElementById('pageTitleFloat');
    if (pageFloat) {
      pageFloat.classList.toggle('hidden', nav !== 'sidebar-left');
      pageFloat.setAttribute('aria-hidden', nav === 'sidebar-left' ? 'false' : 'true');
    }
    if (typeof window.layoutNav === 'function') window.layoutNav();
    if (typeof window.layoutChrome === 'function') window.layoutChrome();
    if (typeof window.renderAppNav === 'function') window.renderAppNav(window._activeTab || 'home');
  }

  window.applyStyleMixerLive = function () {
    var session = ensureSession();
    window._styleMixerLive = true;
    document.body.classList.add('style-mixer-live');
    document.body.classList.remove('ui-classic', 'ui-finder', 'ui-character', 'ui-minimal');
    document.body.classList.remove('finder-preset-1', 'finder-preset-2', 'finder-preset-3', 'finder-preset-4', 'finder-preset-5');

    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');

    if (session.appColor) {
      document.documentElement.style.setProperty('--acc', session.appColor);
      var r = parseInt(session.appColor.slice(1, 3), 16);
      var g = parseInt(session.appColor.slice(3, 5), 16);
      var b = parseInt(session.appColor.slice(5, 7), 16);
      document.documentElement.style.setProperty('--glow', 'rgba(' + r + ',' + g + ',' + b + ',0.22)');
    }

    applyBackdropClasses(session);
    applyNavLayoutSession(session);
    window.applyStyleMixerToElement(document.body, session);
  };

  window.revertStyleMixerLive = function () {
    window._styleMixerLive = false;
    document.body.classList.remove('style-mixer-live', 'style-mixer-scope');
    AXIS_KEYS.forEach(function (axis) {
      var cap = axis.charAt(0).toUpperCase() + axis.slice(1);
      delete document.body.dataset['mix' + cap];
      delete document.body.dataset['mix' + cap + 'Preset'];
    });
    delete document.body.dataset.mixTabsUseborder;
    delete document.body.dataset.mixBackdropTone;
    delete document.body.dataset.mixBackdropVignette;
    delete document.body.dataset.mixBackdropBlur;
    if (typeof window.applySettings === 'function') window.applySettings();
  };

  window.styleMixerLeaveTab = function () {
    if (window._styleMixerLive) window.revertStyleMixerLive();
  };

  window.styleMixerEnterTab = function () {
    ensureSession().theme = 'dark';
    window._styleMixerLive = true;
    window.renderStyleMixer();
  };

  window.styleMixerSet = function (path, value) {
    if (path === 'theme') return;
    var session = ensureSession();
    var parts = path.split('.');
    var obj = session;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    window.styleMixerRefresh();
  };

  window.styleMixerSetAxis = function (axis, family, preset) {
    var session = ensureSession();
    session.axes[axis] = { family: family === 'finder' ? 'finder' : 'classic', preset: window.normalizeFinderPreset(preset || '1') };
    window.styleMixerRefresh();
  };

  window.styleMixerLoadShortcut = function (id) {
    var session = ensureSession();
    if (id === 'from-settings') {
      window._styleMixerSession = window.styleMixerSessionFromSettings();
      window.styleMixerRefresh();
      return;
    }
    if (id === 'classic-all') {
      AXIS_KEYS.forEach(function (k) { session.axes[k] = defaultAxis('classic'); });
      session.backdropTone = 'classic';
      session.backdropVignette = 'off';
      session.theme = 'dark';
    } else if (id.indexOf('finder-') === 0) {
      var p = id.replace('finder-', '');
      AXIS_KEYS.forEach(function (k) { session.axes[k] = defaultAxis('finder', p); });
      session.backdropTone = 'soft';
      session.backdropVignette = 'light';
      session.theme = 'dark';
    }
    window.styleMixerRefresh();
  };

  window.styleMixerToggleLive = function (on) {
    if (on) window.applyStyleMixerLive();
    else window.revertStyleMixerLive();
    window.styleMixerRefresh(false);
  };

  window.styleMixerResetSession = function () {
    window._styleMixerSession = window.styleMixerDefaultSession();
    if (window._styleMixerLive) window.applyStyleMixerLive();
    window.styleMixerRefresh();
  };

  function axisSummary(session, key) {
    var ax = session.axes[key];
    if (ax.family === 'classic') return 'Classique';
    return 'Finder preset ' + ax.preset;
  }

  window.styleMixerExportBlock = function () {
    var session = ensureSession();
    var payload = {
      version: 1,
      profile: 'style-mixer',
      exportedAt: new Date().toISOString(),
      theme: session.theme,
      navLayout: session.navLayout,
      appColor: session.appColor,
      backdropTone: session.backdropTone,
      backdropVignette: session.backdropVignette,
      backdropBlur: session.backdropBlur,
      axes: session.axes,
      livePreview: !!window._styleMixerLive
    };
    var lines = [
      '=== STYLE_MIXER_PROFILE v1 ===',
      'Résumé : ' + (session.theme === 'light' ? 'Clair' : 'Sombre') +
        ' · Nav ' + (session.navLayout === 'sidebar-left' ? 'sidebar' : 'haut') +
        ' · Accent ' + session.appColor +
        ' · Fond ' + session.backdropTone + ' / vignette ' + session.backdropVignette + ' / flou ' + session.backdropBlur,
      'Axes :',
      AXIS_KEYS.map(function (k) { return '  - ' + window.STYLE_MIXER_AXIS_LABELS[k] + ' → ' + axisSummary(session, k); }).join('\n'),
      '',
      'JSON (coller dans le chat Cursor) :',
      JSON.stringify(payload, null, 2),
      '=== END STYLE_MIXER_PROFILE ==='
    ];
    return lines.join('\n');
  };

  window.styleMixerCopyExport = function () {
    var text = window.styleMixerExportBlock();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (typeof window.sysAlert === 'function') window.sysAlert('Profil copié dans le presse-papiers.', 'Style Mixeur');
      });
    } else {
      var ta = document.getElementById('styleMixerExportText');
      if (ta) { ta.select(); document.execCommand('copy'); }
    }
  };

  function chip(active, label, onclick) {
    return '<button type="button" class="ui-lab-chip' + (active ? ' is-active' : '') + '" onclick="' + onclick + '">' + label + '</button>';
  }

  function renderAxisControl(session, axisKey) {
    var ax = session.axes[axisKey];
    var presetRow = '';
    if (ax.family === 'finder') {
      presetRow = '<div class="ui-lab-chip-row style-mixer-preset-row">' +
        window.FINDER_PRESETS.map(function (p) {
          return chip(ax.preset === p.id, p.id + ' · ' + p.name, "window.styleMixerSetAxis('" + axisKey + "','finder','" + p.id + "')");
        }).join('') +
      '</div>';
    }
    return (
      '<div class="style-mixer-axis">' +
        '<div class="style-mixer-axis-head">' +
          '<span class="style-mixer-axis-title">' + window.STYLE_MIXER_AXIS_LABELS[axisKey] + '</span>' +
          '<span class="style-mixer-axis-val">' + axisSummary(session, axisKey) + '</span>' +
        '</div>' +
        '<div class="ui-lab-chip-row">' +
          chip(ax.family === 'classic', 'Classique', "window.styleMixerSetAxis('" + axisKey + "','classic','1')") +
          chip(ax.family === 'finder', 'Finder', "window.styleMixerSetAxis('" + axisKey + "','finder','" + (ax.preset || '1') + "')") +
        '</div>' +
        presetRow +
      '</div>'
    );
  }

  function renderSandbox(session) {
    return (
      '<div id="styleMixerSandbox" class="style-mixer-sandbox theme-dark style-mixer-scope">' +
        '<p class="style-mixer-sandbox-label">Aperçu sandbox (isolé)</p>' +
        '<div class="style-mixer-sandbox-grid">' +
          '<div class="style-mixer-sandbox-block">' +
            '<label>Onglets</label>' +
            '<div class="style-mixer-mini-nav">' +
              '<button type="button" class="tab on" tabindex="-1"><span data-icon="home"></span> Actif</button>' +
              '<button type="button" class="tab" tabindex="-1"><span data-icon="zap"></span> Inactif</button>' +
            '</div>' +
          '</div>' +
          '<div class="style-mixer-sandbox-block">' +
            '<label>Boutons</label>' +
            '<button type="button" class="bp" tabindex="-1">Principal</button>' +
            '<button type="button" class="bs" tabindex="-1">Secondaire</button>' +
          '</div>' +
          '<div class="style-mixer-sandbox-block">' +
            '<label>Chips</label>' +
            '<span class="chip on">Actif</span><span class="chip">Inactif</span>' +
          '</div>' +
          '<div class="style-mixer-sandbox-block">' +
            '<label>Tuile</label>' +
            '<div class="dash-card"><div class="dash-num">12</div><div class="dash-lbl">Exemple KPI</div></div>' +
          '</div>' +
          '<div class="style-mixer-sandbox-block">' +
            '<label>Focus</label>' +
            '<input type="text" class="home-search" placeholder="Recherche…" tabindex="-1" readonly>' +
          '</div>' +
          '<div class="style-mixer-sandbox-block">' +
            '<label>Survol carte</label>' +
            '<div class="card style-mixer-hover-demo"><div class="card-t">Carte exemple</div></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  window.styleMixerRefresh = function (rerender) {
    var session = ensureSession();
    session.theme = 'dark';
    if (rerender !== false && window._activeTab === 'styleMixer') {
      window.renderStyleMixer();
    } else {
      var sandbox = document.getElementById('styleMixerSandbox');
      if (sandbox) window.applyStyleMixerToElement(sandbox, session);
      var exportTa = document.getElementById('styleMixerExportText');
      if (exportTa) exportTa.value = window.styleMixerExportBlock();
    }
    if (window._styleMixerLive) window.applyStyleMixerLive();
  };

  window.renderStyleMixer = function () {
    var root = document.getElementById('styleMixerRoot');
    if (!root) return;
    if (!window.D || !window.D.settings) {
      root.innerHTML = '<p class="ui-lab-section-desc">Connectez-vous ou mode local pour utiliser le Style Mixeur.</p>';
      return;
    }

    var session = ensureSession();
    var blurId = window.normalizeBackdropBlur(session.backdropBlur);
    var blurLevel = window.BACKDROP_BLUR_LEVELS.find(function (l) { return l.id === blurId; }) || window.BACKDROP_BLUR_LEVELS[2];
    var live = !!window._styleMixerLive;

    var swatches = '';
    (window.COLORS || ['#5b9aff']).forEach(function (c) {
      swatches += '<button type="button" class="ui-lab-swatch' + (c === session.appColor ? ' is-active' : '') + '" style="background:' + c + '" title="' + c + '" onclick="window.styleMixerSet(\'appColor\',\'' + c + '\')"></button>';
    });

    var axesHtml = AXIS_KEYS.map(function (k) { return renderAxisControl(session, k); }).join('');

    root.innerHTML =
      '<div class="ui-design-lab style-mixer-lab">' +
        '<div class="ui-lab-hero">' +
          '<h2><span data-icon="palette"></span> Style Mixeur</h2>' +
          '<p>Combine Classique et Finder axe par axe (thème sombre uniquement). Session temporaire — rien n\'est sauvegardé tant que vous n\'envoyez pas le profil exporté. L\'aperçu live s\'active automatiquement dans cet onglet.</p>' +
        '</div>' +

        '<section class="ui-lab-section style-mixer-toolbar">' +
          '<div class="ui-lab-status-row">' +
            '<span class="ui-lab-badge">Sombre</span>' +
            '<span class="ui-lab-badge">' + (session.navLayout === 'sidebar-left' ? 'Sidebar' : 'Barre haut') + '</span>' +
            '<span class="ui-lab-badge">' + (live ? 'Aperçu live actif' : 'Aperçu en pause') + '</span>' +
          '</div>' +
          '<div class="style-mixer-actions">' +
            '<button type="button" class="bp" onclick="window.styleMixerToggleLive(' + (!live) + ')">' +
              (live ? 'Pause aperçu live' : 'Reprendre aperçu live') +
            '</button>' +
            '<button type="button" class="bs" onclick="window.styleMixerLoadShortcut(\'from-settings\')">Depuis mes paramètres</button>' +
            '<button type="button" class="bs" onclick="window.styleMixerResetSession()">Réinitialiser session</button>' +
          '</div>' +
        '</section>' +

        '<section class="ui-lab-section">' +
          '<h3 class="ui-lab-section-title"><span data-icon="zap"></span> Raccourcis</h3>' +
          '<div class="ui-lab-chip-row">' +
            chip(false, 'Classique complet', "window.styleMixerLoadShortcut('classic-all')") +
            window.FINDER_PRESETS.map(function (p) {
              return chip(false, 'Finder ' + p.id + ' · ' + p.name, "window.styleMixerLoadShortcut('finder-" + p.id + "')");
            }).join('') +
          '</div>' +
        '</section>' +

        '<section class="ui-lab-section">' +
          '<h3 class="ui-lab-section-title"><span data-icon="sliders"></span> Global</h3>' +
          '<div class="ui-lab-controls">' +
            '<div class="ui-lab-control-group">' +
              '<span class="ui-lab-control-label">Navigation</span>' +
              '<div class="ui-lab-chip-row">' +
                chip(session.navLayout === 'top', 'Barre du haut', "window.styleMixerSet('navLayout','top')") +
                chip(session.navLayout === 'sidebar-left', 'Barre latérale', "window.styleMixerSet('navLayout','sidebar-left')") +
              '</div>' +
            '</div>' +
            '<div class="ui-lab-control-group">' +
              '<span class="ui-lab-control-label">Couleur d\'accent</span>' +
              '<div class="ui-lab-swatch-row">' + swatches + '</div>' +
            '</div>' +
            '<div class="ui-lab-control-group">' +
              '<span class="ui-lab-control-label">Ton du fond</span>' +
              '<div class="ui-lab-chip-row">' +
                chip(session.backdropTone === 'classic', 'Classique', "window.styleMixerSet('backdropTone','classic')") +
                window.FINDER_BACKDROP_TONES.map(function (t) {
                  return chip(session.backdropTone === t.id, t.name, "window.styleMixerSet('backdropTone','" + t.id + "')");
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="ui-lab-control-group">' +
              '<span class="ui-lab-control-label">Vignette</span>' +
              '<div class="ui-lab-chip-row">' +
                window.FINDER_BACKDROP_VIGNETTES.map(function (v) {
                  return chip(session.backdropVignette === v.id, v.name, "window.styleMixerSet('backdropVignette','" + v.id + "')");
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="ui-lab-control-group">' +
              '<span class="ui-lab-control-label">Flou du fond · ' + blurLevel.label + '</span>' +
              '<div class="ui-lab-chip-row">' +
                window.BACKDROP_BLUR_LEVELS.map(function (l) {
                  return chip(blurId === l.id, l.label, "window.styleMixerSet('backdropBlur','" + l.id + "')");
                }).join('') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        renderSandbox(session) +

        '<section class="ui-lab-section">' +
          '<h3 class="ui-lab-section-title"><span data-icon="layers"></span> Axes (mix libre)</h3>' +
          '<p class="ui-lab-section-desc">Ex. boutons Classique + onglets Finder preset 1 + tuiles Finder preset 4.</p>' +
          '<div class="style-mixer-axes">' + axesHtml + '</div>' +
        '</section>' +

        '<section class="ui-lab-section style-mixer-export">' +
          '<h3 class="ui-lab-section-title"><span data-icon="clipboard-list"></span> Export profil</h3>' +
          '<p class="ui-lab-section-desc">Copiez ce bloc et envoyez-le dans le chat Cursor. Après validation de votre part, le profil sera appliqué définitivement et cet onglet sera archivé.</p>' +
          '<textarea id="styleMixerExportText" class="style-mixer-export-text" readonly rows="14"></textarea>' +
          '<div class="style-mixer-actions">' +
            '<button type="button" class="bp" onclick="window.styleMixerCopyExport()"><span data-icon="clipboard-list"></span> Copier le profil</button>' +
          '</div>' +
        '</section>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);

    var sandbox = document.getElementById('styleMixerSandbox');
    if (sandbox) window.applyStyleMixerToElement(sandbox, session);

    var exportTa = document.getElementById('styleMixerExportText');
    if (exportTa) exportTa.value = window.styleMixerExportBlock();

    if (window._styleMixerLive) window.applyStyleMixerLive();
  };

  (function boot() {
    document.addEventListener('DOMContentLoaded', function () {
      if (window._activeTab === 'styleMixer' && typeof window.styleMixerEnterTab === 'function') {
        window.styleMixerEnterTab();
      }
    });
  })();
})();
