# Migration vers Mediasoup (Qualité Discord/Zoom)

## 🎯 Pourquoi Mediasoup ?

Mediasoup est utilisé par Discord, Zoom, et le projet Call pour le streaming audio/video de haute qualité. Il offre :
- ✅ **Qualité audio supérieure** (Opus 48kHz stéréo)
- ✅ **Latence ultra-faible** (< 100ms)
- ✅ **Fluidité maximale** (comme un appel Discord)
- ✅ **Scalabilité** (supporte des milliers d'utilisateurs)
- ✅ **WebRTC natif** (meilleur que WebSocket pour l'audio)

## 📦 Installation

### 1. Installer les dépendances

```bash
cd /chemin/vers/votre/projet
npm install
```

Cela installera :
- `mediasoup` (serveur)
- `socket.io` (signalisation)

### 2. Mettre à jour le serveur Railway

Remplacez `server.js` par `server-mediasoup.js` dans `package.json` :

```json
{
  "scripts": {
    "start": "node server-mediasoup.js"
  }
}
```

### 3. Variables d'environnement

Ajoutez dans Railway (optionnel) :
```
MEDIASOUP_ANNOUNCED_IP=votre-ip-publique
```

## 🔧 Configuration

### Serveur (Railway)

1. **Déployer** `server-mediasoup.js` sur Railway
2. **Vérifier** que le serveur démarre : `https://votre-url/status`
3. Vous devriez voir : `{ "mediasoup": "active" }`

### Client Admin

1. **Ajouter** dans `admin.html` (avant `admin.js`) :
```html
<script src="mediasoup-client-admin.js"></script>
```

2. **Modifier** `admin.js` pour utiliser Mediasoup au lieu de WebSocket

### Client Site Principal

1. **Ajouter** dans `index.html` (avant `script.js`) :
```html
<script src="mediasoup-client-listener.js"></script>
```

2. **Modifier** `script.js` pour utiliser Mediasoup au lieu de WebSocket

## 🚀 Utilisation

### Admin (Diffuseur)

```javascript
const broadcaster = new MediasoupBroadcaster('https://fsstudio-production.up.railway.app');
await broadcaster.connect();
await broadcaster.startBroadcasting();
// Pour arrêter :
await broadcaster.stopBroadcasting();
```

### Site Principal (Auditeur)

```javascript
const listener = new MediasoupListener('https://fsstudio-production.up.railway.app');
await listener.connect();
// L'audio démarre automatiquement quand un diffuseur se connecte
// Pour arrêter :
listener.stopListening();
```

## ⚠️ Notes Importantes

1. **Socket.IO** : Les clients utilisent Socket.IO pour la signalisation (au lieu de WebSocket natif)
2. **WebRTC** : L'audio passe par WebRTC (meilleur que WebSocket pour l'audio)
3. **Ports** : Mediasoup utilise les ports UDP 40000-49999 (à ouvrir dans le firewall si nécessaire)
4. **CDN** : Les clients chargent Mediasoup depuis un CDN (pas besoin d'installer côté client)

## 🔄 Migration Progressive

Vous pouvez garder les deux systèmes en parallèle :
- `server.js` (WebSocket) - ancien système
- `server-mediasoup.js` (Mediasoup) - nouveau système

Et basculer progressivement.

## ✅ Avantages

- **Qualité** : Audio Opus 48kHz stéréo (comme Discord)
- **Latence** : < 100ms (vs 200-500ms avec WebSocket)
- **Fluidité** : Aucune coupure, lecture continue
- **Scalabilité** : Supporte des milliers d'auditeurs simultanés

## 🐛 Dépannage

### Le serveur ne démarre pas
- Vérifiez que `mediasoup` est installé : `npm list mediasoup`
- Vérifiez les logs Railway

### L'audio ne fonctionne pas
- Ouvrez la console (F12) et vérifiez les erreurs
- Vérifiez que Socket.IO se charge correctement
- Vérifiez que Mediasoup client se charge depuis le CDN

### Connexion refusée
- Vérifiez l'URL du serveur dans les clients
- Vérifiez que le serveur est démarré sur Railway

