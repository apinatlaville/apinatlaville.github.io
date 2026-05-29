/**
 * ☁️ CLOUD & AUTH MANAGER (Google Drive + Firebase Auth)
 */
window.ADMIN_EMAIL = "devesc@hotmail.com"; 

window.currentUser = null;
window.isLocalMode = false;

// Fonction de lancement sécurisée (attend que app.js soit prêt)
function launchAppWhenReady(payload) {
    if (window.initAppAfterAuth) {
        window.initAppAfterAuth(payload);
    } else {
        console.log("⏳ Chargement des modules de l'application, on patiente...");
        setTimeout(() => launchAppWhenReady(payload), 100);
    }
}

// 1️⃣ FONCTION DÉCLENCHÉE PAR GOOGLE
window.handleCredentialResponse = async function(response) {
    console.log("✅ Authentification Google réussie, liaison avec Firebase Auth...");
    
    if (window.auth && window.GoogleAuthProvider && window.signInWithCredential) {
        try {
            // On crée le badge de connexion Firebase grâce au jeton Google
            const credential = window.GoogleAuthProvider.credential(response.credential);
            // On connecte officiellement l'utilisateur dans Firebase Auth !
            await window.signInWithCredential(window.auth, credential);
            
            // On nettoie le mode local au cas où
            localStorage.removeItem('active_mode'); 
        } catch (authError) {
            console.error("❌ Échec de la liaison Firebase Auth:", authError);
            alert("Erreur d'authentification Firebase : " + authError.message);
        }
    } else {
        console.error("❌ Les modules Firebase Auth ne sont pas encore prêts dans index.html");
    }
};

// 2️⃣ BOUTON DÉCONNEXION (La Porte)
window.signOut = async function() {
    console.log("🚪 Déconnexion demandée...");
    localStorage.removeItem('active_mode');
    
    if (window.auth) {
        try {
            await window.auth.signOut(); // Déconnexion de Firebase
        } catch (e) {
            console.error(e);
        }
    }
    
    if (typeof google !== 'undefined' && google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    
    location.reload(); // Rechargement propre pour remettre le bouton Google à neuf
};

// 3️⃣ LE GARDIEN DE SESSION AUTOMATIQUE (onAuthStateChanged)
window.checkSavedSession = function() {
    // Si on a explicitement cliqué sur "Mode Local" au coup d'avant
    if (localStorage.getItem('active_mode') === 'local') {
        console.log("🌸 Reprise automatique du Mode Local.");
        window.startLocalMode();
        return;
    }

    // On attend que index.html ait fourni les outils à cloud.js
    if (!window.auth || !window.onAuthStateChanged) {
        setTimeout(window.checkSavedSession, 50);
        return;
    }

    console.log("🔒 Activation du gardien Firebase Auth...");

    // Firebase nous dit en temps réel si un utilisateur est déjà connecté
    window.onAuthStateChanged(window.auth, (user) => {
        if (window.isLocalMode) return; // Si on est en local, on ignore Firebase

        if (user) {
            console.log("💾 Session Firebase détectée et valide pour :", user.email);
            
            // Formatage du profil pour app.js
            const payload = {
                email: user.email,
                given_name: user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0],
                sub: user.uid
            };
            window.currentUser = payload;
            
            // On cache l'écran noir et on débloque l'application
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';
            document.body.classList.remove('not-logged-in');
            
            // On lance l'application avec les pleins pouvoirs !
            launchAppWhenReady(payload);
        } else {
            console.log("🚪 Aucun utilisateur connecté à Firebase.");
            if (!window.isLocalMode) {
                const loginOverlay = document.getElementById('loginOverlay');
                if (loginOverlay) loginOverlay.style.display = 'flex';
                document.body.classList.add('not-logged-in');
            }
        }
    });
};

// Lancement automatique du gardien
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.checkSavedSession);
} else {
    window.checkSavedSession();
}

// 4️⃣ GESTION DU MODE LOCAL (SANS CLOUD)
window.startLocalMode = function() {
    console.log("🌸 Mode Local activé !");
    window.isLocalMode = true; 
    localStorage.setItem('active_mode', 'local');
    
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
