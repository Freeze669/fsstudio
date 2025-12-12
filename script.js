// Configuration de la radio
const radioConfig = {
    streamUrl: '' // URL du stream radio (chargée depuis Firebase)
};

// Chemins Firebase pour la radio
const FIREBASE_RADIO_STATUS_PATH = 'radio/status';

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
        // Play - Vérifier si une diffusion vocale est en cours
        database.ref(FIREBASE_RADIO_STATUS_PATH).once('value', (snapshot) => {
            const status = snapshot.val();
            if (status && status.isLive) {
                // Si une diffusion vocale est active, démarrer l'écoute
                if (!isPlayingAudio) {
                    startListeningToAudio();
                }
                trackTitle.textContent = 'EN DIRECT 🎙️';
            }
        });
        
        // Mode simulation pour l'animation
        simulatePlayback();
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


// ============================================
// RADIO STREAM - Diffusion vocale directe
// ============================================

let audioChunksQueue = [];
let isPlayingAudio = false;
let lastChunkTimestamp = 0;
let audioContextListener = null;
let audioSource = null;
let chunksReceivedCount = 0;
let lastReceivedTime = null;
let gainNode = null; // Pour contrôler le volume
let currentVolume = 1.0; // Volume par défaut à 100%

// Charger et jouer les chunks audio depuis Firebase
function loadRadioStream() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        setTimeout(loadRadioStream, 1000);
        return;
    }
    
    try {
        // Écouter le statut (en direct/hors ligne)
        const statusRef = database.ref(FIREBASE_RADIO_STATUS_PATH);
        
        statusRef.on('value', (snapshot) => {
            const status = snapshot.val();
            console.log('📡 Statut radio reçu:', status);
            if (status && status.isLive === true) {
                trackTitle.textContent = 'EN DIRECT 🎙️';
                console.log('✅ Statut: EN DIRECT - Démarrage de l\'écoute');
                if (!isPlayingAudio) {
                    startListeningToAudio();
                }
            } else {
                trackTitle.textContent = 'EN DIRECT';
                console.log('⏸️ Statut: Hors ligne');
                stopListeningToAudio();
            }
        });
        
        // Vérifier immédiatement si une diffusion est en cours
        statusRef.once('value', (snapshot) => {
            const status = snapshot.val();
            console.log('📡 Vérification statut initial:', status);
            if (status && status.isLive === true) {
                trackTitle.textContent = 'EN DIRECT 🎙️';
                console.log('✅ Diffusion déjà en cours - Démarrage immédiat');
                if (!isPlayingAudio) {
                    startListeningToAudio();
                }
            } else {
                trackTitle.textContent = 'EN DIRECT';
                console.log('⏸️ Aucune diffusion en cours');
            }
        });
        
        // Enregistrer comme auditeur
        const listenerId = 'listener_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        database.ref(`radio/listeners/${listenerId}`).set({
            joinedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        });
        
        // Mettre à jour lastSeen toutes les 30 secondes
        setInterval(() => {
            database.ref(`radio/listeners/${listenerId}`).update({
                lastSeen: new Date().toISOString()
            });
        }, 30000);
        
        // Nettoyer à la fermeture
        window.addEventListener('beforeunload', () => {
            database.ref(`radio/listeners/${listenerId}`).remove();
        });
        
    } catch (error) {
        console.error('❌ Erreur chargement stream:', error);
    }
}

