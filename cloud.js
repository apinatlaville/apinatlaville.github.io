/**
 * Cloud & Auth Manager (Google + Firebase)
 */
window.currentUser = null;
window.isLocalMode = false;
window.appLaunched = false;

window.waitForFirebase = function(maxMs = 20000) {
  if (window.bootMark) window.bootMark('firebase.wait.start', { maxMs: maxMs });
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function tick() {
      if (window.firebaseReady) {
        window.firebaseReady.then(function (r) {
          if (window.bootMark) window.bootMark('firebase.wait.done', { ms: Date.now() - start });
          resolve(r);
        }).catch(function (e) {
          if (window.bootMark) window.bootMark('firebase.wait.error', { ms: Date.now() - start, error: e.message });
          reject(e);
        });
        return;
      }
      if (window.auth && window.onAuthStateChanged && window.db && window.getDoc) {
        const ready = window.auth.authStateReady
          ? window.auth.authStateReady()
          : Promise.resolve();
        ready.then(function (r) {
          if (window.bootMark) window.bootMark('firebase.wait.done', { ms: Date.now() - start, via: 'direct' });
          resolve(r);
        }).catch(function (e) {
          if (window.bootMark) window.bootMark('firebase.wait.error', { ms: Date.now() - start, error: e.message });
          reject(e);
        });
        return;
      }
      if (Date.now() - start > maxMs) {
        if (window.bootMark) window.bootMark('firebase.wait.timeout', { ms: maxMs });
        reject(new Error('Firebase non disponible après ' + maxMs + 'ms'));
        return;
      }
      setTimeout(tick, 50);
    }
    tick();
  });
};

function userPayload(user) {
  return {
    email: user.email,
    given_name: user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0],
    sub: user.uid
  };
}

function enterAppUi() {
  if (typeof window.setBootStep === 'function') window.setBootStep('auth', 'Connexion');
  if (typeof window.enterApp === 'function') window.enterApp();
  else {
    if (typeof window.unlockPage === 'function') window.unlockPage();
    document.documentElement.classList.remove('pre-login');
    document.body.classList.remove('auth-pending', 'not-logged-in', 'boot-active');
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.setProperty('display', 'none', 'important');
  }
}

function showLoginUi() {
  if (typeof window.setBootStep === 'function') window.setBootStep('auth', 'Connexion');
  if (typeof window.showLogin === 'function') window.showLogin();
  else {
    if (typeof window.forceLoginScreen === 'function') window.forceLoginScreen();
    else {
      document.body.classList.remove('auth-pending', 'boot-active');
      const loginOverlay = document.getElementById('loginOverlay');
      if (loginOverlay) loginOverlay.style.removeProperty('display');
      document.body.classList.add('not-logged-in');
      document.documentElement.classList.add('pre-login');
    }
  }
}

function launchAppWhenReady(payload) {
  if (window.appLaunched) return;

  window._pendingAuthPayload = payload;
  let attempts = 0;
  const maxAttempts = 120;

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
      if (typeof window.forceLoginScreen === 'function') window.forceLoginScreen();
      else showLoginUi();
      const loginOverlay = document.getElementById('loginOverlay');
      if (loginOverlay) {
        let debugDiv = document.getElementById('debug-auth-error');
        if (!debugDiv) {
          debugDiv = document.createElement('div');
          debugDiv.id = 'debug-auth-error';
          debugDiv.style.color = "var(--red)";
          debugDiv.style.marginTop = "20px";
          debugDiv.style.fontWeight = "bold";
          debugDiv.style.textAlign = "center";
          loginOverlay.appendChild(debugDiv);
        }
        debugDiv.innerHTML = (window.iconLabel ? window.iconLabel('circle-x', 'Le chargement automatique bloque.') : 'Le chargement automatique bloque.') + "<br><small style='font-weight:normal;color:#aaa;'>Vérifie la console (F12) : app.js a probablement un problème ou Firebase ne répond pas.</small>";
      }
      return;
    }

    setTimeout(tryLaunch, 100);
  }

  tryLaunch();
}

window.addEventListener('app-js-ready', function() {
  if (window.appLaunched || !window._pendingAuthPayload || !window.initAppAfterAuth) return;
  window.appLaunched = true;
  const payload = window._pendingAuthPayload;
  window._pendingAuthPayload = null;
  window.initAppAfterAuth(payload);
});

function handleAuthenticatedUser(user) {
  if (window.isLocalMode || window.appLaunched) return;
  const payload = userPayload(user);
  window.currentUser = payload;
  enterAppUi();
  launchAppWhenReady(payload);
}

function handleNoUser() {
  if (window.isLocalMode || window.appLaunched) return;
  console.log("Aucun utilisateur connecté à Firebase.");
  showLoginUi();
}

