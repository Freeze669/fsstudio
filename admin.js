// Configuration Admin
const ADMIN_CODE = 'FS2024ADMIN'; // Changez ce code pour la production !
const ADMIN_USERNAME = 'Admin FS Studio';

// Éléments DOM
const loginScreen = document.getElementById('loginScreen');
const adminContainer = document.getElementById('adminContainer');
const adminCodeInput = document.getElementById('adminCode');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const errorMessage = document.getElementById('errorMessage');
const chatMessagesAdmin = document.getElementById('chatMessagesAdmin');
const adminOnlineCount = document.getElementById('adminOnlineCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const refreshBtn = document.getElementById('refreshBtn');
const adminUsername = document.getElementById('adminUsername');
const adminMessage = document.getElementById('adminMessage');
const adminSendBtn = document.getElementById('adminSendBtn');
const charCount = document.getElementById('charCount');
const totalMessages = document.getElementById('totalMessages');
const totalUsers = document.getElementById('totalUsers');

// Configuration Firebase
const FIREBASE_MESSAGES_PATH = 'publicChat/messages';
const FIREBASE_USERS_PATH = 'publicChat/users';
const FIREBASE_RADIO_PATH = 'radio';
const FIREBASE_RADIO_STATUS_PATH = 'radio/status';

// Variables
let messagesRef = null;
let usersRef = null;
let isAuthenticated = false;
let loadedMessageIds = new Set();

// Variables Radio/Streaming (initialisées après chargement)
let startVoiceBtn, stopVoiceBtn;
let voiceInfo, audioLevel, voiceStatusText, radioStatusIndicator, radioStatusText, listenersCount;
let streamStats, chunksSent, lastSent;

let mediaStream = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let animationFrame = null;
let isStreaming = false;
let mediaRecorder = null;
let audioChunks = [];
let streamInterval = null;
let chunksSentCount = 0;
let lastSentTime = null;

// Vérifier si déjà connecté
function checkAuth() {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth === ADMIN_CODE) {
        isAuthenticated = true;
        showAdmin();
    } else {
        showLogin();
    }
}

// Afficher l'écran de connexion
function showLogin() {
    loginScreen.style.display = 'flex';
    adminContainer.style.display = 'none';
    isAuthenticated = false;
}

// Afficher l'interface admin
function showAdmin() {
    loginScreen.style.display = 'none';
    adminContainer.style.display = 'block';
    isAuthenticated = true;
    
    // Initialiser les éléments DOM radio
    startVoiceBtn = document.getElementById('startVoiceBtn');
    stopVoiceBtn = document.getElementById('stopVoiceBtn');
    voiceInfo = document.getElementById('voiceInfo');
    audioLevel = document.getElementById('audioLevel');
    voiceStatusText = document.getElementById('voiceStatusText');
    radioStatusIndicator = document.getElementById('radioStatusIndicator');
    radioStatusText = document.getElementById('radioStatusText');
    listenersCount = document.getElementById('listenersCount');
    streamStats = document.getElementById('streamStats');
    chunksSent = document.getElementById('chunksSent');
    lastSent = document.getElementById('lastSent');
    
    connectToFirebase();
    initRadio();
}

// Connexion
loginBtn.addEventListener('click', () => {
    const code = adminCodeInput.value.trim();
    if (code === ADMIN_CODE) {
        localStorage.setItem('adminAuth', ADMIN_CODE);
        adminCodeInput.value = '';
        errorMessage.style.display = 'none';
        showAdmin();
    } else {
        errorMessage.textContent = 'Code incorrect';
        errorMessage.style.display = 'block';
        adminCodeInput.value = '';
    }
});

// Déconnexion
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminAuth');
    showLogin();
});

// Entrée sur le champ code
adminCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginBtn.click();
    }
});

