/**
 * ☁️ CLOUD & AUTH MANAGER (Google Drive + Firebase Auth)
 */
window.ADMIN_EMAIL = "devesc@hotmail.com"; 

window.currentUser = null;

// Fonction de lancement sécurisée (Patiente que Firebase et app.js soient prêts)
function launchAppWhenReady(payload) {
    if (window.initAppAfterAuth) {
        window.initAppAfterAuth(payload);
    } else {
        console.log("⏳ Chargement des modules Firebase en cours, on patiente...");
        setTimeout(() => launchAppWhenReady(payload), 100);
    }
}

// Fonction déclenchée par Google quand tu cliques sur ton compte
// Fonction déclenchée par Google quand tu cliques sur ton compte
window.handleCredentialResponse = async function(response) {
    console.log("✅ Authentification Google réussie, liaison Firebase en cours...");
    
    if (window.auth && window.GoogleAuthProvider && window.signInWithCredential && window.setPersistence) {
        try {
            // 💾 LE FIX MAGIQUE : On force Firebase à écrire la session dans le disque dur simple du navigateur
            await window.setPersistence(window.auth, window.browserLocalPersistence);
            
            const credential = window.GoogleAuthProvider.credential(response.credential);
            await window.signInWithCredential(window.auth, credential);
            
            // On nettoie la mémoire du mode local pour éviter les conflits
            localStorage.removeItem('active_mode'); 
        } catch (authError) {
            console.error("❌ Échec de la liaison Firebase Auth:", authError);
            if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur Auth: " + authError.message, source: 'cloud.js' });
            alert("Erreur d'authentification : " + authError.message);
        }
    } else {
        console.warn("⚠️ Les modules de sécurité ne sont pas encore prêts.");
    }
};
// Fonction de déconnexion propre
window.signOut = async function() {
    console.log("🚪 Déconnexion demandée...");
    
    if (window.auth) {
        try {
            await window.auth.signOut(); // Déconnexion officielle de Firebase
        } catch (e) {
            console.error("Erreur lors de la déconnexion Firebase:", e);
        }
    }
    
    if (google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    
    location.reload();
};

// =========================================================
// 🔄 GARDIEN DE SESSION AUTOMATIQUE (Natif Firebase)
// =========================================================
window.checkSavedSession = function() {
    // Si Firebase Auth n'est pas encore prêt, on attend un tout petit peu
    if (!window.auth || !window.onAuthStateChanged) {
        setTimeout(window.checkSavedSession, 50);
        return;
    }

    console.log("🔒 Activation du gardien de session Firebase Auth...");

    // On écoute en temps réel l'état de connexion de Firebase
    window.onAuthStateChanged(window.auth, (user) => {
        // Si l'utilisateur a volontairement cliqué sur le "Mode Local", on n'écoute pas Firebase
        if (window.isLocalMode) return;

        if (user) {
            console.log("💾 Session sécurisée Firebase détectée pour :", user.email);
            
            // On crée le payload d'informations dont app.js a besoin
            const payload = {
                email: user.email,
                given_name: user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0],
                sub: user.uid
            };
            window.currentUser = payload;
            
            // On cache l'écran noir de connexion
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';
            document.body.classList.remove('not-logged-in');
            
            // On lance l'application avec les pleins droits d'accès sécurisés !
            launchAppWhenReady(payload);
        } else {
            console.log("🚪 Aucun utilisateur Firebase connecté.");
            // Si pas connecté et pas en mode local, on s'assure que l'écran noir reste actif
            if (!window.isLocalMode) {
                const loginOverlay = document.getElementById('loginOverlay');
                if (loginOverlay) loginOverlay.style.display = 'flex';
                document.body.classList.add('not-logged-in');
            }
        }
    });
};

// On lance le gardien de session dès le chargement de la page
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.checkSavedSession);
} else {
    window.checkSavedSession();
}

// =========================================================
// 🌸 GESTION DU MODE LOCAL (SANS FIREBASE)
// =========================================================
window.startLocalMode = function() {
    console.log("🌸 Mode Local activé !");
    window.isLocalMode = true; 
    
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';
    document.body.classList.remove('not-logged-in');
    
    const localPayload = { 
        sub: 'local_test_user', 
        given_name: 'Testeur', 
        email: 'local@test.com' 
    };
    
    launchAppWhenReady(localPayload);
};
