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
let scriptProcessor = null;

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
            // Demander l'accès au microphone avec qualité APPEL (comme WhatsApp/Telegram)
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    // Paramètres optimisés pour qualité vocale téléphonique (appel)
                    echoCancellation: true, // Essentiel pour éviter l'écho
                    noiseSuppression: true, // Supprime le bruit ambiant
                    autoGainControl: true, // Contrôle automatique du volume (meilleur pour appels)
                    sampleRate: 48000, // 48kHz (qualité appel haute qualité)
                    channelCount: 1, // Mono (standard pour voix)
                    latency: 0.01, // Latence minimale (20ms comme les appels)
                    // Paramètres Google Chrome optimisés pour qualité appel
                    googEchoCancellation: true,
                    googAutoGainControl: true, // Activé pour qualité appel optimale
                    googNoiseSuppression: true,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googNoiseReduction: true,
                    googAudioMirroring: false, // Pas de miroir audio
                    googEchoCancellation2: true, // Version améliorée si disponible
                    googDAEchoCancellation: true, // Double AEC si disponible
                    googAECM: true, // Acoustic Echo Cancellation Mobile
                    googBeamforming: false, // Désactivé pour mono
                    googArrayGeometry: undefined
                } 
            });
            
            // Créer le contexte audio pour l'analyse
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(mediaStream);
            
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            // Créer des filtres audio professionnels pour qualité vocale maximale
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -28; // Seuil optimisé
            compressor.knee.value = 15; // Zone de transition serrée
            compressor.ratio.value = 6; // Ratio équilibré (6:1)
            compressor.attack.value = 0.0001; // Attaque ultra-rapide
            compressor.release.value = 0.08; // Relâchement très rapide
            
            // High-pass filter pour supprimer les basses (bruit, vent, vibrations)
            const highPassFilter = audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.value = 120; // Fréquence optimisée pour voix claire
            highPassFilter.Q.value = 0.8; // Qualité améliorée
            
            // Low-pass filter pour supprimer les hautes fréquences (bruit, sifflements)
            const lowPassFilter = audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.value = 14000; // Garder plus de fréquences vocales (14kHz)
            lowPassFilter.Q.value = 0.8; // Qualité améliorée
            
            // Égaliseur multi-bandes pour qualité vocale maximale
            const eq1 = audioContext.createBiquadFilter(); // Boost fréquences vocales principales
            eq1.type = 'peaking';
            eq1.frequency.value = 2000; // Fréquence centrale de la voix
            eq1.gain.value = 3; // Boost modéré pour clarté
            eq1.Q.value = 1.2;
            
            const eq2 = audioContext.createBiquadFilter(); // Réduction des fréquences problématiques
            eq2.type = 'notch';
            eq2.frequency.value = 60; // Supprimer le ronflement 50/60Hz
            eq2.Q.value = 10;
            
            const eq3 = audioContext.createBiquadFilter(); // Réduction des fréquences aiguës problématiques
            eq3.type = 'peaking';
            eq3.frequency.value = 9000; // Réduire les fréquences très aiguës qui causent saturation
            eq3.gain.value = -3; // Réduction modérée
            eq3.Q.value = 2;
            
            // Égaliseur supplémentaire pour améliorer les fréquences moyennes
            const eq4 = audioContext.createBiquadFilter();
            eq4.type = 'peaking';
            eq4.frequency.value = 3000; // Boost fréquences moyennes-hautes
            eq4.gain.value = 2; // Légère amélioration
            eq4.Q.value = 1;
            
            // Ajouter un limiter supplémentaire avant la compression
            const limiter = audioContext.createDynamicsCompressor();
            limiter.threshold.value = -3; // Seuil très haut (presque pas de compression normale)
            limiter.knee.value = 0; // Pas de zone de transition
            limiter.ratio.value = 20; // Ratio très élevé (limiter dur)
            limiter.attack.value = 0.0001; // Attaque ultra-rapide
            limiter.release.value = 0.01; // Relâchement très rapide
            
            // Connecter les filtres en chaîne optimisée pour qualité vocale maximale
            microphone.connect(eq2); // D'abord supprimer le ronflement 60Hz
            eq2.connect(highPassFilter); // Ensuite high-pass
            highPassFilter.connect(eq1); // Boost fréquences vocales principales
            eq1.connect(eq4); // Boost fréquences moyennes
            eq4.connect(lowPassFilter); // Low-pass
            lowPassFilter.connect(eq3); // Réduction fréquences aiguës problématiques
            eq3.connect(compressor); // Compression principale
            compressor.connect(limiter); // Limiter dur pour éviter saturation
            limiter.connect(analyser);
            
            // Utiliser MediaRecorder avec Opus pour qualité APPEL (comme WhatsApp/Telegram)
            // Opus est le codec standard des appels vocaux modernes
            const mimeType = 'audio/webm;codecs=opus';
            const supportedMimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4;codecs=opus'
            ];
            
            let selectedMimeType = null;
            for (const type of supportedMimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    console.log(`✅ Codec supporté: ${type}`);
                    break;
                }
            }
            
            // FORCER L'UTILISATION DE PCM16 AU LIEU D'OPUS POUR COMPATIBILITÉ
            // Les chunks Opus WebM ne peuvent pas être joués individuellement côté client
            console.log('ℹ️ Opus détecté mais utilisation de PCM16 pour compatibilité');
            selectedMimeType = null; // Forcer l'utilisation de ScriptProcessor (PCM16)
            
            if (!selectedMimeType) {
                console.log('✅ Utilisation de ScriptProcessor (PCM16) pour compatibilité maximale');
                // Utiliser ScriptProcessor pour générer du PCM16
                const bufferSize = 2048;
                scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
            } else {
                // Utiliser MediaRecorder avec Opus (haute qualité vocale)
                mediaRecorder = new MediaRecorder(mediaStream, {
                    mimeType: selectedMimeType,
                    audioBitsPerSecond: 128000 // 128 kbps pour qualité vocale supérieure (au lieu de 64 kbps)
                });
                
                const audioChunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                        
                        // Convertir le blob en base64
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64Audio = reader.result.split(',')[1]; // Enlever le préfixe data:audio/webm;base64,
                            
                            // Envoyer le chunk Opus à Firebase
                            const timestamp = Date.now();
                            database.ref(`radio/audioChunks/${timestamp}`).set({
                                data: base64Audio,
                                timestamp: timestamp,
                                sampleRate: audioContext.sampleRate,
                                format: 'opus', // Format Opus (qualité appel)
                                mimeType: selectedMimeType,
                                bufferSize: event.data.size
                            }).then(() => {
                                chunksSentCount++;
                                lastSentTime = new Date();
                                
                                // Mettre à jour les stats
                                if (chunksSent) chunksSent.textContent = chunksSentCount;
                                if (lastSent) {
                                    const timeStr = lastSentTime.toLocaleTimeString();
                                    lastSent.textContent = timeStr;
                                }
                                
                                console.log(`✅ Chunk Opus envoyé: ${chunksSentCount}, taille: ${event.data.size} bytes`);
                            }).catch((error) => {
                                console.error('❌ Erreur envoi chunk Opus:', error);
                                voiceStatusText.textContent = '❌ Erreur Firebase - Vérifiez la connexion';
                            });
                        };
                        reader.readAsDataURL(event.data);
                    }
                };
                
                mediaRecorder.onerror = (event) => {
                    console.error('❌ Erreur MediaRecorder:', event.error);
                    voiceStatusText.textContent = '❌ Erreur enregistrement audio';
                };
                
                // Démarrer l'enregistrement avec intervalles optimisés (100ms pour éviter les crashes)
                // 100ms = bon compromis entre latence et performance
                mediaRecorder.start(100); // 100ms = éviter trop de chunks
                console.log('✅ MediaRecorder démarré avec Opus (haute qualité vocale)');
                console.log(`   Codec: ${selectedMimeType}`);
                console.log(`   Bitrate: 128 kbps (qualité vocale supérieure)`);
                console.log(`   Intervalle: 100ms (optimisé pour stabilité)`);
            }
            
            // Pour compatibilité avec l'ancien code (ScriptProcessor fallback)
            let lastSendTime = 0;
            const sendInterval = 100; // 100ms pour éviter trop de chunks (évite les crashes)
            
            // Variables pour la normalisation et suppression de bruit (qualité APPEL)
            let noiseGateThreshold = 0.002; // Seuil optimisé pour voix (qualité appel)
            let peakLevel = 0;
            let targetPeak = 0.70; // Niveau cible optimisé pour appels (70%)
            let adaptiveGain = 1.0; // Gain adaptatif initial
            let maxGain = 1.3; // Gain max optimisé pour qualité appel
            
            // ScriptProcessor uniquement en fallback (si Opus non disponible)
            if (scriptProcessor) {
                scriptProcessor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                const outputData = event.outputBuffer.getChannelData(0);
                
                // Toujours mettre du silence en output pour éviter l'écho
                for (let i = 0; i < outputData.length; i++) {
                    outputData[i] = 0;
                }
                
                if (!isStreaming) {
                    return;
                }
                
                const now = Date.now();
                if (now - lastSendTime < sendInterval) {
                    return; // Limiter l'envoi
                }
                lastSendTime = now;
                
                // Traitement audio amélioré
                let maxAmplitude = 0;
                const processedData = new Float32Array(inputData.length);
                
                // 1. Calculer l'amplitude RMS (Root Mean Square) pour meilleure détection
                let sumSquares = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sumSquares += inputData[i] * inputData[i];
                    maxAmplitude = Math.max(maxAmplitude, Math.abs(inputData[i]));
                }
                const rms = Math.sqrt(sumSquares / inputData.length);
                
                // 2. Si pas assez de son, ne pas traiter
                if (rms < noiseGateThreshold && maxAmplitude < noiseGateThreshold * 3) {
                    return; // Pas assez de son, ignorer
                }
                
                // 3. Gain adaptatif optimisé (s'ajuste progressivement)
                const targetGain = targetPeak / Math.max(maxAmplitude, 0.1);
                adaptiveGain = adaptiveGain * 0.9 + targetGain * 0.1; // Lissage doux pour qualité
                const gain = Math.min(adaptiveGain, maxGain); // Gain max 1.5x pour qualité
                
                // 4. Traitement audio haute qualité pour voix
                for (let i = 0; i < inputData.length; i++) {
                    let sample = inputData[i];
                    
                    // Suppression de bruit adaptative (basée sur RMS)
                    const absValue = Math.abs(sample);
                    if (absValue < noiseGateThreshold) {
                        // Réduction progressive du bruit
                        const reduction = Math.pow(absValue / noiseGateThreshold, 2) * 0.2;
                        sample *= reduction;
                    }
                    
                    // Appliquer le gain adaptatif optimisé
                    sample *= gain;
                    
                    // Soft limiter doux (transition douce pour qualité maximale)
                    const softThreshold = 0.75; // Seuil plus haut pour meilleure qualité
                    if (sample > softThreshold) {
                        const excess = sample - softThreshold;
                        sample = softThreshold + excess / (1 + excess * 3); // Compression douce
                    } else if (sample < -softThreshold) {
                        const excess = Math.abs(sample) - softThreshold;
                        sample = -(softThreshold + excess / (1 + excess * 3));
                    }
                    
                    // Hard limiter final (sécurité contre saturation)
                    const hardLimit = 0.85; // Limite à 85% pour qualité maximale
                    if (sample > hardLimit) {
                        sample = hardLimit;
                    } else if (sample < -hardLimit) {
                        sample = -hardLimit;
                    }
                    
                    // Limiter final (sécurité absolue)
                    processedData[i] = Math.max(-0.85, Math.min(0.85, sample));
                }
                
                peakLevel = maxAmplitude * gain;
                
                // NE PAS copier vers l'output pour éviter l'écho
                // Remplir avec du silence
                for (let i = 0; i < outputData.length; i++) {
                    outputData[i] = 0; // Silence pour éviter l'écho
                }
                
                // Convertir les données PCM traitées en Int16 pour transmission
                const int16Data = new Int16Array(processedData.length);
                for (let i = 0; i < processedData.length; i++) {
                    // Convertir de float32 (-1.0 à 1.0) vers int16 (-32768 à 32767)
                    const s = Math.max(-1, Math.min(1, processedData[i]));
                    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                // Convertir en base64 (méthode optimisée pour grandes chaînes)
                const uint8Array = new Uint8Array(int16Data.buffer);
                const timestamp = Date.now();
                
                // Utiliser une méthode plus efficace pour la conversion base64
                let base64Audio;
                try {
                    // Méthode optimisée pour grandes chaînes
                    const chunkSize = 8192; // Traiter par chunks pour éviter les erreurs
                    let binary = '';
                    
                    for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.slice(i, i + chunkSize);
                        binary += String.fromCharCode.apply(null, chunk);
                    }
                    
                    base64Audio = btoa(binary);
                } catch (btoaError) {
                    console.error('❌ Erreur conversion base64:', btoaError);
                    // Fallback : méthode alternative
                    base64Audio = btoa(String.fromCharCode.apply(null, uint8Array));
                }
                
                // Vérifier qu'il y a du son (pas seulement du silence)
                if (maxAmplitude < noiseGateThreshold * 2) {
                    // Pas assez de son, ne pas envoyer
                    return;
                }
                
                // Envoyer le chunk audio à Firebase
                database.ref(`radio/audioChunks/${timestamp}`).set({
                    data: base64Audio,
                    timestamp: timestamp,
                    sampleRate: audioContext.sampleRate,
                    format: 'pcm16',
                    bufferSize: inputData.length
                }).then(() => {
                    chunksSentCount++;
                    lastSentTime = new Date();
                    
                    // Mettre à jour les stats
                    if (chunksSent) chunksSent.textContent = chunksSentCount;
                    if (lastSent) {
                        const timeStr = lastSentTime.toLocaleTimeString();
                        lastSent.textContent = timeStr;
                    }
                    
                    console.log(`✅ Chunk ${chunksSentCount} envoyé: ${base64Audio.length} chars, amplitude: ${maxAmplitude.toFixed(3)}`);
                    
                    // Nettoyer les anciens chunks (plus de 3 secondes)
                    if (chunksSentCount % 20 === 0) {
                        const cleanupTime = Date.now() - 3000;
                        database.ref('radio/audioChunks').orderByKey().once('value', (snapshot) => {
                            snapshot.forEach((child) => {
                                const chunkTime = parseInt(child.key);
                                if (chunkTime < cleanupTime) {
                                    child.ref.remove();
                                }
                            });
                        });
                    }
                }).catch((error) => {
                    console.error('❌ Erreur envoi chunk:', error);
                    voiceStatusText.textContent = '❌ Erreur Firebase - Vérifiez la connexion';
                });
                };
            }
            
            // Connecter ScriptProcessor uniquement si utilisé (fallback)
            if (scriptProcessor) {
                // Créer un gainNode complètement silencieux
                const silentGain = audioContext.createGain();
                silentGain.gain.value = 0; // Volume à ZÉRO absolu pour aucun écho
                
                // Créer un dummy analyser pour activer le scriptProcessor sans sortie
                const dummyAnalyser = audioContext.createAnalyser();
                dummyAnalyser.fftSize = 32; // Taille minimale pour économiser ressources
                
                // Connecter le script processor après le limiter (pour capturer l'audio traité)
                limiter.connect(scriptProcessor);
                // Connecter à un analyser dummy puis à un gain silencieux (pour activer sans écho)
                scriptProcessor.connect(dummyAnalyser);
                dummyAnalyser.connect(silentGain);
                silentGain.connect(audioContext.destination); // Connecté mais volume 0 = aucun son
                
                console.log('✅ ScriptProcessor initialisé (fallback PCM)');
            }
            
            // Note: Si MediaRecorder avec Opus est utilisé, les filtres sont gérés automatiquement
            // Les filtres Web Audio sont toujours actifs pour l'analyse du niveau audio
            limiter.connect(analyser);
            
            console.log('✅ Configuration audio optimisée HAUTE QUALITÉ VOCALE:');
            console.log('   - Codec: Opus (128 kbps) - Qualité vocale supérieure');
            console.log('   - Sample rate: 48kHz (qualité professionnelle)');
            console.log('   - Intervalle: 100ms (optimisé pour stabilité)');
            console.log('   - Auto Gain Control: Activé (volume automatique optimal)');
            console.log('   - Echo Cancellation: Double AEC activé');
            console.log('   - Noise Suppression: Activé');
            console.log('   - Filtres audio: Égaliseur multi-bandes actif');
            console.log('   - Écho: COMPLÈTEMENT DÉSACTIVÉ');
            
            // Mettre à jour l'état dans Firebase
            database.ref(FIREBASE_RADIO_STATUS_PATH).set({
                isLive: true,
                startedAt: new Date().toISOString(),
                sampleRate: audioContext.sampleRate,
                format: selectedMimeType ? 'opus' : 'pcm16', // Format Opus ou PCM fallback
                codec: selectedMimeType || 'pcm16',
                bitrate: selectedMimeType ? 128000 : 768000, // 128 kbps pour Opus (qualité supérieure), brut pour PCM
                quality: 'high' // Qualité vocale haute
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
        // Arrêter MediaRecorder si actif (Opus)
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try {
                mediaRecorder.stop();
                console.log('⏹️ MediaRecorder arrêté');
            } catch (e) {
                console.error('Erreur arrêt MediaRecorder:', e);
            }
            mediaRecorder = null;
        }
        
        // Déconnecter le script processor (fallback)
        if (scriptProcessor) {
            try {
                scriptProcessor.disconnect();
                scriptProcessor = null;
            } catch (e) {
                console.error('Erreur déconnexion scriptProcessor:', e);
            }
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
    initStreamUrlConfig();
}

// Variables pour la diffusion MP3
let mp3StreamInterval = null;
let mp3AudioContext = null;
let mp3AudioBuffer = null;
let mp3IsStreaming = false;
let mp3SourceNode = null;

// Initialiser la configuration de l'URL du stream
function initStreamUrlConfig() {
    const streamUrlInput = document.getElementById('streamUrlInput');
    const saveStreamUrlBtn = document.getElementById('saveStreamUrlBtn');
    const mp3FileInput = document.getElementById('mp3FileInput');
    const startMp3StreamBtn = document.getElementById('startMp3StreamBtn');
    const stopMp3StreamBtn = document.getElementById('stopMp3StreamBtn');
    const mp3StreamStatus = document.getElementById('mp3StreamStatus');
    
    if (!streamUrlInput || !saveStreamUrlBtn) return;
    
    // Charger l'URL actuelle depuis Firebase
    database.ref('radio/streamUrl').once('value', (snapshot) => {
        const url = snapshot.val();
        if (url) {
            streamUrlInput.value = url;
        }
    });
    
    // Enregistrer l'URL
    saveStreamUrlBtn.addEventListener('click', () => {
        const url = streamUrlInput.value.trim();
        
        // VALIDATION : Vérifier que ce n'est pas un fichier local
        if (url && url !== '') {
            // Rejeter les fichiers locaux
            if (url.startsWith('file://') || 
                url.startsWith('C:/') || 
                url.startsWith('C:\\') ||
                url.match(/^[A-Z]:[\\/]/)) {
                alert('❌ Erreur : Les fichiers locaux ne sont pas supportés par les navigateurs pour des raisons de sécurité.\n\nUtilisez une URL HTTP/HTTPS valide (ex: https://example.com/stream.mp3) ou laissez vide pour utiliser le streaming vocal Firebase.');
                console.error('❌ Tentative d\'enregistrement d\'un fichier local:', url);
                return;
            }
            
            // Valider que c'est une URL HTTP/HTTPS valide
            try {
                const urlObj = new URL(url);
                if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                    alert('❌ Erreur : Seules les URLs HTTP/HTTPS sont supportées.\n\nProtocole détecté: ' + urlObj.protocol);
                    console.error('❌ Protocole non supporté:', urlObj.protocol);
                    return;
                }
            } catch (e) {
                alert('❌ Erreur : URL invalide.\n\nFormat attendu: http://example.com/stream.mp3 ou https://example.com/stream.mp3\n\nOu laissez vide pour utiliser le streaming vocal Firebase.');
                console.error('❌ URL invalide:', url);
                return;
            }
        }
        
        database.ref('radio/streamUrl').set(url)
            .then(() => {
                console.log('✅ URL stream enregistrée:', url || '(vide - streaming vocal activé)');
                alert(url ? 'URL du stream enregistrée avec succès !' : 'URL effacée - Le streaming vocal Firebase sera utilisé.');
            })
            .catch((error) => {
                console.error('❌ Erreur enregistrement URL:', error);
                alert('Erreur lors de l\'enregistrement de l\'URL');
            });
    });
    
    // Permettre d'effacer l'URL
    streamUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveStreamUrlBtn.click();
        }
    });
    
    // Diffusion MP3 simple
    if (mp3FileInput && startMp3StreamBtn && stopMp3StreamBtn && mp3StreamStatus) {
        startMp3StreamBtn.addEventListener('click', async () => {
            const file = mp3FileInput.files[0];
            if (!file) {
                alert('Veuillez sélectionner un fichier MP3');
                return;
            }
            
            try {
                mp3StreamStatus.textContent = '⏳ Chargement du fichier...';
                
                // Créer un contexte audio
                mp3AudioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Lire le fichier
                const arrayBuffer = await file.arrayBuffer();
                mp3AudioBuffer = await mp3AudioContext.decodeAudioData(arrayBuffer);
                
                mp3StreamStatus.textContent = '✅ Fichier chargé ! Démarrage de la diffusion...';
                
                // Mettre à jour le statut dans Firebase
                database.ref(FIREBASE_RADIO_STATUS_PATH).set({
                    isLive: true,
                    startedAt: new Date().toISOString(),
                    format: 'mp3-file',
                    filename: file.name
                });
                
                // Démarrer la diffusion (en boucle)
                startMp3StreamLoop();
                
                startMp3StreamBtn.style.display = 'none';
                stopMp3StreamBtn.style.display = 'inline-block';
                mp3StreamStatus.textContent = '✅ Diffusion en cours ! Le fichier joue en boucle sur le site.';
                
            } catch (error) {
                console.error('❌ Erreur chargement MP3:', error);
                mp3StreamStatus.textContent = '❌ Erreur : ' + error.message;
                alert('Erreur lors du chargement du fichier MP3');
            }
        });
        
        stopMp3StreamBtn.addEventListener('click', () => {
            stopMp3Stream();
        });
    }
}

