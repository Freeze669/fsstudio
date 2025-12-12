# 🔥 Règles Firebase - Configuration Complète

## ⚠️ IMPORTANT : Configuration des Règles

Pour que le chat et la radio fonctionnent, vous devez configurer les règles Firebase Realtime Database.

## 📍 Où configurer les règles ?

1. Allez sur https://console.firebase.google.com/
2. Sélectionnez votre projet **fsstudio-33f8a**
3. Allez dans **Realtime Database**
4. Cliquez sur l'onglet **"Règles"** (en haut)
5. Remplacez les règles par celles ci-dessous
6. Cliquez sur **"Publier"**

## ✅ Règles à copier-coller

```json
{
  "rules": {
    "publicChat": {
      ".read": true,
      ".write": true,
      "messages": {
        ".read": true,
        ".write": true
      },
      "users": {
        ".read": true,
        ".write": true
      }
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

## 🔍 Vérification

Après avoir publié les règles :

1. Ouvrez `index.html` dans votre navigateur
2. Ouvrez la console (F12)
3. Vous devriez voir : `✅ Firebase initialisé`
4. Le chat devrait se connecter automatiquement

## ❌ Si vous avez encore des erreurs

### Erreur "Permission denied"
- Vérifiez que vous avez bien copié toutes les règles
- Vérifiez que vous avez cliqué sur "Publier"
- Attendez quelques secondes (propagation)

### Erreur "Database not found"
- Vérifiez que Realtime Database est activé
- Vérifiez l'URL dans `firebase-config.js`

### Erreur "Network error"
- Vérifiez votre connexion internet
- Vérifiez que Firebase n'est pas bloqué par un pare-feu

## 🔒 Sécurité (pour plus tard)

Pour la production, utilisez l'authentification Firebase :

```json
{
  "rules": {
    "publicChat": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "radio": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

Mais pour l'instant, les règles ouvertes permettent de tester facilement.

