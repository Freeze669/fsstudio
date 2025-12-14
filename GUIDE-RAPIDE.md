# 🚀 Guide Rapide - Déploiement sur Service Gratuit

## ⚡ Déploiement en 5 minutes (Railway - Recommandé)

### Étape 1 : Créer le compte
1. Allez sur [railway.app](https://railway.app)
2. Créez un compte (gratuit avec GitHub)

### Étape 2 : Déployer
1. Cliquez sur **"New Project"**
2. Sélectionnez **"Deploy from GitHub repo"**
3. Choisissez votre repository GitHub
4. Railway détecte automatiquement `package.json` et démarre le serveur

### Étape 3 : Obtenir l'URL
1. Une fois déployé, Railway génère une URL comme : `votre-projet.up.railway.app`
2. Copiez cette URL

### Étape 4 : Mettre à jour les fichiers
Dans `admin.js` (ligne ~30) et `script.js` (ligne ~10), remplacez :
```javascript
const WS_SERVER_URL = window.location.protocol === 'https:' 
    ? 'wss://fsstudio.online:3000'
    : 'ws://fsstudio.online:3000';
```

Par :
```javascript
const WS_SERVER_URL = window.location.protocol === 'https:' 
    ? 'wss://votre-projet.up.railway.app'  // Remplacez par votre URL Railway
    : 'ws://votre-projet.up.railway.app';   // Remplacez par votre URL Railway
```

### Étape 5 : Tester
1. Ouvrez `https://votre-projet.up.railway.app/status` pour vérifier
2. Testez le streaming sur votre site GitHub Pages

---

## 📝 Alternative : Render.com

1. Allez sur [render.com](https://render.com)
2. **New** → **Web Service**
3. Connectez votre repo GitHub
4. Configuration :
   - **Name** : `fs-radio-server`
   - **Start Command** : `node server.js`
5. Copiez l'URL générée (ex: `fs-radio-server.onrender.com`)
6. Mettez à jour `admin.js` et `script.js` avec cette URL

---

## ✅ Vérification

Le serveur est prêt quand :
- ✅ `https://votre-url/status` retourne `{"status":"online"}`
- ✅ Le streaming fonctionne sur votre site GitHub Pages

---

## 🆘 Problème ?

Si ça ne fonctionne pas :
1. Vérifiez les logs dans Railway/Render
2. Vérifiez que l'URL WebSocket est correcte dans `admin.js` et `script.js`
3. Vérifiez la console du navigateur (F12) pour les erreurs

