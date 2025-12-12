// Configuration de la radio
const radioConfig = {
    streamUrl: '' // URL du stream radio à ajouter
};

// Éléments DOM
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const trackTitle = document.getElementById('trackTitle');
const currentTimeEl = document.getElementById('currentTime');
const vinylRecord = document.querySelector('.vinyl-record');
const playIcon = document.querySelector('.play-icon');
const pauseIcon = document.querySelector('.pause-icon');

// État du lecteur
let isPlaying = false;

// Mise à jour de l'heure
function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    currentTimeEl.textContent = `${hours}:${minutes}`;
}

// Mise à jour du titre de la piste
function updateTrackTitle() {
    trackTitle.textContent = 'EN DIRECT';
}

// Fonction play/pause
function togglePlayPause() {
    if (isPlaying) {
        // Pause
        audioPlayer.pause();
        isPlaying = false;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        vinylRecord.classList.remove('playing');
    } else {
        // Play
        if (radioConfig.streamUrl) {
            audioPlayer.src = radioConfig.streamUrl;
            audioPlayer.play().catch(err => {
                console.error('Erreur de lecture:', err);
                // Simulation si le stream n'est pas disponible
                simulatePlayback();
            });
        } else {
            // Mode simulation si pas d'URL de stream
            simulatePlayback();
        }
        isPlaying = true;
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        vinylRecord.classList.add('playing');
    }
}

// Simulation de la lecture (si pas de stream)
function simulatePlayback() {
    isPlaying = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    vinylRecord.classList.add('playing');
}

// Gestion des erreurs audio
audioPlayer.addEventListener('error', (e) => {
    console.error('Erreur audio:', e);
    // Basculer en mode simulation
    if (isPlaying) {
        simulatePlayback();
    }
});

// Bouton play/pause
playPauseBtn.addEventListener('click', togglePlayPause);


// Initialisation
updateTime();
updateTrackTitle();
setInterval(updateTime, 1000); // Mettre à jour l'heure chaque seconde

// Gestion du clavier (espace pour play/pause)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
    }
});

// Détection de la visibilité de la page (pause si onglet inactif)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying && audioPlayer.src) {
        // Optionnel: pause automatique quand l'onglet est caché
        // togglePlayPause();
    }
});

// ============================================
// CHAT PUBLIC INTEGRATION
// ============================================

const chatMessages = document.getElementById('chatMessages');
const chatStatus = document.getElementById('chatStatus');
const chatLogin = document.getElementById('chatLogin');
const chatInputContainer = document.getElementById('chatInputContainer');
const usernameInput = document.getElementById('usernameInput');
const loginBtn = document.getElementById('loginBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');

// Configuration Firebase
const FIREBASE_MESSAGES_PATH = 'publicChat/messages';
const FIREBASE_USERS_PATH = 'publicChat/users';

// Variables globales
let currentUsername = localStorage.getItem('chatUsername') || null;
let userRef = null;
let messagesRef = null;

