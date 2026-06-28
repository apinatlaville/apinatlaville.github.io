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

  window._bootScriptErrors = window._bootScriptErrors || [];

  window.recordScriptLoadError = function (name, critical) {
    var entry = { name: name, critical: !!critical };
    var exists = window._bootScriptErrors.some(function (e) { return e.name === name; });
    if (!exists) window._bootScriptErrors.push(entry);
    var time = new Date().toLocaleTimeString();
    var msg = 'Fichier non chargé : ' + name;
    if (!window.appErrors) window.appErrors = [];
    window.appErrors.push({ time: time, msg: msg, source: 'boot-loader', lineno: 0 });
    if (typeof window.renderErrorLogs === 'function') window.renderErrorLogs();
    var toast = document.getElementById('errorToast');
    var toastMsg = document.getElementById('errorToastMsg');
    if (toast && toastMsg) {
      toastMsg.textContent = msg;
      toast.classList.remove('hidden');
    }
    return entry;
  };

  window.notifyScriptLoadFailures = function (errors) {
    if (!errors || !errors.length) return;
    var names = errors.map(function (e) { return e.name; }).join(', ');
    var hasCritical = errors.some(function (e) { return e.critical; });
    var body = 'Certains fichiers n\'ont pas pu être chargés : <b>' + window.escHtml(names) + '</b>.<br><br>' +
      'Recharge la page ou vérifie ta connexion réseau.';
    if (hasCritical) {
      body += '<br><br><b>L\'application peut ne pas fonctionner correctement.</b>';
    }
    if (typeof window.sysAlert === 'function') {
      window.sysAlert(body, 'Erreur de chargement');
    }
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
    if (window.bootMark) window.bootMark('boot.forceLoginScreen');
    window.unlockPage();
    document.body.classList.add('not-logged-in');
    document.documentElement.classList.add('pre-login');
    var loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.removeProperty('display');
    if (typeof window.initGoogleSignIn === 'function') window.initGoogleSignIn();
  };

  /**
   * Secours boot (délai unique) : si l'app n'est pas prête après 12 s
   * et que l'écran d'auth est encore masqué, afficher la connexion.
   * (Ne pas dupliquer ce timer ailleurs — ex. index.html.)
   */
  setTimeout(function () {
    if (!window.appReady && document.body.classList.contains('auth-pending')) {
      if (window.bootMark) window.bootMark('boot.timeout12s.forceLogin');
      window.forceLoginScreen();
    }
  }, 12000);
})();
