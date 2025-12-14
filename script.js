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
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
        if (vinylRecord) vinylRecord.classList.remove('playing');
    } else {
        // Play - Activer le contexte audio puis démarrer la lecture
        // Le navigateur nécessite une interaction utilisateur pour activer l'audio
        if (!audioContextListener || audioContextListener.state === 'closed') {
            audioContextListener = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });
        }
        
        // TOUJOURS essayer de reprendre le contexte (déblocage utilisateur)
        if (audioContextListener.state === 'suspended') {
            audioContextListener.resume().then(() => {
                console.log('✅ Contexte audio activé par interaction utilisateur');
                startListeningToAudio();
                // Activer l'interface
                isPlaying = true;
                if (playIcon) playIcon.style.display = 'none';
                if (pauseIcon) pauseIcon.style.display = 'block';
                if (vinylRecord) vinylRecord.classList.add('playing');
            }).catch(err => {
                console.error('❌ Erreur activation audio:', err);
                alert('Erreur: Impossible d\'activer l\'audio. Vérifiez les permissions.');
            });
        } else {
            startListeningToAudio();
            // Activer l'interface
            isPlaying = true;
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
            if (vinylRecord) vinylRecord.classList.add('playing');
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
    console.error('❌ Erreur audio player:', e, audioPlayer.error);
    
    // Si c'est une erreur de fichier local ou source non supportée, basculer vers streaming vocal
    if (audioPlayer.error && (
        audioPlayer.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
        (streamUrl && (streamUrl.startsWith('file://') || streamUrl.match(/^[A-Z]:[\\/]/)))
    )) {
        console.warn('⚠️ Source non supportée, basculement vers streaming vocal Firebase');
        streamUrl = '';
        audioPlayer.src = '';
        
        // Vérifier si une diffusion vocale est en cours
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            database.ref(FIREBASE_RADIO_STATUS_PATH).once('value', (snapshot) => {
                const status = snapshot.val();
                if (status && status.isLive === true) {
                    console.log('✅ Diffusion vocale détectée, démarrage...');
                    autoStartAudio();
                } else {
                    updateAudioStatus(false, 'Aucune source disponible');
                }
            });
        }
    } else if (isPlaying) {
        // Autres erreurs, essayer le mode simulation
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
let silentAudioSource = null; // Source audio silencieuse pour maintenir l'icône dans l'onglet
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
                const trimmedUrl = url.trim();
                
                // VALIDATION : Rejeter les fichiers locaux (file://) et les chemins Windows
                if (trimmedUrl.startsWith('file://') || 
                    trimmedUrl.startsWith('C:/') || 
                    trimmedUrl.startsWith('C:\\') ||
                    trimmedUrl.match(/^[A-Z]:[\\/]/)) {
                    console.warn('⚠️ URL de fichier local détectée, ignorée (sécurité navigateur):', trimmedUrl);
                    console.log('📡 Utilisation du streaming vocal Firebase à la place');
                    streamUrl = '';
                    // S'assurer qu'on utilise le streaming vocal
                    if (isPlayingAudio) {
                        stopListeningToAudio();
                        const statusRef = database.ref(FIREBASE_RADIO_STATUS_PATH);
                        statusRef.once('value', (statusSnapshot) => {
                            const status = statusSnapshot.val();
                            if (status && status.isLive === true) {
                                autoStartAudio();
                            }
                        });
                    }
                    return;
                }
                
                // Valider que c'est une URL HTTP/HTTPS valide
                try {
                    const urlObj = new URL(trimmedUrl);
                    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                        console.warn('⚠️ Protocole non supporté:', urlObj.protocol);
                        streamUrl = '';
                        return;
                    }
                } catch (e) {
                    console.warn('⚠️ URL invalide:', trimmedUrl);
                    streamUrl = '';
                    return;
                }
                
                streamUrl = trimmedUrl;
                console.log('📡 URL stream valide chargée:', streamUrl);
                // Si on est déjà en lecture, mettre à jour l'URL
                if (isPlayingAudio) {
                    audioPlayer.src = streamUrl;
                    audioPlayer.play().catch(err => {
                        console.error('❌ Erreur lecture stream:', err);
                        // En cas d'erreur, basculer vers le streaming vocal
                        streamUrl = '';
                        updateAudioStatus(false, 'Erreur stream, basculement vocal...');
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
                if (trackTitle) trackTitle.textContent = 'EN DIRECT 🎙️';
                console.log('✅ Statut: EN DIRECT - Démarrage automatique de l\'écoute');
                
                // Démarrer automatiquement l'écoute si pas déjà en cours
                if (!isPlayingAudio) {
                    // Activer automatiquement l'interface et l'audio
                    autoStartAudio();
                } else {
                    // Si déjà en cours, s'assurer que l'interface est à jour
                    isPlaying = true;
                    isPlayingAudio = true;
                    if (playIcon) playIcon.style.display = 'none';
                    if (pauseIcon) pauseIcon.style.display = 'block';
                    if (vinylRecord) vinylRecord.classList.add('playing');
                    if (trackTitle) trackTitle.textContent = 'EN DIRECT 🎙️';
                    updateAudioStatus(true, 'Diffusion en cours');
                }
            } else {
                if (trackTitle) trackTitle.textContent = 'EN DIRECT';
                console.log('⏸️ Statut: Hors ligne');
                stopListeningToAudio();
                // Mettre à jour l'interface
                isPlaying = false;
                isPlayingAudio = false;
                if (playIcon) playIcon.style.display = 'block';
                if (pauseIcon) pauseIcon.style.display = 'none';
                if (vinylRecord) vinylRecord.classList.remove('playing');
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
                console.log('✅ Diffusion déjà en cours - Démarrage automatique immédiat');
                if (!isPlayingAudio) {
                    // Démarrer automatiquement l'audio
                    autoStartAudio();
                } else {
                    // Si déjà en cours, activer l'interface
                    isPlaying = true;
                    playIcon.style.display = 'none';
                    pauseIcon.style.display = 'block';
                    vinylRecord.classList.add('playing');
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

// Variables pour le système de rediffusion amélioré
let chunksListenerRef = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 0; // Pas de délai
let lastSuccessfulChunkTime = null;
let healthCheckInterval = null;
let autoPlayEnabled = true; // Activer la lecture automatique par défaut

// Détection mobile pour optimisations
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);

// Démarrer automatiquement l'audio (sans interaction utilisateur requise)
function autoStartAudio() {
    console.log('🎵 Démarrage automatique de l\'audio...');
    
    // Sur mobile, l'autoplay est plus strict - nécessite souvent une interaction
    if (isMobile) {
        console.log('📱 Détection mobile - autoplay optimisé');
    }
    
    // Créer le contexte audio s'il n'existe pas - OPTIMISÉ POUR MOBILE
    if (!audioContextListener || audioContextListener.state === 'closed') {
        try {
            // Sur mobile, utiliser 'playback' pour meilleure performance
            const latencyHint = isMobile ? 'playback' : 'interactive';
            audioContextListener = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: latencyHint // 'playback' sur mobile pour meilleure performance
            });
            console.log(`✅ Contexte audio créé automatiquement (${isMobile ? 'mobile' : 'desktop'})`);
        } catch (error) {
            console.error('❌ Erreur création contexte:', error);
            // Si échec, essayer avec startListeningToAudio qui demande l'interaction
            startListeningToAudio();
            return;
        }
    }
    
    // Essayer de reprendre le contexte (peut nécessiter une interaction utilisateur)
    if (audioContextListener.state === 'suspended') {
        // Essayer plusieurs fois de reprendre le contexte
        const resumeAudio = () => {
            audioContextListener.resume().then(() => {
                console.log('✅ Contexte audio activé automatiquement');
                // Démarrer l'écoute
                startListeningToAudio();
                // Activer l'interface
                isPlaying = true;
                if (playIcon) playIcon.style.display = 'none';
                if (pauseIcon) pauseIcon.style.display = 'block';
                if (vinylRecord) vinylRecord.classList.add('playing');
            }).catch(err => {
                console.warn('⚠️ Impossible d\'activer automatiquement, nouvelle tentative...', err);
                // Réessayer après un court délai
                setTimeout(() => {
                    if (audioContextListener && audioContextListener.state === 'suspended') {
                        resumeAudio();
                    } else if (audioContextListener && audioContextListener.state === 'running') {
                        startListeningToAudio();
                        isPlaying = true;
                        if (playIcon) playIcon.style.display = 'none';
                        if (pauseIcon) pauseIcon.style.display = 'block';
                        if (vinylRecord) vinylRecord.classList.add('playing');
                    } else {
                        updateAudioStatus(false, 'Cliquez sur ▶️ pour démarrer');
                    }
                }, 500);
            });
        };
        
        resumeAudio();
    } else {
        // Contexte déjà actif, démarrer directement
        startListeningToAudio();
        // Activer l'interface
        isPlaying = true;
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
        if (vinylRecord) vinylRecord.classList.add('playing');
    }
}

// Démarrer l'écoute des chunks audio
function startListeningToAudio() {
    if (isPlayingAudio) {
        console.log('⚠️ Écoute déjà en cours');
        return;
    }
    
    // Si une URL de stream est configurée, utiliser l'élément audio classique
    if (streamUrl && streamUrl.trim() !== '') {
        // Vérifier à nouveau que ce n'est pas un fichier local
        if (streamUrl.startsWith('file://') || 
            streamUrl.startsWith('C:/') || 
            streamUrl.startsWith('C:\\') ||
            streamUrl.match(/^[A-Z]:[\\/]/)) {
            console.warn('⚠️ Fichier local détecté, basculement vers streaming vocal');
            streamUrl = '';
            // Continuer avec le streaming vocal
        } else {
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
                updateAudioStatus(false, 'Erreur lecture, basculement vocal...');
                // En cas d'erreur, basculer vers le streaming vocal
                streamUrl = '';
                // Ne pas return, continuer avec le streaming vocal
            });
            
            // Si le stream fonctionne, on return
            if (audioPlayer.src && !audioPlayer.error) {
                return;
            }
        }
    }
    
    // Sinon, utiliser le streaming vocal Firebase
    // Créer le contexte audio s'il n'existe pas - OPTIMISÉ POUR MOBILE
    if (!audioContextListener || audioContextListener.state === 'closed') {
        try {
            // Sur mobile, utiliser 'playback' pour meilleure performance et fluidité
            const latencyHint = isMobile ? 'playback' : 'interactive';
            audioContextListener = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: latencyHint
            });
            console.log(`✅ Contexte audio créé pour streaming vocal (${isMobile ? 'mobile' : 'desktop'})`);
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
            // Ne pas alerter, juste logger - le système réessayera automatiquement
        });
    } else {
        console.log('✅ Contexte audio déjà actif:', audioContextListener.state);
    }
    
    // S'assurer que le contexte reste actif - vérification périodique
    const keepAudioActive = setInterval(() => {
        if (!isPlayingAudio) {
            clearInterval(keepAudioActive);
            return;
        }
        
        if (audioContextListener && audioContextListener.state === 'suspended') {
            console.log('🔄 Réactivation du contexte audio suspendu...');
            audioContextListener.resume().catch(err => {
                console.warn('⚠️ Impossible de réactiver:', err);
            });
        }
    }, 2000); // Vérifier toutes les 2 secondes
    
    // Stocker l'interval pour le nettoyer plus tard
    if (!window.audioActiveIntervals) {
        window.audioActiveIntervals = [];
    }
    window.audioActiveIntervals.push(keepAudioActive);
    
    isPlayingAudio = true;
    audioChunksQueue = [];
    continuousStreamBuffer = []; // Réinitialiser le buffer continu
    isPlayingStream = false;
    lastChunkTimestamp = Date.now() - 5000;
    reconnectAttempts = 0;
    lastSuccessfulChunkTime = Date.now();
    
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
    
    // Créer une source audio silencieuse continue pour maintenir l'icône audio dans l'onglet
    // Cela permet au navigateur de détecter que l'audio est actif
    if (audioContextListener && !silentAudioSource && gainNode) {
        try {
            // Créer un buffer silencieux très court (0.1 seconde)
            const silentBuffer = audioContextListener.createBuffer(1, Math.floor(audioContextListener.sampleRate * 0.1), audioContextListener.sampleRate);
            // Le buffer est déjà rempli de zéros (silence)
            
            // Fonction pour créer et jouer une source silencieuse en boucle
            const playSilentLoop = () => {
                if (!isPlayingAudio || !audioContextListener || audioContextListener.state === 'closed') return;
                
                try {
                    const source = audioContextListener.createBufferSource();
                    source.buffer = silentBuffer;
                    source.connect(gainNode);
                    
                    source.onended = () => {
                        // Rejouer en boucle tant que l'audio est actif
                        if (isPlayingAudio && audioContextListener && audioContextListener.state !== 'closed') {
                            playSilentLoop();
                        } else {
                            silentAudioSource = null;
                        }
                    };
                    
                    source.start(0);
                    silentAudioSource = source;
                } catch (error) {
                    console.warn('⚠️ Erreur création source silencieuse:', error);
                    silentAudioSource = null;
                }
            };
            
            // Démarrer la boucle silencieuse
            playSilentLoop();
            console.log('✅ Source audio silencieuse créée pour maintenir l\'icône dans l\'onglet');
        } catch (error) {
            console.warn('⚠️ Impossible de créer la source silencieuse:', error);
        }
    }
    
    // ÉCOUTER TOUS LES NOUVEAUX CHUNKS - SYSTÈME AMÉLIORÉ ET FIABLE
    connectToAudioChunks();
    
    // Démarrer le health check
    startHealthCheck();
    
    chunksReceivedCount = 0;
    
    console.log('✅ Écoute de la diffusion vocale démarrée');
    
    // TOUJOURS mettre à jour l'interface visuelle
    isPlaying = true;
    isPlayingAudio = true;
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';
    if (vinylRecord) vinylRecord.classList.add('playing');
    if (trackTitle) trackTitle.textContent = 'EN DIRECT 🎙️';
    
    // Afficher l'indicateur audio
    updateAudioStatus(true, 'En attente des chunks...');
    
    // Vérifier immédiatement s'il y a des chunks en attente
    setTimeout(() => {
        if (audioChunksQueue.length > 0 && !isProcessingBuffer) {
            console.log('📦 Chunks en attente détectés, démarrage de la lecture...');
            processAudioQueue();
        }
    }, 100);
}

