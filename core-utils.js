/**
 * core-utils.js — Utilitaires globaux chargés en premier.
 * escHtml · $ · écran de chargement (spinner)
 */
(function () {
  window.$ = window.$ || function (id) { return document.getElementById(id); };

  window.escHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  var bootDismissed = false;

  function splashEl() { return document.getElementById('splashScreen'); }

  /** No-op — conservé pour compatibilité avec cloud.js / app.js */
  window.setBootStep = function () {};

  /** Débloque la page : retire auth-pending + splash */
  window.unlockPage = function () {
    if (bootDismissed) return;
    bootDismissed = true;
    document.body.classList.remove('boot-active', 'auth-pending');
    var splash = splashEl();
    if (!splash) return;
    splash.classList.add('splash-out');
    setTimeout(function () {
      if (splash.parentNode) splash.remove();
    }, 400);
  };

  window.dismissSplash = function () {
    window.unlockPage();
  };

  /** Écran de connexion si le boot reste bloqué */
  window.forceLoginScreen = function () {
    window.unlockPage();
    document.body.classList.add('not-logged-in');
    document.documentElement.classList.add('pre-login');
    var loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.removeProperty('display');
    if (typeof window.initGoogleSignIn === 'function') window.initGoogleSignIn();
  };

  /* Secours : si init ne finit pas, afficher login après 12s */
  setTimeout(function () {
    if (!window.appReady && document.body.classList.contains('auth-pending')) {
      window.forceLoginScreen();
    }
  }, 12000);
})();
