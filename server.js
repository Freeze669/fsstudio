// Serveur de streaming audio pour FS Radio
// Utilise WebSockets pour le streaming audio en temps réel

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();

// Configuration CORS pour autoriser fsstudio.online
app.use(cors({
    origin: ['https://fsstudio.online', 'http://fsstudio.online', 'https://www.fsstudio.online'],
    credentials: true
}));

app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Stocker les clients connectés
let broadcaster = null; // Le client qui diffuse (admin) - doit être modifiable
const listeners = new Set(); // Les clients qui écoutent

// Gérer les connexions WebSocket
wss.on('connection', (ws, req) => {
    console.log('✅ Nouvelle connexion WebSocket');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'broadcast') {
                // C'est le diffuseur (admin)
                broadcaster = ws;
                ws.isBroadcaster = true;
                console.log('📡 Diffuseur connecté');
                
                // Envoyer confirmation
                ws.send(JSON.stringify({ type: 'broadcaster-confirmed' }));
            } else if (data.type === 'listen') {
                // C'est un auditeur
                listeners.add(ws);
                ws.isListener = true;
                console.log('🎧 Auditeur connecté (total:', listeners.size, ')');
                
                // Envoyer confirmation
                ws.send(JSON.stringify({ type: 'listener-confirmed' }));
            } else if (data.type === 'audio') {
                // Audio reçu du diffuseur - rediffuser à tous les auditeurs
                if (ws.isBroadcaster) {
                    const audioData = {
                        type: 'audio',
                        data: data.data,
                        sampleRate: data.sampleRate || 48000,
                        channels: data.channels || 2,
                        timestamp: Date.now()
                    };
                    
                    // Envoyer à tous les auditeurs
                    listeners.forEach((listener) => {
                        if (listener.readyState === WebSocket.OPEN) {
                            listener.send(JSON.stringify(audioData));
                        }
                    });
                }
            } else if (data.type === 'status') {
                // Statut de diffusion
                if (ws.isBroadcaster) {
                    const statusData = {
                        type: 'status',
                        isLive: data.isLive,
                        timestamp: Date.now()
                    };
                    
                    // Envoyer à tous les auditeurs
                    listeners.forEach((listener) => {
                        if (listener.readyState === WebSocket.OPEN) {
                            listener.send(JSON.stringify(statusData));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('❌ Erreur traitement message:', error);
        }
    });
    
    ws.on('close', () => {
        if (ws.isBroadcaster) {
            console.log('📡 Diffuseur déconnecté');
            broadcaster = null;
            
            // Notifier tous les auditeurs
            const statusData = {
                type: 'status',
                isLive: false,
                timestamp: Date.now()
            };
            
            listeners.forEach((listener) => {
                if (listener.readyState === WebSocket.OPEN) {
                    listener.send(JSON.stringify(statusData));
                }
            });
        } else if (ws.isListener) {
            listeners.delete(ws);
            console.log('🎧 Auditeur déconnecté (total:', listeners.size, ')');
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ Erreur WebSocket:', error);
    });
});

// Route pour vérifier le statut du serveur
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        broadcaster: broadcaster ? 'connected' : 'disconnected',
        listeners: listeners.size,
        timestamp: Date.now()
    });
});

// Démarrer le serveur
// Le port est défini par la plateforme d'hébergement (Railway, Render, etc.)
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🚀 Serveur de streaming audio démarré`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Site: https://fsstudio.online/`);
    console.log(`✅ Prêt à recevoir des connexions WebSocket`);
});

