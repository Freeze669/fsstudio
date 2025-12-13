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
        if (streamUrl && audioPlayer.src) {
            // Si on utilise un stream URL, utiliser l'élément audio
            audioPlayer.pause();
        } else {
            // Sinon, arrêter le streaming vocal
            stopListeningToAudio();
        }
        isPlaying = false;
        isPlayingAudio = false;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        vinylRecord.classList.remove('playing');
    } else {
        // Play - Activer le contexte audio puis démarrer la lecture
        // Le navigateur nécessite une interaction utilisateur pour activer l'audio
        if (!audioContextListener || audioContextListener.state === 'closed') {
            audioContextListener = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });
        }
        
        if (audioContextListener.state === 'suspended') {
            audioContextListener.resume().then(() => {
                console.log('✅ Contexte audio activé, démarrage de l\'écoute...');
                startListeningToAudio();
            }).catch(err => {
                console.error('❌ Erreur activation audio:', err);
                alert('Erreur: Impossible d\'activer l\'audio. Vérifiez les permissions.');
            });
        } else {
            startListeningToAudio();
        }
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
        // Charger l'URL du stream depuis Firebase
        database.ref('radio/streamUrl').on('value', (snapshot) => {
            const url = snapshot.val();
            if (url && url.trim() !== '') {
                streamUrl = url.trim();
                console.log('📡 URL stream chargée:', streamUrl);
                // Si on est déjà en lecture, mettre à jour l'URL
                if (isPlayingAudio) {
                    audioPlayer.src = streamUrl;
                    audioPlayer.play().catch(err => {
                        console.error('❌ Erreur lecture stream:', err);
                    });
                }
            } else {
                streamUrl = '';
                console.log('📡 Pas d\'URL stream, utilisation du streaming vocal');
            }
        });
        
        // Écouter le statut (en direct/hors ligne) - seulement si pas d'URL stream
        const statusRef = database.ref(FIREBASE_RADIO_STATUS_PATH);
        
        statusRef.on('value', (snapshot) => {
            const status = snapshot.val();
            // Si on a une URL stream, ignorer le statut vocal
            if (streamUrl && streamUrl.trim() !== '') {
                return;
            }
            
            console.log('📡 Statut radio vocal reçu:', status);
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
            // Si on a une URL stream, ne pas vérifier le statut vocal
            if (streamUrl && streamUrl.trim() !== '') {
                return;
            }
            
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

// Variable pour le stream URL
let streamUrl = '';

// Démarrer l'écoute des chunks audio
function startListeningToAudio() {
    if (isPlayingAudio) {
        console.log('⚠️ Écoute déjà en cours');
        return;
    }
    
    // Si une URL de stream est configurée, utiliser l'élément audio classique
    if (streamUrl && streamUrl.trim() !== '') {
        console.log('📡 Utilisation du stream URL:', streamUrl);
        audioPlayer.src = streamUrl;
        audioPlayer.play().then(() => {
            isPlayingAudio = true;
            isPlaying = true;
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            vinylRecord.classList.add('playing');
            trackTitle.textContent = 'EN DIRECT 🎙️';
            updateAudioStatus(true, 'Stream actif');
        }).catch(err => {
            console.error('❌ Erreur lecture stream:', err);
            updateAudioStatus(false, 'Erreur lecture');
        });
        return;
    }
    
    // Sinon, utiliser le streaming vocal Firebase
    // Créer le contexte audio s'il n'existe pas
    if (!audioContextListener || audioContextListener.state === 'closed') {
        try {
            audioContextListener = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });
            console.log('✅ Contexte audio créé pour streaming vocal');
        } catch (error) {
            console.error('❌ Erreur création contexte:', error);
            return;
        }
    }
    
    // Reprendre le contexte s'il est suspendu (nécessite une interaction utilisateur)
    if (audioContextListener.state === 'suspended') {
        console.log('⚠️ Contexte audio suspendu, tentative de reprise...');
        audioContextListener.resume().then(() => {
            console.log('✅ Contexte audio activé avec succès');
        }).catch(err => {
            console.error('❌ Erreur activation contexte:', err);
            alert('⚠️ Le navigateur bloque l\'audio. Cliquez n\'importe où sur la page puis réessayez.');
        });
    } else {
        console.log('✅ Contexte audio déjà actif:', audioContextListener.state);
    }
    
    isPlayingAudio = true;
    audioChunksQueue = [];
    lastChunkTimestamp = Date.now() - 2000; // Accepter les chunks des 2 dernières secondes
    
    console.log('🎧 Démarrage de l\'écoute de la diffusion vocale Firebase...');
    
    // Créer le gainNode si nécessaire
    if (!gainNode && audioContextListener) {
        try {
            gainNode = audioContextListener.createGain();
            gainNode.gain.value = currentVolume;
            gainNode.connect(audioContextListener.destination);
            console.log('✅ GainNode créé et connecté, volume:', currentVolume, '(', (currentVolume * 100).toFixed(0) + '%)');
        } catch (error) {
            console.error('❌ Erreur création gainNode:', error);
            return;
        }
    }
    
    // Vérifier que le volume n'est pas à 0
    if (gainNode && gainNode.gain.value === 0) {
        console.warn('⚠️ Volume à 0, réglage à 100%');
        gainNode.gain.value = 1.0;
        currentVolume = 1.0;
    }
    
    // MediaSource n'est plus utilisé, on utilise directement Audio pour chaque chunk
    
    // ÉCOUTER TOUS LES NOUVEAUX CHUNKS - SYSTÈME SIMPLIFIÉ ET FIABLE
    const chunksRef = database.ref('radio/audioChunks');
    
    // Écouter chaque nouveau chunk (SYSTÈME SIMPLIFIÉ)
    chunksRef.orderByKey().on('child_added', (snapshot) => {
        const chunkData = snapshot.val();
        if (!chunkData || !chunkData.data) return;
        
        const chunkTimestamp = chunkData.timestamp || parseInt(snapshot.key);
        const age = Date.now() - chunkTimestamp;
        
        // Accepter seulement les nouveaux chunks récents (moins de 3 secondes)
        if (chunkTimestamp > lastChunkTimestamp && age < 3000) {
            lastChunkTimestamp = chunkTimestamp;
            console.log(`📥 Chunk reçu: ${chunkTimestamp}, âge: ${age}ms`);
            playAudioChunk(chunkData.data, {
                format: chunkData.format || 'pcm16',
                sampleRate: chunkData.sampleRate || 44100,
                bufferSize: chunkData.bufferSize || 4096,
                mimeType: chunkData.mimeType || null
            });
        }
    });
    
    chunksReceivedCount = 0;
    updateAudioStatus(false, 'En attente des chunks...');
    
    // Le contexte devrait déjà être activé, sinon on l'affichera dans startListeningToAudio
    
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
        
        // LIMITER la queue à 10 chunks maximum pour éviter les crashes
        if (audioChunksQueue.length > 10) {
            console.warn(`⚠️ Queue trop longue (${audioChunksQueue.length}), suppression des anciens chunks`);
            // Supprimer les 5 plus anciens
            audioChunksQueue.splice(0, 5);
        }
        
        // Ajouter à la queue avec les informations du chunk
        audioChunksQueue.push({ 
            data: base64Data, 
            format: chunkInfo.format || 'pcm16',
            sampleRate: chunkInfo.sampleRate || 44100,
            bufferSize: chunkInfo.bufferSize || 4096,
            mimeType: chunkInfo.mimeType || null
        });
        
        // Si c'est le premier chunk, démarrer la lecture
        if (audioChunksQueue.length === 1 && !isProcessingBuffer) {
            processAudioQueue();
        }
        
        // Log seulement tous les 10 chunks pour éviter le spam
        if (chunksReceivedCount % 10 === 0) {
            console.log(`🎵 ${chunksReceivedCount} chunks reçus, queue: ${audioChunksQueue.length}, format: ${chunkInfo.format || 'pcm16'}`);
        }
        
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

// TRAITER LA QUEUE AUDIO - SYSTÈME SIMPLIFIÉ ET FIABLE
async function processAudioQueue() {
    if (audioChunksQueue.length === 0) {
        isProcessingBuffer = false;
        updateAudioStatus(true, 'En attente de chunks...');
        return;
    }
    
    if (isProcessingBuffer) return;
    isProcessingBuffer = true;
    
    // Prendre le premier chunk de la queue
    const chunk = audioChunksQueue.shift();
    
    try {
        // FORMAT OPUS - Utiliser directement l'élément Audio HTML (plus fiable)
        if (chunk.format === 'opus' || chunk.mimeType) {
            // Format Opus (qualité appel optimale comme WhatsApp/Telegram)
            const mimeType = chunk.mimeType || 'audio/webm;codecs=opus';
            
            // Convertir base64 en Blob
            const binaryString = atob(chunk.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: mimeType });
            const audioUrl = URL.createObjectURL(blob);
            
            // S'assurer que le contexte est actif
            if (audioContextListener.state === 'suspended') {
                await audioContextListener.resume();
            }
            
            if (!gainNode) {
                gainNode = audioContextListener.createGain();
                gainNode.gain.value = currentVolume;
                gainNode.connect(audioContextListener.destination);
            }
            
            // LECTURE OPUS SIMPLIFIÉE - Élément Audio HTML direct
            const audio = new Audio(audioUrl);
            audio.volume = currentVolume;
            
            let cleaned = false;
            const cleanup = () => {
                if (cleaned) return;
                cleaned = true;
                try {
                    audio.pause();
                    audio.src = '';
                    URL.revokeObjectURL(audioUrl);
                } catch (e) {}
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) {
                    setTimeout(() => processAudioQueue(), 5);
                }
            };
            
            audio.addEventListener('ended', cleanup, { once: true });
            audio.addEventListener('error', () => cleanup(), { once: true });
            
            try {
                audio.play().then(() => {
                    updateAudioStatus(true, `Lecture: ${chunksReceivedCount} chunks`);
                    // Cleanup après ~150ms (durée du chunk)
                    setTimeout(cleanup, 150);
                }).catch((err) => {
                    console.error('❌ Erreur play Opus:', err);
                    cleanup();
                });
            } catch (err) {
                console.error('❌ Erreur lecture Opus:', err);
                cleanup();
            }
            
            return;
        }
        
        // FORMAT PCM16 - LECTURE SIMPLIFIÉE ET FIABLE
        if (chunk.format === 'pcm16' && chunk.sampleRate) {
            // Décoder base64
            const binaryString = atob(chunk.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            if (bytes.length % 2 !== 0) {
                console.warn('⚠️ Taille invalide');
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) setTimeout(() => processAudioQueue(), 10);
                return;
            }
            
            // Convertir en Int16 puis Float32
            const int16Data = new Int16Array(bytes.buffer);
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }
            
            // Créer AudioBuffer
            const sampleRate = chunk.sampleRate || 44100;
            const audioBuffer = audioContextListener.createBuffer(1, float32Data.length, sampleRate);
            audioBuffer.getChannelData(0).set(float32Data);
            
            // Activer le contexte
            if (audioContextListener.state === 'suspended') {
                await audioContextListener.resume();
            }
            
            // Créer/connecter gainNode
            if (!gainNode) {
                gainNode = audioContextListener.createGain();
                gainNode.connect(audioContextListener.destination);
            }
            gainNode.gain.value = currentVolume || 1.0;
            
            // Créer et jouer la source
            const source = audioContextListener.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNode);
            
            const duration = audioBuffer.duration;
            console.log(`🔊 Chunk PCM: ${float32Data.length} échantillons, ${duration.toFixed(3)}s, volume: ${(currentVolume * 100).toFixed(0)}%`);
            
            source.onended = () => {
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) {
                    setTimeout(() => processAudioQueue(), 5);
                }
            };
            
            source.onerror = () => {
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) {
                    setTimeout(() => processAudioQueue(), 10);
                }
            };
            
            try {
                source.start(0);
                updateAudioStatus(true, `Lecture: ${chunksReceivedCount} chunks`);
                setTimeout(() => {
                    isProcessingBuffer = false;
                    if (audioChunksQueue.length > 0) processAudioQueue();
                }, duration * 1000 + 50);
            } catch (err) {
                console.error('❌ Erreur start source:', err);
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0) setTimeout(() => processAudioQueue(), 10);
            }
            
        } else {
            console.warn('⚠️ Format non supporté:', chunk.format);
            isProcessingBuffer = false;
            if (audioChunksQueue.length > 0) setTimeout(() => processAudioQueue(), 10);
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

// Gestion des événements audio player
audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    isPlayingAudio = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    vinylRecord.classList.add('playing');
    updateAudioStatus(true, 'Lecture en cours');
});

audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    isPlayingAudio = false;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    vinylRecord.classList.remove('playing');
});

audioPlayer.addEventListener('error', (e) => {
    console.error('❌ Erreur audio player:', e, audioPlayer.error);
    updateAudioStatus(false, 'Erreur de lecture');
});

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