// Formatage de l'heure
function formatMessageTime(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Ajouter un message dans l'admin
function addMessageToAdmin(messageId, author, content, timestamp) {
    // Vérifier si le message existe déjà
    if (loadedMessageIds.has(messageId)) {
        return;
    }
    loadedMessageIds.add(messageId);

    const messageDiv = document.createElement('div');
    messageDiv.className = 'admin-message';
    messageDiv.dataset.messageId = messageId;
    
    const date = timestamp ? new Date(timestamp) : new Date();
    const time = formatMessageTime(date);
    const isAdmin = author === ADMIN_USERNAME || author.includes('Admin');
    
    messageDiv.innerHTML = `
        <div class="message-header-admin">
            <span class="message-author-admin ${isAdmin ? 'admin-user' : ''}">${author}</span>
            <span class="message-time-admin">${time}</span>
        </div>
        <div class="message-content-admin">${content}</div>
        <button class="delete-btn" data-message-id="${messageId}" title="Supprimer ce message">
            🗑️
        </button>
    `;
    
    chatMessagesAdmin.appendChild(messageDiv);
    chatMessagesAdmin.scrollTop = chatMessagesAdmin.scrollHeight;
}

// Supprimer un message
function deleteMessage(messageId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
        return;
    }
    
    database.ref(`${FIREBASE_MESSAGES_PATH}/${messageId}`).remove()
        .then(() => {
            console.log('✅ Message supprimé:', messageId);
            // Retirer de la liste des messages chargés
            loadedMessageIds.delete(messageId);
            // Retirer du DOM
            const messageEl = chatMessagesAdmin.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                messageEl.remove();
            }
        })
        .catch((error) => {
            console.error('❌ Erreur suppression:', error);
            alert('Erreur lors de la suppression du message');
        });
}

// Supprimer tous les messages
clearAllBtn.addEventListener('click', () => {
    if (!confirm('⚠️ ATTENTION: Supprimer TOUS les messages ? Cette action est irréversible !')) {
        return;
    }
    
    if (!confirm('Êtes-vous vraiment sûr ?')) {
        return;
    }
    
    database.ref(FIREBASE_MESSAGES_PATH).remove()
        .then(() => {
            console.log('✅ Tous les messages supprimés');
            chatMessagesAdmin.innerHTML = '<div class="empty-message">Aucun message</div>';
            loadedMessageIds.clear();
            updateStats();
        })
        .catch((error) => {
            console.error('❌ Erreur suppression:', error);
            alert('Erreur lors de la suppression des messages');
        });
});

// Actualiser
refreshBtn.addEventListener('click', () => {
    chatMessagesAdmin.innerHTML = '<div class="loading-message">Actualisation...</div>';
    loadedMessageIds.clear();
    loadMessages();
});

// Envoyer un message depuis l'admin
adminSendBtn.addEventListener('click', sendAdminMessage);

adminMessage.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        sendAdminMessage();
    }
});

// Compteur de caractères
adminMessage.addEventListener('input', () => {
    const length = adminMessage.value.length;
    charCount.textContent = length;
    if (length > 450) {
        charCount.parentElement.style.color = '#f04747';
    } else {
        charCount.parentElement.style.color = 'rgba(255, 255, 255, 0.6)';
    }
});

function sendAdminMessage() {
    const content = adminMessage.value.trim();
    const username = adminUsername.value.trim() || ADMIN_USERNAME;
    
    if (!content) {
        alert('Veuillez entrer un message');
        return;
    }
    
    if (content.length > 500) {
        alert('Le message est trop long (max 500 caractères)');
        return;
    }
    
    // Écrire dans Firebase
    const messageRef = database.ref(FIREBASE_MESSAGES_PATH).push();
    messageRef.set({
        author: username,
        content: content,
        timestamp: new Date().toISOString(),
        isAdmin: true
    }).then(() => {
        adminMessage.value = '';
        charCount.textContent = '0';
        console.log('✅ Message admin envoyé');
    }).catch((error) => {
        console.error('❌ Erreur envoi:', error);
        alert('Erreur lors de l\'envoi du message');
    });
}

// Connexion à Firebase
function connectToFirebase() {
    try {
        console.log('🔄 Connexion admin à Firebase...');
        
        // Écouter les utilisateurs en ligne
        usersRef = database.ref(FIREBASE_USERS_PATH);
        usersRef.on('value', (snapshot) => {
            const users = snapshot.val();
            if (users) {
                const now = new Date().getTime();
                const onlineUsers = Object.values(users).filter(user => {
                    const lastSeen = new Date(user.lastSeen).getTime();
                    return (now - lastSeen) < 120000; // 2 minutes
                });
                adminOnlineCount.textContent = onlineUsers.length;
                totalUsers.textContent = Object.keys(users).length;
            } else {
                adminOnlineCount.textContent = '0';
                totalUsers.textContent = '0';
            }
        });
        
        // Charger et écouter les messages
        loadMessages();
        listenToNewMessages();
        
        console.log('✅ Admin connecté à Firebase');
        
    } catch (error) {
        console.error('❌ Erreur Firebase:', error);
        chatMessagesAdmin.innerHTML = '<div class="error-message">Erreur de connexion à Firebase</div>';
    }
}

