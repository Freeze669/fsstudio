# Installation du Serveur de Streaming Audio

## 🚀 Démarrage Rapide

### 1. Installer Node.js
Téléchargez et installez Node.js (version 14 ou supérieure) depuis [nodejs.org](https://nodejs.org/)

### 2. Installer les dépendances
```bash
npm install
```

### 3. Démarrer le serveur
```bash
npm start
```

Le serveur démarre sur le port **3000** par défaut.

## 📝 Configuration

### Modifier l'URL du serveur dans les fichiers

1. **admin.js** (ligne ~29) :
```javascript
const WS_SERVER_URL = 'ws://localhost:3000'; // Changez pour votre serveur
```

2. **script.js** (ligne ~8) :
```javascript
const WS_SERVER_URL = 'ws://localhost:3000'; // Changez pour votre serveur
```

### Pour un serveur distant

Remplacez `localhost:3000` par l'URL de votre serveur :
- `ws://votre-serveur.com:3000` (sans SSL)
- `wss://votre-serveur.com` (avec SSL - recommandé)

## 🌐 Déploiement sur un Serveur VPS

### Option 1: Avec PM2 (Recommandé)

1. Installer PM2 globalement :
```bash
npm install -g pm2
```

2. Démarrer le serveur avec PM2 :
```bash
pm2 start server.js --name fs-radio-server
```

3. Sauvegarder la configuration :
```bash
pm2 save
```

4. Configurer le démarrage automatique :
```bash
pm2 startup
```

### Option 2: Avec Nginx (Reverse Proxy)

Ajoutez dans votre configuration Nginx (`/etc/nginx/sites-available/default`) :

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Puis redémarrez Nginx :
```bash
sudo systemctl restart nginx
```

## 🔒 Sécurité

Pour la production, utilisez **WSS** (WebSocket Secure) avec SSL :
1. Configurez un certificat SSL (Let's Encrypt)
2. Utilisez `wss://` au lieu de `ws://` dans les URLs

## ✅ Vérification

Vérifiez que le serveur fonctionne :
- Ouvrez `http://localhost:3000/status` dans votre navigateur
- Vous devriez voir : `{"status":"online","broadcaster":"disconnected","listeners":0}`

## 🐛 Dépannage

### Le serveur ne démarre pas
- Vérifiez que le port 3000 n'est pas déjà utilisé
- Changez le port dans `server.js` : `const PORT = 8080;`

### Connexion refusée
- Vérifiez que le serveur est démarré
- Vérifiez l'URL dans `admin.js` et `script.js`
- Vérifiez le firewall (port 3000 doit être ouvert)

### Audio ne fonctionne pas
- Vérifiez la console du navigateur pour les erreurs
- Vérifiez que le serveur reçoit les connexions
- Vérifiez les logs du serveur dans le terminal

