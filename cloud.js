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
window.handleCredentialResponse = function(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    window.currentUser = payload;
    
    console.log("✅ Connecté avec : " + payload.email);
    
    // 💾 SAUVEGARDE EN MÉMOIRE : On retient l'utilisateur pour la prochaine fois
    localStorage.setItem('pc_user_session', JSON.stringify(payload));
    
    // 1. On cache l'écran de connexion
    document.getElementById('loginOverlay').style.display = 'none';
    
    // 2. On déverrouille l'application entière
    document.body.classList.remove('not-logged-in');
    
    // 3. On lance l'application
    launchAppWhenReady(payload);
};

window.signOut = function() {
    localStorage.removeItem('pc_user_session'); // 🗑️ On efface la mémoire au moment de la déconnexion
    google.accounts.id.disableAutoSelect();
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
window.addEventListener('DOMContentLoaded', () => {
    window.checkSavedSession();
});