// ============================================
// SYSTÈME DE STREAMING CONTINU (STYLE APPEL)
// ============================================
// Buffer continu pour accumuler et jouer les streams
let continuousStreamBuffer = [];
let isPlayingStream = false;
let streamStartTime = 0;

// Se connecter aux streams audio Firebase (système continu)
function connectToAudioChunks() {
    console.log('🔄 Connexion aux streams audio Firebase (système continu)...');
    
    // Désactiver les anciens listeners
    try {
        database.ref('radio/audioChunks').off('child_added');
        database.ref('radio/audioStream').off('child_added');
    } catch (e) {
        console.warn('⚠️ Erreur désactivation anciens listeners:', e);
    }
    
    // Écouter les nouveaux streams continus
    const streamRef = database.ref('radio/audioStream');
    
    streamRef.on('child_added', (snapshot) => {
        try {
            if (!isPlayingAudio) {
                console.log('⏸️ Stream reçu mais écoute arrêtée');
                return;
            }
            
            const streamData = snapshot.val();
            if (!streamData || !streamData.data) {
                console.warn('⚠️ Stream invalide reçu:', streamData);
                return;
            }
            
            const streamTimestamp = streamData.timestamp || parseInt(snapshot.key);
            const age = Date.now() - streamTimestamp;
            
            // Log pour débogage (premiers streams)
            if (chunksReceivedCount < 5) {
                console.log(`📥 Stream reçu: timestamp=${streamTimestamp}, âge=${age}ms, samples=${streamData.samples || 'N/A'}, format=${streamData.format || 'N/A'}`);
            }
            
            // Accepter les streams récents (moins de 5 secondes) ou nouveaux
            if (streamTimestamp > lastChunkTimestamp || age < 5000) {
                lastChunkTimestamp = Math.max(lastChunkTimestamp, streamTimestamp);
                lastSuccessfulChunkTime = Date.now();
                reconnectAttempts = 0;
                
                // Traiter le stream continu
                processContinuousStream(streamData);
            } else {
                if (chunksReceivedCount < 5) {
                    console.log(`⏭️ Stream ignoré (trop ancien): timestamp=${streamTimestamp}, âge=${age}ms`);
                }
            }
        } catch (error) {
            console.error('❌ Erreur traitement stream:', error);
        }
    }, (error) => {
        console.error('❌ Erreur listener Firebase:', error);
        handleAudioChunksError(error);
    });
    
    // Fallback: écouter aussi les anciens chunks pour compatibilité
    const chunksRef = database.ref('radio/audioChunks');
    chunksRef.on('child_added', (snapshot) => {
        try {
            if (!isPlayingAudio) return;
            
            const chunkData = snapshot.val();
            if (!chunkData || !chunkData.data) return;
            
            const chunkTimestamp = chunkData.timestamp || parseInt(snapshot.key);
            if (chunkTimestamp > lastChunkTimestamp || (Date.now() - chunkTimestamp) < 10000) {
                lastChunkTimestamp = Math.max(lastChunkTimestamp, chunkTimestamp);
                playAudioChunk(chunkData.data, {
                    format: chunkData.format || 'pcm16',
                    sampleRate: chunkData.sampleRate || 48000,
                    bufferSize: chunkData.bufferSize || 4096
                });
            }
        } catch (error) {
            console.error('❌ Erreur traitement chunk (fallback):', error);
        }
    });
    
    console.log('✅ Listener Firebase connecté pour les streams continus');
}