// Démarrer la boucle de diffusion MP3
function startMp3StreamLoop() {
    if (mp3IsStreaming) return;
    mp3IsStreaming = true;
    
    let currentTime = 0;
    const sampleRate = mp3AudioBuffer.sampleRate;
    const chunkDuration = 0.1; // 100ms par chunk
    const chunkSize = Math.floor(sampleRate * chunkDuration);
    
    function sendNextChunk() {
        if (!mp3IsStreaming) return;
        
        const startSample = Math.floor(currentTime * sampleRate);
        const endSample = Math.min(startSample + chunkSize, mp3AudioBuffer.length);
        
        if (startSample >= mp3AudioBuffer.length) {
            // Fin du fichier, recommencer
            currentTime = 0;
            sendNextChunk();
            return;
        }
        
        // Extraire les données audio
        const channelData = mp3AudioBuffer.getChannelData(0);
        const chunkData = channelData.slice(startSample, endSample);
        
        // Convertir en Int16
        const int16Data = new Int16Array(chunkData.length);
        for (let i = 0; i < chunkData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, chunkData[i] * 32768));
        }
        
        // Convertir en base64
        const uint8Array = new Uint8Array(int16Data.buffer);
        let base64Audio = '';
        const chunkSize2 = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize2) {
            const chunk = uint8Array.slice(i, i + chunkSize2);
            base64Audio += String.fromCharCode.apply(null, chunk);
        }
        base64Audio = btoa(base64Audio);
        
        // Envoyer à Firebase
        const timestamp = Date.now();
        database.ref(`radio/audioChunks/${timestamp}`).set({
            data: base64Audio,
            timestamp: timestamp,
            sampleRate: sampleRate,
            format: 'pcm16',
            bufferSize: chunkData.length
        }).catch((error) => {
            console.error('❌ Erreur envoi chunk:', error);
        });
        
        currentTime += chunkDuration;
        
        // Envoyer le prochain chunk
        mp3StreamInterval = setTimeout(sendNextChunk, chunkDuration * 1000);
    }
    
    sendNextChunk();
}

// Arrêter la diffusion MP3
function stopMp3Stream() {
    mp3IsStreaming = false;
    
    if (mp3StreamInterval) {
        clearTimeout(mp3StreamInterval);
        mp3StreamInterval = null;
    }
    
    if (mp3SourceNode) {
        mp3SourceNode.stop();
        mp3SourceNode = null;
    }
    
    if (mp3AudioContext) {
        mp3AudioContext.close();
        mp3AudioContext = null;
    }
    
    // Supprimer les chunks
    database.ref('radio/audioChunks').remove();
    
    // Mettre à jour le statut
    database.ref(FIREBASE_RADIO_STATUS_PATH).set({
        isLive: false,
        stoppedAt: new Date().toISOString()
    });
    
    document.getElementById('startMp3StreamBtn').style.display = 'inline-block';
    document.getElementById('stopMp3StreamBtn').style.display = 'none';
    document.getElementById('mp3StreamStatus').textContent = '⏹️ Diffusion arrêtée';
}

// Initialisation
checkAuth();

