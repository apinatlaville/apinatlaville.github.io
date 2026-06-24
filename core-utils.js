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

  window.setBootStep = function (stepId, customLabel) {
    var idx = BOOT_STEPS.findIndex(function (s) { return s.id === stepId; });
    if (idx < 0) return;
    if (idx <= bootIndex && !customLabel) return;
    bootIndex = Math.max(bootIndex, idx);

    var pct = Math.round(((bootIndex + 1) / BOOT_STEPS.length) * 100);
    var label = customLabel || BOOT_STEPS[bootIndex].label;

    var bar = document.getElementById('splashProgressBar');
    var lbl = document.getElementById('splashProgressLabel');
    var pctEl = document.getElementById('splashProgressPct');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = 'Chargement — ' + label + '…';
    if (pctEl) pctEl.textContent = pct + '%';
  };

  /** Débloque la page : retire les classes qui masquent tout le site */
  window.unlockPage = function () {
    document.body.classList.remove('boot-active', 'auth-pending');
    var splash = splashEl();
    if (splash && splash.parentNode) splash.remove();
    bootDismissed = true;
  };

  window.dismissSplash = function () {
    if (bootDismissed) return;
    window.setBootStep('data', 'Prêt');
    var splash = splashEl();
    if (splash) splash.classList.add('splash-out');
    setTimeout(window.unlockPage, 280);
  };

  /** Affiche l'écran de connexion si le boot reste bloqué */
  window.forceLoginScreen = function () {
    window.unlockPage();
    document.body.classList.add('not-logged-in');
    document.documentElement.classList.add('pre-login');
    var loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.removeProperty('display');
    if (typeof window.initGoogleSignIn === 'function') window.initGoogleSignIn();
  };

  /* Secours : auth-pending + splash parti = écran noir → forcer login */
  setTimeout(function () {
    if (document.body.classList.contains('auth-pending') || document.getElementById('splashScreen')) {
      if (!window.appReady && !window.appLaunched) {
        window.forceLoginScreen();
      } else {
        window.unlockPage();
      }
    }
  }, 7000);

  document.addEventListener('DOMContentLoaded', function () {
    var splash = document.getElementById('splashScreen');
    if (splash && typeof window.hydrateIcons === 'function') {
      window.hydrateIcons(splash);
    }
    if (typeof window.setBootStep === 'function') window.setBootStep('styles');
  });
})();
