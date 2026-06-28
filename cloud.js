/**
 * cloud.js — Démarrage direct (pas d'écran de connexion)
 */
window.currentUser = null;
window.isLocalMode = true;
window.appLaunched = false;

function defaultUserPayload() {
  var name = 'Étudiant';
  try {
    var raw = localStorage.getItem('backup_local_cours');
    if (raw) {
      var d = JSON.parse(raw);
      if (d.settings && d.settings.userName) name = d.settings.userName;
    }
  } catch (e) { /* ignore */ }
  return { sub: 'local_user', given_name: name, email: 'local@app' };
}

function enterAppUi() {
  if (typeof window.enterApp === 'function') window.enterApp();
  else if (typeof window.unlockPage === 'function') window.unlockPage();
}

function launchAppWhenReady(payload) {
  if (window.appLaunched) return;

  window._pendingAuthPayload = payload;
  var attempts = 0;
  var maxAttempts = 120;

  function tryLaunch() {
    if (window.appLaunched) return;
    attempts++;
    if (window.bootMark && (attempts === 1 || attempts % 10 === 0 || attempts >= maxAttempts)) {
      window.bootMark('launchApp.attempt', { n: attempts, hasInit: !!window.initAppAfterAuth });
    }

    if (window.initAppAfterAuth) {
      window.appLaunched = true;
      window._pendingAuthPayload = null;
      if (window.bootMark) window.bootMark('launchApp.success', { attempts: attempts });
      window.initAppAfterAuth(payload);
      return;
    }

    if (attempts >= maxAttempts) {
      if (window.bootMark) window.bootMark('launchApp.timeout', { attempts: attempts });
      console.error("❌ CRITIQUE : app.js n'a pas chargé à temps.");
      if (typeof window.unlockPage === 'function') window.unlockPage();
      return;
    }

    setTimeout(tryLaunch, 100);
  }

  tryLaunch();
}

window.addEventListener('app-js-ready', function () {
  if (window.appLaunched || !window._pendingAuthPayload || !window.initAppAfterAuth) return;
  window.appLaunched = true;
  var payload = window._pendingAuthPayload;
  window._pendingAuthPayload = null;
  window.initAppAfterAuth(payload);
});

window.checkSavedSession = function () {
  if (window.bootMark) window.bootMark('auth.autoStart');
  window.isLocalMode = true;
  localStorage.setItem('active_mode', 'local');
  window.currentUser = defaultUserPayload();
  enterAppUi();
  launchAppWhenReady(window.currentUser);
};

/* Compatibilité — plus d'écran de connexion */
window.startLocalMode = window.checkSavedSession;
window._startLocalModeImpl = window.checkSavedSession;
