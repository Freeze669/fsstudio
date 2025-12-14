// Configuration WebSocket centralisée
// Modifiez cette URL selon votre serveur d'hébergement

// Exemples d'URLs selon le service :
// Railway: 'wss://votre-projet.up.railway.app'
// Render: 'wss://fs-radio-server.onrender.com'
// Fly.io: 'wss://votre-app.fly.dev'
// VPS personnalisé: 'wss://fsstudio.online:3000'

const WEBSOCKET_SERVER_URL = 'wss://votre-serveur.railway.app'; // ⚠️ CHANGEZ CETTE URL

// Détection automatique du protocole (wss pour HTTPS, ws pour HTTP)
const getWebSocketURL = () => {
    // Si une URL personnalisée est définie, l'utiliser
    if (WEBSOCKET_SERVER_URL) {
        return WEBSOCKET_SERVER_URL;
    }
    
    // Sinon, utiliser l'URL par défaut basée sur le domaine
    return window.location.protocol === 'https:' 
        ? 'wss://fsstudio.online:3000'
        : 'ws://fsstudio.online:3000';
};

// Exporter pour utilisation dans admin.js et script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getWebSocketURL, WEBSOCKET_SERVER_URL };
} else {
    // Pour utilisation dans le navigateur
    window.WEBSOCKET_CONFIG = {
        getWebSocketURL,
        WEBSOCKET_SERVER_URL
    };
}

