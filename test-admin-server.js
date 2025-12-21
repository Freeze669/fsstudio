// Serveur de test simple pour vérifier l'automatic login
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname)));

app.listen(8080, () => {
    console.log('✅ Serveur de test démarré sur http://localhost:8080');
    console.log('🔗 Testez l\'admin: http://localhost:8080/admin-secure-panel.html');
});