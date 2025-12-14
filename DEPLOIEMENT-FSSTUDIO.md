# Guide de Déploiement pour fsstudio.online

## 🚀 Installation du Serveur WebSocket

### 1. Sur votre serveur VPS/hébergement

Connectez-vous à votre serveur et installez Node.js :
```bash
# Installer Node.js (si pas déjà installé)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Télécharger les fichiers du serveur

Copiez les fichiers suivants sur votre serveur :
- `server.js`
- `package.json`

### 3. Installer les dépendances

```bash
cd /chemin/vers/votre/projet
npm install
```

### 4. Démarrer le serveur avec PM2 (recommandé)

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer le serveur
pm2 start server.js --name fs-radio-server

# Sauvegarder la configuration
pm2 save

# Configurer le démarrage automatique
pm2 startup
```

## 🔧 Configuration Nginx (si vous utilisez Nginx)

Ajoutez cette configuration dans votre fichier Nginx pour le domaine `fsstudio.online` :

```nginx
# Redirection WebSocket pour le streaming audio
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Route pour le statut du serveur
location /status {
    proxy_pass http://localhost:3000/status;
    proxy_set_header Host $host;
}
```

Puis redémarrez Nginx :
```bash
sudo systemctl restart nginx
```

## 🔒 Configuration SSL/HTTPS

Si votre site utilise HTTPS (recommandé), vous devez utiliser **WSS** (WebSocket Secure).

Les fichiers `admin.js` et `script.js` sont déjà configurés pour détecter automatiquement HTTPS et utiliser `wss://` au lieu de `ws://`.

## 🔥 Configuration Firewall

Ouvrez le port 3000 sur votre serveur :
```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp

# Ou avec iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

## ✅ Vérification

1. Vérifiez que le serveur fonctionne :
   - Ouvrez `https://fsstudio.online/status` dans votre navigateur
   - Vous devriez voir : `{"status":"online","broadcaster":"disconnected","listeners":0}`

2. Testez le streaming :
   - Ouvrez la page admin et démarrez une diffusion
   - Ouvrez la page principale et vérifiez que l'audio fonctionne

## 🐛 Dépannage

### Le serveur ne démarre pas
- Vérifiez que Node.js est installé : `node --version`
- Vérifiez que le port 3000 n'est pas utilisé : `netstat -tulpn | grep 3000`
- Vérifiez les logs : `pm2 logs fs-radio-server`

### Connexion WebSocket refusée
- Vérifiez que le serveur est démarré : `pm2 status`
- Vérifiez le firewall (port 3000 doit être ouvert)
- Vérifiez la configuration Nginx si vous l'utilisez
- Vérifiez les logs du serveur : `pm2 logs fs-radio-server`

### Audio ne fonctionne pas
- Ouvrez la console du navigateur (F12) et vérifiez les erreurs
- Vérifiez que l'URL WebSocket est correcte dans `admin.js` et `script.js`
- Vérifiez que le serveur reçoit les connexions dans les logs

## 📊 Monitoring

Pour surveiller le serveur :
```bash
# Voir le statut
pm2 status

# Voir les logs en temps réel
pm2 logs fs-radio-server

# Redémarrer le serveur
pm2 restart fs-radio-server

# Arrêter le serveur
pm2 stop fs-radio-server
```

