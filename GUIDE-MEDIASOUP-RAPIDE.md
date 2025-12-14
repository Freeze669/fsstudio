# 🚀 Guide Rapide - Migration vers Mediasoup

## ⚡ Déploiement en 3 étapes

### Étape 1 : Mettre à jour le serveur Railway

1. **Modifier** `package.json` :
```json
{
  "scripts": {
    "start": "node server-mediasoup.js"
  }
}
```

2. **Commit et push** sur GitHub
3. Railway redéploiera automatiquement avec Mediasoup

### Étape 2 : Mettre à jour les fichiers HTML

#### `admin.html` - Ajouter avant `</head>` :
```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script src="mediasoup-client-admin.js"></script>
```

#### `index.html` - Ajouter avant `</head>` :
```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script src="mediasoup-client-listener.js"></script>
```

### Étape 3 : Intégrer dans le code

#### Dans `admin.js` - Remplacer le système WebSocket :

**Trouvez** la fonction `initRadioEvents()` et **remplacez** le code de démarrage :

```javascript
// Ancien code (WebSocket) - À REMPLACER
connectWebSocket();
sendContinuousBuffer();

// Nouveau code (Mediasoup) - REMPLACER PAR :
let mediasoupBroadcaster = null;

startVoiceBtn.addEventListener('click', async () => {
    try {
        if (!mediasoupBroadcaster) {
            mediasoupBroadcaster = new MediasoupBroadcaster('https://fsstudio-production.up.railway.app');
            await mediasoupBroadcaster.connect();
        }
        await mediasoupBroadcaster.startBroadcasting();
        voiceStatusText.textContent = '✅ Diffusion en cours (Mediasoup)';
    } catch (error) {
        console.error('❌ Erreur Mediasoup:', error);
        voiceStatusText.textContent = '❌ Erreur diffusion';
    }
});

stopVoiceBtn.addEventListener('click', async () => {
    if (mediasoupBroadcaster) {
        await mediasoupBroadcaster.stopBroadcasting();
        voiceStatusText.textContent = '⏸️ Diffusion arrêtée';
    }
});
```

#### Dans `script.js` - Remplacer le système WebSocket :

**Trouvez** la fonction `connectToAudioChunks()` et **remplacez** :

```javascript
// Ancien code (WebSocket) - À REMPLACER
connectToAudioChunks();

// Nouveau code (Mediasoup) - REMPLACER PAR :
let mediasoupListener = null;

async function initMediasoupListener() {
    if (!mediasoupListener) {
        mediasoupListener = new MediasoupListener('https://fsstudio-production.up.railway.app');
        await mediasoupListener.connect();
        console.log('✅ Mediasoup listener initialisé');
    }
}

// Appeler au chargement de la page
initMediasoupListener();
```

## ✅ Vérification

1. **Vérifiez le serveur** : `https://fsstudio-production.up.railway.app/status`
   - Vous devriez voir : `{ "mediasoup": "active" }`

2. **Testez la diffusion** :
   - Ouvrez l'admin et démarrez une diffusion
   - Ouvrez le site principal dans un autre onglet
   - L'audio devrait être **beaucoup plus fluide et clair**

## 🎯 Avantages Immédiats

- ✅ **Qualité audio** : Opus 48kHz stéréo (comme Discord)
- ✅ **Latence** : < 100ms (vs 200-500ms avant)
- ✅ **Fluidité** : Aucune coupure, lecture continue
- ✅ **Clarté** : Son beaucoup plus clair et naturel

## 🐛 Si ça ne fonctionne pas

1. **Vérifiez la console** (F12) pour les erreurs
2. **Vérifiez les logs Railway** pour voir si le serveur démarre
3. **Vérifiez** que Socket.IO se charge (dans la console : `typeof io !== 'undefined'`)
4. **Vérifiez** que Mediasoup se charge (dans la console : `typeof MediasoupBroadcaster !== 'undefined'`)

## 📝 Notes

- Le système WebSocket (`server.js`) reste disponible en backup
- Vous pouvez basculer entre les deux en changeant `package.json`
- Mediasoup nécessite Socket.IO (chargé depuis CDN, pas besoin d'installer)