// Démarrer l'écoute des chunks audio
function startListeningToAudio() {
    if (isPlayingAudio) {
        console.log('⚠️ Écoute déjà en cours');
        return;
    }
    
    isPlayingAudio = true;
    audioChunksQueue = [];
    lastChunkTimestamp = Date.now() - 5000; // Accepter les chunks des 5 dernières secondes
    
    console.log('🎧 Démarrage de l\'écoute de la diffusion vocale...');
    
    // Créer/réinitialiser le contexte audio pour la lecture
    if (!audioContextListener || audioContextListener.state === 'closed') {
        audioContextListener = new (window.AudioContext || window.webkitAudioContext)();
        
        // Créer un GainNode pour contrôler le volume
        gainNode = audioContextListener.createGain();
        gainNode.gain.value = currentVolume;
        gainNode.connect(audioContextListener.destination);
        
        console.log('✅ Contexte audio créé avec contrôle de volume');
    }
    
    // Reprendre le contexte si suspendu (nécessaire après interaction utilisateur)
    if (audioContextListener.state === 'suspended') {
        audioContextListener.resume().then(() => {
            console.log('✅ Contexte audio repris');
        });
    }
    
    // S'assurer que le gainNode existe
    if (!gainNode) {
        gainNode = audioContextListener.createGain();
        gainNode.gain.value = currentVolume;
        gainNode.connect(audioContextListener.destination);
    }
    
    // Initialiser MediaSource pour le streaming
    try {
        if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/webm; codecs=opus')) {
            mediaSource = new MediaSource();
            const audio = new Audio();
            audio.src = URL.createObjectURL(mediaSource);
            audio.volume = 1.0;
            
            mediaSource.addEventListener('sourceopen', () => {
                try {
                    sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs=opus');
                    mediaSourceReady = true;
                    console.log('✅ MediaSource initialisé pour streaming');
                    
                    audio.play().catch(err => {
                        console.warn('⚠️ Auto-play bloqué, nécessite interaction utilisateur');
                    });
                } catch (e) {
                    console.warn('⚠️ MediaSource SourceBuffer non supporté, utilisation du fallback');
                    mediaSourceReady = false;
                }
            });
            
            // Stocker la référence audio
            window.streamAudio = audio;
        }
    } catch (e) {
        console.warn('⚠️ MediaSource non disponible, utilisation du fallback');
    }
    
    // Écouter tous les nouveaux chunks audio
    const chunksRef = database.ref('radio/audioChunks');
    
    // Écouter les nouveaux chunks en temps réel
    chunksRef.orderByKey().on('child_added', (snapshot) => {
        const chunkData = snapshot.val();
            if (chunkData && chunkData.data) {
                const chunkTimestamp = chunkData.timestamp || parseInt(snapshot.key);
                const age = Date.now() - chunkTimestamp;
                
                // Ne jouer que les chunks récents (moins de 5 secondes)
                if (chunkTimestamp > lastChunkTimestamp && age < 5000) {
                    lastChunkTimestamp = chunkTimestamp;
                    console.log(`🎵 Chunk reçu: ${chunkTimestamp}, âge: ${age}ms, format: ${chunkData.format || 'pcm16'}`);
                    playAudioChunk(chunkData.data, {
                        format: chunkData.format || 'pcm16',
                        sampleRate: chunkData.sampleRate || 44100,
                        bufferSize: chunkData.bufferSize || 4096
                    });
                } else {
                    console.log(`⏭️ Chunk ignoré (trop vieux): ${age}ms`);
                }
            }
    });
    
    // Écouter aussi les changements pour récupérer les chunks manqués
    chunksRef.on('value', (snapshot) => {
        const chunks = snapshot.val();
        if (chunks) {
            const now = Date.now();
            const chunkEntries = Object.entries(chunks)
                .map(([key, value]) => ({
                    key: parseInt(key),
                    timestamp: value.timestamp || parseInt(key),
                    ...value
                }))
                .filter(chunk => {
                    const age = now - chunk.timestamp;
                    return chunk.timestamp > lastChunkTimestamp && age < 5000 && chunk.data;
                })
                .sort((a, b) => a.timestamp - b.timestamp);
            
            if (chunkEntries.length > 0) {
                console.log(`📥 Récupération de ${chunkEntries.length} chunks manqués`);
                chunkEntries.forEach(chunk => {
                    lastChunkTimestamp = chunk.timestamp;
                    playAudioChunk(chunk.data, {
                        format: chunk.format || 'pcm16',
                        sampleRate: chunk.sampleRate || 44100,
                        bufferSize: chunk.bufferSize || 4096
                    });
                });
            }
        }
    });
    
    chunksReceivedCount = 0;
    updateAudioStatus(false, 'En attente des chunks...');
    
    // S'assurer que le contexte audio est actif (nécessaire pour certains navigateurs)
    if (audioContextListener.state === 'suspended') {
        // Activer le contexte avec une interaction utilisateur
        const resumeAudio = () => {
            audioContextListener.resume().then(() => {
                console.log('✅ Contexte audio activé');
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
            });
        };
        document.addEventListener('click', resumeAudio, { once: true });
        document.addEventListener('touchstart', resumeAudio, { once: true });
    }
    
    console.log('✅ Écoute de la diffusion vocale démarrée');
}