// Charger les messages
function loadMessages() {
    messagesRef = database.ref(FIREBASE_MESSAGES_PATH);
    messagesRef.limitToLast(100).once('value', (snapshot) => {
        const messages = snapshot.val();
        chatMessagesAdmin.innerHTML = '';
        loadedMessageIds.clear();
        
        if (messages) {
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
                    addMessageToAdmin(msg.key, msg.author, msg.content, msg.timestamp);
                }
            });
            
            totalMessages.textContent = sortedMessages.length;
        } else {
            chatMessagesAdmin.innerHTML = '<div class="empty-message">Aucun message</div>';
            totalMessages.textContent = '0';
        }
        
        chatMessagesAdmin.scrollTop = chatMessagesAdmin.scrollHeight;
    });
}

// Écouter les nouveaux messages
function listenToNewMessages() {
    messagesRef.limitToLast(100).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message && message.author && message.content) {
            const messageId = snapshot.key;
            addMessageToAdmin(messageId, message.author, message.content, message.timestamp);
            updateStats();
        }
    });
    
    // Écouter les suppressions
    messagesRef.on('child_removed', (snapshot) => {
        const messageId = snapshot.key;
        loadedMessageIds.delete(messageId);
        const messageEl = chatMessagesAdmin.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.remove();
        }
        updateStats();
    });
}

// Mettre à jour les statistiques
function updateStats() {
    messagesRef.once('value', (snapshot) => {
        const messages = snapshot.val();
        if (messages) {
            totalMessages.textContent = Object.keys(messages).length;
        } else {
            totalMessages.textContent = '0';
        }
    });
}

// Gérer les clics sur les boutons de suppression
chatMessagesAdmin.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
        const btn = e.target.classList.contains('delete-btn') ? e.target : e.target.closest('.delete-btn');
        const messageId = btn.dataset.messageId;
        if (messageId) {
            deleteMessage(messageId);
        }
    }
});

// ============================================
// RADIO / STREAMING VOCAL
// ============================================