// Traiter un stream continu (accumulation et lecture fluide)
function processContinuousStream(streamData) {
    try {
        if (!streamData.data || !streamData.sampleRate) {
            console.warn('⚠️ Stream incomplet');
            return;
        }
        
        // Décoder le stream
        const binaryString = atob(streamData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        if (bytes.length % 2 !== 0) {
            console.warn('⚠️ Taille stream invalide');
            return;
        }
        
        // Convertir en Float32
        const int16Data = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = Math.max(-1, Math.min(1, int16Data[i] / 32768.0));
        }
        
        // Ajouter au buffer continu
        for (let i = 0; i < float32Data.length; i++) {
            continuousStreamBuffer.push(float32Data[i]);
        }
        
        chunksReceivedCount++;
        
        // Démarrer la lecture si pas déjà en cours
        if (!isPlayingStream && continuousStreamBuffer.length > 0) {
            startContinuousPlayback(streamData.sampleRate);
        }
        
        // Détecter le format (Opus ou PCM16)
        const format = (streamData.format || '').toLowerCase();
        const isOpus = format.includes('opus') || (streamData.mimeType && streamData.mimeType.includes('opus'));
        const isStereo = streamData.channels === 2 || format.includes('stereo');
        
        // Si Opus, utiliser le traitement Opus dédié
        if (isOpus) {
            processOpusStream(streamData);
            return;
        }
        
        // Log pour débogage (tous les streams au début, puis périodique)
        if (chunksReceivedCount <= 5 || chunksReceivedCount % 10 === 0) {
            const samples = streamData.samples || (int16Data.length / (isStereo ? 2 : 1));
            console.log(`📡 Stream ${chunksReceivedCount}: ${samples} échantillons, ${isStereo ? 'STÉRÉO' : 'MONO'}, buffer: ${continuousStreamBuffer.length}, durée: ${(samples/streamData.sampleRate).toFixed(3)}s, 48kHz`);
        }
        
        // Démarrer la lecture si pas déjà en cours
        if (!isPlayingStream && continuousStreamBuffer.length > 0) {
            startContinuousPlayback(streamData.sampleRate, isStereo ? 2 : 1);
        }
        
    } catch (error) {
        console.error('❌ Erreur traitement stream continu:', error);
    }
}

