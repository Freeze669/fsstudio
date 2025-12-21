// Variables globales
let adminCodeInput, loginBtn, loginError;
let dynamicModerators = {};
let currentUser = null;

// Utilisateurs administrateurs statiques
const ADMIN_USERS = {
    'DIRECTEUR2024': {
        name: 'Directeur Général',
        role: 'directeur_general',
        permissions: ['broadcast', 'chat', 'finance', 'moderators'],
        wallet: 0,
        earnings: []
    }
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    // Récupérer les éléments DOM
    adminCodeInput = document.getElementById('adminCodeInput');
    loginBtn = document.getElementById('loginBtn');
    loginError = document.getElementById('loginError');
    
    // Charger les modérateurs depuis localStorage
    const savedModerators = localStorage.getItem('dynamicModerators');
    if (savedModerators) {
        try {
            dynamicModerators = JSON.parse(savedModerators);
        } catch (e) {
            console.error('Erreur chargement modérateurs:', e);
            dynamicModerators = {};
        }
    }
    
    // Vérifier si déjà connecté
    checkAuth();
    
    // Event listeners
    if (loginBtn && adminCodeInput) {
        loginBtn.addEventListener('click', handleLogin);
        adminCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
        
        // Masquer l'erreur quand l'utilisateur tape
        adminCodeInput.addEventListener('input', () => {
            if (loginError) {
                loginError.style.display = 'none';
            }
        });
    }
});

// Vérifier l'authentification
function checkAuth() {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth) {
        // Vérifier dans les utilisateurs statiques
        let user = ADMIN_USERS[savedAuth];
        
        // Si pas trouvé, vérifier dans les modérateurs dynamiques
        if (!user) {
            user = dynamicModerators[savedAuth];
        }
        
        if (user) {
            // Rediriger vers le panel admin
            window.location.href = 'admin-panel.html';
            return;
        }
    }
}

// Gérer la connexion
function handleLogin() {
    const code = adminCodeInput.value.trim();
    const errorText = loginError ? loginError.querySelector('.error-text') : null;
    
    // Masquer l'erreur précédente
    if (loginError) {
        loginError.style.display = 'none';
    }
    
    // Vérifier si le code est vide
    if (!code || code.trim() === '') {
        if (loginError && errorText) {
            errorText.textContent = 'Veuillez entrer un code d\'accès';
            loginError.style.display = 'flex';
        }
        if (adminCodeInput) adminCodeInput.focus();
        return;
    }
    
    // Recharger les modérateurs depuis Firebase avant de vérifier
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && typeof database !== 'undefined') {
        database.ref('admin/moderators').once('value', (snapshot) => {
            const firebaseModerators = snapshot.val() || {};
            dynamicModerators = { ...dynamicModerators, ...firebaseModerators };
            localStorage.setItem('dynamicModerators', JSON.stringify(dynamicModerators));
            performLogin(code, errorText);
        }).catch((error) => {
            console.error('❌ Erreur rechargement modérateurs:', error);
            performLogin(code, errorText); // Continuer avec les modérateurs locaux
        });
    } else {
        performLogin(code, errorText);
    }
}

// Effectuer la connexion
function performLogin(code, errorText) {
    // Vérifier dans les utilisateurs statiques
    let user = ADMIN_USERS[code];
    
    // Si pas trouvé, vérifier dans les modérateurs dynamiques
    if (!user) {
        user = dynamicModerators[code];
    }
    
    if (user) {
        // Connexion réussie
        localStorage.setItem('adminAuth', code);
        currentUser = user;
        console.log('✅ Connexion réussie pour:', user.name, '- Rôle:', user.role);
        
        // Masquer l'erreur si elle était affichée
        if (loginError) {
            loginError.style.display = 'none';
        }
        
        // Déconnecter tous les membres
        disconnectAllMembers();
        
        // Rediriger vers le panel admin
        window.location.href = 'admin-panel.html';
    } else {
        // Code incorrect
        if (loginError && errorText) {
            errorText.textContent = 'Code d\'accès incorrect. Veuillez réessayer.';
            loginError.style.display = 'flex';
        }
        
        // Effet de secousse sur le champ
        if (adminCodeInput) {
            adminCodeInput.style.animation = 'none';
            setTimeout(() => {
                adminCodeInput.style.animation = 'errorShake 0.5s ease-out';
            }, 10);
            
            // Réinitialiser le champ après l'animation
            setTimeout(() => {
                adminCodeInput.value = '';
                adminCodeInput.focus();
            }, 500);
        }
    }
}

// Fonction pour déconnecter tous les membres/utilisateurs
function disconnectAllMembers() {
    console.log('🔄 Déconnexion de tous les membres...');
    
    try {
        // Déconnecter tous les utilisateurs du chat Firebase
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && typeof database !== 'undefined') {
            const FIREBASE_USERS_PATH = 'publicChat/users';
            
            // Utiliser le chemin correct pour les utilisateurs
            const usersRef = database.ref(FIREBASE_USERS_PATH);
            usersRef.once('value', (snapshot) => {
                const users = snapshot.val();
                if (users) {
                    Object.keys(users).forEach(userId => {
                        database.ref(`${FIREBASE_USERS_PATH}/${userId}`).remove();
                    });
                    console.log('✅ Tous les utilisateurs du chat déconnectés');
                }
            });
            
            // Nettoyer les sessions actives dans publicChat
            database.ref('publicChat/sessions').remove().then(() => {
                console.log('✅ Sessions nettoyées');
            }).catch(err => {
                console.log('ℹ️ Aucune session à nettoyer');
            });
            
            // Nettoyer aussi les sessions générales
            database.ref('sessions').remove().then(() => {
                console.log('✅ Sessions générales nettoyées');
            }).catch(err => {
                console.log('ℹ️ Aucune session générale à nettoyer');
            });
        }
        
        console.log('✅ Déconnexion de tous les membres terminée');
    } catch (error) {
        console.error('❌ Erreur lors de la déconnexion des membres:', error);
    }
}