// Arrêter l'écoute
function stopListeningToAudio() {
    if (!isPlayingAudio) return;
    
    isPlayingAudio = false;
    audioChunksQueue = [];
    audioBufferQueue = [];
    isProcessingBuffer = false;
    
    if (sourceBuffer) {
        try {
            if (sourceBuffer.updating) {
                sourceBuffer.abort();
            }
        } catch (e) {}
        sourceBuffer = null;
    }
    
    if (mediaSource && mediaSource.readyState === 'open') {
        try {
            mediaSource.endOfStream();
        } catch (e) {}
    }
    
    if (mediaSource) {
        try {
            mediaSource = null;
        } catch (e) {}
    }
    
    if (audioContextListener) {
        try {
            audioContextListener.close();
        } catch (e) {}
        audioContextListener = null;
    }
    
    if (audioSource) {
        try {
            audioSource.disconnect();
        } catch (e) {}
        audioSource = null;
    }
    
    // Désactiver les listeners Firebase
    try {
        database.ref('radio/audioChunks').off();
    } catch (e) {}
    
    console.log('⏹️ Écoute arrêtée');
}

// Jouer un chunk audio
function playAudioChunk(base64Data, chunkInfo) {
    try {
        chunksReceivedCount++;
        lastReceivedTime = new Date();
        
        // Mettre à jour le statut visuel
        updateAudioStatus(true);
        
        // Ajouter à la queue avec les informations du chunk
        audioChunksQueue.push({ 
            data: base64Data, 
            format: chunkInfo.format || 'pcm16',
            sampleRate: chunkInfo.sampleRate || 44100,
            bufferSize: chunkInfo.bufferSize || 4096
        });
        
        // Si c'est le premier chunk, démarrer la lecture
        if (audioChunksQueue.length === 1) {
            processAudioQueue();
        }
        
        console.log(`🎵 Chunk reçu et ajouté à la queue (total: ${chunksReceivedCount}, format: ${chunkInfo.format || 'pcm16'})`);
        
    } catch (error) {
        console.error('Erreur traitement chunk audio:', error);
        updateAudioStatus(false, 'Erreur traitement');
    }
}

// Mettre à jour le statut audio visuel
function updateAudioStatus(isReceiving, message = null) {
    const audioStatus = document.getElementById('audioStatus');
    const statusDot = document.getElementById('statusDot');
    const audioStatusText = document.getElementById('audioStatusText');
    
    if (!audioStatus || !statusDot || !audioStatusText) return;
    
    audioStatus.style.display = 'flex';
    
    if (isReceiving) {
        statusDot.style.background = '#43b581';
        audioStatusText.textContent = message || `Reçu: ${chunksReceivedCount} chunks`;
    } else {
        statusDot.style.background = '#f04747';
        audioStatusText.textContent = message || 'Aucun signal';
    }
}

// Buffer audio continu pour créer un stream
let audioBufferQueue = [];
let isProcessingBuffer = false;
let mediaSource = null;
let sourceBuffer = null;
let mediaSourceReady = false;

