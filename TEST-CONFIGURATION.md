# ✅ Test de la Configuration

## 🔍 Vérifications à Faire

### 1. Vérifier que le Serveur Railway Fonctionne

Ouvrez dans votre navigateur :
```
https://fsstudio-production.up.railway.app/status
```

Vous devriez voir :
```json
{
  "status": "online",
  "broadcaster": "disconnected",
  "listeners": 0,
  "timestamp": 1234567890
}
```

✅ **Si vous voyez ça** : Le serveur fonctionne !

❌ **Si vous voyez une erreur** : Vérifiez les logs dans Railway

---

### 2. Vérifier les Logs Railway

1. Allez sur [railway.app](https://railway.app)
2. Ouvrez votre projet
3. Cliquez sur votre service
4. Allez dans l'onglet **"Deployments"**
5. Cliquez sur le dernier déploiement
6. Vérifiez les logs pour voir si le serveur démarre correctement

Vous devriez voir :
```
🚀 Serveur de streaming audio démarré
📡 Port: 3000 (ou autre)
🌐 Site: https://fsstudio.online/
✅ Prêt à recevoir des connexions WebSocket
```

---

### 3. Tester le Streaming

1. **Ouvrez votre site** : https://fsstudio.online/
2. **Ouvrez la console** (F12) pour voir les erreurs
3. **Ouvrez la page admin** et démarrez une diffusion
4. **Retournez sur le site principal** et vérifiez que l'audio fonctionne

---

### 4. Vérifier la Console du Navigateur

Dans la console (F12), vous devriez voir :
- ✅ `Connexion WebSocket établie` (ou similaire)
- ✅ Pas d'erreurs de connexion

Si vous voyez des erreurs :
- ❌ `WebSocket connection failed` → Vérifiez l'URL dans `admin.js` et `script.js`
- ❌ `CORS error` → Vérifiez la configuration CORS dans `server.js`
- ❌ `Connection refused` → Vérifiez que le serveur Railway est démarré

---

## 🐛 Dépannage

### Le serveur ne répond pas
- Vérifiez que le service est déployé sur Railway
- Vérifiez les logs Railway pour les erreurs
- Vérifiez que `package.json` contient bien `"start": "node server.js"`

### Connexion WebSocket refusée
- Vérifiez que l'URL est correcte : `wss://fsstudio-production.up.railway.app`
- Vérifiez que vous utilisez `wss://` (pas `ws://`)
- Vérifiez que le serveur Railway est en ligne

### Audio ne fonctionne pas
- Ouvrez la console (F12) et vérifiez les erreurs
- Vérifiez que le serveur reçoit les données (logs Railway)
- Vérifiez que les permissions audio sont accordées dans le navigateur

---

## ✅ Checklist Finale

- [ ] Le serveur répond sur `/status`
- [ ] Les logs Railway montrent que le serveur est démarré
- [ ] L'URL WebSocket est correcte dans `admin.js` et `script.js`
- [ ] Pas d'erreurs dans la console du navigateur
- [ ] Le streaming fonctionne sur le site principal

