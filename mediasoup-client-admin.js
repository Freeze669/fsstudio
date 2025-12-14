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
            // Obtenir le stream audio du microphone
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 2,
                    latency: 0.01
                }
            });
            
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
                
                // Produire l'audio
                const track = this.mediaStream.getAudioTracks()[0];
                this.producer = await this.transport.produce({ track });
                
                console.log('✅ Diffusion audio démarrée via Mediasoup');
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

