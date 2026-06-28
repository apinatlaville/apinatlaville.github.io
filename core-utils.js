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

  /** Débloque la page : retire boot-active + splash */
  window.unlockPage = function () {
    if (bootDismissed) return;
    bootDismissed = true;
    document.body.classList.remove('boot-active');
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

  /** Secours si le boot reste bloqué */
  window.forceLoginScreen = function () {
    if (window.bootMark) window.bootMark('boot.forceUnlock');
    window.unlockPage();
  };

  setTimeout(function () {
    if (!window.appReady && document.body.classList.contains('boot-active')) {
      if (window.bootMark) window.bootMark('boot.timeout12s.forceUnlock');
      window.forceLoginScreen();
    }
  }, 12000);
})();
