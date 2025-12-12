// EXEMPLE de configuration Firebase
// Copiez ce fichier en firebase-config.js et remplissez avec vos valeurs

const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "votre-projet.firebaseapp.com",
    databaseURL: "https://votre-projet-default-rtdb.firebaseio.com",
    projectId: "votre-projet-id",
    storageBucket: "votre-projet.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

console.log('✅ Firebase initialisé');