// Initialiser les événements radio
function initRadioEvents() {
    if (!startVoiceBtn || !stopVoiceBtn) return;

    // Démarrer la diffusion vocale
    startVoiceBtn.addEventListener('click', async () => {
        try {
            // Demander l'accès au microphone
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                } 
            });
            
            // Créer le contexte audio pour l'analyse
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(mediaStream);
            
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            microphone.connect(analyser);
            
            // Créer le MediaRecorder pour capturer l'audio
            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            };
            
            // Essayer différents formats
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'audio/mp4';
                }
            }
            
            mediaRecorder = new MediaRecorder(mediaStream, options);
            audioChunks = [];
            
            // Quand on reçoit des données audio
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    console.log(`📤 Chunk audio reçu: ${event.data.size} bytes, type: ${event.data.type}`);
                    
                    // Convertir en base64 pour Firebase
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        try {
                            const result = reader.result;
                            if (!result || !result.includes(',')) {
                                console.error('❌ Format base64 invalide');
                                return;
                            }
                            
                            const base64Audio = result.split(',')[1];
                            const timestamp = Date.now();
                            
                            if (!base64Audio || base64Audio.length === 0) {
                                console.error('❌ Données audio vides');
                                return;
                            }
                            
                            // Envoyer le chunk audio à Firebase
                            database.ref(`radio/audioChunks/${timestamp}`).set({
                                data: base64Audio,
                                timestamp: timestamp,
                                mimeType: options.mimeType || 'audio/webm'
                            }).then(() => {
                                chunksSentCount++;
                                lastSentTime = new Date();
                                
                                // Mettre à jour les stats
                                if (chunksSent) chunksSent.textContent = chunksSentCount;
                                if (lastSent) {
                                    const timeStr = lastSentTime.toLocaleTimeString();
                                    lastSent.textContent = timeStr;
                                }
                                
                                console.log(`✅ Chunk envoyé: ${timestamp}, taille: ${base64Audio.length} chars, total: ${chunksSentCount}`);
                                
                                // Nettoyer les anciens chunks (plus de 3 secondes)
                                const cleanupTime = Date.now() - 3000;
                                database.ref('radio/audioChunks').orderByKey().once('value', (snapshot) => {
                                    snapshot.forEach((child) => {
                                        const chunkTime = parseInt(child.key);
                                        if (chunkTime < cleanupTime) {
                                            child.ref.remove();
                                        }
                                    });
                                });
                            }).catch((error) => {
                                console.error('❌ Erreur envoi chunk:', error);
                                voiceStatusText.textContent = '❌ Erreur d\'envoi - Vérifiez la connexion Firebase';
                            });
                        } catch (error) {
                            console.error('❌ Erreur traitement chunk:', error);
                        }
                    };
                    
                    reader.onerror = (error) => {
                        console.error('❌ Erreur FileReader:', error);
                    };
                    
                    reader.readAsDataURL(event.data);
                } else {
                    console.warn('⚠️ Chunk audio vide reçu');
                }
            };
            
            mediaRecorder.onerror = (event) => {
                console.error('❌ Erreur MediaRecorder:', event);
            };
            
            // Démarrer l'enregistrement avec des chunks toutes les 500ms
            mediaRecorder.start(500);
            
            // Mettre à jour l'état dans Firebase
            database.ref(FIREBASE_RADIO_STATUS_PATH).set({
                isLive: true,
                startedAt: new Date().toISOString(),
                mimeType: options.mimeType
            });
            
            // Afficher les contrôles
            startVoiceBtn.style.display = 'none';
            stopVoiceBtn.style.display = 'inline-flex';
            voiceInfo.style.display = 'block';
            streamStats.style.display = 'block';
            isStreaming = true;
            chunksSentCount = 0;
            
            // Démarrer l'animation du niveau audio
            updateAudioLevel();
            
            voiceStatusText.textContent = '✅ Diffusion en cours... Votre voix est diffusée en direct !';
            updateRadioStatus(true);
            
            console.log('✅ Diffusion vocale démarrée');
            
        } catch (error) {
            console.error('❌ Erreur accès microphone:', error);
            alert('Erreur: Impossible d\'accéder au microphone. Vérifiez les permissions.');
            voiceStatusText.textContent = '❌ Erreur d\'accès au microphone';
        }
    });

    // Arrêter la diffusion vocale
    stopVoiceBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder = null;
        }
        
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        if (streamInterval) {
            clearInterval(streamInterval);
            streamInterval = null;
        }
        
        // Supprimer tous les chunks audio
        database.ref('radio/audioChunks').remove();
        
        // Mettre à jour l'état dans Firebase
        database.ref(FIREBASE_RADIO_STATUS_PATH).set({
            isLive: false,
            stoppedAt: new Date().toISOString()
        });
        
        // Masquer les contrôles
        startVoiceBtn.style.display = 'inline-flex';
        stopVoiceBtn.style.display = 'none';
        voiceInfo.style.display = 'none';
        isStreaming = false;
        
        audioLevel.style.width = '0%';
        voiceStatusText.textContent = 'Diffusion arrêtée';
        updateRadioStatus(false);
        
        console.log('⏹️ Diffusion vocale arrêtée');
    });
}

// Mettre à jour le niveau audio
function updateAudioLevel() {
    if (!isStreaming || !analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const percentage = Math.min((average / 255) * 100, 100);
    
    audioLevel.style.width = percentage + '%';
    
    // Couleur selon le niveau
    if (percentage > 70) {
        audioLevel.style.background = '#f04747';
    } else if (percentage > 40) {
        audioLevel.style.background = '#faa61a';
    } else {
        audioLevel.style.background = '#43b581';
    }
    
    animationFrame = requestAnimationFrame(updateAudioLevel);
}

// Mettre à jour le statut radio
function updateRadioStatus(isLive) {
    if (isLive) {
        radioStatusIndicator.style.background = '#43b581';
        radioStatusText.textContent = 'En direct';
    } else {
        radioStatusIndicator.style.background = '#f04747';
        radioStatusText.textContent = 'Hors ligne';
    }
}

// Écouter le statut radio depuis Firebase
function listenToRadioStatus() {
    database.ref(FIREBASE_RADIO_STATUS_PATH).on('value', (snapshot) => {
        const status = snapshot.val();
        if (status) {
            updateRadioStatus(status.isLive);
        } else {
            updateRadioStatus(false);
        }
    });
}

// Compter les auditeurs (ceux qui écoutent le stream)
function countListeners() {
    database.ref('radio/listeners').on('value', (snapshot) => {
        const listeners = snapshot.val();
        if (listeners) {
            listenersCount.textContent = Object.keys(listeners).length;
        } else {
            listenersCount.textContent = '0';
        }
    });
}

// Initialisation Radio
function initRadio() {
    initRadioEvents();
    listenToRadioStatus();
    countListeners();
}

// Initialisation
checkAuth();

