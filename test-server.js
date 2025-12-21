// Serveur de test simple
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Serveur fonctionne !</h1><p>Le JavaScript est correct.</p>');
});

server.listen(3000, () => {
    console.log('✅ Serveur de test démarré sur http://localhost:3000');
});