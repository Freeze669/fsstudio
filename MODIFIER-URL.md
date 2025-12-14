# 🔧 Comment Modifier l'URL du Serveur WebSocket

Après avoir déployé votre serveur sur Railway, Render, ou un autre service, vous devez mettre à jour l'URL dans 2 fichiers.

## 📝 Fichiers à Modifier

### 1. `admin.js` (ligne ~30-33)

**Trouvez cette section :**
```javascript
// Configuration WebSocket pour streaming audio
// Utiliser wss:// pour HTTPS (sécurisé) ou ws:// pour HTTP
const WS_SERVER_URL = window.location.protocol === 'https:' 
    ? 'wss://fsstudio.online:3000'  // HTTPS -> WSS (sécurisé)
    : 'ws://fsstudio.online:3000';   // HTTP -> WS
```

**Remplacez par votre URL Railway/Render :**
```javascript
// Configuration WebSocket pour streaming audio
// Utiliser wss:// pour HTTPS (sécurisé) ou ws:// pour HTTP
const WS_SERVER_URL = window.location.protocol === 'https:' 
    ? 'wss://votre-projet.up.railway.app'  // ⚠️ Remplacez par votre URL
    : 'ws://votre-projet.up.railway.app';   // ⚠️ Remplacez par votre URL
```

### 2. `script.js` (ligne ~9-12)

**Trouvez cette section :**
```javascript
// Configuration WebSocket pour streaming audio
// Utiliser wss:// pour HTTPS (sécurisé) ou ws:// pour HTTP
const WS_SERVER_URL = window.location.protocol === 'https:' 
    ? 'wss://fsstudio.online:3000'  // HTTPS -> WSS (sécurisé)
    : 'ws://fsstudio.online:3000';   // HTTP -> WS
```

**Remplacez par votre URL Railway/Render :**
```javascript
// Configuration WebSocket pour streaming audio
// Utiliser wss:// pour HTTPS (sécurisé) ou ws:// pour HTTP
const WS_SERVER_URL = window.location.protocol === 'https:' 
    ? 'wss://votre-projet.up.railway.app'  // ⚠️ Remplacez par votre URL
    : 'ws://votre-projet.up.railway.app';   // ⚠️ Remplacez par votre URL
```

## ✅ Exemples d'URLs

### Railway
```javascript
const WS_SERVER_URL = 'wss://fs-radio-server.up.railway.app';
```

### Render
```javascript
const WS_SERVER_URL = 'wss://fs-radio-server.onrender.com';
```

### Fly.io
```javascript
const WS_SERVER_URL = 'wss://fs-radio-server.fly.dev';
```

## 🔍 Comment Trouver Votre URL

### Railway
1. Ouvrez votre projet sur [railway.app](https://railway.app)
2. Cliquez sur votre service
3. L'URL est affichée dans l'onglet **"Settings"** → **"Domains"**
4. Ou dans l'onglet **"Deployments"** → cliquez sur le dernier déploiement

### Render
1. Ouvrez votre service sur [render.com](https://render.com)
2. L'URL est affichée en haut de la page de votre service
3. Format : `votre-nom.onrender.com`

## ⚠️ Important

- Utilisez **`wss://`** (pas `ws://`) pour les connexions sécurisées (HTTPS)
- N'ajoutez **PAS** de port à la fin (ex: `:3000`) - Railway/Render le gèrent automatiquement
- L'URL doit commencer par `wss://` ou `ws://`

## 🧪 Test

Après modification, testez :
1. Ouvrez `https://votre-url/status` dans votre navigateur
2. Vous devriez voir : `{"status":"online"}`
3. Testez le streaming sur votre site GitHub Pages