// Traiter un stream Opus STÉRÉO (comme Discord)
let opusStreamBlobs = [];
let opusMediaSource = null;
let opusSourceBuffer = null;
let opusAudioElement = null;
let opusBlobUrl = null;

function processOpusStream(streamData) {
    try {
        // Décoder base64 en ArrayBuffer
        const binaryString = atob(streamData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Créer un blob Opus WebM
        const mimeType = streamData.mimeType || 'audio/webm;codecs=opus';
        const blob = new Blob([bytes], { type: mimeType });
        
        chunksReceivedCount++;
        
        // Utiliser un élément audio avec blob URL (méthode simple et fiable)
        playOpusBlobStream(blob);
        
        if (chunksReceivedCount <= 5 || chunksReceivedCount % 10 === 0) {
            console.log(`🎵 Stream Opus STÉRÉO ${chunksReceivedCount}: ${bytes.length} bytes, 48kHz, 2 canaux (comme Discord)`);
        }
        
    } catch (error) {
        console.error('❌ Erreur traitement stream Opus:', error);
    }
}

// Jouer un stream Opus via blob URL (méthode simple)
function playOpusBlobStream(blob) {
    try {
        // Créer un élément audio dédié pour Opus
        if (!opusAudioElement) {
            opusAudioElement = new Audio();
            opusAudioElement.autoplay = true;
            opusAudioElement.volume = (currentVolume || 1.0) * 1.2; // Volume augmenté
            opusAudioElement.addEventListener('ended', () => {
                // Continuer avec le prochain blob si disponible
                if (opusStreamBlobs.length > 0) {
                    const nextBlob = opusStreamBlobs.shift();
                    playOpusBlobStream(nextBlob);
                }
            });
        }
        
        // Créer un blob URL et le jouer
        if (opusBlobUrl) {
            URL.revokeObjectURL(opusBlobUrl);
        }
        
        opusBlobUrl = URL.createObjectURL(blob);
        opusAudioElement.src = opusBlobUrl;
        
        // Jouer si pas déjà en cours
        if (opusAudioElement.paused) {
            opusAudioElement.play().catch(err => {
                console.warn('⚠️ Erreur lecture Opus:', err);
            });
        }
        
    } catch (error) {
        console.error('❌ Erreur lecture blob Opus:', error);
    }
}

// Lire le buffer continu de manière fluide (style Discord - STÉRÉO)
function startContinuousPlayback(sampleRate, channels = 1) {
    if (isPlayingStream || !audioContextListener || continuousStreamBuffer.length === 0) {
        return;
    }
    
    isPlayingStream = true;
    const targetSampleRate = sampleRate || 48000;
    const numChannels = channels || 1; // 1 = mono, 2 = stéréo
    
    // Fonction récursive pour lire le buffer par morceaux
    const playBufferChunk = () => {
        if (!isPlayingAudio || continuousStreamBuffer.length === 0) {
            isPlayingStream = false;
            return;
        }
        
        // Prendre un morceau du buffer - OPTIMISÉ POUR FLUIDITÉ DISCORD
        // Buffers plus petits (30ms) pour latence minimale et fluidité maximale
        const chunkSize = Math.floor(targetSampleRate * 0.03); // 30ms (au lieu de 50ms) pour fluidité
        const samplesToPlay = Math.min(chunkSize, continuousStreamBuffer.length);
        
        if (samplesToPlay === 0) {
            // Buffer vide, attendre très peu (5ms au lieu de 10ms) pour réactivité
            setTimeout(playBufferChunk, 5);
            return;
        }
        
        // Extraire les échantillons
        const audioChunk = continuousStreamBuffer.splice(0, samplesToPlay);
        
        // Créer l'AudioBuffer
        try {
            if (audioContextListener.state === 'suspended') {
                audioContextListener.resume();
            }
            
            // Créer l'AudioBuffer STÉRÉO ou MONO
            const audioBuffer = audioContextListener.createBuffer(numChannels, audioChunk.length / numChannels, targetSampleRate);
            
            if (numChannels === 2) {
                // STÉRÉO : séparer les canaux (interleaved: L, R, L, R, ...)
                const leftChannel = audioBuffer.getChannelData(0);
                const rightChannel = audioBuffer.getChannelData(1);
                for (let i = 0; i < audioChunk.length / 2; i++) {
                    leftChannel[i] = audioChunk[i * 2];
                    rightChannel[i] = audioChunk[i * 2 + 1];
                }
            } else {
                // MONO : un seul canal
                audioBuffer.getChannelData(0).set(audioChunk);
            }
            
            // Créer et jouer la source - VOLUME AUGMENTÉ POUR SON AUDIBLE
            if (!gainNode) {
                gainNode = audioContextListener.createGain();
                // Volume par défaut à 1.2 (120%) pour son audible même à faible volume
                gainNode.gain.value = (currentVolume || 1.0) * 1.2;
                gainNode.connect(audioContextListener.destination);
            } else {
                // S'assurer que le volume est toujours élevé pour son audible
                gainNode.gain.value = Math.max((currentVolume || 1.0) * 1.2, 1.0);
            }
            
            const source = audioContextListener.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNode);
            
            const duration = audioBuffer.duration;
            
            source.onended = () => {
                // Continuer avec le prochain morceau immédiatement
                playBufferChunk();
            };
            
            source.onerror = (e) => {
                console.error('❌ Erreur source:', e);
                isPlayingStream = false;
            };
            
            source.start(0);
            updateAudioStatus(true, `Stream: ${chunksReceivedCount} paquets`);
            
            // Planifier le prochain morceau (AVANT la fin pour continuité maximale - style Discord)
            // Réduire le délai pour fluidité maximale
            const nextDelay = Math.max(duration * 1000 - 10, 0); // 10ms avant la fin (au lieu de 5ms)
            setTimeout(() => {
                if (isPlayingAudio && continuousStreamBuffer.length > 0) {
                    playBufferChunk();
                }
            }, nextDelay);
            
        } catch (error) {
            console.error('❌ Erreur lecture buffer:', error);
            isPlayingStream = false;
            // Réessayer après un court délai
            setTimeout(() => {
                if (isPlayingAudio && continuousStreamBuffer.length > 0) {
                    isPlayingStream = false;
                    startContinuousPlayback(targetSampleRate);
                }
            }, 20);
        }
    };
    
    // Démarrer la lecture
    playBufferChunk();
}

