/**
 * core-utils.js — Utilitaires globaux chargés en premier.
 * escHtml · $ · toast / erreurs · messages · dates · storage · helpers UI
 */
(function () {
  window.$ = window.$ || function (id) { return document.getElementById(id); };

  /** Media query mobile unique (alignée sur ui-shell / nav) */
  window.MQ_MOBILE = '(max-width: 767px)';
  window.isMobileViewport = function () {
    return !!(window.matchMedia && window.matchMedia(window.MQ_MOBILE).matches);
  };

  window.escHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  /** Appelle window[name] si c'est une fonction (évite les typeof répétés) */
  window.callIf = function (name) {
    var fn = window[name];
    if (typeof fn !== 'function') return undefined;
    return fn.apply(window, Array.prototype.slice.call(arguments, 1));
  };

  /** Messages / labels UI partagés — une seule source */
  window.APP_MSG = {
    ERROR: 'Erreur',
    ERROR_NETWORK_PREFIX: 'Erreur réseau : ',
    ERROR_PREFIX: 'Erreur : ',
    RELOAD_HINT: 'Recharge la page ou vérifie ta connexion réseau.',
    RELOAD_SHORT: 'Recharge la page.',
    DEMO_DATA_MISSING: 'Fichier demo-data.js non chargé.',
    DEMO_SAVE_FAIL: 'La démo n\'a pas pu être enregistrée. Réessaie.',
    DATA_NOT_READY: 'Données non chargées — réessaie dans un instant.',
    DATA_NOT_READY_SHORT: 'Données non chargées.',
    SECONDARY_READ_ONLY: 'Appareil secondaire : les modifications ne sont pas enregistrées ici.',
    SAVE_LOCAL_FAIL: 'Impossible d\'enregistrer tes données dans le navigateur.',
    SAVE_DISABLED: 'Enregistrement impossible : tes données n\'ont pas pu être chargées au démarrage.<br><br><b>Rien ne sera sauvegardé</b> dans cette session.',
    SAVE_DISABLED_TITLE: 'Sauvegarde désactivée',
    SYNC_TITLE: 'Erreur de synchronisation',
    LOAD_TITLE: 'Erreur de chargement',
    BOOT_TITLE: 'Erreur de démarrage',
    AUTH_FIREBASE: 'Erreur d\'authentification Firebase',
    SCANNER_LIB_MISSING: 'Le module caméra n\'est pas chargé. Utilise la saisie manuelle ou recharge la page.',
    QUEUE_EMPTY: 'Aucune carte à réviser.',
    QUEUE_EMPTY_MANUAL: 'Sélectionne des cartes en mode manuel.',
    EMPTY_RESERVOIR: 'Aucune carte dans le réservoir.',
    EMPTY_FILTERS: 'Aucune carte ne correspond aux filtres.',
    EMPTY_SEARCH: 'Aucun résultat',
    ABANDON_SESSION_TITLE: 'Abandonner la session',
    ABANDON_EVENING: 'Abandonner la session du soir ?<br>La file sera effacée — les cartes déjà notées restent enregistrées.',
    ABANDON_ACTIVE: 'Abandonner cette session ? La file en cours sera effacée (les cartes déjà notées restent enregistrées).',
    CANCEL: 'Annuler',
    CONFIRM: 'Confirmer',
    OK: 'OK',
    SAVE: 'Enregistrer',
    EDIT: 'Modifier',
    DELETE: 'Supprimer',
    CLOSE: 'Fermer',
    CREATE: 'Créer',
    NEW_CARD: 'Nouvelle carte',
    MOVE: 'Déplacer',
    DONE: 'Terminer'
  };

  var _toastHideTimer = null;

  /** Affiche le toast global (#errorToast). opts.duration: ms (0 = sticky) */
  window.showToast = function (msg, opts) {
    opts = opts || {};
    var toast = document.getElementById('errorToast');
    var toastMsg = document.getElementById('errorToastMsg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = String(msg == null ? '' : msg);
    toast.classList.remove('hidden');
    if (_toastHideTimer) clearTimeout(_toastHideTimer);
    _toastHideTimer = null;
    var ms = opts.duration;
    if (ms == null) ms = 6000;
    if (ms > 0) {
      _toastHideTimer = setTimeout(function () {
        toast.classList.add('hidden');
      }, ms);
    }
  };

  window.hideToast = function () {
    if (_toastHideTimer) clearTimeout(_toastHideTimer);
    _toastHideTimer = null;
    var toast = document.getElementById('errorToast');
    if (toast) toast.classList.add('hidden');
  };

  /**
   * Enregistre une erreur dans appErrors (+ logs + toast optionnel).
   * opts: { toast, toastMsg, lineno, sticky }
   */
  window.recordAppError = function (msg, source, opts) {
    opts = opts || {};
    if (!window.appErrors) window.appErrors = [];
    var time = new Date().toLocaleTimeString();
    var entry = {
      time: time,
      msg: String(msg == null ? '' : msg),
      source: source || 'app',
      lineno: opts.lineno != null ? opts.lineno : 0
    };
    window.appErrors.push(entry);
    if (typeof window.renderErrorLogs === 'function') window.renderErrorLogs();
    if (opts.toast) {
      window.showToast(opts.toastMsg != null ? opts.toastMsg : entry.msg, {
        duration: opts.sticky ? 0 : opts.duration
      });
    }
    return entry;
  };

  /** Erreur inline sous un champ formulaire (bordure rouge + message) */
  window.showInlineError = function (input, msg, opts) {
    opts = opts || {};
    if (!input) return;
    var duration = opts.duration != null ? opts.duration : 4000;
    if (input._inlineErrorTimer) {
      clearTimeout(input._inlineErrorTimer);
      input._inlineErrorTimer = null;
    }
    input.style.border = '2px solid var(--red)';
    var errText = input.nextElementSibling;
    if (!errText || errText.className !== 'inline-error') {
      errText = document.createElement('div');
      errText.className = 'inline-error';
      errText.style.color = 'var(--red)';
      errText.style.fontSize = '12px';
      errText.style.marginTop = '5px';
      errText.style.fontWeight = 'bold';
      if (input.parentNode) input.parentNode.insertBefore(errText, input.nextSibling);
    }
    var icon = typeof window.iconHtml === 'function'
      ? window.iconHtml('circle-x', 14, 'icon-sm') + ' '
      : '';
    errText.innerHTML = icon + String(msg == null ? '' : msg);
    input._inlineErrorTimer = setTimeout(function () {
      input.style.border = '';
      if (errText && errText.parentNode) errText.parentNode.removeChild(errText);
      input._inlineErrorTimer = null;
    }, duration);
  };

  /** Bannière d'erreur dans un formulaire (élément #id avec classe .visible) */
  window.showFormError = function (elId, msg) {
    var el = typeof elId === 'string' ? document.getElementById(elId) : elId;
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.add('visible');
    } else {
      el.textContent = '';
      el.classList.remove('visible');
    }
  };

  /** Ferme un overlay par id (classe .hidden) */
  window.hideOverlay = function (id) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.classList.add('hidden');
  };

  /** Accès localStorage sécurisé (Safari privé / quota) */
  window.safeLocalGet = function (key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  };
  window.safeLocalSet = function (key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  };
  window.safeLocalRemove = function (key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  };

  /** Date locale YYYY-MM-DD (évite le décalage UTC de toISOString) */
  window.localDateISO = function (d) {
    var dt = d ? new Date(d) : new Date();
    if (isNaN(dt.getTime())) return window.localDateISO(new Date());
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  };
  window.todayISO = function () {
    return window.localDateISO(new Date());
  };
  window.nowISO = function () {
    return new Date().toISOString();
  };

  window._bootScriptErrors = window._bootScriptErrors || [];

  window.recordScriptLoadError = function (name, critical) {
    var entry = { name: name, critical: !!critical };
    var exists = window._bootScriptErrors.some(function (e) { return e.name === name; });
    if (!exists) window._bootScriptErrors.push(entry);
    var msg = 'Fichier non chargé : ' + name;
    window.recordAppError(msg, 'boot-loader', {
      toast: true,
      toastMsg: msg,
      sticky: !!critical
    });
    return entry;
  };

  window.notifyScriptLoadFailures = function (errors) {
    if (!errors || !errors.length) return;
    var names = errors.map(function (e) { return e.name; }).join(', ');
    var hasCritical = errors.some(function (e) { return e.critical; });
    var M = window.APP_MSG;
    var body = 'Certains fichiers n\'ont pas pu être chargés : <b>' + window.escHtml(names) + '</b>.<br><br>' +
      M.RELOAD_HINT;
    if (hasCritical) {
      body += '<br><br><b>L\'application peut ne pas fonctionner correctement.</b>';
    }
    if (typeof window.sysAlert === 'function') {
      window.sysAlert(body, M.LOAD_TITLE);
    } else {
      var plain = 'Fichiers non chargés : ' + names + '. ' + M.RELOAD_HINT;
      window.showToast(plain, { duration: 0 });
    }
  };

  var bootDismissed = false;

  function splashEl() { return document.getElementById('splashScreen'); }

  /** No-op — conservé pour compatibilité avec cloud.js / app.js */
  window.setBootStep = function () {};

  /** Débloque la page : retire auth-pending + splash */
  window.unlockPage = function () {
    document.body.classList.remove('boot-active', 'auth-pending');
    if (bootDismissed) return;
    bootDismissed = true;
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
    // Si l'auth a déjà lancé l'app (initApp lent), ne jamais réafficher le login :
    // sinon l'utilisateur reclique Google et handleAuthenticatedUser no-op (appLaunched).
    if (window.appLaunched) {
      if (window.bootMark) window.bootMark('boot.forceLoginScreen.skipped.appLaunched');
      console.warn('[Auth] forceLoginScreen ignoré — app déjà lancée');
      if (typeof window.enterApp === 'function') window.enterApp();
      else window.unlockPage();
      return;
    }
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
   * Ne pas forcer le login si l'utilisateur est déjà authentifié (appLaunched)
   * — typiquement initApp / Firestore lent sur mauvaise connexion.
   */
  setTimeout(function () {
    if (window.appReady) return;
    if (!document.body.classList.contains('auth-pending')) return;
    if (window.appLaunched) {
      if (window.bootMark) window.bootMark('boot.timeout12s.appLaunched.keepWaiting');
      console.warn('[Auth] Timeout 12s — app lancée, init encore en cours (pas de retour login)');
      return;
    }
    if (window.bootMark) window.bootMark('boot.timeout12s.forceLogin');
    window.forceLoginScreen();
  }, 12000);
})();
