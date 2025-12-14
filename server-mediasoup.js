// Serveur Mediasoup pour streaming audio haute qualité (comme Discord/Zoom)
// Basé sur l'architecture du projet Call (joincalldotco/Call)

const express = require('express');
const http = require('http');
const mediasoup = require('mediasoup');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

// Configuration CORS pour autoriser fsstudio.online
app.use(cors({
    origin: ['https://fsstudio.online', 'http://fsstudio.online', 'https://www.fsstudio.online'],
    credentials: true
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['https://fsstudio.online', 'http://fsstudio.online', 'https://www.fsstudio.online'],
        credentials: true
    }
});

// Configuration Mediasoup
const mediasoupWorkers = [];
let nextMediasoupWorkerIdx = 0;

// Créer les workers Mediasoup
async function createMediasoupWorkers() {
    const { numWorkers } = { numWorkers: 1 }; // Un seul worker pour commencer
    
    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
            logLevel: 'warn',
            logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
            rtcMinPort: 40000,
            rtcMaxPort: 49999
        });
        
        worker.on('died', () => {
            console.error('❌ Mediasoup worker died, exiting in 2 seconds...');
            setTimeout(() => process.exit(1), 2000);
        });
        
        mediasoupWorkers.push(worker);
        console.log(`✅ Mediasoup worker ${i} créé`);
    }
    
    console.log(`✅ ${mediasoupWorkers.length} worker(s) Mediasoup créé(s)`);
}

// Obtenir le prochain worker
function getNextMediasoupWorker() {
    const worker = mediasoupWorkers[nextMediasoupWorkerIdx];
    nextMediasoupWorkerIdx = (nextMediasoupWorkerIdx + 1) % mediasoupWorkers.length;
    return worker;
}

// Stocker les rooms et les utilisateurs
const rooms = new Map(); // roomId -> { router, broadcaster, listeners }

// Créer ou obtenir une room
async function getOrCreateRoom(roomId) {
    if (rooms.has(roomId)) {
        return rooms.get(roomId);
    }
    
    const worker = getNextMediasoupWorker();
    const router = await worker.createRouter({
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2, // Stéréo
                parameters: {
                    minptime: 10,
                    useinbandfec: 1
                }
            }
        ]
    });
    
    const room = {
        router,
        broadcaster: null,
        listeners: new Set()
    };
    
    rooms.set(roomId, room);
    console.log(`✅ Room créée: ${roomId}`);
    
    return room;
}

