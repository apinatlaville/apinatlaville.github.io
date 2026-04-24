/**
 * ☁️ CLOUD & AUTH MANAGER (Google Drive + Firebase Auth)
 * Gère la connexion, le compte Admin et l'accès au stockage BYOS.
 */

window.G_CLIENT_ID = "889951150073-v91560remp86n50njmnmqhlbgn14pn65.apps.googleusercontent.com";
window.ADMIN_EMAIL = "devesc@hotmail.com"; // 🚨 REMPLACE PAR TON EMAIL POUR ÊTRE ADMIN

window.userToken = null;
window.currentUser = null;

// Initialise le bouton de connexion Google
window.initGoogleAuth = function() {
    google.accounts.id.initialize({
        client_id: window.G_CLIENT_ID,
        callback: window.handleCredentialResponse
    });
    google.accounts.id.renderButton(
        document.getElementById("googleBtn"),
        { theme: "outline", size: "large", width: "280" }
    );
};

window.handleCredentialResponse = function(response) {
    // Décodage simple du profil utilisateur
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    window.currentUser = payload;
    
    console.log("Connecté en tant que : " + payload.email);
    
    // Masquer l'écran de connexion et afficher l'appli
    document.getElementById('loginOverlay').style.display = 'none';
    
    // Lancer l'application principale
    if(window.initAppAfterAuth) window.initAppAfterAuth(payload);
};

window.signOut = function() {
    google.accounts.id.disableAutoSelect();
    location.reload();
};
