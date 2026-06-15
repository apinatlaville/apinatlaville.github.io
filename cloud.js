/**
 * ☁️ CLOUD & AUTH MANAGER (Google Drive + Firebase Auth)
 */
window.ADMIN_EMAIL = "devesc@hotmail.com"; 

window.currentUser = null;
window.isLocalMode = false;
window.appLaunched = false; // 🛡️ FIX : Évite de lancer l'application deux fois

let launchAttempts = 0; // Compteur pour traquer le blocage

function launchAppWhenReady(payload) {
    // 🛡️ FIX : Empêche le double lancement si les deux gardiens (handleCredentialResponse
    // ET onAuthStateChanged) se déclenchent en même temps (cas fréquent)
    if (window.appLaunched) {
        console.log("⚠️ [Double lancement bloqué] L'application est déjà initialisée.");
        return;
    }
    launchAttempts++;
    
    // Ajout d'un log visible dans la console du navigateur
    console.log(`⏳ [Aide-Debug] Tentative ${launchAttempts} : Attente que app.js s'initialise...`);

    if (window.initAppAfterAuth) {
        console.log("🚀 [Succès] app.js est détecté ! Lancement de l'application.");
        window.appLaunched = true;
        window.initAppAfterAuth(payload);
    } else {
        // 🚨 SÉCURITÉ : Si après 5 secondes (50 essais de 100ms) app.js ne répond pas
        if (launchAttempts > 50) {
            console.error("❌ CRITIQUE : Le fichier app.js n'a pas chargé ou contient une erreur fatale.");
            
            // On écrit le bug directement sur ton écran de chargement pour que tu le voies
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
                debugDiv.innerHTML = "❌ Le chargement automatique bloque.<br><small style='font-weight:normal;color:#aaa;'>Vérifie la console (F12) : app.js a probablement un problème ou Firebase ne répond pas.</small>";
            }
            return; // On arrête la boucle infinie pour ne pas faire ramer ton téléphone/PC
        }
        
        // Sinon, on continue d'attendre sagement
        setTimeout(() => launchAppWhenReady(payload), 100);
    }
}

// 1️⃣ FONCTION DÉCLENCHÉE PAR GOOGLE (Sécurisée contre les clics trop rapides ⚡)
window.handleCredentialResponse = async function(response) {
    console.log("✅ Authentification Google réussie, tentative de liaison avec Firebase Auth...");
    
    // Si Firebase Auth n'est pas encore totalement initialisé
    if (!window.auth || !window.GoogleAuthProvider || !window.signInWithCredential) {
        console.log("⏳ Firebase Auth n'est pas encore prêt, on patiente 0.1s...");
        setTimeout(() => window.handleCredentialResponse(response), 100); 
        return;
    }

    try {
        const credential = window.GoogleAuthProvider.credential(response.credential);
        const userCredential = await window.signInWithCredential(window.auth, credential);
        
        localStorage.removeItem('active_mode'); 
        
        // 🛡️ FIX MAGIQUE 2 : On force le lancement directement ici !
        // Au cas où Firebase freeze et ne déclenche pas le gardien automatique.
        if (userCredential.user) {
            const payload = {
                email: userCredential.user.email,
                given_name: userCredential.user.displayName ? userCredential.user.displayName.split(' ')[0] : userCredential.user.email.split('@')[0],
                sub: userCredential.user.uid
            };
            window.currentUser = payload;
            
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';
            document.body.classList.remove('not-logged-in');
            
            launchAppWhenReady(payload);
        }
    } catch (authError) {
        console.error("❌ Échec de la liaison Firebase Auth:", authError);
        alert("Erreur d'authentification Firebase : " + authError.message);
    }
};

// 2️⃣ BOUTON DÉCONNEXION (La Porte)
window.signOut = async function() {
    console.log("🚪 Déconnexion demandée...");
    localStorage.removeItem('active_mode');
    window.appLaunched = false;
    
    if (window.auth) {
        try {
            await window.auth.signOut(); // Déconnexion de Firebase
        } catch (e) {
            console.error("Erreur à la déconnexion :", e);
        }
    }
    
    if (typeof google !== 'undefined' && google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    
    // 🛡️ FIX MAGIQUE 1 : On laisse 500ms à Firebase pour nettoyer sa base de données interne
    // avant de recharger la page. Sinon, la page coupe Firebase en plein milieu de sa déconnexion !
    setTimeout(() => {
        location.reload(); 
    }, 500);
};

// 3️⃣ LE GARDIEN DE SESSION AUTOMATIQUE (onAuthStateChanged)
window.checkSavedSession = function() {
    if (localStorage.getItem('active_mode') === 'local') {
        console.log("🌸 Reprise automatique du Mode Local.");
        window.startLocalMode();
        return;
    }

    if (!window.auth || !window.onAuthStateChanged) {
        setTimeout(window.checkSavedSession, 50);
        return;
    }

    console.log("🔒 Activation du gardien Firebase Auth...");

    window.onAuthStateChanged(window.auth, (user) => {
        if (window.isLocalMode) return; 

        if (user) {
            console.log("💾 Session Firebase détectée et valide pour :", user.email);
            
            const payload = {
                email: user.email,
                given_name: user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0],
                sub: user.uid
            };
            window.currentUser = payload;
            
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) loginOverlay.style.display = 'none';
            document.body.classList.remove('not-logged-in');
            
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

// Lancement automatique du gardien au démarrage
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.checkSavedSession);
} else {
    window.checkSavedSession();
}
