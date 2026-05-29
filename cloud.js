/**
 * ☁️ CLOUD & AUTH MANAGER (Google Drive + Firebase Auth)
 */
window.ADMIN_EMAIL = "devesc@hotmail.com"; // Mets ton vrai mail ici !

window.currentUser = null;

// Fonction de lancement sécurisée (Patiente que Firebase et app.js soient prêts)
function launchAppWhenReady(payload) {
    if (window.initAppAfterAuth) {
        window.initAppAfterAuth(payload);
    } else {
        console.log("⏳ Chargement des modules Firebase en cours, on patiente...");
        setTimeout(() => launchAppWhenReady(payload), 100); // Réessaye toutes les 0.1s
    }
}

// Fonction déclenchée par Google quand tu cliques sur ton compte
// Fonction déclenchée par Google quand tu cliques sur ton compte
window.handleCredentialResponse = async function(response) {
    // 1. Décodage du profil utilisateur Google
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    window.currentUser = payload;
    
    console.log("✅ Authentification Google réussie : " + payload.email);
    
    // 2. 🔐 LIAISON AVEC FIREBASE AUTH (Rend l'application impénétrable)
    if (window.auth && window.GoogleAuthProvider && window.signInWithCredential) {
        try {
            const credential = window.GoogleAuthProvider.credential(response.credential);
            const userCredential = await window.signInWithCredential(window.auth, credential);
            console.log("🔥 Authentification Firebase sécurisée validée ! UID:", userCredential.user.uid);
        } catch (authError) {
            console.error("❌ Échec de la liaison de sécurité Firebase Auth:", authError);
            if(window.appErrors) window.appErrors.push({ time: new Date().toLocaleTimeString(), msg: "Erreur Auth Firebase: " + authError.message, source: 'cloud.js' });
        }
    } else {
        console.warn("⚠️ Les modules Firebase Auth ne sont pas encore prêts, connexion en mode dégradé.");
    }
    
    // 💾 SAUVEGARDE EN MÉMOIRE : On retient l'utilisateur pour la prochaine fois
    localStorage.setItem('pc_user_session', JSON.stringify(payload));
    
    // 3. On cache l'écran de connexion et on déverrouille l'interface
    document.getElementById('loginOverlay').style.display = 'none';
    document.body.classList.remove('not-logged-in');
    
    // 4. On lance l'application
    launchAppWhenReady(payload);
};

window.signOut = function() {
    console.log("🚪 Déconnexion en cours...");
    
    // 1. On vide la mémoire du navigateur pour qu'il ne nous reconnecte pas tout seul
    localStorage.removeItem('pc_user_session'); 
    
    // 2. On dit à Google de nous déconnecter
    if (google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    
    // 3. On recharge la page pour faire réapparaître l'écran noir de connexion
    location.reload();
};

// 🚀 VÉRIFICATION AUTO-LOGIN AU DÉMARRAGE
window.checkSavedSession = function() {
    const saved = localStorage.getItem('pc_user_session');
    if(saved) {
        console.log("💾 Session retrouvée ! Connexion automatique en cours...");
        const payload = JSON.parse(saved);
        window.currentUser = payload;
        
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.style.display = 'none';
        
        document.body.classList.remove('not-logged-in');
        
        // On lance l'application
        launchAppWhenReady(payload);
    }
};

// On déclenche la vérification dès que la page HTML s'affiche
// Si la page est déjà chargée, on lance direct, sinon on attend un peu.
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
    
    // On met un drapeau pour dire au reste de l'appli (app.js) qu'on est en local
    window.isLocalMode = true; 
    
    // On cache l'écran de connexion
    document.getElementById('loginOverlay').style.display = 'none';
    document.body.classList.remove('not-logged-in');
    
    // On crée un "faux" utilisateur pour tromper l'application 
    // et lui faire croire qu'on est connecté, pour qu'elle s'ouvre !
    const localPayload = { 
        sub: 'local_test_user', 
        given_name: 'Testeur', 
        email: 'local@test.com' 
    };
    
    // On lance l'application avec ce faux compte
    launchAppWhenReady(localPayload);
};
