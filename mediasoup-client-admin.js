// Client Mediasoup pour l'admin (diffuseur)
// Utilise WebRTC pour streaming audio haute qualité (comme Discord/Zoom)

class MediasoupBroadcaster {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.device = null;
        this.roomId = 'fs-radio-main';
        this.transport = null;
        this.producer = null;
        this.mediaStream = null;
        this.isConnected = false;
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Utiliser Socket.IO pour la signalisation
                const ioScript = document.createElement('script');
                ioScript.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                ioScript.onload = () => {
                    this.socket = io(this.serverUrl);
                    
                    this.socket.on('connect', async () => {
                        console.log('✅ Connecté au serveur Mediasoup');
                        try {
                            await this.joinRoom();
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
                    
                    this.socket.on('disconnect', () => {
                        console.log('⚠️ Déconnecté du serveur Mediasoup');
                        this.isConnected = false;
                    });
                    
                    this.socket.on('connect_error', (error) => {
                        console.error('❌ Erreur connexion Mediasoup:', error);
                        reject(error);
                    });
                };
                document.head.appendChild(ioScript);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async joinRoom() {
        return new Promise((resolve, reject) => {
            this.socket.emit('join-room', { roomId: this.roomId, role: 'broadcaster' }, async (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                
                try {
                    // Initialiser le device Mediasoup
                    const mediasoupClient = await import('https://cdn.jsdelivr.net/npm/mediasoup-client@3.6.59/+esm');
                    this.device = new mediasoupClient.Device();
                    
                    // Charger les capacités du router
                    await this.device.load({ routerRtpCapabilities: response.rtpCapabilities });
                    
                    console.log('✅ Device Mediasoup initialisé');
                    this.isConnected = true;
                    resolve();
                } catch (error) {
                    console.error('❌ Erreur initialisation device:', error);
                    reject(error);
                }
            });
        });
    }
    
    async startBroadcasting() {
        try {
            // Profils audio optimisés pour différentes qualités
            const audioProfiles = {
                broadcast: {
                    sampleRate: 48000, // 48kHz standard broadcast
                    channelCount: 2,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    latency: 0.005, // Latence ultra-faible
                    volume: 1.0
                },
                music: {
                    sampleRate: 44100, // 44.1kHz qualité CD
                    channelCount: 2,
                    echoCancellation: false, // Désactiver pour la musique
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0.01,
                    volume: 1.0
                },
                voice: {
                    sampleRate: 16000, // 16kHz optimisé pour la voix
                    channelCount: 1, // Mono pour la voix
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    latency: 0.02,
                    volume: 1.2
                }
            };

            // Sélectionner le profil selon le type de contenu (défaut: broadcast)
            const currentProfile = localStorage.getItem('audioProfile') || 'broadcast';
            const profile = audioProfiles[currentProfile];

            console.log(`🎵 Profil audio sélectionné: ${currentProfile}`, profile);

            // Obtenir le stream audio avec les paramètres optimisés
            const rawStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // Paramètres du profil sélectionné
                    echoCancellation: profile.echoCancellation,
                    noiseSuppression: profile.noiseSuppression,
                    autoGainControl: profile.autoGainControl,
                    sampleRate: profile.sampleRate,
                    channelCount: profile.channelCount,
                    latency: profile.latency,

                    // Paramètres avancés pour qualité maximale
                    googEchoCancellation: profile.echoCancellation,
                    googAutoGainControl: profile.autoGainControl,
                    googNoiseSuppression: profile.noiseSuppression,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googNoiseReduction: true,
                    googEchoCancellation2: true,
                    googDAEchoCancellation: true,
                    googAECM: true,

                    // Paramètres supplémentaires pour qualité broadcast
                    googExperimentalEchoCancellation: true,
                    googExperimentalNoiseSuppression: true,
                    googExperimentalAutoGainControl: true,

                    // Optimisations pour faible latence
                    latencyHint: 'interactive',
                    advanced: [{
                        echoCancellation: [profile.echoCancellation],
                        noiseSuppression: [profile.noiseSuppression],
                        autoGainControl: [profile.autoGainControl],
                        sampleRate: [profile.sampleRate],
                        channelCount: [profile.channelCount]
                    }]
                }
            });
            
            // Appliquer des filtres audio avec le panneau de contrôle
            if (window.audioControlPanel) {
                const filteredStream = await window.audioControlPanel.applyAudioFilters(rawStream);
                this.mediaStream = filteredStream || rawStream;
            } else {
                // Fallback si le panneau n'est pas disponible
                this.mediaStream = rawStream;
                await this.applyAudioFilters();
            }
            
            // Créer le transport
            this.socket.emit('create-transport', {
                roomId: this.roomId,
                role: 'broadcaster',
                direction: 'send'
            }, async (response) => {
                if (response.error) {
                    throw new Error(response.error);
                }
                
                this.transport = this.device.createSendTransport({
                    id: response.id,
                    iceParameters: response.iceParameters,
                    iceCandidates: response.iceCandidates,
                    dtlsParameters: response.dtlsParameters
                });
                
                this.transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                    this.socket.emit('connect-transport', {
                        transportId: this.transport.id,
                        dtlsParameters
                    }, (response) => {
                        if (response.error) {
                            errback(new Error(response.error));
                        } else {
                            callback();
                        }
                    });
                });
                
                this.transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                    try {
                        this.socket.emit('produce', {
                            roomId: this.roomId,
                            transportId: this.transport.id,
                            kind,
                            rtpParameters
                        }, (response) => {
                            if (response.error) {
                                errback(new Error(response.error));
                            } else {
                                callback({ id: response.id });
                            }
                        });
                    } catch (error) {
                        errback(error);
                    }
                });
                
