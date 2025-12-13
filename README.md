# FS Radio - Radio Web avec Chat Public

Application web de radio avec chat public en temps réel.

## 🚀 Démarrage rapide

### 1. Configuration Firebase

1. Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Activez **Realtime Database**
3. Configurez les règles de sécurité (voir `CONFIGURATION-FIREBASE.md`)
4. Copiez votre configuration Firebase dans `firebase-config.js`

### 2. Ouvrir le site

Ouvrez simplement `index.html` dans votre navigateur. C'est tout !

Le chat public se connecte automatiquement à Firebase et fonctionne en temps réel.

## 📝 Fonctionnalités

- 🎵 **Lecteur radio** avec contrôle play/pause
- 💬 **Chat public** en temps réel
- 🤖 **Bot automatique** qui répond aux messages du chat
- 👥 **Compteur d'utilisateurs en ligne**
- 🔄 **Synchronisation automatique** via Firebase

## 🔧 Configuration

### Firebase Realtime Database

Assurez-vous que les règles Firebase permettent la lecture/écriture pour le chat :

```json
{
  "rules": {
    "publicChat": {
      ".read": true,
      ".write": true
    }
  }
}
```

⚠️ **Note** : Ces règles permettent à tout le monde de lire/écrire. Pour la production, utilisez l'authentification Firebase.

### Configuration Firebase

1. Copiez `firebase-config.example.js` vers `firebase-config.js`
2. Remplissez avec vos informations Firebase
3. Le fichier `firebase-config.js` est déjà dans `.gitignore` pour la sécurité

## 📡 Comment ça marche ?

1. **Frontend (script.js)** : Se connecte à Firebase Realtime Database
2. **Firebase** : Stocke et synchronise les messages en temps réel
3. **Tous les visiteurs** : Voient les mêmes messages instantanément

Aucun serveur backend nécessaire ! Tout fonctionne directement depuis le navigateur.

## 🌐 Déploiement

Pour déployer sur GitHub Pages, Netlify, Vercel, etc. :

1. Commitez tous les fichiers (sauf `firebase-config.js` qui est dans `.gitignore`)
2. Déployez le dossier
3. Configurez `firebase-config.js` sur votre serveur avec vos vraies clés Firebase

## 🔒 Sécurité

- ⚠️ Ne commitez **jamais** `firebase-config.js` avec vos vraies clés
- Le fichier est déjà dans `.gitignore`
- Pour la production, utilisez l'authentification Firebase et des règles de sécurité plus strictes

## 🤖 Bot Automatique

Un bot intelligent est disponible pour répondre automatiquement aux messages du chat !

**Pour déployer le bot** :
1. Consultez `BOT-DEPLOYMENT.md` pour les instructions complètes
2. Le bot répond aux mots-clés comme "bonjour", "aide", "musique", etc.
3. Vous pouvez personnaliser les réponses dans `functions/index.js`

## 📦 Fichiers du projet

- `index.html` - Page principale
- `script.js` - Logique de la radio et du chat
- `style.css` - Styles
- `admin.html` / `admin.js` - Interface d'administration
- `functions/` - Code du bot Firebase Functions
- `firebase-config.js` - Configuration Firebase (ne pas commiter)
- `firebase-config.example.js` - Exemple de configuration
- `BOT-DEPLOYMENT.md` - Guide de déploiement du bot
