/**
 * ☁️ CLOUD & AUTH MANAGER (Google Drive + Firebase Auth)
 */
window.ADMIN_EMAIL = "devesc@hotmail.com"; // Mets ton vrai mail ici !

window.currentUser = null;

// Fonction déclenchée par Google quand tu cliques sur ton compte
window.handleCredentialResponse = function(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    window.currentUser = payload;
    
    console.log("Connecté avec : " + payload.email);
    
    // 1. On cache l'écran de connexion
    document.getElementById('loginOverlay').style.display = 'none';
    
    // 2. On déverrouille l'application entière
    document.body.classList.remove('not-logged-in');
    
    // 3. On charge tes cours personnels !
    if(window.initAppAfterAuth) window.initAppAfterAuth(payload);
};

window.signOut = function() {
    google.accounts.id.disableAutoSelect();
    location.reload();
};
