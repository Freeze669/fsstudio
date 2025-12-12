# 🔥 Configuration Firebase - Guide Simple

## Étape 1: Créer un projet Firebase

1. Allez sur https://console.firebase.google.com/
2. Cliquez sur "Ajouter un projet" ou "Add project"
3. Donnez un nom à votre projet (ex: "fs-radio")
4. Suivez les étapes (désactivez Google Analytics si vous voulez)
5. Cliquez sur "Créer le projet"

## Étape 2: Activer Realtime Database

1. Dans votre projet Firebase, allez dans "Realtime Database"
2. Cliquez sur "Créer une base de données"
3. Choisissez "France (europe-west1)" ou votre région
4. Choisissez "Mode test" (pour commencer)
5. Cliquez sur "Activer"

## Étape 3: Configurer les règles de sécurité

1. Dans Realtime Database, allez dans l'onglet "Règles"
2. Remplacez les règles par:

```json
{
  "rules": {
    "publicChat": {
      ".read": true,
      ".write": true
    },
    "radio": {
      ".read": true,
      ".write": true,
      "audioChunks": {
        ".read": true,
        ".write": true
      },
      "status": {
        ".read": true,
        ".write": true
      },
      "listeners": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

3. Cliquez sur "Publier"

⚠️ **Note**: Ces règles permettent à tout le monde de lire/écrire. Pour la production, utilisez l'authentification Firebase.

## Étape 4: Obtenir la configuration web

1. Dans votre projet Firebase, cliquez sur l'icône ⚙️ (Paramètres)
2. Allez dans "Paramètres du projet"
3. Descendez jusqu'à "Vos applications"
4. Cliquez sur l'icône `</>` (Web)
5. Donnez un nom à votre app (ex: "FS Radio")
6. Copiez la configuration qui apparaît

## Étape 5: Configurer firebase-config.js

1. Copiez `firebase-config.example.js` vers `firebase-config.js`
2. Ouvrez `firebase-config.js` et remplacez les valeurs:

```javascript
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY_ICI",
    authDomain: "votre-projet.firebaseapp.com",
    databaseURL: "https://votre-projet-default-rtdb.firebaseio.com",
    projectId: "votre-projet-id",
    storageBucket: "votre-projet.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

## Étape 6: Tester

1. Ouvrez `index.html` dans votre navigateur
2. Entrez un pseudo dans le chat
3. Envoyez un message
4. Le chat devrait fonctionner en temps réel !

## ✅ C'est tout !

Maintenant:
- Le site web écrit et lit les messages depuis Firebase en temps réel
- Tous les visiteurs voient les mêmes messages instantanément
- Ça fonctionne même si le site est hébergé en ligne !
- Aucun serveur backend nécessaire

## 🔒 Sécurité (pour plus tard)

Pour la production, utilisez les règles Firebase avec authentification:

```json
{
  "rules": {
    "publicChat": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

Et configurez l'authentification Firebase dans votre site.