// Gérer les erreurs de connexion aux chunks
function handleAudioChunksError(error) {
    console.error('❌ Erreur connexion chunks audio:', error);
    reconnectAttempts++;
    
    if (reconnectAttempts < maxReconnectAttempts) {
        console.log(`🔄 Tentative de reconnexion ${reconnectAttempts}/${maxReconnectAttempts} dans ${reconnectDelay}ms...`);
        updateAudioStatus(false, `Reconnexion... (${reconnectAttempts}/${maxReconnectAttempts})`);
        
        // Reconnexion immédiate sans délai
        if (isPlayingAudio) {
            connectToAudioChunks();
        }
    } else {
        console.error('❌ Échec de reconnexion après', maxReconnectAttempts, 'tentatives');
        updateAudioStatus(false, 'Erreur de connexion');
        alert('⚠️ Impossible de se connecter au stream audio. Vérifiez votre connexion internet.');
    }
}

// Health check pour détecter les problèmes de connexion
function startHealthCheck() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
    
    healthCheckInterval = setInterval(() => {
        if (!isPlayingAudio) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
            return;
        }
        
        // Si aucun chunk n'a été reçu depuis 10 secondes, essayer de se reconnecter
        if (lastSuccessfulChunkTime && (Date.now() - lastSuccessfulChunkTime > 10000)) {
            console.warn('⚠️ Aucun chunk reçu depuis 10 secondes, reconnexion...');
            updateAudioStatus(false, 'Reconnexion...');
            connectToAudioChunks();
        }
    }, 5000); // Vérifier toutes les 5 secondes
}