                // Produire l'audio avec paramètres optimisés pour qualité maximale
                const track = this.mediaStream.getAudioTracks()[0];
                
                this.producer = await this.transport.produce({ 
                    track,
                    codecOptions: {
                        opusStereo: true, // Stéréo activé (standard FM)
                        opusFec: true, // Forward Error Correction
                        opusDtx: false, // Pas de DTX pour continuité
                        opusMaxPlaybackRate: 44100, // 44.1kHz (standard radio FM)
                        opusMaxAverageBitrate: 160000, // 160 kbps (qualité radio FM)
                        opusComplexity: 10, // Complexité max (0-10)
                        opusSignal: 'music', // Optimisé pour musique/voix (radio)
                        opusApplication: 'audio' // Application audio (meilleure qualité)
                    }
                });
                
                console.log('✅ Diffusion audio RADIO FM démarrée');
                console.log('   Codec: Opus 44.1kHz stéréo');
                console.log('   Bitrate: 160 kbps (qualité radio FM)');
                console.log('   Sample Rate: 44.1kHz');
                console.log('   Bande passante: 50Hz - 15kHz');
                console.log('   Qualité: Radio FM professionnelle');
            });
        } catch (error) {
            console.error('❌ Erreur démarrage diffusion:', error);
            throw error;
        }
    }
    
    async stopBroadcasting() {
        try {
            if (this.producer) {
                this.producer.close();
                this.producer = null;
            }
            
            if (this.transport) {
                this.transport.close();
                this.transport = null;
            }
            
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }
            
            console.log('✅ Diffusion audio arrêtée');
        } catch (error) {
            console.error('❌ Erreur arrêt diffusion:', error);
        }
    }
    
    async applyAudioFilters() {
        if (!this.mediaStream) return;
        
        try {
            // Créer un contexte audio 44.1kHz (standard radio FM)
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100, // 44.1kHz (standard radio FM)
                latencyHint: 'interactive'
            });
            
            const source = audioContext.createMediaStreamSource(this.mediaStream);
            
            // === CHAÎNE DE TRAITEMENT RADIO FM PROFESSIONNELLE ===
            
            // 1. High-pass filter (supprime infrasons et bruit basse fréquence)
            const highPassFilter = audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.value = 50; // 50Hz (standard FM)
            highPassFilter.Q.value = 0.7;
            
            // 2. Low-pass filter (limite à 15kHz comme la radio FM)
            const lowPassFilter = audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.value = 15000; // 15kHz (bande passante FM)
            lowPassFilter.Q.value = 0.7;
            
            // 3. Pré-emphasis FM (boost hautes fréquences comme en FM)
            const preEmphasis = audioContext.createBiquadFilter();
            preEmphasis.type = 'highshelf';
            preEmphasis.frequency.value = 3000; // À partir de 3kHz
            preEmphasis.gain.value = 3; // +3dB boost hautes fréquences (style FM)
            preEmphasis.Q.value = 0.7;
            
            // 4. Égaliseur multi-bandes (optimisation fréquences vocales)
            // EQ basse (100-300Hz) - présence vocale
            const eqLow = audioContext.createBiquadFilter();
            eqLow.type = 'peaking';
            eqLow.frequency.value = 200;
            eqLow.gain.value = 1.5; // Boost léger
            eqLow.Q.value = 1.0;
            
            // EQ mid (1-3kHz) - clarté vocale
            const eqMid = audioContext.createBiquadFilter();
            eqMid.type = 'peaking';
            eqMid.frequency.value = 2000; // 2kHz (fréquence centrale voix)
            eqMid.gain.value = 2.5; // Boost important pour clarté FM
            eqMid.Q.value = 1.2;
            
            // EQ haute (5-8kHz) - brillance
            const eqHigh = audioContext.createBiquadFilter();
            eqHigh.type = 'peaking';
            eqHigh.frequency.value = 6000; // 6kHz (brillance)
            eqHigh.gain.value = 2; // Boost brillance
            eqHigh.Q.value = 1.0;
            
            // 5. Compresseur multi-bandes (normalisation dynamique FM)
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -18; // Seuil adapté FM
            compressor.knee.value = 15; // Transition douce
            compressor.ratio.value = 3; // Ratio modéré (style FM)
            compressor.attack.value = 0.003; // Attaque rapide
            compressor.release.value = 0.15; // Release plus long (style FM)
            
            // 6. AGC (Auto Gain Control) - normalisation volume
            const agcGain = audioContext.createGain();
            agcGain.gain.value = 1.0; // Ajusté dynamiquement si nécessaire
            
            // 7. Limiter final FM (évite saturation, -0.3dB comme standard FM)
            const limiter = audioContext.createDynamicsCompressor();
            limiter.threshold.value = -0.3; // -0.3dB (standard radio FM)
            limiter.knee.value = 0; // Hard knee
            limiter.ratio.value = 20; // Ratio très élevé (limiter)
            limiter.attack.value = 0.001; // Attaque ultra-rapide
            limiter.release.value = 0.05;
            
            // 8. De-emphasis (compensation pré-emphasis) - optionnel
            const deEmphasis = audioContext.createBiquadFilter();
            deEmphasis.type = 'lowshelf';
            deEmphasis.frequency.value = 3000;
            deEmphasis.gain.value = -1; // Légère réduction
            deEmphasis.Q.value = 0.7;
            
            // === CHAÎNAGE : source -> highpass -> lowpass -> preEmphasis -> EQ -> compressor -> agc -> limiter -> deEmphasis -> destination ===
            source.connect(highPassFilter);
            highPassFilter.connect(lowPassFilter);
            lowPassFilter.connect(preEmphasis);
            preEmphasis.connect(eqLow);
            eqLow.connect(eqMid);
            eqMid.connect(eqHigh);
            eqHigh.connect(compressor);
            compressor.connect(agcGain);
            agcGain.connect(limiter);
            limiter.connect(deEmphasis);
            
            // Créer un nouveau stream avec les filtres
            const destination = audioContext.createMediaStreamDestination();
            deEmphasis.connect(destination);
            
            // Remplacer le stream original par le stream filtré
            this.mediaStream = destination.stream;
            
            console.log('✅ Filtres audio RADIO FM appliqués');
            console.log('   Sample Rate: 44.1kHz');
            console.log('   Bande passante: 50Hz - 15kHz (standard FM)');
            console.log('   Pré-emphasis: +3dB @ 3kHz');
            console.log('   Limiter: -0.3dB (standard FM)');
            console.log('   Qualité: Radio FM professionnelle');
        } catch (error) {
            console.warn('⚠️ Impossible d\'appliquer les filtres audio:', error);
            // Continuer sans filtres si erreur
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
    }
}

// Exporter pour utilisation globale
window.MediasoupBroadcaster = MediasoupBroadcaster;