// 1️⃣ FONCTION DÉCLENCHÉE PAR GOOGLE
window.handleCredentialResponse = async function(response) {
  if (window.bootMark) window.bootMark('auth.google.start');
  console.log("✅ Authentification Google réussie, liaison Firebase Auth...");

  try {
    await window.waitForFirebase();
    const credential = window.GoogleAuthProvider.credential(response.credential);
    const userCredential = await window.signInWithCredential(window.auth, credential);

    if (typeof window.safeLocalRemove === 'function') window.safeLocalRemove('active_mode');
    else try { localStorage.removeItem('active_mode'); } catch (e) {}

    if (userCredential.user) {
      if (window.bootMark) window.bootMark('auth.google.ok', { email: userCredential.user.email });
      handleAuthenticatedUser(userCredential.user);
    }
  } catch (authError) {
    if (window.bootMark) window.bootMark('auth.google.error', { error: authError.message });
    console.error("❌ Échec de la liaison Firebase Auth:", authError);
    const M = window.APP_MSG || {};
    const msg = (M.AUTH_FIREBASE || "Erreur d'authentification Firebase") + ' : ' + authError.message;
    if (typeof window.sysAlert === 'function') window.sysAlert(window.escHtml(msg), M.ERROR || 'Erreur');
    else if (typeof window.showToast === 'function') window.showToast(msg);
    else alert(msg);
  }
};

// 2️⃣ BOUTON DÉCONNEXION
window.signOut = async function() {
  console.log("🚪 Déconnexion demandée...");
  if (window.DeviceSession && typeof window.DeviceSession.stop === 'function') {
    try { window.DeviceSession.stop(); } catch (e) { /* ignore */ }
  }
  if (typeof window.safeLocalRemove === 'function') window.safeLocalRemove('active_mode');
  else try { localStorage.removeItem('active_mode'); } catch (e) {}
  window.appLaunched = false;
  window.appReady = false;
  window._authListenerAttached = false;

  if (window.auth) {
    try {
      await window.auth.signOut();
    } catch (e) {
      console.error("Erreur à la déconnexion :", e);
    }
  }

  if (typeof google !== 'undefined' && google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }

  setTimeout(() => {
    location.reload();
  }, 500);
};

// 3️⃣ GARDIEN DE SESSION (authStateReady + onAuthStateChanged)
window.checkSavedSession = async function() {
  if (window.bootMark) window.bootMark('auth.checkSavedSession.start');
  var activeMode = typeof window.safeLocalGet === 'function'
    ? window.safeLocalGet('active_mode')
    : (function () { try { return localStorage.getItem('active_mode'); } catch (e) { return null; } })();
  if (activeMode === 'local') {
    console.log("🌸 Reprise automatique du Mode Local.");
    if (window.bootMark) window.bootMark('auth.mode.local');
    window.startLocalMode();
    return;
  }

  try {
    await window.waitForFirebase();
    console.log("🔒 Firebase prêt — vérification de session...");
    if (window.bootMark) window.bootMark('auth.session.check');

    const user = window.auth.currentUser;
    if (user) {
      console.log("Session Firebase restaurée pour :", user.email);
      if (window.bootMark) window.bootMark('auth.session.restored', { email: user.email });
      handleAuthenticatedUser(user);
    } else {
      if (window.bootMark) window.bootMark('auth.session.none');
      handleNoUser();
    }

    if (!window._authListenerAttached) {
      window._authListenerAttached = true;
      window.onAuthStateChanged(window.auth, (authUser) => {
        if (window.isLocalMode) return;
        if (authUser) {
          if (!window.appLaunched) {
            console.log("Session Firebase détectée :", authUser.email);
            handleAuthenticatedUser(authUser);
          }
        } else if (window.appLaunched) {
          // Session perdue alors que l'app tournait — handleNoUser ignore appLaunched
          console.warn('Session Firebase perdue — retour écran de connexion.');
          window.appLaunched = false;
          window.appReady = false;
          if (window.DeviceSession && typeof window.DeviceSession.stop === 'function') {
            try { window.DeviceSession.stop(); } catch (e) { /* ignore */ }
          }
          showLoginUi();
        }
      });
    }
  } catch (e) {
    console.error("Firebase indisponible :", e);
    if (window.bootMark) window.bootMark('auth.checkSavedSession.error', { error: e.message });
    showLoginUi();
  }
};

// 4️⃣ MODE LOCAL
window.startLocalMode = function() {
  console.log("Mode Local activé !");
  if (window.bootMark) window.bootMark('auth.startLocalMode');
  window.isLocalMode = true;
  if (typeof window.safeLocalSet === 'function') window.safeLocalSet('active_mode', 'local');
  else try { localStorage.setItem('active_mode', 'local'); } catch (e) {}
  enterAppUi();

  const localPayload = {
    sub: 'local_test_user',
    given_name: 'Testeur',
    email: 'local@test.com'
  };

  launchAppWhenReady(localPayload);
};
window._startLocalModeImpl = window.startLocalMode;

/* Auth déclenchée par boot-loader.js après chargement de app.js */
