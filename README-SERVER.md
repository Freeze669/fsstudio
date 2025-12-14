# Serveur de Streaming Audio FS Radio

## Installation

1. Installer Node.js (version 14 ou supérieure)
2. Installer les dépendances :
```bash
npm install
```

## Démarrage

```bash
npm start
```

Ou en mode développement (avec rechargement automatique) :
```bash
npm run dev
```

Le serveur démarre sur le port 3000 par défaut.

## Configuration

Pour changer le port, utilisez la variable d'environnement :
```bash
PORT=8080 npm start
```

## Déploiement

### Sur un serveur VPS

1. Installer Node.js
2. Cloner/copier les fichiers
3. Installer les dépendances : `npm install`
4. Utiliser PM2 pour gérer le processus :
```bash
npm install -g pm2
pm2 start server.js --name fs-radio-server
pm2 save
pm2 startup
```

### Avec Nginx (reverse proxy)

Ajouter dans la configuration Nginx :
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Utilisation

Le serveur accepte les connexions WebSocket pour :
- **Diffuseur (admin)** : Envoie l'audio avec `type: 'broadcast'`
- **Auditeurs** : Reçoivent l'audio avec `type: 'listen'`

Le serveur fait le relais entre le diffuseur et tous les auditeurs.

