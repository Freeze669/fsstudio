# Hébergement Gratuit du Serveur WebSocket

GitHub Pages ne peut pas exécuter Node.js. Vous devez héberger le serveur WebSocket ailleurs.

## 🆓 Options d'Hébergement Gratuit

### Option 1: Railway (Recommandé - Très Simple)

1. **Créer un compte** sur [railway.app](https://railway.app)
2. **Nouveau projet** → "Deploy from GitHub repo"
3. Sélectionner votre repo GitHub
4. Railway détecte automatiquement `package.json` et démarre le serveur
5. **Obtenir l'URL** : Railway génère une URL comme `votre-projet.railway.app`
6. **Mettre à jour les URLs** dans `admin.js` et `script.js` :
   ```javascript
   const WS_SERVER_URL = 'wss://votre-projet.railway.app';
   ```

**Avantages** : Gratuit (500h/mois), SSL automatique, déploiement automatique

---

### Option 2: Render

1. **Créer un compte** sur [render.com](https://render.com)
2. **New** → **Web Service**
3. Connecter votre repo GitHub
4. Configuration :
   - **Name** : `fs-radio-server`
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
5. **Obtenir l'URL** : Render génère une URL comme `fs-radio-server.onrender.com`
6. **Mettre à jour les URLs** :
   ```javascript
   const WS_SERVER_URL = 'wss://fs-radio-server.onrender.com';
   ```

**Avantages** : Gratuit (avec limitations), SSL automatique

---

### Option 3: Fly.io

1. **Installer Fly CLI** : `curl -L https://fly.io/install.sh | sh`
2. **Créer un compte** : `fly auth signup`
3. **Créer l'app** : `fly launch`
4. **Déployer** : `fly deploy`
5. **Obtenir l'URL** : `votre-app.fly.dev`

**Avantages** : Gratuit (généreux), très rapide

---

### Option 4: Vercel (avec Serverless Functions)

⚠️ **Note** : Vercel utilise des fonctions serverless, nécessite une adaptation du code.

---

## 🔧 Configuration pour Railway (Recommandé)

### 1. Créer `railway.json` (optionnel)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 2. Créer `Procfile` (pour compatibilité)

```
web: node server.js
```

### 3. Variables d'environnement (si nécessaire)

Dans Railway, ajoutez :
- `PORT` : Laissé vide (Railway définit automatiquement)
- `NODE_ENV` : `production`

---

## 🔧 Configuration pour Render

### 1. Créer `render.yaml` (optionnel)

```yaml
services:
  - type: web
    name: fs-radio-server
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
```

---

## 📝 Mise à jour des URLs

Après avoir déployé le serveur, mettez à jour :

### `admin.js` (ligne ~30)
```javascript
const WS_SERVER_URL = 'wss://votre-serveur.railway.app'; // Remplacez par votre URL
```

### `script.js` (ligne ~10)
```javascript
const WS_SERVER_URL = 'wss://votre-serveur.railway.app'; // Remplacez par votre URL
```

---

## ✅ Vérification

1. Vérifiez que le serveur fonctionne :
   - Ouvrez `https://votre-serveur.railway.app/status`
   - Vous devriez voir : `{"status":"online"}`

2. Testez le streaming :
   - Ouvrez votre site GitHub Pages
   - Démarrer une diffusion depuis l'admin
   - Vérifiez que l'audio fonctionne

---

## 🆘 Dépannage

### Le serveur ne démarre pas
- Vérifiez les logs dans Railway/Render
- Vérifiez que `package.json` contient bien `"start": "node server.js"`

### Connexion refusée
- Vérifiez que l'URL utilise `wss://` (pas `ws://`) pour HTTPS
- Vérifiez que le port est correct (Railway/Render le définit automatiquement)

### CORS errors
- Vérifiez que `fsstudio.online` est dans la liste des origines autorisées dans `server.js`

