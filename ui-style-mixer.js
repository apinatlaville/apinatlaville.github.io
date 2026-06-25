/**
 * Style Mixeur v3 — mêmes classes CSS que Paramètres / Labo UI (ui-classic, ui-finder, finder-preset-N).
 */
(function () {
  'use strict';

  var THEME_DIFFS = [
    { aspect: 'Philosophie', classic: 'Bleu lumineux, glow sur les actions', finder: 'Neutre type Apple, zéro halo coloré' },
    { aspect: 'Bouton principal', classic: 'Bleu accent + ombre bleue', finder: 'Selon preset (plat, blanc, accent, flou…)' },
    { aspect: 'Bouton secondaire', classic: 'Verre léger + bordure', finder: 'Gris / vitre selon preset' },
    { aspect: 'Onglet actif', classic: 'Pilule bleue + bordure + glow', finder: 'Pilule grise, sans bordure ni glow' },
    { aspect: 'Chips / filtres', classic: 'Fond bleu, bordure accent', finder: 'Gris neutre, sans couleur vive' },
    { aspect: 'Tuiles KPI', classic: 'Surface opaque (--s2)', finder: 'Vitres empilées + blur' },
    { aspect: 'Panneaux contenu', classic: 'Verre bleuté', finder: 'Verre neutre, flou plus fort' },
    { aspect: 'Sidebar', classic: 'Fond semi-opaque + bordure', finder: 'Preset (Photos, plat, flou…)' },
    { aspect: 'Fond app', classic: 'Dégradé classique', finder: 'Ton + vignette + flou réglables' },
    { aspect: 'Focus champs', classic: 'Anneau bleu (--acc)', finder: 'Anneau blanc discret' }
  ];

  function patchSettingsFromSession(target, session) {
    if (!target || !session) return;
    target.uiStyle = session.uiStyle === 'finder' ? 'finder' : 'classic';
    target.finderPreset = window.normalizeFinderPreset(session.finderPreset);
    target.finderBackdropTone = window.normalizeFinderBackdropTone(session.finderBackdropTone);
    target.finderBackdropVignette = window.normalizeFinderBackdropVignette(session.finderBackdropVignette);
    target.backdropBlur = window.normalizeBackdropBlur(session.backdropBlur);
    target.btnStyle = session.btnStyle === 'ice'
      ? 'flat'
      : window.normalizeBtnStyle(session.btnStyle, session.uiStyle);
    if (session.appColor) target.appColor = session.appColor;
    if (session.navLayout) target.navLayout = session.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top';
  }

  function resolvedBtnStyle(session) {
    if (session.btnStyle === 'ice') return 'ice';
    return window.normalizeBtnStyle(session.btnStyle, session.uiStyle);
  }

  function btnStyleClass(session) {
    var s = resolvedBtnStyle(session);
    if (s === 'glow') return ' btn-style-glow';
    if (s === 'ice') return ' btn-style-ice';
    return '';
  }

  function isIcePrototype(session) {
    return resolvedBtnStyle(session) === 'ice';
  }

  window.styleMixerDefaultSession = function () {
    return {
      uiStyle: 'classic',
      finderPreset: '1',
      btnStyle: 'glow',
      finderBackdropTone: 'soft',
      finderBackdropVignette: 'light',
      backdropBlur: 'medium',
      appColor: '#5b9aff',
      navLayout: 'top'
    };
  };

  window.styleMixerSessionFromSettings = function () {
    if (!window.D || !window.D.settings) return window.styleMixerDefaultSession();
    var s = window.D.settings;
    var uiStyle = window.normalizeUiStyle(s.uiStyle) === 'finder' ? 'finder' : 'classic';
    return {
      uiStyle: uiStyle,
      finderPreset: window.normalizeFinderPreset(s.finderPreset),
      btnStyle: window.normalizeBtnStyle(s.btnStyle, uiStyle),
      finderBackdropTone: window.normalizeFinderBackdropTone(s.finderBackdropTone),
      finderBackdropVignette: window.normalizeFinderBackdropVignette(s.finderBackdropVignette),
      backdropBlur: window.normalizeBackdropBlur(s.backdropBlur),
      appColor: s.appColor || '#5b9aff',
      navLayout: s.navLayout === 'sidebar-left' ? 'sidebar-left' : 'top'
    };
  };

  function ensureSession() {
    if (!window._styleMixerSession) {
      window._styleMixerSession = window.styleMixerSessionFromSettings();
    }
    return window._styleMixerSession;
  }

  function presetMeta(id) {
    var list = window.FINDER_PRESETS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return { id: id, name: 'Preset ' + id, desc: '' };
  }

  function sessionSummary(session) {
    var base = session.uiStyle === 'classic' ? 'Classique' : ('Finder · preset ' + presetMeta(session.finderPreset).id + ' — ' + presetMeta(session.finderPreset).name);
    var btn = resolvedBtnStyle(session) === 'ice'
      ? ' · glace liquide (aperçu mixeur)'
      : (resolvedBtnStyle(session) === 'glow' ? ' · boutons glow bleu' : ' · boutons plat');
    return base + btn;
  }

  function renderIceShowcase(session) {
    var iceCls = 'style-mixer-ice-stage btn-style-ice' + btnStyleClass(session);
    return (
      '<div class="' + iceCls + '">' +
        '<p class="style-mixer-ice-tag">Prototype — effet glace liquide, visible uniquement dans cet onglet</p>' +
        '<div class="style-mixer-ice-showcase">' +
          '<div class="liquid-glass liquid-glass--panel style-mixer-ice-sidebar">' +
            '<span class="liquid-glass__glint liquid-glass__glint--tr" aria-hidden="true"></span>' +
            '<span class="liquid-glass__glint liquid-glass__glint--tl" aria-hidden="true"></span>' +
            '<p class="style-mixer-ice-sidebar-title">Barre latérale</p>' +
            '<button type="button" class="liquid-glass liquid-glass--pill liquid-glass--nav is-on" tabindex="-1">Accueil</button>' +
            '<button type="button" class="liquid-glass liquid-glass--pill liquid-glass--nav" tabindex="-1">Révisions</button>' +
            '<button type="button" class="liquid-glass liquid-glass--pill liquid-glass--nav" tabindex="-1">Paramètres</button>' +
          '</div>' +
          '<div class="style-mixer-ice-stack">' +
            '<button type="button" class="liquid-glass liquid-glass--circle" tabindex="-1" aria-label="Action"></button>' +
            '<button type="button" class="liquid-glass liquid-glass--pill liquid-glass--w1" tabindex="-1">Léger</button>' +
            '<button type="button" class="liquid-glass liquid-glass--pill liquid-glass--w2" tabindex="-1">Classique</button>' +
            '<button type="button" class="liquid-glass liquid-glass--pill liquid-glass--w3" tabindex="-1">Barre latérale</button>' +
            '<button type="button" class="liquid-glass liquid-glass--pill liquid-glass--w4" tabindex="-1">Commencer</button>' +
          '</div>' +
        '</div>' +
        '<div class="style-mixer-ice-samples">' +
          '<h4>Composants du site</h4>' +
          renderSamplesBlock(session.uiStyle === 'finder', session) +
        '</div>' +
      '</div>'
    );
  }

  function renderSamplesBlock(forFinder, session) {
    var navHtml = forFinder
      ? '<div class="finder-style-nav-row">' +
          '<button type="button" class="ui-btn-nav-demo on" tabindex="-1">Actif</button>' +
          '<button type="button" class="ui-btn-nav-demo" tabindex="-1">Inactif</button>' +
        '</div>'
      : '<div class="finder-style-nav-row">' +
          '<button type="button" class="tab on" tabindex="-1">Actif</button>' +
          '<button type="button" class="tab" tabindex="-1">Inactif</button>' +
        '</div>';
    return (
      '<div class="finder-style-samples">' +
        '<div><label>Navigation</label>' + navHtml + '</div>' +
        '<div><label>Principal</label><button type="button" class="bp" tabindex="-1">Commencer</button></div>' +
        '<div><label>Secondaire</label><button type="button" class="bs" tabindex="-1">Scanner</button></div>' +
        '<div><label>Réglage</label><button type="button" class="toggle-btn" tabindex="-1">Classique</button></div>' +
        '<div><label>Chips</label><span class="chip on">Actif</span> <span class="chip">Off</span></div>' +
        '<div><label>Tuile</label><div class="dash-card" style="max-width:120px;padding:10px;"><div class="dash-num">42</div><div class="dash-lbl">KPI</div></div></div>' +
      '</div>'
    );
  }

  function renderClassicPreview(session) {
    return (
      '<div class="style-theme-preview ui-classic' + btnStyleClass(session) + '">' +
        '<h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">Classique</h4>' +
        renderSamplesBlock(false, session) +
      '</div>'
    );
  }

  function renderFinderPreviewCard(presetId, active, clickable, session) {
    var p = presetMeta(presetId);
    var activeCls = active ? ' is-active' : '';
    var attrs = clickable
      ? ' data-preset="' + presetId + '" onclick="window.styleMixerPickFinder(\'' + presetId + '\')"'
      : '';
    return (
      '<div class="finder-style-card finder-preset-' + presetId + activeCls + btnStyleClass(session) + '"' + attrs + '>' +
        '<h3>' + p.id + '. ' + p.name + '</h3>' +
        '<p>' + p.desc + '</p>' +
        renderSamplesBlock(true, session) +
        (clickable
          ? '<button type="button" class="bp finder-style-pick style-mixer-ui" tabindex="-1">' +
              (active ? '✓ Sélectionné' : 'Choisir') +
            '</button>'
          : '') +
      '</div>'
    );
  }

  function renderMainPreview(session) {
    if (isIcePrototype(session)) return renderIceShowcase(session);
    if (session.uiStyle === 'classic') return renderClassicPreview(session);
    return renderFinderPreviewCard(session.finderPreset, true, false, session);
  }

  function renderDiffTable() {
    var rows = THEME_DIFFS.map(function (d) {
      return (
        '<tr><td>' + d.aspect + '</td><td>' + d.classic + '</td><td>' + d.finder + '</td></tr>'
      );
    }).join('');
    return (
      '<table class="style-mixer-diff-table">' +
        '<thead><tr><th>Élément</th><th>Classique</th><th>Finder</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>'
    );
  }

  function styleMixerApplyIfLive() {
    if (!window._styleMixerLive || !window.D || !window.D.settings) return;
    var session = ensureSession();
    patchSettingsFromSession(window.D.settings, session);
    window._styleMixerApplying = true;
    if (typeof window.applySettings === 'function') window.applySettings();
    window._styleMixerApplying = false;
  }

  window.applyStyleMixerLive = function () {
    if (!window.D || !window.D.settings) return;
    if (!window._styleMixerSavedSettings) {
      window._styleMixerSavedSettings = JSON.parse(JSON.stringify(window.D.settings));
    }
    window._styleMixerLive = true;
    styleMixerApplyIfLive();
  };

  window.revertStyleMixerLive = function () {
    if (window._styleMixerSavedSettings && window.D) {
      window.D.settings = JSON.parse(JSON.stringify(window._styleMixerSavedSettings));
      window._styleMixerSavedSettings = null;
    }
    window._styleMixerLive = false;
    window._styleMixerApplying = true;
    if (typeof window.applySettings === 'function') window.applySettings();
    window._styleMixerApplying = false;
  };

  window.styleMixerLeaveTab = function () {
    if (window._styleMixerLive) window.revertStyleMixerLive();
  };

  window.styleMixerEnterTab = function () {
    window.renderStyleMixer();
    window.styleMixerSyncPreview();
  };

  window.styleMixerSetBtnStyle = function (style) {
    var session = ensureSession();
    if (style === 'flat') session.btnStyle = 'flat';
    else if (style === 'ice') session.btnStyle = 'ice';
    else session.btnStyle = 'glow';
    styleMixerAfterChange();
  };

  function styleMixerAfterChange() {
    window.styleMixerSyncPreview();
    styleMixerApplyIfLive();
  }

  window.styleMixerSetUiStyle = function (style) {
    var session = ensureSession();
    session.uiStyle = style === 'finder' ? 'finder' : 'classic';
    styleMixerAfterChange();
  };

  window.styleMixerPickFinder = function (presetId) {
    var session = ensureSession();
    session.uiStyle = 'finder';
    session.finderPreset = window.normalizeFinderPreset(presetId);
    styleMixerAfterChange();
  };

  window.styleMixerSet = function (path, value) {
    var session = ensureSession();
    session[path] = value;
    styleMixerAfterChange();
  };

  window.styleMixerLoadFromSettings = function () {
    window._styleMixerSession = window.styleMixerSessionFromSettings();
    styleMixerAfterChange();
  };

  window.styleMixerToggleLive = function (on) {
    if (on) window.applyStyleMixerLive();
    else window.revertStyleMixerLive();
    window.styleMixerSyncPreview();
  };

  window.styleMixerExportBlock = function () {
    var session = ensureSession();
    var payload = {
      version: 2,
      profile: 'style-mixer',
      exportedAt: new Date().toISOString(),
      uiStyle: session.uiStyle,
      finderPreset: session.finderPreset,
      btnStyle: session.btnStyle,
      finderBackdropTone: session.finderBackdropTone,
      finderBackdropVignette: session.finderBackdropVignette,
      backdropBlur: session.backdropBlur,
      appColor: session.appColor,
      navLayout: session.navLayout,
      livePreview: !!window._styleMixerLive
    };
    if (session.btnStyle === 'ice') payload.btnStyleNote = 'prototype-mixer-only';
    var lines = [
      '=== STYLE_MIXER_PROFILE v2 ===',
      'Choix : ' + sessionSummary(session),
      'Fond : ton ' + session.finderBackdropTone + ' · vignette ' + session.finderBackdropVignette + ' · flou ' + session.backdropBlur,
      'Accent : ' + session.appColor,
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
        if (typeof window.sysAlert === 'function') window.sysAlert('Profil copié.', 'Style Mixeur');
      });
    }
  };

  function chip(active, label, onclick, extra) {
    return '<button type="button" class="ui-lab-chip style-mixer-ui' + (active ? ' is-active' : '') + '" ' + (extra || '') + ' onclick="' + onclick + '">' + label + '</button>';
  }

  window.styleMixerSyncPreview = function () {
    var session = ensureSession();

    var host = document.getElementById('styleMixerPreviewHost');
    if (host) host.innerHTML = renderMainPreview(session);

    var summary = document.getElementById('styleMixerSummary');
    if (summary) summary.textContent = 'Sélection : ' + sessionSummary(session);

    var classicBtn = document.getElementById('styleMixerPickClassic');
    var finderBtn = document.getElementById('styleMixerPickFinder');
    if (classicBtn) classicBtn.classList.toggle('is-active', session.uiStyle === 'classic');
    if (finderBtn) finderBtn.classList.toggle('is-active', session.uiStyle === 'finder');

    var btnGlow = document.getElementById('styleMixerPickBtnGlow');
    var btnFlat = document.getElementById('styleMixerPickBtnFlat');
    var btnIce = document.getElementById('styleMixerPickBtnIce');
    if (btnGlow) btnGlow.classList.toggle('is-active', resolvedBtnStyle(session) === 'glow');
    if (btnFlat) btnFlat.classList.toggle('is-active', resolvedBtnStyle(session) === 'flat');
    if (btnIce) btnIce.classList.toggle('is-active', resolvedBtnStyle(session) === 'ice');

    var iceNotice = document.getElementById('styleMixerIceNotice');
    if (iceNotice) iceNotice.classList.toggle('style-mixer-section-hidden', !isIcePrototype(session));

    var glowDemo = document.getElementById('styleMixerBtnGlowDemo');
    if (glowDemo) glowDemo.classList.toggle('style-mixer-section-hidden', isIcePrototype(session));

    var labRoot = document.querySelector('.style-mixer-lab');
    if (labRoot) labRoot.classList.toggle('style-mixer-lab--ice', isIcePrototype(session));

    document.querySelectorAll('.style-mixer-preset-grid .finder-style-card').forEach(function (card) {
      var id = card.getAttribute('data-preset');
      var active = session.uiStyle === 'finder' && id === session.finderPreset;
      card.classList.toggle('is-active', active);
      var pick = card.querySelector('.finder-style-pick');
      if (pick) pick.textContent = active ? '✓ Sélectionné' : 'Choisir';
    });

    var finderOpts = document.getElementById('styleMixerFinderOptions');
    if (finderOpts) finderOpts.classList.toggle('style-mixer-section-hidden', session.uiStyle !== 'finder');

    syncGlobalChips(session);

    var liveBadge = document.getElementById('styleMixerLiveBadge');
    if (liveBadge) {
      var liveLabel = window._styleMixerLive ? 'Test app : ON' : 'Test app : OFF';
      if (window._styleMixerLive && isIcePrototype(session)) liveLabel += ' (sans glace)';
      liveBadge.textContent = liveLabel;
      liveBadge.classList.toggle('is-on', !!window._styleMixerLive);
    }

    var exportTa = document.getElementById('styleMixerExportText');
    if (exportTa) exportTa.value = window.styleMixerExportBlock();
  };

  function syncGlobalChips(session) {
    document.querySelectorAll('[data-mix-backdrop]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-mix-backdrop') === session.finderBackdropTone);
    });
    document.querySelectorAll('[data-mix-vignette]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-mix-vignette') === session.finderBackdropVignette);
    });
    document.querySelectorAll('[data-mix-blur]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-mix-blur') === session.backdropBlur);
    });
    document.querySelectorAll('[data-mix-color]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-mix-color') === session.appColor);
    });
    document.querySelectorAll('[data-mix-nav]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-mix-nav') === session.navLayout);
    });
  }

  window.renderStyleMixer = function () {
    var root = document.getElementById('styleMixerRoot');
    if (!root) return;
    if (!window.D || !window.D.settings) {
      root.innerHTML = '<p class="ui-lab-section-desc">Mode local ou connexion requis.</p>';
      return;
    }

    var session = ensureSession();
    var live = !!window._styleMixerLive;

    var swatches = '';
    (window.COLORS || ['#5b9aff']).forEach(function (c) {
      swatches += '<button type="button" class="ui-lab-swatch style-mixer-ui' + (c === session.appColor ? ' is-active' : '') + '" data-mix-color="' + c + '" style="background:' + c + '" title="' + c + '" onclick="window.styleMixerSet(\'appColor\',\'' + c + '\')"></button>';
    });

    var presetCards = '';
    (window.FINDER_PRESETS || []).forEach(function (p) {
      presetCards += renderFinderPreviewCard(
        p.id,
        session.uiStyle === 'finder' && p.id === session.finderPreset,
        true,
        session
      );
    });

    root.innerHTML =
      '<div class="ui-design-lab style-mixer-lab">' +
        '<div class="ui-lab-hero">' +
          '<h2><span data-icon="palette"></span> Style Mixeur</h2>' +
          '<p>Choisis entre <b>Classique</b> et <b>Finder</b> — les aperçus utilisent les <b>mêmes styles CSS</b> que Paramètres et le Labo UI. Rien n\'est sauvegardé tant que tu n\'exportes pas le profil.</p>' +
        '</div>' +

        '<section class="style-mixer-preview-section">' +
          '<div class="style-mixer-preview-head">' +
            '<h3>Aperçu de ta sélection</h3>' +
            '<p id="styleMixerSummary" class="style-mixer-summary">—</p>' +
          '</div>' +
          '<div id="styleMixerPreviewHost"></div>' +
        '</section>' +

        '<section class="style-mixer-toolbar">' +
          '<span class="ui-lab-badge style-mixer-live-badge' + (live ? ' is-on' : '') + '" id="styleMixerLiveBadge">' + (live ? 'Test app : ON' : 'Test app : OFF') + '</span>' +
          '<div class="style-mixer-actions">' +
            '<button type="button" class="bp style-mixer-ui" onclick="window.styleMixerToggleLive(' + (!live) + ')">' +
              (live ? 'Arrêter test sur l\'app' : 'Tester sur toute l\'app') +
            '</button>' +
            '<button type="button" class="bs style-mixer-ui" onclick="window.styleMixerLoadFromSettings()">Mes paramètres actuels</button>' +
          '</div>' +
        '</section>' +

        '<section class="ui-lab-section">' +
          '<h3 class="ui-lab-section-title"><span data-icon="git-compare"></span> Classique ou Finder ?</h3>' +
          '<div class="style-mixer-main-pick">' +
            '<button type="button" id="styleMixerPickClassic" class="style-mixer-main-btn' + (session.uiStyle === 'classic' ? ' is-active' : '') + '" onclick="window.styleMixerSetUiStyle(\'classic\')">' +
              '<strong>Classique</strong>' +
              '<span>Bleu lumineux, glow sur onglets et boutons. Le style d\'origine du site.</span>' +
            '</button>' +
            '<button type="button" id="styleMixerPickFinder" class="style-mixer-main-btn' + (session.uiStyle === 'finder' ? ' is-active' : '') + '" onclick="window.styleMixerSetUiStyle(\'finder\')">' +
              '<strong>Finder</strong>' +
              '<span>Style Apple neutre, 5 presets. Fond réglable (ton, vignette, flou).</span>' +
            '</button>' +
          '</div>' +
          '<div class="ui-lab-compare-grid">' +
            renderClassicPreview(session) +
            renderFinderPreviewCard('1', false, false, session) +
          '</div>' +
        '</section>' +

        '<section class="ui-lab-section">' +
          '<h3 class="ui-lab-section-title"><span data-icon="mouse-pointer-click"></span> Style des boutons</h3>' +
          '<p class="ui-lab-section-desc' + (isIcePrototype(session) ? '' : ' style-mixer-section-hidden') + '" id="styleMixerIceNotice">' +
            '<b>Glace liquide</b> : prototype visible uniquement ici. « Tester sur toute l\'app » applique le reste de ton profil, pas encore cet effet.' +
          '</p>' +
          '<p class="ui-lab-section-desc' + (isIcePrototype(session) ? ' style-mixer-section-hidden' : '') + '" id="styleMixerBtnStyleDesc">' +
            'Le <b>glow bleu</b> correspond aux boutons Paramètres. Le <b>plat</b> suit le preset Finder.' +
          '</p>' +
          '<div class="style-mixer-btn-pick">' +
            '<button type="button" id="styleMixerPickBtnGlow" class="style-mixer-main-btn' + (resolvedBtnStyle(session) === 'glow' ? ' is-active' : '') + '" onclick="window.styleMixerSetBtnStyle(\'glow\')">' +
              '<strong>Glow bleu</strong>' +
              '<span>Bleu lumineux, relief 3D — site entier.</span>' +
            '</button>' +
            '<button type="button" id="styleMixerPickBtnFlat" class="style-mixer-main-btn' + (resolvedBtnStyle(session) === 'flat' ? ' is-active' : '') + '" onclick="window.styleMixerSetBtnStyle(\'flat\')">' +
              '<strong>Plat (preset)</strong>' +
              '<span>Boutons neutres selon le preset Finder.</span>' +
            '</button>' +
            '<button type="button" id="styleMixerPickBtnIce" class="style-mixer-main-btn' + (resolvedBtnStyle(session) === 'ice' ? ' is-active' : '') + '" onclick="window.styleMixerSetBtnStyle(\'ice\')">' +
              '<strong>Glace liquide</strong>' +
              '<span>Verre givré type Apple — aperçu mixeur seulement.</span>' +
            '</button>' +
          '</div>' +
          '<div id="styleMixerBtnGlowDemo" class="style-mixer-btn-glow-demo' + btnStyleClass(session) + (isIcePrototype(session) ? ' style-mixer-section-hidden' : '') + '">' +
            '<div class="set-row" style="margin:0;"><div><div class="set-lbl">Exemple réglage</div></div>' +
            '<button type="button" class="toggle-btn" tabindex="-1">Classique</button></div>' +
            '<div style="display:flex;gap:8px;margin-top:10px;">' +
            '<button type="button" class="bp" tabindex="-1">Principal</button>' +
            '<button type="button" class="bs" tabindex="-1">Secondaire</button>' +
            '</div></div>' +
        '</section>' +

        '<section class="ui-lab-section' + (session.uiStyle !== 'finder' ? ' style-mixer-section-hidden' : '') + '" id="styleMixerFinderOptions">' +
          '<h3 class="ui-lab-section-title"><span data-icon="sparkles"></span> Preset Finder (1–5)</h3>' +
          '<p class="ui-lab-section-desc">Même cartes que le Labo UI — clique pour choisir.</p>' +
          '<div class="style-mixer-preset-grid finder-style-grid">' + presetCards + '</div>' +
          '<h3 class="ui-lab-section-title" style="margin-top:20px;"><span data-icon="image"></span> Fond (Finder uniquement)</h3>' +
          '<div class="ui-lab-controls">' +
            '<div class="ui-lab-control-group"><span class="ui-lab-control-label">Ton</span>' +
              '<div class="ui-lab-chip-row">' +
                (window.FINDER_BACKDROP_TONES || []).map(function (t) {
                  return chip(session.finderBackdropTone === t.id, t.name, "window.styleMixerSet('finderBackdropTone','" + t.id + "')", 'data-mix-backdrop="' + t.id + '"');
                }).join('') +
              '</div></div>' +
            '<div class="ui-lab-control-group"><span class="ui-lab-control-label">Vignette</span>' +
              '<div class="ui-lab-chip-row">' +
                (window.FINDER_BACKDROP_VIGNETTES || []).map(function (v) {
                  return chip(session.finderBackdropVignette === v.id, v.name, "window.styleMixerSet('finderBackdropVignette','" + v.id + "')", 'data-mix-vignette="' + v.id + '"');
                }).join('') +
              '</div></div>' +
            '<div class="ui-lab-control-group"><span class="ui-lab-control-label">Flou fond</span>' +
              '<div class="ui-lab-chip-row">' +
                (window.BACKDROP_BLUR_LEVELS || []).map(function (l) {
                  return chip(session.backdropBlur === l.id, l.label, "window.styleMixerSet('backdropBlur','" + l.id + "')", 'data-mix-blur="' + l.id + '"');
                }).join('') +
              '</div></div>' +
          '</div>' +
        '</section>' +

        '<section class="ui-lab-section">' +
          '<h3 class="ui-lab-section-title"><span data-icon="list"></span> Toutes les différences</h3>' +
          renderDiffTable() +
        '</section>' +

        '<details class="style-mixer-group">' +
          '<summary><span data-icon="sliders"></span> Options test app</summary>' +
          '<div class="ui-lab-controls">' +
            '<div class="ui-lab-control-group"><span class="ui-lab-control-label">Accent (couleur principale)</span>' +
              '<div class="ui-lab-swatch-row">' + swatches + '</div></div>' +
            '<div class="ui-lab-control-group"><span class="ui-lab-control-label">Navigation (test app seulement)</span>' +
              '<div class="ui-lab-chip-row">' +
                chip(session.navLayout === 'top', 'Barre haut', "window.styleMixerSet('navLayout','top')", 'data-mix-nav="top"') +
                chip(session.navLayout === 'sidebar-left', 'Sidebar', "window.styleMixerSet('navLayout','sidebar-left')", 'data-mix-nav="sidebar-left"') +
              '</div></div>' +
          '</div>' +
        '</details>' +

        '<section class="ui-lab-section style-mixer-export">' +
          '<h3 class="ui-lab-section-title"><span data-icon="clipboard-list"></span> Export</h3>' +
          '<p class="ui-lab-section-desc">Colle ce bloc dans le chat quand tu as choisi — j\'appliquerai le profil définitivement.</p>' +
          '<textarea id="styleMixerExportText" class="style-mixer-export-text" readonly rows="14"></textarea>' +
          '<button type="button" class="bp style-mixer-ui" onclick="window.styleMixerCopyExport()">Copier le profil</button>' +
        '</section>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
    window.styleMixerSyncPreview();
  };

  (function boot() {
    document.addEventListener('DOMContentLoaded', function () {
      if (window._activeTab === 'styleMixer' && typeof window.styleMixerEnterTab === 'function') {
        window.styleMixerEnterTab();
      }
    });
  })();
})();
