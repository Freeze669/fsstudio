// Client Mediasoup pour les auditeurs (site principal)
// Utilise WebRTC pour recevoir l'audio haute qualité (comme Discord/Zoom)

class MediasoupListener {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.device = null;
        this.roomId = 'fs-radio-main';
        this.transport = null;
        this.consumer = null;
        this.audioContext = null;
        this.audioElement = null;
        this.isConnected = false;
        this.isPlaying = false;
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
                        this.isPlaying = false;
                    });
                    
                    this.socket.on('connect_error', (error) => {
                        console.error('❌ Erreur connexion Mediasoup:', error);
                        reject(error);
                    });
                    
                    // Écouter les nouveaux producers (diffuseur)
                    this.socket.on('broadcaster-joined', async () => {
                        console.log('📡 Diffuseur détecté, démarrage de l\'écoute...');
                        await this.startListening();
                    });
                    
                    this.socket.on('broadcaster-left', () => {
                        console.log('⏸️ Diffuseur parti');
                        this.stopListening();
                    });
                    
                    // Écouter les nouveaux producers
                    this.socket.on('new-producer', async (data) => {
                        if (data.kind === 'audio') {
                            await this.consumeAudio(data);
                        }
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
            this.socket.emit('join-room', { roomId: this.roomId, role: 'listener' }, async (response) => {
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
                    
                    // Stocker les capacités pour plus tard
                    this.socket.rtpCapabilities = this.device.rtpCapabilities;
                    
                    console.log('✅ Device Mediasoup initialisé');
                    this.isConnected = true;
                    
                    // Si un diffuseur est déjà présent, démarrer l'écoute
                    this.socket.emit('check-broadcaster', { roomId: this.roomId }, (response) => {
                        if (response.hasBroadcaster) {
                            this.startListening();
                        }
                    });
                    
                    resolve();
                } catch (error) {
                    console.error('❌ Erreur initialisation device:', error);
                    reject(error);
                }
            });
        });
    }
    
    async startListening() {
        if (this.isPlaying) {
            return;
        }
        
        try {
            // Créer le transport
            this.socket.emit('create-transport', {
                roomId: this.roomId,
                role: 'listener',
                direction: 'recv'
            }, async (response) => {
                if (response.error) {
                    throw new Error(response.error);
                }
                
                this.transport = this.device.createRecvTransport({
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
                
                // Demander la liste des producers
                this.socket.emit('get-producers', { roomId: this.roomId }, async (producers) => {
                    for (const producer of producers) {
                        if (producer.kind === 'audio') {
                            await this.consumeAudio(producer);
                        }
                    }
                });
            });
        } catch (error) {
            console.error('❌ Erreur démarrage écoute:', error);
        }
    }
    
    async consumeAudio(producerData) {
        try {
            this.socket.emit('consume', {
                roomId: this.roomId,
                producerId: producerData.producerId || producerData.id,
                rtpCapabilities: this.device.rtpCapabilities
            }, async (response) => {
                if (response.error) {
                    console.error('❌ Erreur consume:', response.error);
                    return;
                }
                
                this.consumer = await this.transport.consume({
                    id: response.id,
                    producerId: response.producerId,
                    kind: response.kind,
                    rtpParameters: response.rtpParameters
                });
                
                // Créer un contexte audio 44.1kHz (standard radio FM)
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 44100, // 44.1kHz (standard radio FM)
                    latencyHint: 'interactive'
                });
                
                // Créer une source depuis le track
                const source = this.audioContext.createMediaStreamSource(
                    new MediaStream([this.consumer.track])
                );
                
                // === TRAITEMENT AUDIO RADIO FM (côté réception) ===
                
                // High-pass filter (50Hz)
                const highPass = this.audioContext.createBiquadFilter();
                highPass.type = 'highpass';
                highPass.frequency.value = 50;
                highPass.Q.value = 0.7;
                
                // Low-pass filter (15kHz - bande passante FM)
                const lowPass = this.audioContext.createBiquadFilter();
                lowPass.type = 'lowpass';
                lowPass.frequency.value = 15000;
                lowPass.Q.value = 0.7;
                
                // Égaliseur léger pour améliorer la clarté FM
                const eq = this.audioContext.createBiquadFilter();
                eq.type = 'peaking';
                eq.frequency.value = 2000; // Boost fréquences vocales
                eq.gain.value = 1.5; // Boost léger
                eq.Q.value = 1.0;
                
                // Gain node pour volume optimal (pas de distorsion)
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 0.95; // 95% pour éviter distorsion
                
                // Connecter : source -> highpass -> lowpass -> EQ -> gain -> destination
                source.connect(highPass);
                highPass.connect(lowPass);
                lowPass.connect(eq);
                eq.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // Résumer le contexte si suspendu
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                
                // Créer aussi un élément audio HTML5 pour compatibilité (44.1kHz)
                this.audioElement = new Audio();
                const stream = new MediaStream([this.consumer.track]);
                this.audioElement.srcObject = stream;
                this.audioElement.autoplay = true;
                this.audioElement.preload = 'auto';
                
                // Essayer de jouer avec l'élément audio HTML5
                try {
                    await this.audioElement.play();
                    console.log('✅ Audio HTML5 player démarré (44.1kHz)');
                } catch (error) {
                    console.warn('⚠️ Autoplay bloqué, utilisation Web Audio API uniquement');
                }
                
                console.log('✅ Audio RADIO FM en lecture');
                console.log('   Sample Rate: 44.1kHz');
                console.log('   Bitrate: 160 kbps (qualité radio FM)');
                console.log('   Bande passante: 50Hz - 15kHz');
                console.log('   Player: HTML5 + Web Audio API');
                console.log('   Qualité: Radio FM professionnelle');
                this.isPlaying = true;
            });
        } catch (error) {
            console.error('❌ Erreur consumeAudio:', error);
        }
    }
    
    stopListening() {
        if (this.consumer) {
            this.consumer.close();
            this.consumer = null;
        }
        
        if (this.transport) {
            this.transport.close();
            this.transport = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.srcObject = null;
            this.audioElement = null;
        }
        
        this.isPlaying = false;
        console.log('⏸️ Écoute arrêtée');
    }
    
    disconnect() {
        this.stopListening();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
    }
}

// Exporter pour utilisation globale
window.MediasoupListener = MediasoupListener;

