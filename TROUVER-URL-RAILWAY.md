# 🔍 Comment Trouver l'URL de Votre Service Railway

## Méthode 1 : Via l'Interface Railway

1. **Ouvrez votre projet** sur [railway.app](https://railway.app)
2. **Cliquez sur votre service** (celui qui contient `server.js`)
3. Allez dans l'onglet **"Settings"** (Paramètres)
4. Scrollez jusqu'à **"Domains"** (Domaines)
5. Vous verrez une URL comme : `votre-service.up.railway.app`
6. **Copiez cette URL** (sans le `https://`)

## Méthode 2 : Via les Deployments

1. Dans votre projet Railway, cliquez sur votre service
2. Allez dans l'onglet **"Deployments"**
3. Cliquez sur le dernier déploiement (celui en vert)
4. L'URL est affichée dans les logs ou dans les détails

## Méthode 3 : Via les Variables d'Environnement

1. Dans votre service, allez dans **"Variables"**
2. Cherchez `RAILWAY_PUBLIC_DOMAIN` ou `RAILWAY_STATIC_URL`
3. Cette variable contient votre URL

## ⚠️ Important

- L'URL Railway ressemble à : `votre-service-production.up.railway.app`
- Utilisez **`wss://`** (pas `ws://`) car Railway utilise HTTPS
- N'ajoutez **PAS** de port (pas de `:3000`)

## 📝 Format de l'URL

Une fois que vous avez l'URL, elle devrait ressembler à :
```
wss://votre-service-production.up.railway.app
```

Ou simplement :
```
votre-service-production.up.railway.app
```

(On ajoutera `wss://` dans le code)

