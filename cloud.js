/**
 * Cloud & Auth Manager (Google + Firebase)
 */
window.currentUser = null;
window.isLocalMode = false;
window.appLaunched = false;

window.waitForFirebase = function(maxMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function tick() {
      if (window.firebaseReady) {
        window.firebaseReady.then(resolve).catch(reject);
        return;
      }
      if (window.auth && window.onAuthStateChanged && window.db && window.getDoc) {
        const ready = window.auth.authStateReady
          ? window.auth.authStateReady()
          : Promise.resolve();
        ready.then(resolve).catch(reject);
        return;
      }
      if (Date.now() - start > maxMs) {
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
    document.documentElement.classList.remove('pre-login');
    document.body.classList.remove('auth-pending', 'not-logged-in');
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.setProperty('display', 'none', 'important');
  }
}

function showLoginUi() {
  if (typeof window.setBootStep === 'function') window.setBootStep('auth', 'Connexion');
  if (typeof window.showLogin === 'function') window.showLogin();
  else {
    document.body.classList.remove('auth-pending');
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.removeProperty('display');
    document.body.classList.add('not-logged-in');
    document.documentElement.classList.add('pre-login');
  }
  if (typeof window.dismissSplash === 'function') window.dismissSplash();
}

function launchAppWhenReady(payload) {
  if (window.appLaunched) return;

  window._pendingAuthPayload = payload;
  let attempts = 0;
  const maxAttempts = 120;

  function tryLaunch() {
    if (window.appLaunched) return;
    attempts++;

    if (window.initAppAfterAuth) {
      window.appLaunched = true;
      window._pendingAuthPayload = null;
      window.initAppAfterAuth(payload);
      return;
    }

    if (attempts >= maxAttempts) {
      console.error("❌ CRITIQUE : app.js n'a pas chargé à temps.");
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
  console.log("✅ Authentification Google réussie, liaison Firebase Auth...");

  try {
    await window.waitForFirebase();
    const credential = window.GoogleAuthProvider.credential(response.credential);
    const userCredential = await window.signInWithCredential(window.auth, credential);

    localStorage.removeItem('active_mode');

    if (userCredential.user) {
      handleAuthenticatedUser(userCredential.user);
    }
  } catch (authError) {
    console.error("❌ Échec de la liaison Firebase Auth:", authError);
    alert("Erreur d'authentification Firebase : " + authError.message);
  }
};

// 2️⃣ BOUTON DÉCONNEXION
window.signOut = async function() {
  console.log("🚪 Déconnexion demandée...");
  localStorage.removeItem('active_mode');
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
  if (localStorage.getItem('active_mode') === 'local') {
    console.log("🌸 Reprise automatique du Mode Local.");
    window.startLocalMode();
    return;
  }

  try {
    await window.waitForFirebase();
    console.log("🔒 Firebase prêt — vérification de session...");

    const user = window.auth.currentUser;
    if (user) {
      console.log("Session Firebase restaurée pour :", user.email);
      handleAuthenticatedUser(user);
    } else {
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
          handleNoUser();
        }
      });
    }
  } catch (e) {
    console.error("Firebase indisponible :", e);
    showLoginUi();
  }
};

// 4️⃣ MODE LOCAL
window.startLocalMode = function() {
  console.log("Mode Local activé !");
  window.isLocalMode = true;
  localStorage.setItem('active_mode', 'local');
  enterAppUi();

  const localPayload = {
    sub: 'local_test_user',
    given_name: 'Testeur',
    email: 'local@test.com'
  };

  launchAppWhenReady(localPayload);
};
window._startLocalModeImpl = window.startLocalMode;

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', window.checkSavedSession);
} else {
  window.checkSavedSession();
}
