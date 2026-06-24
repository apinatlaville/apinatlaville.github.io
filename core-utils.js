/**
 * core-utils.js — Utilitaires globaux chargés en premier.
 * escHtml · $ · écran de chargement (boot)
 */
(function () {
  window.$ = window.$ || function (id) { return document.getElementById(id); };

  window.escHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  var BOOT_STEPS = [
    { id: 'styles', label: 'Styles' },
    { id: 'scripts', label: 'Modules' },
    { id: 'app', label: 'Application' },
    { id: 'auth', label: 'Session' },
    { id: 'data', label: 'Données' }
  ];

  var bootIndex = -1;
  var bootDismissed = false;

  function splashEl() { return document.getElementById('splashScreen'); }
  function splashBar() { return document.getElementById('splashProgressBar'); }
  function splashLabel() { return document.getElementById('splashProgressLabel'); }
  function splashPct() { return document.getElementById('splashProgressPct'); }

  window.setBootStep = function (stepId, customLabel) {
    var idx = BOOT_STEPS.findIndex(function (s) { return s.id === stepId; });
    if (idx < 0) return;
    if (idx <= bootIndex && !customLabel) return;
    bootIndex = Math.max(bootIndex, idx);

    var pct = Math.round(((bootIndex + 1) / BOOT_STEPS.length) * 100);
    var label = customLabel || BOOT_STEPS[bootIndex].label;

    var bar = splashBar();
    var lbl = splashLabel();
    var pctEl = splashPct();
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = 'Chargement — ' + label + '…';
    if (pctEl) pctEl.textContent = pct + '%';
  };

  window.dismissSplash = function () {
    if (bootDismissed) return;
    bootDismissed = true;
    window.setBootStep('data', 'Prêt');

    var splash = splashEl();
    if (!splash) return;

    splash.classList.add('splash-out');
    setTimeout(function () {
      splash.remove();
      document.body.classList.remove('boot-active');
    }, 450);
  };

  if (document.body) {
    document.body.classList.add('boot-active');
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.classList.add('boot-active');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var splash = document.getElementById('splashScreen');
    if (splash && typeof window.hydrateIcons === 'function') {
      window.hydrateIcons(splash);
    }
    if (typeof window.setBootStep === 'function') window.setBootStep('styles');
  });
})();