// Gérer les connexions Socket.IO
io.on('connection', (socket) => {
    console.log(`✅ Client connecté: ${socket.id}`);
    
    // Rejoindre une room
    socket.on('join-room', async ({ roomId, role }, callback) => {
        try {
            const room = await getOrCreateRoom(roomId);
            
            if (role === 'broadcaster') {
                // C'est le diffuseur (admin)
                room.broadcaster = socket.id;
                socket.join(roomId);
                socket.emit('room-joined', { roomId, role: 'broadcaster' });
                console.log(`📡 Diffuseur ${socket.id} a rejoint la room ${roomId}`);
                
                // Notifier les auditeurs
                io.to(roomId).emit('broadcaster-joined');
            } else {
                // C'est un auditeur
                room.listeners.add(socket.id);
                socket.join(roomId);
                socket.emit('room-joined', { roomId, role: 'listener' });
                console.log(`🎧 Auditeur ${socket.id} a rejoint la room ${roomId} (total: ${room.listeners.size})`);
                
                // Si un diffuseur est déjà présent, notifier l'auditeur
                if (room.broadcaster) {
                    socket.emit('broadcaster-joined');
                }
            }
            
            // Envoyer les capacités du router
            const rtpCapabilities = room.router.rtpCapabilities;
            callback({ rtpCapabilities });
        } catch (error) {
            console.error('❌ Erreur join-room:', error);
            callback({ error: error.message });
        }
    });
    
    // Créer un transport WebRTC pour le diffuseur
    socket.on('create-transport', async ({ roomId, role, direction }, callback) => {
        try {
            const room = rooms.get(roomId);
            if (!room) {
                return callback({ error: 'Room not found' });
            }
            
            const transport = await room.router.createWebRtcTransport({
                listenIps: [
                    {
                        ip: '0.0.0.0',
                        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined
                    }
                ],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true
            });
            
            transport.on('dtlsstatechange', (dtlsState) => {
                if (dtlsState === 'closed') {
                    transport.close();
                }
            });
            
            socket.transports = socket.transports || new Map();
            socket.transports.set(transport.id, transport);
            
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        } catch (error) {
            console.error('❌ Erreur create-transport:', error);
            callback({ error: error.message });
        }
    });
    
    // Connecter le transport
    socket.on('connect-transport', async ({ transportId, dtlsParameters }, callback) => {
        try {
            const transport = socket.transports?.get(transportId);
            if (!transport) {
                return callback({ error: 'Transport not found' });
            }
            
            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (error) {
            console.error('❌ Erreur connect-transport:', error);
            callback({ error: error.message });
        }
    });
    
    // Produire de l'audio (diffuseur)
    socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
        try {
            const room = rooms.get(roomId);
            if (!room) {
                return callback({ error: 'Room not found' });
            }
            
            const transport = socket.transports?.get(transportId);
            if (!transport) {
                return callback({ error: 'Transport not found' });
            }
            
            const producer = await transport.produce({
                kind,
                rtpParameters
            });
            
            socket.producers = socket.producers || new Map();
            socket.producers.set(producer.id, producer);
            
            // Si c'est le diffuseur, notifier tous les auditeurs
            if (room.broadcaster === socket.id) {
                room.listeners.forEach((listenerId) => {
                    const listenerSocket = io.sockets.sockets.get(listenerId);
                    if (listenerSocket && listenerSocket.transports && listenerSocket.transports.size > 0) {
                        createConsumerForListener(room, listenerSocket, producer);
                    } else {
                        // Si l'auditeur n'a pas encore de transport, il créera le consumer plus tard
                        listenerSocket?.emit('new-producer', {
                            id: producer.id,
                            producerId: producer.id,
                            kind: producer.kind
                        });
                    }
                });
            }
            
            callback({ id: producer.id });
        } catch (error) {
            console.error('❌ Erreur produce:', error);
            callback({ error: error.message });
        }
    });
    
    // Consommer de l'audio (auditeur)
    socket.on('consume', async ({ roomId, producerId, rtpCapabilities }, callback) => {
        try {
            const room = rooms.get(roomId);
            if (!room) {
                return callback({ error: 'Room not found' });
            }
            
            const producer = Array.from(io.sockets.sockets.values())
                .find(s => s.producers?.has(producerId))?.producers?.get(producerId);
            
            if (!producer) {
                return callback({ error: 'Producer not found' });
            }
            
            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                return callback({ error: 'Cannot consume' });
            }
            
            const transport = socket.transports?.values().next().value;
            if (!transport) {
                return callback({ error: 'Transport not found' });
            }
            
            const consumer = await transport.consume({
                producerId,
                rtpCapabilities
            });
            
            socket.consumers = socket.consumers || new Map();
            socket.consumers.set(consumer.id, consumer);
            
            callback({
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters
            });
        } catch (error) {
            console.error('❌ Erreur consume:', error);
            callback({ error: error.message });
        }
    });
    
    // Créer un consumer pour un auditeur
    async function createConsumerForListener(room, listenerSocket, producer) {
        try {
            const transport = listenerSocket.transports?.values().next().value;
            if (!transport) {
                return;
            }
            
            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities: listenerSocket.rtpCapabilities
            });
            
            listenerSocket.consumers = listenerSocket.consumers || new Map();
            listenerSocket.consumers.set(consumer.id, consumer);
            
            listenerSocket.emit('new-producer', {
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters
            });
        } catch (error) {
            console.error('❌ Erreur createConsumerForListener:', error);
        }
    }
    
    // Obtenir la liste des producers (pour les auditeurs qui se connectent après)
    socket.on('get-producers', ({ roomId }, callback) => {
        const room = rooms.get(roomId);
        if (!room) {
            return callback([]);
        }
        
        const producers = [];
        // Trouver tous les producers du diffuseur
        if (room.broadcaster) {
            const broadcasterSocket = io.sockets.sockets.get(room.broadcaster);
            if (broadcasterSocket && broadcasterSocket.producers) {
                broadcasterSocket.producers.forEach((producer, id) => {
                    producers.push({
                        id: producer.id,
                        producerId: producer.id,
                        kind: producer.kind
                    });
                });
            }
        }
        
        callback(producers);
    });
    
    // Vérifier si un diffuseur est présent
    socket.on('check-broadcaster', ({ roomId }, callback) => {
        const room = rooms.get(roomId);
        callback({ hasBroadcaster: !!(room && room.broadcaster) });
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
        console.log(`⚠️ Client déconnecté: ${socket.id}`);
        
        // Nettoyer les rooms
        for (const [roomId, room] of rooms.entries()) {
            if (room.broadcaster === socket.id) {
                room.broadcaster = null;
                io.to(roomId).emit('broadcaster-left');
                console.log(`📡 Diffuseur ${socket.id} a quitté la room ${roomId}`);
            } else if (room.listeners.has(socket.id)) {
                room.listeners.delete(socket.id);
                console.log(`🎧 Auditeur ${socket.id} a quitté la room ${roomId} (total: ${room.listeners.size})`);
            }
            
            // Supprimer la room si vide
            if (!room.broadcaster && room.listeners.size === 0) {
                room.router.close();
                rooms.delete(roomId);
                console.log(`🗑️ Room ${roomId} supprimée`);
            }
        }
        
        // Nettoyer les transports et producers
        if (socket.transports) {
            socket.transports.forEach(transport => transport.close());
        }
    });
});

// Route pour vérifier le statut
app.get('/status', (req, res) => {
    let totalListeners = 0;
    let totalBroadcasters = 0;
    
    for (const room of rooms.values()) {
        if (room.broadcaster) totalBroadcasters++;
        totalListeners += room.listeners.size;
    }
    
    res.json({
        status: 'online',
        mediasoup: 'active',
        rooms: rooms.size,
        broadcasters: totalBroadcasters,
        listeners: totalListeners,
        workers: mediasoupWorkers.length,
        timestamp: Date.now()
    });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
    await createMediasoupWorkers();
    
    server.listen(PORT, HOST, () => {
        console.log(`🚀 Serveur Mediasoup démarré`);
        console.log(`📡 Port: ${PORT}`);
        console.log(`🌐 Site: https://fsstudio.online/`);
        console.log(`✅ Prêt à recevoir des connexions WebRTC`);
    });
}

startServer().catch(error => {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
});