// Traiter la queue audio - Format PCM16
async function processAudioQueue() {
    if (audioChunksQueue.length === 0) {
        if (audioBufferQueue.length === 0) {
            // Ne pas afficher "Queue vide" si on est en direct
            const statusRef = database.ref(FIREBASE_RADIO_STATUS_PATH);
            statusRef.once('value', (snapshot) => {
                const status = snapshot.val();
                if (!status || !status.isLive) {
                    updateAudioStatus(false, 'Aucune diffusion en cours');
                } else {
                    updateAudioStatus(true, 'En attente de chunks...');
                }
            });
        }
        return;
    }
    
    if (isProcessingBuffer) return;
    isProcessingBuffer = true;
    
    // Prendre le premier chunk de la queue
    const chunk = audioChunksQueue.shift();
    
    try {
        // Vérifier le format
        if (chunk.format === 'pcm16' && chunk.sampleRate) {
            // Convertir base64 en Int16Array
            const binaryString = atob(chunk.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Vérifier que la taille est correcte (doit être multiple de 2 pour Int16)
            if (bytes.length % 2 !== 0) {
                console.warn('⚠️ Taille de données invalide, ignoré');
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) {
                    setTimeout(() => processAudioQueue(), 10);
                }
                return;
            }
            
            // Convertir en Int16Array
            const int16Data = new Int16Array(bytes.buffer);
            
            // Convertir Int16 vers Float32 pour Web Audio API
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }
            
            // Créer un AudioBuffer
            const audioBuffer = audioContextListener.createBuffer(
                1, // 1 canal (mono)
                float32Data.length,
                chunk.sampleRate
            );
            
            // Copier les données
            audioBuffer.getChannelData(0).set(float32Data);
            
            // S'assurer que le contexte est actif
            if (audioContextListener.state === 'suspended') {
                await audioContextListener.resume();
            }
            
            // S'assurer que le gainNode existe
            if (!gainNode) {
                gainNode = audioContextListener.createGain();
                gainNode.gain.value = currentVolume;
                gainNode.connect(audioContextListener.destination);
            }
            
            // Créer une source audio et jouer via le gainNode (pour le volume)
            const source = audioContextListener.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNode); // Connecter au gainNode au lieu de destination directement
            
            updateAudioStatus(true, `Lecture: ${chunksReceivedCount} chunks`);
            const duration = audioBuffer.duration;
            console.log(`🔊 Chunk PCM décodé et joué (${float32Data.length} échantillons, ${chunk.sampleRate}Hz, ${duration.toFixed(3)}s)`);
            
            // Quand la lecture est terminée
            source.onended = () => {
                isProcessingBuffer = false;
                // Continuer avec le prochain chunk immédiatement
                if (audioChunksQueue.length > 0) {
                    setTimeout(() => processAudioQueue(), 5);
                } else {
                    updateAudioStatus(true, 'En attente de nouveaux chunks...');
                    isProcessingBuffer = false;
                }
            };
            
            try {
                source.start(0);
                console.log('✅ Source audio démarrée');
            } catch (startError) {
                console.error('❌ Erreur démarrage source:', startError);
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) {
                    setTimeout(() => processAudioQueue(), 10);
                }
            }
            
            // Timeout de sécurité (un peu plus long que la durée réelle)
            const durationMs = duration * 1000;
            setTimeout(() => {
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) {
                    processAudioQueue();
                }
            }, durationMs + 50);
            
        } else {
            // Format inconnu, ignorer
            console.warn('⚠️ Format audio inconnu:', chunk.format, chunk);
            isProcessingBuffer = false;
            if (audioChunksQueue.length > 0) {
                setTimeout(() => processAudioQueue(), 10);
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur traitement chunk PCM:', error);
        isProcessingBuffer = false;
        updateAudioStatus(false, 'Erreur traitement');
        // Continuer avec le prochain chunk
        if (audioChunksQueue.length > 0) {
            setTimeout(() => processAudioQueue(), 10);
        }
    }
}

// ============================================
// CONTRÔLE DE VOLUME
// ============================================

const volumeBtn = document.getElementById('volumeBtn');
const volumeSliderContainer = document.getElementById('volumeSliderContainer');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

// Charger le volume sauvegardé
const savedVolume = localStorage.getItem('radioVolume');
if (savedVolume !== null) {
    currentVolume = parseFloat(savedVolume);
    if (volumeSlider) volumeSlider.value = currentVolume * 100;
    if (volumeValue) volumeValue.textContent = Math.round(currentVolume * 100) + '%';
}

// Toggle affichage du slider
if (volumeBtn) {
    volumeBtn.addEventListener('click', () => {
        if (volumeSliderContainer) {
            const isVisible = volumeSliderContainer.style.display !== 'none';
            volumeSliderContainer.style.display = isVisible ? 'none' : 'flex';
        }
    });
}

// Changer le volume
if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        currentVolume = e.target.value / 100;
        
        // Mettre à jour le gainNode
        if (gainNode) {
            gainNode.gain.value = currentVolume;
        }
        
        // Sauvegarder
        localStorage.setItem('radioVolume', currentVolume);
        
        // Mettre à jour l'affichage
        if (volumeValue) {
            volumeValue.textContent = Math.round(currentVolume * 100) + '%';
        }
        
        console.log(`🔊 Volume: ${Math.round(currentVolume * 100)}%`);
    });
}

// Initialisation
updateTime();
updateTrackTitle();
setInterval(updateTime, 1000); // Mettre à jour l'heure chaque seconde

// Charger le stream radio depuis Firebase
loadRadioStream();

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

