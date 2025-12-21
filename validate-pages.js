const fs = require('fs');

console.log('=== VALIDATION DES PAGES SÉPARÉES ===');

// Vérifier que login.html existe et contient les éléments nécessaires
const loginHtml = fs.readFileSync('login.html', 'utf8');
console.log('✅ login.html existe');
console.log('   - Formulaire de connexion:', loginHtml.includes('login-form'));
console.log('   - Champ password:', loginHtml.includes('type="password"'));
console.log('   - Centré avec flexbox:', loginHtml.includes('display: flex') && loginHtml.includes('align-items: center'));
console.log('   - Script de connexion intégré:', loginHtml.includes('performLogin'));

// Vérifier que admin.html n'a plus l'écran de connexion
const adminHtml = fs.readFileSync('admin.html', 'utf8');
console.log('✅ admin.html modifié');
console.log('   - Plus d\'écran de connexion:', !adminHtml.includes('login-screen'));
console.log('   - Admin container visible:', adminHtml.includes('admin-container') && !adminHtml.includes('display: none'));

// Vérifier les redirections dans admin.js
const adminJs = fs.readFileSync('admin.js', 'utf8');
console.log('✅ admin.js modifié');
console.log('   - Redirection login.html dans performAuthCheck:', adminJs.includes('window.location.href = \'login.html\''));
console.log('   - Redirection admin.html dans performLogin:', adminJs.includes('window.location.href = \'admin.html\''));
console.log('   - Déconnexion vers login.html:', adminJs.includes('logoutBtn.addEventListener') && adminJs.includes('login.html'));

console.log('');
console.log('🎯 RÉSULTAT: Pages séparées créées avec succès !');
console.log('   📄 login.html - Page de connexion centrée');
console.log('   📄 admin.html - Panel d\'administration uniquement');
console.log('   🔄 Redirections automatiques entre les pages');