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
        setTimeout(() => launchAppWhenReady(payload), 100); // Réessaye toutes les 0.1s
    }
}

// Fonction déclenchée par Google quand tu cliques sur ton compte
window.handleCredentialResponse = function(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    window.currentUser = payload;
    
    console.log("✅ Connecté avec : " + payload.email);
    
    // 💾 SAUVEGARDE EN MÉMOIRE : On retient l'utilisateur pour la prochaine fois
    localStorage.setItem('pc_user_session', JSON.stringify(payload));
    
    // 1. On cache l'écran de connexion
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';
    
    // 2. On déverrouille l'application entière
    document.body.classList.remove('not-logged-in');
    
    // 3. On lance l'application
    launchAppWhenReady(payload);
};

// =========================================================
// 🚪 LE FIX DE LA DÉCONNEXION
// =========================================================
window.signOut = function() {
    console.log("🚪 Déconnexion demandée...");
    
    // 1. On supprime proprement le jeton de session
    localStorage.removeItem('pc_user_session');
    
    // 2. On dit à Google de désactiver la sélection automatique pour éviter les boucles infinies
    if (typeof google !== 'undefined' && google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    
    // 3. ⚡ LE FIX MAGIQUE : On recharge la page complète !
    // Cela réinitialise proprement le bouton Google pour qu'il soit à nouveau cliquable à 100%
    location.reload();
};

// On vérifie s'il y a une session enregistrée au démarrage
window.checkSavedSession = function() {
    const saved = localStorage.getItem('pc_user_session');
    if (saved) {
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
window.addEventListener('DOMContentLoaded', () => {
    window.checkSavedSession();
});

// =========================================================
// 🌸 GESTION DU MODE LOCAL (SANS FIREBASE)
// =========================================================
window.startLocalMode = function() {
    console.log("🌸 Mode Local activé !");
    
    // On met un drapeau pour dire au reste de l'appli (app.js) qu'on est en local
    window.isLocalMode = true; 
    
    // On cache l'écran de connexion
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';
    document.body.classList.remove('not-logged-in');
    
    // On crée un "faux" utilisateur pour tromper l'application 
    const localPayload = { 
        sub: 'local_test_user', 
        given_name: 'Testeur', 
        email: 'local@test.com' 
    };
    
    // On lance l'application avec ce payload de test
    launchAppWhenReady(localPayload);
};