// Formatage de l'heure pour les messages
function formatMessageTime(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Générer un ID unique pour l'utilisateur
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Ajouter un message au chat
function addMessage(author, content, isSystem = false, messageId = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isSystem ? 'system' : ''}`;
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }
    
    const time = formatMessageTime();
    const isOwnMessage = !isSystem && author === currentUsername;
    
    messageDiv.innerHTML = `
        <span class="message-time">${time}</span>
        ${!isSystem ? `<div class="message-header"><span class="message-author ${isOwnMessage ? 'own-message' : ''}">${author}</span></div>` : ''}
        <span class="message-content">${content}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Limiter à 100 messages pour les performances
    if (chatMessages.children.length > 100) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

// Mettre à jour le statut de connexion
function updateStatus(connected, text) {
    chatStatus.textContent = text || (connected ? 'Connecté' : 'Déconnecté');
    chatStatus.className = `status-text ${connected ? 'connected' : ''}`;
}

// Initialiser le chat
function initChat() {
    // Vérifier si l'utilisateur a déjà un pseudo
    if (currentUsername) {
        joinChat(currentUsername);
    } else {
        // Afficher le formulaire de connexion
        chatLogin.style.display = 'block';
        chatInputContainer.style.display = 'none';
    }
}

// Rejoindre le chat avec un pseudo
function joinChat(username) {
    if (!username || username.trim() === '') {
        alert('Veuillez entrer un pseudo valide');
        return;
    }
    
    username = username.trim().substring(0, 20);
    currentUsername = username;
    localStorage.setItem('chatUsername', username);
    
    // Masquer le formulaire de connexion
    chatLogin.style.display = 'none';
    chatInputContainer.style.display = 'block';
    
    // Se connecter à Firebase
    connectToChat();
}

// Se connecter au chat Firebase
function connectToChat() {
    try {
        console.log('🔄 Connexion au chat public...');
        
        // Enregistrer l'utilisateur comme étant en ligne
        const userId = generateUserId();
        userRef = database.ref(`${FIREBASE_USERS_PATH}/${userId}`);
        userRef.set({
            username: currentUsername,
            joinedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        });
        
        // Mettre à jour lastSeen toutes les 30 secondes
        setInterval(() => {
            if (userRef) {
                userRef.update({ lastSeen: new Date().toISOString() });
            }
        }, 30000);
        
        // Compter les utilisateurs en ligne (ceux qui ont été actifs dans les 2 dernières minutes)
        database.ref(FIREBASE_USERS_PATH).on('value', (snapshot) => {
            const users = snapshot.val();
            if (users) {
                const now = new Date().getTime();
                const onlineUsers = Object.values(users).filter(user => {
                    const lastSeen = new Date(user.lastSeen).getTime();
                    return (now - lastSeen) < 120000; // 2 minutes
                });
                onlineCount.textContent = onlineUsers.length;
            } else {
                onlineCount.textContent = '0';
            }
        });
        
        // Charger les messages existants
        messagesRef = database.ref(FIREBASE_MESSAGES_PATH);
        messagesRef.limitToLast(50).once('value', (snapshot) => {
            const messages = snapshot.val();
            if (messages) {
                // Vider les messages existants (sauf le message système)
                chatMessages.innerHTML = '';
                
                // Trier par timestamp
                const sortedMessages = Object.entries(messages)
                    .map(([key, msg]) => ({ key, ...msg }))
                    .sort((a, b) => {
                        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                        return timeA - timeB;
                    });
                
                sortedMessages.forEach(msg => {
                    if (msg.author && msg.content) {
                        addMessage(msg.author, msg.content, false, msg.key || null);
                    }
                });
            }
        });
        
        // Écouter les nouveaux messages
        messagesRef.limitToLast(50).on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (message && message.author && message.content) {
                const messageId = snapshot.key;
                // Vérifier si le message n'existe pas déjà
                const existingMessage = chatMessages.querySelector(`[data-message-id="${messageId}"]`);
                if (!existingMessage) {
                    addMessage(message.author, message.content, false, messageId);
                }
            }
        });
        
        // Message de bienvenue
        addMessage('System', `${currentUsername} a rejoint le chat`, true);
        
        console.log('✅ Connecté au chat public');
        updateStatus(true, 'Connecté');
        
    } catch (error) {
        console.error('❌ Erreur Firebase:', error);
        updateStatus(false, 'Erreur de connexion');
        addMessage('System', 'Erreur de connexion au chat. Vérifiez la configuration Firebase.', true);
    }
}

// Envoyer un message
function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentUsername) {
        return;
    }
    
    if (content.length === 0) {
        return;
    }
    
    // Éviter les messages vides ou trop longs
    if (content.length > 500) {
        alert('Le message est trop long (max 500 caractères)');
        return;
    }
    
    // Écrire dans Firebase
    const messageRef = database.ref(FIREBASE_MESSAGES_PATH).push();
    messageRef.set({
        author: currentUsername,
        content: content,
        timestamp: new Date().toISOString()
    }).then(() => {
        messageInput.value = '';
        console.log('✅ Message envoyé');
    }).catch((error) => {
        console.error('❌ Erreur envoi message:', error);
        alert('Erreur lors de l\'envoi du message');
    });
}

// Événements
loginBtn.addEventListener('click', () => {
    joinChat(usernameInput.value);
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinChat(usernameInput.value);
    }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Nettoyer à la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (userRef) {
        userRef.remove();
    }
});

// Initialisation du chat (attendre que Firebase soit prêt)
if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
    initChat();
} else {
    setTimeout(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            initChat();
        } else {
            console.error('Firebase non initialisé');
            updateStatus(false, 'Firebase non configuré');
        }
    }, 1000);
}