// Arrêter l'écoute
function stopListeningToAudio() {
    if (!isPlayingAudio) return;
    
    isPlayingAudio = false;
    audioChunksQueue = [];
    audioBufferQueue = [];
    continuousStreamBuffer = []; // Arrêter le buffer continu
    isPlayingStream = false; // Arrêter le streaming continu
    isProcessingBuffer = false;
    
    // Arrêter le health check
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
    
    // Arrêter tous les intervalles de maintien audio
    if (window.audioActiveIntervals) {
        window.audioActiveIntervals.forEach(interval => clearInterval(interval));
        window.audioActiveIntervals = [];
    }
    
    // Désactiver le listener Firebase
    if (chunksListenerRef) {
        try {
            chunksListenerRef.off('child_added');
            chunksListenerRef = null;
        } catch (e) {
            console.warn('⚠️ Erreur désactivation listener:', e);
        }
    }
    
    // Désactiver tous les listeners Firebase (chunks et streams)
    try {
        database.ref('radio/audioChunks').off();
        database.ref('radio/audioStream').off();
    } catch (e) {
        console.warn('⚠️ Erreur désactivation listeners Firebase:', e);
    }
    
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
    
    // Arrêter la source audio silencieuse
    if (silentAudioSource) {
        try {
            silentAudioSource.stop();
            silentAudioSource.disconnect();
        } catch (e) {}
        silentAudioSource = null;
    }
    
    if (audioSource) {
        try {
            audioSource.disconnect();
        } catch (e) {}
        audioSource = null;
    }
    
    // Ne pas fermer le contexte audio, juste le suspendre (pour pouvoir le réutiliser)
    if (audioContextListener && audioContextListener.state !== 'closed') {
        try {
            if (audioContextListener.state !== 'suspended') {
                audioContextListener.suspend();
            }
        } catch (e) {
            console.warn('⚠️ Erreur suspension contexte audio:', e);
        }
    }
    
    // Réinitialiser les variables de suivi
    reconnectAttempts = 0;
    lastSuccessfulChunkTime = null;
    
    console.log('⏹️ Écoute arrêtée');
}

