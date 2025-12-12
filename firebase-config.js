// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDvysyoiQUdWGzqutb3JNT9TZTcF5KEkqk",
    authDomain: "fsstudio-33f8a.firebaseapp.com",
    databaseURL: "https://fsstudio-33f8a-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fsstudio-33f8a",
    storageBucket: "fsstudio-33f8a.firebasestorage.app",
    messagingSenderId: "488398834792",
    appId: "1:488398834792:web:6d5c237d0d34989882bfdd"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

console.log('✅ Firebase initialisé');
