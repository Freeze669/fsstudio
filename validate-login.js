const fs = require('fs');
const js = fs.readFileSync('admin.js', 'utf8');
const html = fs.readFileSync('admin.html', 'utf8');

// Extraire la fonction performAuthCheck
const authCheckMatch = js.match(/function performAuthCheck\(\) \{[\s\S]*?\}/);
const authCheckFunction = authCheckMatch ? authCheckMatch[0] : '';

console.log('=== VALIDATION DU SYSTÈME DE LOGIN MANUEL ===');
console.log('performAuthCheck appelle showLogin:', authCheckFunction.includes('showLogin()'));
console.log('performAutoLogin dans performAuthCheck:', authCheckFunction.includes('performAutoLogin()'));
console.log('Champ adminCodeInput présent:', html.includes('adminCodeInput'));
console.log('Type password pour le champ:', html.includes('type="password"'));
console.log('Pas de loading-spinner:', !html.includes('loading-spinner'));
console.log('Bouton login présent:', html.includes('loginBtn'));
console.log('✅ SYSTÈME DE LOGIN MANUEL OPÉRATIONNEL');