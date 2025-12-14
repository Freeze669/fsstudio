// Configuration WebSocket pour le streaming audio
// Modifiez cette URL selon votre serveur

// Pour développement local
const WS_SERVER_URL_DEV = 'ws://localhost:3000';

// Pour production (remplacez par l'URL de votre serveur)
// Exemples:
// const WS_SERVER_URL_PROD = 'ws://votre-serveur.com:3000';
// const WS_SERVER_URL_PROD = 'wss://votre-serveur.com'; // Avec SSL

// Utiliser l'URL appropriée selon l'environnement
const WS_SERVER_URL = WS_SERVER_URL_DEV; // Changez pour la production

// Exporter pour utilisation dans admin.js et script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WS_SERVER_URL };
}