// Jouer un chunk audio
function playAudioChunk(base64Data, chunkInfo) {
    try {
        if (!isPlayingAudio) {
            // Si l'écoute est arrêtée, ignorer le chunk
            return;
        }
        
        chunksReceivedCount++;
        lastReceivedTime = new Date();
        
        // Mettre à jour le statut visuel
        updateAudioStatus(true);
        
        // LIMITER la queue à 25 chunks maximum pour meilleure qualité (augmenté de 20)
        // Protection anti-crash : si trop de chunks, supprimer les plus anciens
        if (audioChunksQueue.length > 25) {
            console.warn(`⚠️ Queue trop longue (${audioChunksQueue.length}), suppression des anciens chunks`);
            // Supprimer les 12 plus anciens pour garder la queue fluide
            audioChunksQueue.splice(0, 12);
        }
        
        // Ajouter à la queue avec les informations du chunk
        audioChunksQueue.push({ 
            data: base64Data, 
            format: chunkInfo.format || 'pcm16',
            sampleRate: chunkInfo.sampleRate || 44100,
            bufferSize: chunkInfo.bufferSize || 4096,
            mimeType: chunkInfo.mimeType || null,
            timestamp: Date.now() // Ajouter un timestamp pour le suivi
        });
        
        // Si c'est le premier chunk ou si aucun traitement n'est en cours, démarrer la lecture
        if ((audioChunksQueue.length === 1 || !isProcessingBuffer) && isPlayingAudio) {
            processAudioQueue();
        }
        
        // Log seulement tous les 20 chunks pour éviter le spam
        if (chunksReceivedCount % 20 === 0) {
            console.log(`🎵 ${chunksReceivedCount} chunks reçus, queue: ${audioChunksQueue.length}, format: ${chunkInfo.format || 'pcm16'}`);
        }
        
    } catch (error) {
        console.error('❌ Erreur traitement chunk audio:', error);
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

// TRAITER LA QUEUE AUDIO - SYSTÈME COMPLÈTEMENT RECRÉÉ ET SIMPLIFIÉ
async function processAudioQueue() {
    // Vérifications de base
    if (!isPlayingAudio) {
        isProcessingBuffer = false;
        return;
    }
    
    if (audioChunksQueue.length === 0) {
        isProcessingBuffer = false;
        updateAudioStatus(true, 'En attente de chunks...');
        return;
    }
    
    if (isProcessingBuffer) {
        return; // Déjà en train de traiter
    }
    
    isProcessingBuffer = true;
    const chunk = audioChunksQueue.shift();
    
    try {
        // S'ASSURER QUE LE CONTEXTE AUDIO EST ACTIF
        if (!audioContextListener || audioContextListener.state === 'closed') {
            console.log('🔄 Recréation du contexte audio...');
            audioContextListener = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });
        }
        
        // Toujours essayer de reprendre le contexte
        if (audioContextListener.state === 'suspended') {
            await audioContextListener.resume();
            console.log('✅ Contexte audio réactivé');
        }
        
        // Créer/connecter gainNode si nécessaire
        if (!gainNode) {
            gainNode = audioContextListener.createGain();
            gainNode.gain.value = currentVolume || 1.0;
            gainNode.connect(audioContextListener.destination);
            console.log('✅ GainNode créé et connecté');
        }
        
        // DÉTECTER LE FORMAT DU CHUNK
        const chunkFormat = (chunk.format || '').toLowerCase();
        const hasOpusMimeType = chunk.mimeType && (chunk.mimeType.includes('opus') || chunk.mimeType.includes('webm'));
        
        // TRAITER LE CHUNK - PCM16 OU OPUS
        if (chunkFormat === 'pcm16' && chunk.sampleRate) {
            // Décoder base64
            const binaryString = atob(chunk.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            if (bytes.length % 2 !== 0) {
                console.warn('⚠️ Taille PCM invalide (impair), ignoré');
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0 && isPlayingAudio) {
                    processAudioQueue();
                }
                return;
            }
            
                // Convertir en Int16 puis Float32 - QUALITÉ MAXIMALE
                const int16Data = new Int16Array(bytes.buffer);
                const float32Data = new Float32Array(int16Data.length);
                
                // Conversion haute qualité avec normalisation
                for (let i = 0; i < int16Data.length; i++) {
                    // Conversion précise avec normalisation
                    float32Data[i] = Math.max(-1, Math.min(1, int16Data[i] / 32768.0));
                }
                
                // Créer AudioBuffer - QUALITÉ MAXIMALE
                const sampleRate = chunk.sampleRate || 48000; // 48kHz par défaut (qualité maximale)
                const audioBuffer = audioContextListener.createBuffer(1, float32Data.length, sampleRate);
                audioBuffer.getChannelData(0).set(float32Data);
            
            // Mettre à jour le volume
            gainNode.gain.value = currentVolume || 1.0;
            
            // Créer et jouer la source
            const source = audioContextListener.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNode);
            
            const duration = audioBuffer.duration;
            
            // Log pour débogage
            if (chunksReceivedCount % 20 === 0) {
                console.log(`🔊 Lecture chunk ${chunksReceivedCount}: ${float32Data.length} échantillons, ${duration.toFixed(3)}s, volume: ${(currentVolume * 100).toFixed(0)}%, queue: ${audioChunksQueue.length}`);
            }
            
            // Gérer la fin de lecture
            source.onended = () => {
                isProcessingBuffer = false;
                // Traiter le prochain chunk immédiatement
                if (audioChunksQueue.length > 0 && isPlayingAudio) {
                    processAudioQueue();
                }
            };
            
            source.onerror = (e) => {
                console.error('❌ Erreur source PCM:', e);
                isProcessingBuffer = false;
                // Continuer avec le prochain chunk
                if (audioChunksQueue.length > 0 && isPlayingAudio) {
                    processAudioQueue();
                }
            };
            
            // DÉMARRER LA LECTURE - PROTECTION ANTI-CRASH
            try {
                source.start(0);
                updateAudioStatus(true, `Lecture: ${chunksReceivedCount} chunks`);
                
                // Planifier le traitement du prochain chunk AVANT la fin (pour continuité)
                const nextChunkDelay = Math.max(duration * 1000 - 30, 0); // Réduit de 50ms à 30ms pour meilleure continuité
                setTimeout(() => {
                    if (!isProcessingBuffer && audioChunksQueue.length > 0 && isPlayingAudio) {
                        processAudioQueue();
                    }
                }, nextChunkDelay);
            } catch (error) {
                console.error('❌ Erreur start source:', error);
                isProcessingBuffer = false;
                // Continuer avec le prochain chunk
                if (audioChunksQueue.length > 0 && isPlayingAudio) {
                    setTimeout(() => processAudioQueue(), 50);
                }
            }
            
        } else if (chunkFormat === 'opus' || hasOpusMimeType) {
            // FORMAT OPUS - Utiliser MediaSource API pour créer un stream continu
            const mimeType = chunk.mimeType || 'audio/webm;codecs=opus';
            
            console.log(`🎵 Traitement chunk Opus: format=${chunk.format}, mimeType=${chunk.mimeType}, dataLength=${chunk.data ? chunk.data.length : 0}`);
            
            try {
                // Convertir base64 en ArrayBuffer
                const binaryString = atob(chunk.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // SOLUTION SIMPLIFIÉE : Utiliser Web Audio API pour décoder Opus
                // Mais comme Web Audio ne décode pas Opus directement, on va utiliser une approche différente
                // On va créer un AudioContext et utiliser decodeAudioData, mais ça ne fonctionne pas avec les fragments
                
                // SOLUTION ALTERNATIVE : Forcer l'admin à envoyer en PCM16
                // Pour l'instant, on va ignorer les chunks Opus et demander à l'admin d'utiliser PCM16
                console.warn('⚠️ Format Opus détecté mais non supporté pour la lecture en fragments.');
                console.warn('💡 Solution: Configurez l\'admin pour utiliser PCM16 au lieu d\'Opus.');
                console.warn('   Les chunks Opus WebM ne peuvent pas être joués individuellement.');
                
                // Ignorer ce chunk et continuer
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0 && isPlayingAudio) {
                    processAudioQueue();
                }
                return;
                
            } catch (error) {
                console.error('❌ Erreur traitement Opus:', error);
                isProcessingBuffer = false;
                if (audioChunksQueue.length > 0 && isPlayingAudio) {
                    setTimeout(() => processAudioQueue(), 50);
                }
                return;
            }
        } else {
            console.warn('⚠️ Format non supporté:', chunk.format);
            isProcessingBuffer = false;
            if (audioChunksQueue.length > 0 && isPlayingAudio) {
                processAudioQueue();
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur traitement chunk:', error);
        isProcessingBuffer = false;
        updateAudioStatus(false, 'Erreur traitement');
        // Continuer avec le prochain chunk
        if (audioChunksQueue.length > 0 && isPlayingAudio) {
            setTimeout(() => processAudioQueue(), 50);
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

// Activer l'audio automatiquement au chargement de la page
// Cela permet au navigateur de détecter que le site veut jouer de l'audio
document.addEventListener('DOMContentLoaded', () => {
    // Créer un contexte audio dès le chargement pour "réserver" les permissions
    try {
        if (!audioContextListener || audioContextListener.state === 'closed') {
            audioContextListener = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });
            console.log('✅ Contexte audio pré-initialisé pour autoriser la diffusion');
            
            // Essayer de le mettre en état "running" immédiatement
            if (audioContextListener.state === 'suspended') {
                audioContextListener.resume().catch(err => {
                    console.log('ℹ️ Contexte audio suspendu, sera activé lors de la première diffusion');
                });
            }
        }
    } catch (error) {
        console.warn('⚠️ Impossible de pré-initialiser le contexte audio:', error);
    }
    
    // Écouter les interactions utilisateur pour débloquer l'audio
    // Fonction améliorée pour débloquer l'audio (optimisée pour mobile)
    const unlockAudio = () => {
        if (isMobile) {
            console.log('📱 Déblocage audio mobile...');
        }
        if (audioContextListener && audioContextListener.state === 'suspended') {
            audioContextListener.resume().then(() => {
                console.log('✅ Audio débloqué par interaction utilisateur');
                // Sur mobile, aussi démarrer l'écoute si une diffusion est en cours
                if (isMobile && !isPlayingAudio) {
                    database.ref(FIREBASE_RADIO_STATUS_PATH).once('value', (snapshot) => {
                        const status = snapshot.val();
                        if (status && status.isLive === true) {
                            console.log('📱 Mobile: Démarrage automatique après déblocage');
                            autoStartAudio();
                        }
                    });
                }
            }).catch(err => {
                console.warn('⚠️ Impossible de débloquer l\'audio:', err);
            });
        }
    };
    
    // Débloquer l'audio au premier clic/touch - OPTIMISÉ POUR MOBILE
    // Sur mobile, privilégier les événements tactiles
    const events = isMobile 
        ? ['touchstart', 'touchend', 'click', 'pointerdown', 'pointerup'] // Mobile-first
        : ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown', 'mousemove'];
    
    events.forEach(eventType => {
        document.addEventListener(eventType, unlockAudio, { once: true, passive: true });
    });
    
    // Sur mobile, aussi écouter sur le bouton play/pause spécifiquement
    if (isMobile && playPauseBtn) {
        playPauseBtn.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
        playPauseBtn.addEventListener('click', unlockAudio, { once: true, passive: true });
    }
});

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

