// Configuration Admin - Système hiérarchique
const ADMIN_USERS = {
    // Directeur Général - Contrôle total absolu
    'DIRECTEUR2024': { role: 'directeur_general', name: 'Directeur Général FS Studio', permissions: ['all'] },
    
    // Directeur de Niveau 1 - Contrôle total
    'STUDIO2024': { role: 'directeur_de_1', name: 'Directeur de Niveau 1 FS Studio', permissions: ['all'] },
    
    // Moderators (peuvent être ajoutés dynamiquement par le Directeur Général)
};

// Stockage des modérateurs créés dynamiquement
let dynamicModerators = JSON.parse(localStorage.getItem('dynamicModerators') || '{}');

// Fonction pour vérifier les permissions
function hasPermission(user, permission) {
    if (!user || !user.permissions) return false;
    return user.permissions.includes('all') || user.permissions.includes(permission);
}

// Fonction pour créer un modérateur (seulement pour le Directeur Général)
function createModerator(code, name) {
    if (!isAuthenticated || !currentUser || currentUser.role !== 'directeur_general') {
        alert('❌ Seuls les Directeurs Généraux peuvent créer des modérateurs');
        return false;
    }
    
    if (ADMIN_USERS[code] || dynamicModerators[code]) {
        alert('❌ Ce code existe déjà');
        return false;
    }
    
    dynamicModerators[code] = {
        role: 'directeur_de_2',
        name: name,
        permissions: ['chat'],
        createdBy: currentUser.name,
        createdAt: new Date().toISOString()
    };
    
    localStorage.setItem('dynamicModerators', JSON.stringify(dynamicModerators));
    
    // Sauvegarder dans Firebase pour synchronisation
    database.ref('admin/moderators/' + code).set(dynamicModerators[code]);
    
    alert(`✅ Modérateur "${name}" créé avec le code: ${code}`);
    return true;
}

// Fonction pour modifier un modérateur
function updateModerator(oldCode, newCode, newName, newPermissions) {
    if (!isAuthenticated || !currentUser || currentUser.role !== 'directeur_general') {
        alert('❌ Seuls les Directeurs Généraux peuvent modifier les modérateurs');
        return false;
    }
    
    if (!dynamicModerators[oldCode]) {
        alert('❌ Modérateur introuvable');
        return false;
    }
    
    // Vérifier si le nouveau code existe déjà (sauf si c'est le même)
    if (newCode !== oldCode && (ADMIN_USERS[newCode] || dynamicModerators[newCode])) {
        alert('❌ Ce code existe déjà');
        return false;
    }
    
    // Supprimer l'ancien modérateur
    delete dynamicModerators[oldCode];
    database.ref('admin/moderators/' + oldCode).remove();
    
    // Créer le nouveau modérateur
    dynamicModerators[newCode] = {
        role: 'directeur_de_2',
        name: newName,
        permissions: newPermissions,
        createdBy: currentUser.name,
        updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('dynamicModerators', JSON.stringify(dynamicModerators));
    
    // Sauvegarder dans Firebase
    database.ref('admin/moderators/' + newCode).set(dynamicModerators[newCode]);
    
    alert(`✅ Modérateur "${newName}" mis à jour`);
    return true;
}

// Fonction pour supprimer un modérateur
function deleteModerator(code) {
    if (!isAuthenticated || !currentUser || currentUser.role !== 'directeur_general') {
        alert('❌ Seuls les Directeurs Généraux peuvent supprimer les modérateurs');
        return false;
    }
    
    if (!dynamicModerators[code]) {
        alert('❌ Modérateur introuvable');
        return false;
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le modérateur "${dynamicModerators[code].name}" ?`)) {
        return false;
    }
    
    delete dynamicModerators[code];
    localStorage.setItem('dynamicModerators', JSON.stringify(dynamicModerators));
    
    // Supprimer de Firebase
    database.ref('admin/moderators/' + code).remove();
    
    alert('✅ Modérateur supprimé');
    return true;
}

// Fonction pour afficher la liste des modérateurs
function displayModerators() {
    const moderatorList = document.getElementById('moderatorList');
    if (!moderatorList) return;
    
    moderatorList.innerHTML = '';
    
    Object.entries(dynamicModerators).forEach(([code, moderator]) => {
        const moderatorDiv = document.createElement('div');
        moderatorDiv.className = 'moderator-item';
        moderatorDiv.innerHTML = `
            <div class="moderator-info">
                <strong>${moderator.name}</strong> (${code})
                <br><small>Créé par: ${moderator.createdBy} • ${new Date(moderator.createdAt).toLocaleDateString()}</small>
                <br><small>Permissions: ${moderator.permissions.join(', ')}</small>
            </div>
            <div class="moderator-actions">
                <button class="edit-btn" data-code="${code}">✏️ Modifier</button>
                <button class="delete-btn" data-code="${code}">🗑️ Supprimer</button>
            </div>
        `;
        moderatorList.appendChild(moderatorDiv);
    });
    
    // Ajouter les écouteurs d'événements
    moderatorList.addEventListener('click', (e) => {
        const code = e.target.dataset.code;
        if (!code) return;
        
        if (e.target.classList.contains('edit-btn')) {
            editModerator(code);
        } else if (e.target.classList.contains('delete-btn')) {
            if (deleteModerator(code)) {
                displayModerators(); // Rafraîchir la liste
            }
        }
    });
}

// Fonction pour éditer un modérateur
function editModerator(code) {
    const moderator = dynamicModerators[code];
    if (!moderator) return;
    
    // Remplir le formulaire d'édition
    const editName = document.getElementById('editModeratorName');
    const editCode = document.getElementById('editModeratorCode');
    const editChat = document.getElementById('editChatPermission');
    const editBroadcast = document.getElementById('editBroadcastPermission');
    
    if (editName) editName.value = moderator.name;
    if (editCode) editCode.value = code;
    if (editChat) editChat.checked = moderator.permissions.includes('chat');
    if (editBroadcast) editBroadcast.checked = moderator.permissions.includes('broadcast');
    
    // Stocker le code original
    document.getElementById('editModeratorForm').dataset.originalCode = code;
    
    // Afficher la modal d'édition
    const editModal = document.getElementById('editModeratorModal');
    if (editModal) editModal.style.display = 'flex';
}

// Variables globales
let currentUser = null;

// Éléments DOM
const loginScreen = document.getElementById('loginScreen');
const adminContainer = document.getElementById('adminContainer');
const adminCodeInput = document.getElementById('adminCode');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const errorMessage = document.getElementById('errorMessage');
const chatMessagesAdmin = document.getElementById('chatMessagesAdmin');
const adminOnlineCount = document.getElementById('adminOnlineCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const refreshBtn = document.getElementById('refreshBtn');
const adminUsername = document.getElementById('adminUsername');
const adminMessage = document.getElementById('adminMessage');
const adminSendBtn = document.getElementById('adminSendBtn');
const charCount = document.getElementById('charCount');
const totalMessages = document.getElementById('totalMessages');
const totalUsers = document.getElementById('totalUsers');

// Variables pour les statistiques
let startTime = Date.now();
let lastMessageCount = 0;
let lastUserCount = 0;
let lastEngagement = 0;

// Fonction pour changer d'onglet
function switchTab(tabId) {
    // Masquer tous les contenus
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Désactiver tous les boutons
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activer l'onglet sélectionné
    const selectedTab = document.getElementById(tabId);
    const selectedBtn = document.querySelector(`[data-tab="${tabId}"]`);
    
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    // Sauvegarder l'onglet actif
    localStorage.setItem('adminActiveTab', tabId);
}

// Fonction pour mettre à jour l'uptime
function updateUptime() {
    const now = Date.now();
    const diff = now - startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    uptime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Fonction pour calculer les pourcentages
function calculatePercentages() {
    const total = parseInt(totalUsers.textContent) || 1;
    const online = parseInt(onlineUsers.textContent) || 0;
    const listeners = parseInt(listenersCount.textContent) || 0;
    
    const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;
    const listenersPct = total > 0 ? Math.round((listeners / total) * 100) : 0;
    
    onlinePercentage.textContent = `${onlinePct}%`;
    listenersPercentage.textContent = `${listenersPct}%`;
}

// Fonction pour mettre à jour les changements
function updateChanges() {
    const currentMessages = parseInt(totalMessages.textContent) || 0;
    const currentUsers = parseInt(totalUsers.textContent) || 0;
    
    const messageChange = currentMessages - lastMessageCount;
    const userChange = currentUsers - lastUserCount;
    
    messagesChange.textContent = messageChange >= 0 ? `+${messageChange} aujourd'hui` : `${messageChange} aujourd'hui`;
    usersChange.textContent = userChange >= 0 ? `+${userChange} aujourd'hui` : `${userChange} aujourd'hui`;
    
    lastMessageCount = currentMessages;
    lastUserCount = currentUsers;
}

// Configuration Firebase
const FIREBASE_MESSAGES_PATH = 'publicChat/messages';
const FIREBASE_USERS_PATH = 'publicChat/users';
const FIREBASE_RADIO_PATH = 'radio';
const FIREBASE_RADIO_STATUS_PATH = 'radio/status';
const FIREBASE_BROADCAST_INFO_PATH = 'broadcast/info';

// Configuration WebSocket pour streaming audio
// URL du serveur Railway (toujours en WSS car Railway utilise HTTPS)
const WS_SERVER_URL = 'wss://fsstudio-production.up.railway.app';
let audioWebSocket = null;

// Fonction pour se connecter au serveur WebSocket
function connectWebSocket() {
    if (audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN) {
        return; // Déjà connecté
    }
    
    try {
        audioWebSocket = new WebSocket(WS_SERVER_URL);
        
        audioWebSocket.onopen = () => {
            console.log('✅ Connecté au serveur WebSocket');
            // S'identifier comme diffuseur
            audioWebSocket.send(JSON.stringify({ type: 'broadcast' }));
            if (websocketStatus) websocketStatus.textContent = '🟢 Connecté';
        };
        
        audioWebSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'broadcaster-confirmed') {
                    console.log('✅ Identifié comme diffuseur');
                }
            } catch (e) {
                console.error('❌ Erreur parsing message WebSocket:', e);
            }
        };
        
        audioWebSocket.onerror = (error) => {
            console.error('❌ Erreur WebSocket:', error);
            if (websocketStatus) websocketStatus.textContent = '🔴 Erreur';
        };
        
        audioWebSocket.onclose = () => {
            console.log('⚠️ Connexion WebSocket fermée');
            if (websocketStatus) websocketStatus.textContent = '🔴 Déconnecté';
            // Tentative de reconnexion après 3 secondes
            if (isStreaming) {
                setTimeout(() => {
                    connectWebSocket();
                }, 3000);
            }
        };
    } catch (error) {
        console.error('❌ Erreur connexion WebSocket:', error);
    }
}

// Variables
let messagesRef = null;
let usersRef = null;
let isAuthenticated = false;
let loadedMessageIds = new Set();

// Variables Radio/Streaming (initialisées après chargement)
let startVoiceBtn, stopVoiceBtn;
let voiceInfo, audioLevel, voiceStatusText, radioStatusIndicator, radioStatusText, listenersCount;
let streamStats, chunksSent, lastSent;

// Variables pour les onglets et stats
let tabBtns, tabContents;
let onlineUsers, uptime, engagementRate, websocketStatus, firebaseStatus, streamingStatus, lastActivity;
let messagesChange, usersChange, engagementChange, listenersPercentage, onlinePercentage;

// Éléments pour la diffusion
let scheduleDay, scheduleStart, scheduleEnd, saveScheduleBtn, currentScheduleDay, currentScheduleTime;
let contactEmail, contactWebsite, contactPhone, contactAddress, saveContactBtn;

let mediaStream = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let animationFrame = null;
let isStreaming = false;
let mediaRecorder = null;
let audioChunks = [];
let streamInterval = null;
let bufferTimer = null; // Timer pour forcer l'envoi périodique du buffer
let chunksSentCount = 0;
let lastSentTime = null;
let scriptProcessor = null;

// Vérifier si déjà connecté
function checkAuth() {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth) {
        // Vérifier d'abord les utilisateurs statiques
        let user = ADMIN_USERS[savedAuth];
        
        // Si pas trouvé, vérifier les modérateurs dynamiques
        if (!user) {
            user = dynamicModerators[savedAuth];
        }
        
        if (user) {
            currentUser = user;
            isAuthenticated = true;
            showAdmin();
            return;
        }
    }
    showLogin();
}

// Afficher l'écran de connexion
function showLogin() {
    loginScreen.style.display = 'flex';
    adminContainer.style.display = 'none';
    isAuthenticated = false;
}

// Afficher l'interface admin
function showAdmin() {
    loginScreen.style.display = 'none';
    adminContainer.style.display = 'block';
    isAuthenticated = true;
    
    // Afficher le nom et rôle de l'utilisateur
    const userInfo = document.getElementById('userInfo');
    if (userInfo && currentUser) {
        userInfo.textContent = `${currentUser.name} (${currentUser.role})`;
    }
    
    // Masquer les onglets selon les permissions
    if (!hasPermission(currentUser, 'broadcast')) {
        const broadcastTab = document.querySelector('[data-tab="broadcasting"]');
        if (broadcastTab) broadcastTab.style.display = 'none';
    }
    
    if (!hasPermission(currentUser, 'chat')) {
        const chatTab = document.querySelector('[data-tab="chat"]');
        if (chatTab) chatTab.style.display = 'none';
    }
    
    // Masquer la section de création de modérateurs si pas directeur_general
    const createModeratorSection = document.getElementById('createModeratorSection');
    if (createModeratorSection) {
        createModeratorSection.style.display = currentUser && currentUser.role === 'directeur_general' ? 'block' : 'none';
    }
    
    // Initialiser les éléments DOM radio
    startVoiceBtn = document.getElementById('startVoiceBtn');
    stopVoiceBtn = document.getElementById('stopVoiceBtn');
    voiceInfo = document.getElementById('voiceInfo');
    audioLevel = document.getElementById('audioLevel');
    voiceStatusText = document.getElementById('voiceStatusText');
    radioStatusIndicator = document.getElementById('radioStatusIndicator');
    radioStatusText = document.getElementById('radioStatusText');
    listenersCount = document.getElementById('listenersCount');
    streamStats = document.getElementById('streamStats');
    chunksSent = document.getElementById('chunksSent');
    lastSent = document.getElementById('lastSent');
    
    // Initialiser les nouveaux éléments DOM
    onlineUsers = document.getElementById('onlineUsers');
    uptime = document.getElementById('uptime');
    engagementRate = document.getElementById('engagementRate');
    websocketStatus = document.getElementById('websocketStatus');
    firebaseStatus = document.getElementById('firebaseStatus');
    streamingStatus = document.getElementById('streamingStatus');
    lastActivity = document.getElementById('lastActivity');
    messagesChange = document.getElementById('messagesChange');
    usersChange = document.getElementById('usersChange');
    engagementChange = document.getElementById('engagementChange');
    listenersPercentage = document.getElementById('listenersPercentage');
    onlinePercentage = document.getElementById('onlinePercentage');
    
    // Éléments pour la diffusion
    scheduleDay = document.getElementById('scheduleDay');
    scheduleStart = document.getElementById('scheduleStart');
    scheduleEnd = document.getElementById('scheduleEnd');
    saveScheduleBtn = document.getElementById('saveScheduleBtn');
    currentScheduleDay = document.getElementById('currentScheduleDay');
    currentScheduleTime = document.getElementById('currentScheduleTime');
    
    contactEmail = document.getElementById('contactEmail');
    contactWebsite = document.getElementById('contactWebsite');
    contactPhone = document.getElementById('contactPhone');
    contactAddress = document.getElementById('contactAddress');
    saveContactBtn = document.getElementById('saveContactBtn');
    
    // Onglets
    tabBtns = document.querySelectorAll('.tab-btn');
    tabContents = document.querySelectorAll('.tab-content');
    
    // Écouteurs pour les onglets
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Initialiser les onglets
    const savedTab = localStorage.getItem('adminActiveTab') || 'site-info';
    switchTab(savedTab);
    
    // Écouteurs pour les boutons de sauvegarde
    saveScheduleBtn.addEventListener('click', saveBroadcastSchedule);
    saveContactBtn.addEventListener('click', saveContactInfo);
    
    // Écouteurs pour la gestion des modérateurs
    const generateCodeBtn = document.getElementById('generateCodeBtn');
    const createModeratorBtn = document.getElementById('createModeratorBtn');
    const moderatorName = document.getElementById('moderatorName');
    const moderatorCode = document.getElementById('moderatorCode');
    
    if (generateCodeBtn) {
        generateCodeBtn.addEventListener('click', () => {
            const code = 'MOD' + Math.random().toString(36).substr(2, 6).toUpperCase();
            moderatorCode.value = code;
        });
    }
    
    if (createModeratorBtn) {
        createModeratorBtn.addEventListener('click', () => {
            const name = moderatorName.value.trim();
            const code = moderatorCode.value.trim();
            
            if (!name) {
                alert('Veuillez entrer un nom pour le modérateur');
                return;
            }
            
            if (!code) {
                alert('Veuillez générer un code d\'accès');
                return;
            }
            
            if (createModerator(code, name)) {
                moderatorName.value = '';
                moderatorCode.value = '';
                displayModerators(); // Rafraîchir la liste
            }
        });
    }
    
    // Écouteurs pour l'édition des modérateurs
    const saveEditBtn = document.getElementById('saveEditModeratorBtn');
    const cancelEditBtn = document.getElementById('cancelEditModeratorBtn');
    const editModal = document.getElementById('editModeratorModal');
    
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            const originalCode = document.getElementById('editModeratorForm').dataset.originalCode;
            const newName = document.getElementById('editModeratorName').value.trim();
            const newCode = document.getElementById('editModeratorCode').value.trim();
            const chatPermission = document.getElementById('editChatPermission').checked;
            const broadcastPermission = document.getElementById('editBroadcastPermission').checked;
            
            if (!newName || !newCode) {
                alert('Veuillez remplir tous les champs');
                return;
            }
            
            const newPermissions = [];
            if (chatPermission) newPermissions.push('chat');
            if (broadcastPermission) newPermissions.push('broadcast');
            
            if (newPermissions.length === 0) {
                alert('Au moins une permission doit être sélectionnée');
                return;
            }
            
            if (updateModerator(originalCode, newCode, newName, newPermissions)) {
                if (editModal) editModal.style.display = 'none';
                displayModerators(); // Rafraîchir la liste
            }
        });
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            if (editModal) editModal.style.display = 'none';
        });
    }
    
    // Fermer la modal en cliquant en dehors
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                editModal.style.display = 'none';
            }
        });
    }
    
    // Charger les données de diffusion
    loadBroadcastInfo();
    
    connectToFirebase();
    initRadio();
    initAudioControlPanel();
    
    // Afficher la liste des modérateurs si directeur_general
    if (currentUser && currentUser.role === 'directeur_general') {
        displayModerators();
    }
    
    // Mettre à jour les statistiques en temps réel toutes les 30 secondes
    setInterval(() => {
        if (isAuthenticated) {
            updateStats();
        }
    }, 30000);
}

// Initialiser le panneau de contrôle audio
function initAudioControlPanel() {
    // Attendre que MediasoupBroadcaster soit disponible
    if (typeof MediasoupBroadcaster !== 'undefined' && typeof AudioControlPanel !== 'undefined') {
        const serverUrl = 'https://fsstudio-production.up.railway.app';
        const broadcaster = new MediasoupBroadcaster(serverUrl);
        window.audioControlPanel = new AudioControlPanel(broadcaster);
        
        // Afficher la section de contrôle audio
        const audioControlSection = document.getElementById('audioControlSection');
        if (audioControlSection) {
            audioControlSection.style.display = 'block';
        }
        
        // Initialiser les contrôles
        setupAudioControls();
    } else {
        // Réessayer après un court délai
        setTimeout(initAudioControlPanel, 1000);
    }
}

// Configurer les contrôles audio
function setupAudioControls() {
    const panel = window.audioControlPanel;
    if (!panel) return;
    
    // Charger les valeurs sauvegardées
    panel.updateUI();
    
    // Écouter tous les changements de sliders
    const paramKeys = [
        'highPassFreq', 'lowPassFreq', 'preEmphasisGain', 'preEmphasisFreq',
        'eqLowFreq', 'eqLowGain', 'eqLowQ',
        'eqMidFreq', 'eqMidGain', 'eqMidQ',
        'eqHighFreq', 'eqHighGain', 'eqHighQ',
        'compressorThreshold', 'compressorKnee', 'compressorRatio', 'compressorAttack', 'compressorRelease',
        'agcGain',
        'limiterThreshold', 'limiterKnee', 'limiterRatio', 'limiterAttack', 'limiterRelease',
        'deEmphasisGain', 'deEmphasisFreq'
    ];
    
    paramKeys.forEach(key => {
        const input = document.getElementById(`audio-${key}`);
        if (input) {
            input.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                panel.updateParam(key, value);
                
                // Mettre à jour l'affichage
                const display = document.getElementById(`audio-${key}-display`);
                if (display) {
                    display.textContent = panel.formatValue(key, value);
                }
            });
        }
    });
    
    // Bouton réinitialiser
    const resetBtn = document.getElementById('resetAudioParamsBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Réinitialiser tous les paramètres audio aux valeurs par défaut ?')) {
                panel.resetToDefaults();
                panel.updateUI();
            }
        });
    }
    
    // Bouton sauvegarder
    const saveBtn = document.getElementById('saveAudioParamsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            panel.saveParams();
            alert('✅ Paramètres audio sauvegardés !');
        });
    }
}

// Connexion
loginBtn.addEventListener('click', () => {
    const code = adminCodeInput.value.trim();
    
    // Vérifier d'abord les utilisateurs statiques
    let user = ADMIN_USERS[code];
    
    // Si pas trouvé, vérifier les modérateurs dynamiques
    if (!user) {
        user = dynamicModerators[code];
    }
    
    if (user) {
        localStorage.setItem('adminAuth', code);
        adminCodeInput.value = '';
        errorMessage.style.display = 'none';
        currentUser = user;
        showAdmin();
    } else {
        errorMessage.textContent = 'Code incorrect';
        errorMessage.style.display = 'block';
        adminCodeInput.value = '';
    }
});

// Déconnexion
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminAuth');
    showLogin();
});

// Entrée sur le champ code
adminCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginBtn.click();
    }
});

// Formatage de l'heure
function formatMessageTime(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Ajouter un message dans l'admin
function addMessageToAdmin(messageId, author, content, timestamp) {
    // Vérifier si le message existe déjà
    if (loadedMessageIds.has(messageId)) {
        return;
    }
    loadedMessageIds.add(messageId);

    const messageDiv = document.createElement('div');
    messageDiv.className = 'admin-message';
    messageDiv.dataset.messageId = messageId;
    
    const date = timestamp ? new Date(timestamp) : new Date();
    const time = formatMessageTime(date);
    const isAdmin = author === ADMIN_USERNAME || author.includes('Admin');
    
    messageDiv.innerHTML = `
        <div class="message-header-admin">
            <span class="message-author-admin ${isAdmin ? 'admin-user' : ''}">${author}</span>
            <span class="message-time-admin">${time}</span>
        </div>
        <div class="message-content-admin">${content}</div>
        <button class="delete-btn" data-message-id="${messageId}" title="Supprimer ce message">
            🗑️
        </button>
    `;
    
    chatMessagesAdmin.appendChild(messageDiv);
    chatMessagesAdmin.scrollTop = chatMessagesAdmin.scrollHeight;
}

// Supprimer un message
function deleteMessage(messageId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
        return;
    }
    
    database.ref(`${FIREBASE_MESSAGES_PATH}/${messageId}`).remove()
        .then(() => {
            console.log('✅ Message supprimé:', messageId);
            // Retirer de la liste des messages chargés
            loadedMessageIds.delete(messageId);
            // Retirer du DOM
            const messageEl = chatMessagesAdmin.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                messageEl.remove();
            }
        })
        .catch((error) => {
            console.error('❌ Erreur suppression:', error);
            alert('Erreur lors de la suppression du message');
        });
}

// Supprimer tous les messages
clearAllBtn.addEventListener('click', () => {
    if (!confirm('⚠️ ATTENTION: Supprimer TOUS les messages ? Cette action est irréversible !')) {
        return;
    }
    
    if (!confirm('Êtes-vous vraiment sûr ?')) {
        return;
    }
    
    database.ref(FIREBASE_MESSAGES_PATH).remove()
        .then(() => {
            console.log('✅ Tous les messages supprimés');
            chatMessagesAdmin.innerHTML = '<div class="empty-message">Aucun message</div>';
            loadedMessageIds.clear();
            updateStats();
        })
        .catch((error) => {
            console.error('❌ Erreur suppression:', error);
            alert('Erreur lors de la suppression des messages');
        });
});

// Actualiser
refreshBtn.addEventListener('click', () => {
    chatMessagesAdmin.innerHTML = '<div class="loading-message">Actualisation...</div>';
    loadedMessageIds.clear();
    loadMessages();
});

// Envoyer un message depuis l'admin
adminSendBtn.addEventListener('click', sendAdminMessage);

adminMessage.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        sendAdminMessage();
    }
});

// Compteur de caractères
adminMessage.addEventListener('input', () => {
    const length = adminMessage.value.length;
    charCount.textContent = length;
    if (length > 450) {
        charCount.parentElement.style.color = '#f04747';
    } else {
        charCount.parentElement.style.color = 'rgba(255, 255, 255, 0.6)';
    }
});

function sendAdminMessage() {
    const content = adminMessage.value.trim();
    const username = adminUsername.value.trim() || ADMIN_USERNAME;
    
    if (!content) {
        alert('Veuillez entrer un message');
        return;
    }
    
    if (content.length > 500) {
        alert('Le message est trop long (max 500 caractères)');
        return;
    }
    
    // Écrire dans Firebase
    const messageRef = database.ref(FIREBASE_MESSAGES_PATH).push();
    messageRef.set({
        author: username,
        content: content,
        timestamp: new Date().toISOString(),
        isAdmin: true
    }).then(() => {
        adminMessage.value = '';
        charCount.textContent = '0';
        console.log('✅ Message admin envoyé');
    }).catch((error) => {
        console.error('❌ Erreur envoi:', error);
        alert('Erreur lors de l\'envoi du message');
    });
}

// Connexion à Firebase
function connectToFirebase() {
    try {
        console.log('🔄 Connexion admin à Firebase...');
        
        firebaseStatus.textContent = '🟢 Connecté';
        
        // Écouter les utilisateurs en ligne
        usersRef = database.ref(FIREBASE_USERS_PATH);
        usersRef.on('value', (snapshot) => {
            const users = snapshot.val();
            if (users) {
                const now = new Date().getTime();
                const onlineUsers = Object.values(users).filter(user => {
                    const lastSeen = new Date(user.lastSeen).getTime();
                    return (now - lastSeen) < 120000; // 2 minutes
                });
                adminOnlineCount.textContent = onlineUsers.length;
                onlineUsers.textContent = onlineUsers.length;
                totalUsers.textContent = Object.keys(users).length;
            } else {
                adminOnlineCount.textContent = '0';
                totalUsers.textContent = '0';
            }
        });
        
        // Charger et écouter les messages
        loadMessages();
        listenToNewMessages();
        
        // Charger les modérateurs dynamiques depuis Firebase
        database.ref('admin/moderators').once('value', (snapshot) => {
            const firebaseModerators = snapshot.val() || {};
            // Fusionner avec les modérateurs locaux
            dynamicModerators = { ...dynamicModerators, ...firebaseModerators };
            localStorage.setItem('dynamicModerators', JSON.stringify(dynamicModerators));
        });
        
        console.log('✅ Admin connecté à Firebase');
        
    } catch (error) {
        console.error('❌ Erreur Firebase:', error);
        chatMessagesAdmin.innerHTML = '<div class="error-message">Erreur de connexion à Firebase</div>';
    }
}

// Charger les messages
function loadMessages() {
    messagesRef = database.ref(FIREBASE_MESSAGES_PATH);
    messagesRef.limitToLast(100).once('value', (snapshot) => {
        const messages = snapshot.val();
        chatMessagesAdmin.innerHTML = '';
        loadedMessageIds.clear();
        
        if (messages) {
            // Trier par timestamp
            const sortedMessages = Object.entries(messages)
                .map(([key, msg]) => ({ key, ...msg }))
                .sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return timeA - timeB;
                });
            
            sortedMessages.forEach(msg => {
                if (msg.author && msg.content) {
                    addMessageToAdmin(msg.key, msg.author, msg.content, msg.timestamp);
                }
            });
            
            totalMessages.textContent = sortedMessages.length;
        } else {
            chatMessagesAdmin.innerHTML = '<div class="empty-message">Aucun message</div>';
            totalMessages.textContent = '0';
        }
        
        chatMessagesAdmin.scrollTop = chatMessagesAdmin.scrollHeight;
    });
}

// Écouter les nouveaux messages
function listenToNewMessages() {
    messagesRef.limitToLast(100).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message && message.author && message.content) {
            const messageId = snapshot.key;
            addMessageToAdmin(messageId, message.author, message.content, message.timestamp);
            updateStats();
            lastActivity.textContent = new Date().toLocaleTimeString();
        }
    });
    
    // Écouter les suppressions
    messagesRef.on('child_removed', (snapshot) => {
        const messageId = snapshot.key;
        loadedMessageIds.delete(messageId);
        const messageEl = chatMessagesAdmin.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.remove();
        }
        updateStats();
    });
}

// Mettre à jour les statistiques
function updateStats() {
    // Mettre à jour les utilisateurs en ligne en temps réel
    usersRef.once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            const now = new Date().getTime();
            const onlineUsers = Object.values(users).filter(user => {
                const lastSeen = new Date(user.lastSeen).getTime();
                return (now - lastSeen) < 120000; // 2 minutes
            });
            adminOnlineCount.textContent = onlineUsers.length;
            if (onlineUsers) onlineUsers.textContent = onlineUsers.length;
            if (totalUsers) totalUsers.textContent = Object.keys(users).length;
        } else {
            adminOnlineCount.textContent = '0';
            if (onlineUsers) onlineUsers.textContent = '0';
            if (totalUsers) totalUsers.textContent = '0';
        }
    });

    // Mettre à jour les messages
    messagesRef.once('value', (snapshot) => {
        const messages = snapshot.val();
        const messageCount = messages ? Object.keys(messages).length : 0;
        if (totalMessages) totalMessages.textContent = messageCount;

        // Calculer le taux d'engagement (messages par utilisateur)
        const userCount = parseInt(totalUsers.textContent) || 1;
        const engagement = messageCount / userCount;
        if (engagementRate) engagementRate.textContent = engagement.toFixed(2);

        // Mettre à jour l'uptime
        const uptimeMs = Date.now() - startTime;
        const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        if (uptime) uptime.textContent = `${uptimeHours}h ${uptimeMinutes}m`;

        // Calculer les changements depuis la dernière mise à jour
        const messageChange = messageCount - lastMessageCount;
        const userChange = parseInt(totalUsers.textContent) - lastUserCount;
        const engagementChange = engagement - lastEngagement;

        // Mettre à jour les indicateurs de changement
        if (messagesChange) {
            messagesChange.textContent = messageChange >= 0 ? `+${messageChange}` : messageChange.toString();
            messagesChange.className = `change ${messageChange >= 0 ? 'positive' : 'negative'}`;
        }

        if (usersChange) {
            usersChange.textContent = userChange >= 0 ? `+${userChange}` : userChange.toString();
            usersChange.className = `change ${userChange >= 0 ? 'positive' : 'negative'}`;
        }

        if (engagementChange) {
            engagementChange.textContent = engagementChange >= 0 ? `+${engagementChange.toFixed(2)}` : engagementChange.toFixed(2);
            engagementChange.className = `change ${engagementChange >= 0 ? 'positive' : 'negative'}`;
        }

        // Sauvegarder les valeurs actuelles
        lastMessageCount = messageCount;
        lastUserCount = parseInt(totalUsers.textContent);
        lastEngagement = engagement;
    });

    // Mettre à jour la dernière activité
    if (lastActivity) {
        lastActivity.textContent = new Date().toLocaleTimeString();
    }
}

// Gérer les clics sur les boutons de suppression
chatMessagesAdmin.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
        const btn = e.target.classList.contains('delete-btn') ? e.target : e.target.closest('.delete-btn');
        const messageId = btn.dataset.messageId;
        if (messageId) {
            deleteMessage(messageId);
        }
    }
});

// ============================================
// RADIO / STREAMING VOCAL
// ============================================

// Initialiser les événements radio
function initRadioEvents() {
    if (!startVoiceBtn || !stopVoiceBtn) return;

    // Démarrer la diffusion vocale
    startVoiceBtn.addEventListener('click', async () => {
        try {
            // Demander l'accès au microphone avec qualité APPEL (comme WhatsApp/Telegram)
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    // Paramètres optimisés pour qualité vocale téléphonique (appel)
                    echoCancellation: true, // Essentiel pour éviter l'écho
                    noiseSuppression: true, // Supprime le bruit ambiant
                    autoGainControl: true, // Contrôle automatique du volume (meilleur pour appels)
                    sampleRate: 48000, // 48kHz (qualité maximale - standard Discord)
                    channelCount: 2, // STÉRÉO (comme Discord) - 2 canaux
                    latency: 0.01, // Latence minimale (20ms comme Discord)
                    // Paramètres Google Chrome optimisés pour qualité appel
                    googEchoCancellation: true,
                    googAutoGainControl: true, // Activé pour qualité appel optimale
                    googNoiseSuppression: true,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googNoiseReduction: true,
                    googAudioMirroring: false, // Pas de miroir audio
                    googEchoCancellation2: true, // Version améliorée si disponible
                    googDAEchoCancellation: true, // Double AEC si disponible
                    googAECM: true, // Acoustic Echo Cancellation Mobile
                    googBeamforming: false, // Désactivé pour mono
                    googArrayGeometry: undefined
                } 
            });
            
            // Créer le contexte audio pour l'analyse - QUALITÉ DISCORD (STÉRÉO 48kHz)
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000, // 48kHz qualité maximale (standard Discord)
                latencyHint: 'interactive' // Latence minimale
            });
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(mediaStream);
            
            // S'assurer que l'analyser est en stéréo (2 canaux)
            analyser.channelCount = 2;
            analyser.channelCountMode = 'explicit';
            
            // Augmenter la résolution de l'analyseur pour meilleure qualité
            analyser.fftSize = 2048; // Augmenté de 256 à 2048 pour meilleure résolution
            analyser.smoothingTimeConstant = 0.8; // Lissage pour qualité
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            // Créer des filtres audio professionnels pour QUALITÉ MAXIMALE ET CLARTÉ
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -24; // Seuil plus haut (moins de compression) pour clarté
            compressor.knee.value = 20; // Zone de transition plus large (plus doux)
            compressor.ratio.value = 4; // Ratio plus doux (4:1 au lieu de 6:1) pour préserver la voix
            compressor.attack.value = 0.003; // Attaque plus lente (3ms) pour préserver les transitoires
            compressor.release.value = 0.1; // Relâchement plus lent pour plus de naturel
            
            // High-pass filter pour supprimer les basses (bruit, vent, vibrations)
            const highPassFilter = audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.value = 80; // Fréquence plus basse (80Hz) pour garder plus de chaleur vocale
            highPassFilter.Q.value = 0.7; // Q plus doux pour transition naturelle
            
            // Low-pass filter pour supprimer les hautes fréquences (bruit, sifflements)
            const lowPassFilter = audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.value = 16000; // Garder plus de fréquences (16kHz) pour clarté maximale
            lowPassFilter.Q.value = 0.7; // Q plus doux
            
            // Égaliseur multi-bandes pour CLARTÉ MAXIMALE (moins agressif)
            const eq1 = audioContext.createBiquadFilter(); // Boost fréquences vocales principales
            eq1.type = 'peaking';
            eq1.frequency.value = 2500; // Fréquence centrale de la voix (2.5kHz)
            eq1.gain.value = 2; // Boost plus doux (2dB au lieu de 3dB) pour naturel
            eq1.Q.value = 1.0; // Q plus large pour transition douce
            
            const eq2 = audioContext.createBiquadFilter(); // Réduction des fréquences problématiques
            eq2.type = 'notch';
            eq2.frequency.value = 60; // Supprimer le ronflement 50/60Hz
            eq2.Q.value = 8; // Q un peu moins serré
            
            const eq3 = audioContext.createBiquadFilter(); // Réduction des fréquences aiguës problématiques
            eq3.type = 'peaking';
            eq3.frequency.value = 12000; // Réduire seulement les très hautes fréquences (12kHz)
            eq3.gain.value = -2; // Réduction plus douce (-2dB au lieu de -3dB)
            eq3.Q.value = 1.5; // Q plus large
            
            // Égaliseur supplémentaire pour améliorer les fréquences moyennes
            const eq4 = audioContext.createBiquadFilter();
            eq4.type = 'peaking';
            eq4.frequency.value = 3500; // Boost fréquences moyennes-hautes (3.5kHz) pour clarté
            eq4.gain.value = 1.5; // Boost doux (1.5dB) pour naturel
            eq4.Q.value = 0.8; // Q large
            
            // Ajouter un limiter DOUX pour éviter saturation sans déformer
            const limiter = audioContext.createDynamicsCompressor();
            limiter.threshold.value = -1; // Seuil plus haut (-1dB) pour moins de limitation
            limiter.knee.value = 5; // Zone de transition douce (5dB)
            limiter.ratio.value = 10; // Ratio moins agressif (10:1 au lieu de 20:1)
            limiter.attack.value = 0.001; // Attaque plus lente (1ms) pour préserver les transitoires
            limiter.release.value = 0.05; // Relâchement plus lent (50ms) pour plus de naturel
            
            // Connecter les filtres en chaîne optimisée pour qualité vocale maximale
            microphone.connect(eq2); // D'abord supprimer le ronflement 60Hz
            eq2.connect(highPassFilter); // Ensuite high-pass
            highPassFilter.connect(eq1); // Boost fréquences vocales principales
            eq1.connect(eq4); // Boost fréquences moyennes
            eq4.connect(lowPassFilter); // Low-pass
            lowPassFilter.connect(eq3); // Réduction fréquences aiguës problématiques
            eq3.connect(compressor); // Compression principale
            compressor.connect(limiter); // Limiter dur pour éviter saturation
            limiter.connect(analyser);
            
            // Utiliser MediaRecorder avec Opus pour qualité APPEL (comme WhatsApp/Telegram)
            // Opus est le codec standard des appels vocaux modernes
            const mimeType = 'audio/webm;codecs=opus';
            const supportedMimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4;codecs=opus'
            ];
            
            let selectedMimeType = null;
            for (const type of supportedMimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    console.log(`✅ Codec supporté: ${type}`);
                    break;
                }
            }
            
            // UTILISER PCM16 STÉRÉO 48kHz (PLUS FIABLE QUE OPUS POUR STREAMING FRAGMENTÉ)
            // Opus WebM ne peut pas être joué en fragments individuels, donc on utilise PCM16 stéréo
            console.log('✅ Utilisation de PCM16 STÉRÉO 48kHz (plus fiable pour streaming fragmenté)');
            selectedMimeType = null; // Forcer PCM16 stéréo
            const bufferSize = 8192; // Buffer plus grand (8192 au lieu de 4096) pour meilleure qualité
            scriptProcessor = audioContext.createScriptProcessor(bufferSize, 2, 2); // 2 canaux (stéréo)
            
            if (false) { // Désactivé - Opus ne fonctionne pas avec fragments
                // DÉSACTIVÉ - Opus WebM ne fonctionne pas avec fragments
                // Utiliser MediaRecorder avec Opus STÉRÉO 48kHz (COMME DISCORD)
                // NOTE: Ce code est désactivé car les fragments Opus ne peuvent pas être joués individuellement
                if (false) {
                mediaRecorder = new MediaRecorder(mediaStream, {
                    mimeType: selectedMimeType,
                    audioBitsPerSecond: 128000, // 128 kbps (qualité Discord)
                    numberOfAudioChannels: 2 // 2 canaux (stéréo)
                });
                
                // Buffer pour accumuler les chunks Opus en stream continu
                const opusStreamChunks = [];
                let opusStreamStartTime = Date.now();
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0 && isStreaming) {
                        opusStreamChunks.push(event.data);
                        
                        // Envoyer par paquets (stream continu comme Discord)
                        // Accumuler ~80-100ms de données avant d'envoyer
                        const now = Date.now();
                        const timeSinceLastSend = now - opusStreamStartTime;
                        
                        if (timeSinceLastSend >= 80 || opusStreamChunks.length >= 5) {
                            // Créer un blob combiné pour le stream continu
                            const combinedBlob = new Blob(opusStreamChunks, { type: selectedMimeType });
                            
                            // Convertir le blob en base64
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64Audio = reader.result.split(',')[1];
                                
                                // Envoyer le stream Opus continu à Firebase (comme Discord)
                                const timestamp = Date.now();
                                database.ref(`radio/audioStream/${timestamp}`).set({
                                    data: base64Audio,
                                    timestamp: timestamp,
                                    sampleRate: 48000, // 48kHz (standard Discord)
                                    format: 'opus-stream', // Format stream Opus continu
                                    mimeType: selectedMimeType,
                                    channels: 2, // STÉRÉO (2 canaux)
                                    bufferSize: combinedBlob.size,
                                    duration: timeSinceLastSend / 1000 // Durée en secondes
                                }).then(() => {
                                    chunksSentCount++;
                                    lastSentTime = new Date();
                                    
                                    // Mettre à jour les stats
                                    if (chunksSent) chunksSent.textContent = chunksSentCount;
                                    if (lastSent) {
                                        const timeStr = lastSentTime.toLocaleTimeString();
                                        lastSent.textContent = timeStr;
                                    }
                                    
                                    if (chunksSentCount <= 5 || chunksSentCount % 10 === 0) {
                                        console.log(`✅ Stream Opus STÉRÉO envoyé: ${chunksSentCount}, ${combinedBlob.size} bytes, ${timeSinceLastSend}ms, 48kHz`);
                                    }
                                }).catch((error) => {
                                    console.error('❌ Erreur envoi stream Opus:', error);
                                    voiceStatusText.textContent = '❌ Erreur Firebase - Vérifiez la connexion';
                                });
                            };
                            reader.readAsDataURL(combinedBlob);
                            
                            // Réinitialiser pour le prochain stream
                            opusStreamChunks.length = 0;
                            opusStreamStartTime = now;
                        }
                    }
                };
                
                mediaRecorder.onerror = (event) => {
                    console.error('❌ Erreur MediaRecorder:', event.error);
                    voiceStatusText.textContent = '❌ Erreur enregistrement audio';
                };
                
                // Démarrer l'enregistrement avec intervalles optimisés (80ms pour fluidité Discord)
                mediaRecorder.start(80); // 80ms pour fluidité maximale
                console.log('✅ MediaRecorder démarré avec Opus STÉRÉO 48kHz (comme Discord)');
                console.log(`   Codec: ${selectedMimeType}`);
                console.log(`   Canaux: 2 (STÉRÉO)`);
                console.log(`   Sample Rate: 48kHz`);
                console.log(`   Bitrate: 128 kbps`);
                console.log(`   Intervalle: 80ms (fluidité Discord)`);
                }
            }
            
            // ============================================
            // SYSTÈME DE STREAMING CONTINU (STYLE APPEL)
            // ============================================
            // Au lieu de chunks individuels, on accumule les données dans un buffer continu
            // et on envoie par paquets plus grands pour créer un flux continu
            
            // Buffer continu pour accumuler les données audio - OPTIMISÉ POUR FLUIDITÉ DISCORD
            let continuousAudioBuffer = [];
            let bufferAccumulationTime = 0;
            let lastBufferSendTime = Date.now();
            // Buffers optimisés pour QUALITÉ MAXIMALE (plus grands = meilleure qualité)
            const bufferTargetDuration = 0.12; // 120ms (augmenté de 80ms) pour meilleure qualité
            const bufferMaxWaitTime = 150; // Envoyer au maximum toutes les 150ms (augmenté de 100ms) pour qualité
            const sampleRate = audioContext.sampleRate;
            const samplesPerBuffer = Math.floor(sampleRate * bufferTargetDuration); // ~5760 échantillons à 48kHz (plus grand = meilleure qualité)
            
            // Nettoyer l'ancien timer s'il existe
            if (bufferTimer) {
                clearInterval(bufferTimer);
                bufferTimer = null;
            }
            
            // Timer de sécurité pour forcer l'envoi toutes les 200ms
            bufferTimer = setInterval(() => {
                if (!isStreaming) {
                    if (bufferTimer) {
                        clearInterval(bufferTimer);
                        bufferTimer = null;
                    }
                    return;
                }
                
                const now = Date.now();
                const timeSinceLastSend = now - lastBufferSendTime;
                
                // Forcer l'envoi si ça fait plus de 100ms et qu'on a des données (fluidité Discord)
                if (timeSinceLastSend >= bufferMaxWaitTime && continuousAudioBuffer.length > 0) {
                    if (chunksSentCount < 3) {
                        console.log(`⏰ Timer: Forcer envoi buffer (${continuousAudioBuffer.length} échantillons, ${timeSinceLastSend}ms depuis dernier)`);
                    }
                    sendContinuousBuffer();
                    lastBufferSendTime = now;
                }
            }, 50); // Vérifier toutes les 50ms (au lieu de 100ms) pour fluidité maximale
            
            // Variables pour la normalisation et suppression de bruit - QUALITÉ MAXIMALE ET CLARTÉ
            let noiseGateThreshold = 0.0003; // Seuil plus bas pour capturer plus de voix
            let peakLevel = 0;
            let targetPeak = 0.70; // Niveau cible à 70% pour éviter la distorsion et garder la clarté maximale
            let adaptiveGain = 1.0;
            let maxGain = 2.0; // Gain max à 2.0x pour meilleure clarté sans distorsion
            
            // Fonction pour envoyer le buffer accumulé comme un stream continu
            const sendContinuousBuffer = () => {
                if (!isStreaming) {
                    continuousAudioBuffer = [];
                    bufferAccumulationTime = 0;
                    return;
                }
                
                // Envoyer même si le buffer est petit (pour continuité)
                if (continuousAudioBuffer.length === 0) return;
                
                // Convertir le buffer accumulé STÉRÉO en Int16
                // Le buffer contient des échantillons interleaved: [L, R, L, R, ...]
                const totalSamples = continuousAudioBuffer.length;
                const int16Data = new Int16Array(totalSamples);
                
                for (let i = 0; i < totalSamples; i++) {
                    const s = Math.max(-1, Math.min(1, continuousAudioBuffer[i]));
                    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                // Convertir en base64 de manière optimisée
                const uint8Array = new Uint8Array(int16Data.buffer);
                const timestamp = Date.now();
                
                let base64Audio;
                try {
                    // Conversion optimisée par chunks
                    const chunkSize = 16384; // Chunks plus grands pour meilleure performance
                    let binary = '';
                    
                    for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.slice(i, i + chunkSize);
                        binary += String.fromCharCode.apply(null, chunk);
                    }
                    
                    base64Audio = btoa(binary);
                } catch (btoaError) {
                    console.error('❌ Erreur conversion base64:', btoaError);
                    continuousAudioBuffer = []; // Réinitialiser le buffer en cas d'erreur
                    return;
                }
                
                // Envoyer le buffer via WebSocket (plus fiable que Firebase)
                if (audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN) {
                    try {
                        audioWebSocket.send(JSON.stringify({
                            type: 'audio',
                            data: base64Audio,
                            sampleRate: sampleRate,
                            channels: 2, // STÉRÉO
                            samples: totalSamples,
                            timestamp: timestamp
                        }));
                        
                        chunksSentCount++;
                        lastSentTime = new Date();
                        
                        if (chunksSent) chunksSent.textContent = chunksSentCount;
                        if (lastSent) {
                            const timeStr = lastSentTime.toLocaleTimeString();
                            lastSent.textContent = timeStr;
                        }
                        
                        // Log tous les 10 buffers
                        if (chunksSentCount % 10 === 0) {
                            console.log(`📡 Stream envoyé via WebSocket: ${chunksSentCount}, ${totalSamples} échantillons, ${(totalSamples/sampleRate).toFixed(3)}s`);
                        }
                    } catch (error) {
                        console.error('❌ Erreur envoi WebSocket:', error);
                        // Tentative de reconnexion
                        if (isStreaming) {
                            connectWebSocket();
                        }
                    }
                } else {
                    // WebSocket non connecté, essayer de se connecter
                    if (isStreaming && (!audioWebSocket || audioWebSocket.readyState === WebSocket.CLOSED)) {
                        connectWebSocket();
                    }
                }
                
                // FALLBACK Firebase désactivé - utiliser uniquement WebSocket
                
                // Réinitialiser le buffer
                continuousAudioBuffer = [];
                bufferAccumulationTime = 0;
            };
            
            // ScriptProcessor pour capturer et accumuler les données (FALLBACK STÉRÉO)
            if (scriptProcessor) {
                scriptProcessor.onaudioprocess = (event) => {
                // STÉRÉO : 2 canaux (comme Discord)
                const inputDataLeft = event.inputBuffer.getChannelData(0);
                const inputDataRight = event.inputBuffer.getChannelData(1);
                const outputDataLeft = event.outputBuffer.getChannelData(0);
                const outputDataRight = event.outputBuffer.getChannelData(1);
                
                // Traiter les deux canaux
                const inputData = inputDataLeft; // Utiliser le canal gauche pour l'analyse
                
                // Toujours mettre du silence en output pour éviter l'écho (STÉRÉO)
                for (let i = 0; i < outputDataLeft.length; i++) {
                    outputDataLeft[i] = 0;
                    outputDataRight[i] = 0;
                }
                
                if (!isStreaming) {
                    continuousAudioBuffer = []; // Réinitialiser le buffer
                    return;
                }
                
                // Traitement audio haute qualité STÉRÉO (qualité appel)
                let maxAmplitude = 0;
                
                // 1. Calculer RMS pour détection précise (sur les deux canaux)
                let sumSquares = 0;
                for (let i = 0; i < inputDataLeft.length; i++) {
                    const left = inputDataLeft[i];
                    const right = inputDataRight[i];
                    sumSquares += left * left + right * right;
                    maxAmplitude = Math.max(maxAmplitude, Math.abs(left), Math.abs(right));
                }
                const rms = Math.sqrt(sumSquares / (inputDataLeft.length * 2)); // Diviser par 2 car 2 canaux
                
                // 2. Gain adaptatif pour clarté maximale (moins agressif)
                const targetGain = targetPeak / Math.max(maxAmplitude, 0.1); // Seuil minimum plus haut (0.1)
                adaptiveGain = adaptiveGain * 0.9 + targetGain * 0.1; // Lissage plus rapide pour réactivité
                const gain = Math.min(adaptiveGain, maxGain);
                
                // 3. Traitement audio professionnel STÉRÉO (qualité appel téléphonique)
                const processedDataLeft = new Float32Array(inputDataLeft.length);
                const processedDataRight = new Float32Array(inputDataRight.length);
                
                for (let i = 0; i < inputDataLeft.length; i++) {
                    let sampleLeft = inputDataLeft[i];
                    let sampleRight = inputDataRight[i];
                    
                    // Suppression de bruit très douce (pour clarté)
                    const absValueLeft = Math.abs(sampleLeft);
                    const absValueRight = Math.abs(sampleRight);
                    
                    // Réduction plus douce pour préserver les détails vocaux
                    if (absValueLeft < noiseGateThreshold) {
                        const reduction = Math.pow(absValueLeft / noiseGateThreshold, 2) * 0.5; // Plus doux (^2 au lieu de ^3, 0.5 au lieu de 0.3)
                        sampleLeft *= reduction;
                    }
                    if (absValueRight < noiseGateThreshold) {
                        const reduction = Math.pow(absValueRight / noiseGateThreshold, 2) * 0.5;
                        sampleRight *= reduction;
                    }
                    
                    // Appliquer le gain
                    sampleLeft *= gain;
                    sampleRight *= gain;
                    
                    // Soft limiter très doux pour clarté (seuil plus bas pour éviter distorsion)
                    const softThreshold = 0.85; // Seuil plus bas (85%) pour éviter la distorsion
                    if (sampleLeft > softThreshold) {
                        const excess = sampleLeft - softThreshold;
                        sampleLeft = softThreshold + excess / (1 + excess * 6); // Compression plus douce (x6 au lieu de x4)
                    } else if (sampleLeft < -softThreshold) {
                        const excess = Math.abs(sampleLeft) - softThreshold;
                        sampleLeft = -(softThreshold + excess / (1 + excess * 6));
                    }
                    if (sampleRight > softThreshold) {
                        const excess = sampleRight - softThreshold;
                        sampleRight = softThreshold + excess / (1 + excess * 6);
                    } else if (sampleRight < -softThreshold) {
                        const excess = Math.abs(sampleRight) - softThreshold;
                        sampleRight = -(softThreshold + excess / (1 + excess * 6));
                    }
                    
                    // Hard limiter (sécurité) - limite plus basse pour éviter distorsion
                    const hardLimit = 0.90; // Limite plus basse (90%) pour clarté
                    if (sampleLeft > hardLimit) sampleLeft = hardLimit;
                    else if (sampleLeft < -hardLimit) sampleLeft = -hardLimit;
                    if (sampleRight > hardLimit) sampleRight = hardLimit;
                    else if (sampleRight < -hardLimit) sampleRight = -hardLimit;
                    
                    // Limite finale pour clarté maximale
                    processedDataLeft[i] = Math.max(-0.90, Math.min(0.90, sampleLeft));
                    processedDataRight[i] = Math.max(-0.90, Math.min(0.90, sampleRight));
                }
                
                peakLevel = maxAmplitude * gain;
                
                // ACCUMULER les deux canaux en format interleaved (L, R, L, R, ...)
                for (let i = 0; i < processedDataLeft.length; i++) {
                    continuousAudioBuffer.push(processedDataLeft[i]); // Canal gauche
                    continuousAudioBuffer.push(processedDataRight[i]); // Canal droit
                }
                bufferAccumulationTime += inputDataLeft.length / sampleRate;
                
                const now = Date.now();
                const timeSinceLastSend = now - lastBufferSendTime;
                
                // Envoyer le buffer si (optimisé pour fluidité Discord):
                // 1. On a accumulé assez de données (80ms)
                // 2. OU si ça fait plus de 100ms depuis le dernier envoi (pour continuité maximale)
                // 3. OU si on a au moins 30ms de données et ça fait plus de 80ms (pour fluidité)
                const shouldSend = continuousAudioBuffer.length >= samplesPerBuffer || 
                    (timeSinceLastSend >= bufferMaxWaitTime && continuousAudioBuffer.length > 0) ||
                    (timeSinceLastSend >= 80 && continuousAudioBuffer.length >= Math.floor(sampleRate * 0.03));
                
                if (shouldSend) {
                    sendContinuousBuffer();
                    lastBufferSendTime = now;
                }
                };
            }
            
            // Connecter ScriptProcessor uniquement si utilisé (fallback)
            if (scriptProcessor) {
                // Créer un gainNode complètement silencieux
                const silentGain = audioContext.createGain();
                silentGain.gain.value = 0; // Volume à ZÉRO absolu pour aucun écho
                
                // Créer un dummy analyser pour activer le scriptProcessor sans sortie
                const dummyAnalyser = audioContext.createAnalyser();
                dummyAnalyser.fftSize = 32; // Taille minimale pour économiser ressources
                
                // Connecter le script processor après le limiter (pour capturer l'audio traité)
                limiter.connect(scriptProcessor);
                // Connecter à un analyser dummy puis à un gain silencieux (pour activer sans écho)
                scriptProcessor.connect(dummyAnalyser);
                dummyAnalyser.connect(silentGain);
                silentGain.connect(audioContext.destination); // Connecté mais volume 0 = aucun son
                
                console.log('✅ ScriptProcessor initialisé (fallback PCM)');
            }
            
            // Note: Si MediaRecorder avec Opus est utilisé, les filtres sont gérés automatiquement
            // Les filtres Web Audio sont toujours actifs pour l'analyse du niveau audio
            limiter.connect(analyser);
            
            console.log('✅ Configuration audio optimisée HAUTE QUALITÉ VOCALE:');
            console.log('   - Codec: Opus (128 kbps) - Qualité vocale supérieure');
            console.log('   - Sample rate: 48kHz (qualité professionnelle)');
            console.log('   - Intervalle: 100ms (optimisé pour stabilité)');
            console.log('   - Auto Gain Control: Activé (volume automatique optimal)');
            console.log('   - Echo Cancellation: Double AEC activé');
            console.log('   - Noise Suppression: Activé');
            console.log('   - Filtres audio: Égaliseur multi-bandes actif');
            console.log('   - Écho: COMPLÈTEMENT DÉSACTIVÉ');
            
            // Se connecter au serveur WebSocket
            connectWebSocket();
            
            // Envoyer le statut de diffusion via WebSocket
            if (audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN) {
                audioWebSocket.send(JSON.stringify({
                    type: 'status',
                    isLive: true
                }));
            }
            
            // Mettre à jour l'état dans Firebase (pour compatibilité)
            database.ref(FIREBASE_RADIO_STATUS_PATH).set({
                isLive: true,
                startedAt: new Date().toISOString(),
                sampleRate: audioContext.sampleRate,
                format: 'pcm16',
                codec: 'pcm16',
                bitrate: 768000,
                quality: 'high'
            });
            
            // Afficher les contrôles
            startVoiceBtn.style.display = 'none';
            stopVoiceBtn.style.display = 'inline-flex';
            voiceInfo.style.display = 'block';
            streamStats.style.display = 'block';
            isStreaming = true;
            streamingStatus.textContent = '▶️ En cours';
            chunksSentCount = 0;
            
            // Démarrer l'animation du niveau audio
            updateAudioLevel();
            
            voiceStatusText.textContent = '✅ Diffusion en cours... Votre voix est diffusée en direct !';
            updateRadioStatus(true);
            
            console.log('✅ Diffusion vocale démarrée');
            
        } catch (error) {
            console.error('❌ Erreur accès microphone:', error);
            alert('Erreur: Impossible d\'accéder au microphone. Vérifiez les permissions.');
            voiceStatusText.textContent = '❌ Erreur d\'accès au microphone';
        }
    });

    // Arrêter la diffusion vocale
    stopVoiceBtn.addEventListener('click', () => {
        console.log('⏹️ Arrêt de la diffusion vocale...');
        
        // Arrêter le streaming immédiatement
        isStreaming = false;
        streamingStatus.textContent = '⏸️ Arrêté';
        
        // Envoyer le statut d'arrêt via WebSocket
        if (audioWebSocket && audioWebSocket.readyState === WebSocket.OPEN) {
            try {
                audioWebSocket.send(JSON.stringify({
                    type: 'status',
                    isLive: false
                }));
            } catch (e) {
                console.error('❌ Erreur envoi statut WebSocket:', e);
            }
        }
        
        // Fermer la connexion WebSocket
        if (audioWebSocket) {
            audioWebSocket.close();
            audioWebSocket = null;
        }
        
        // Arrêter le timer de buffer
        if (bufferTimer) {
            clearInterval(bufferTimer);
            bufferTimer = null;
            console.log('✅ Timer de buffer arrêté');
        }
        
        // Arrêter MediaRecorder si actif (Opus)
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try {
                mediaRecorder.stop();
                mediaRecorder = null;
                console.log('✅ MediaRecorder arrêté');
            } catch (e) {
                console.error('❌ Erreur arrêt MediaRecorder:', e);
            }
        }
        
        // Déconnecter le script processor (PCM16)
        if (scriptProcessor) {
            try {
                scriptProcessor.disconnect();
                scriptProcessor.onaudioprocess = null; // Désactiver le handler
                scriptProcessor = null;
                console.log('✅ ScriptProcessor arrêté');
            } catch (e) {
                console.error('❌ Erreur déconnexion scriptProcessor:', e);
            }
        }
        
        // Arrêter le mediaStream
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                track.stop();
                console.log('✅ Piste audio arrêtée:', track.kind);
            });
            mediaStream = null;
        }
        
        // Fermer le contexte audio
        if (audioContext) {
            try {
                audioContext.close().then(() => {
                    console.log('✅ Contexte audio fermé');
                }).catch(e => {
                    console.error('❌ Erreur fermeture contexte:', e);
                });
            } catch (e) {
                console.error('❌ Erreur fermeture contexte:', e);
            }
            audioContext = null;
        }
        
        // Arrêter l'animation
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        // Arrêter les intervalles
        if (streamInterval) {
            clearInterval(streamInterval);
            streamInterval = null;
        }
        
        // Supprimer tous les chunks audio et streams
        database.ref('radio/audioChunks').remove().then(() => {
            console.log('✅ Chunks audio supprimés');
        }).catch(e => {
            console.error('❌ Erreur suppression chunks:', e);
        });
        
        database.ref('radio/audioStream').remove().then(() => {
            console.log('✅ Streams audio supprimés');
        }).catch(e => {
            console.error('❌ Erreur suppression streams:', e);
        });
        
        // Mettre à jour l'état dans Firebase
        database.ref(FIREBASE_RADIO_STATUS_PATH).set({
            isLive: false,
            stoppedAt: new Date().toISOString()
        }).then(() => {
            console.log('✅ Statut Firebase mis à jour (hors ligne)');
        }).catch(e => {
            console.error('❌ Erreur mise à jour statut:', e);
        });
        
        // Masquer les contrôles
        startVoiceBtn.style.display = 'inline-flex';
        stopVoiceBtn.style.display = 'none';
        voiceInfo.style.display = 'none';
        if (streamStats) streamStats.style.display = 'none';
        isStreaming = false; // IMPORTANT: Mettre à false AVANT de masquer les contrôles
        streamingStatus.textContent = '⏸️ Arrêté';
        
        if (audioLevel) {
            audioLevel.style.width = '0%';
        }
        if (voiceStatusText) {
            voiceStatusText.textContent = '⏹️ Diffusion arrêtée';
        }
        updateRadioStatus(false);
        
        console.log('✅ Diffusion vocale arrêtée avec succès');
        
        console.log('⏹️ Diffusion vocale arrêtée');
    });
}

// Mettre à jour le niveau audio
function updateAudioLevel() {
    if (!isStreaming || !analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const percentage = Math.min((average / 255) * 100, 100);
    
    audioLevel.style.width = percentage + '%';
    
    // Couleur selon le niveau
    if (percentage > 70) {
        audioLevel.style.background = '#f04747';
    } else if (percentage > 40) {
        audioLevel.style.background = '#faa61a';
    } else {
        audioLevel.style.background = '#43b581';
    }
    
    animationFrame = requestAnimationFrame(updateAudioLevel);
}

// Mettre à jour le statut radio
function updateRadioStatus(isLive) {
    if (isLive) {
        radioStatusIndicator.style.background = '#43b581';
        radioStatusText.textContent = 'En direct';
    } else {
        radioStatusIndicator.style.background = '#f04747';
        radioStatusText.textContent = 'Hors ligne';
    }
}

// Écouter le statut radio depuis Firebase
function listenToRadioStatus() {
    database.ref(FIREBASE_RADIO_STATUS_PATH).on('value', (snapshot) => {
        const status = snapshot.val();
        if (status) {
            updateRadioStatus(status.isLive);
        } else {
            updateRadioStatus(false);
        }
    });
}

// Compter les auditeurs (ceux qui écoutent le stream)
function countListeners() {
    database.ref('radio/listeners').on('value', (snapshot) => {
        const listeners = snapshot.val();
        if (listeners) {
            listenersCount.textContent = Object.keys(listeners).length;
        } else {
            listenersCount.textContent = '0';
        }
    });
}

// Initialisation Radio
function initRadio() {
    initRadioEvents();
    listenToRadioStatus();
    countListeners();
    initStreamUrlConfig();
}

// Variables pour la diffusion MP3
let mp3StreamInterval = null;
let mp3AudioContext = null;
let mp3AudioBuffer = null;
let mp3IsStreaming = false;
let mp3SourceNode = null;

// Initialiser la configuration de l'URL du stream
function initStreamUrlConfig() {
    const streamUrlInput = document.getElementById('streamUrlInput');
    const saveStreamUrlBtn = document.getElementById('saveStreamUrlBtn');
    const mp3FileInput = document.getElementById('mp3FileInput');
    const startMp3StreamBtn = document.getElementById('startMp3StreamBtn');
    const stopMp3StreamBtn = document.getElementById('stopMp3StreamBtn');
    const mp3StreamStatus = document.getElementById('mp3StreamStatus');
    
    if (!streamUrlInput || !saveStreamUrlBtn) return;
    
    // Charger l'URL actuelle depuis Firebase
    database.ref('radio/streamUrl').once('value', (snapshot) => {
        const url = snapshot.val();
        if (url) {
            streamUrlInput.value = url;
        }
    });
    
    // Enregistrer l'URL
    saveStreamUrlBtn.addEventListener('click', () => {
        const url = streamUrlInput.value.trim();
        
        // VALIDATION : Vérifier que ce n'est pas un fichier local
        if (url && url !== '') {
            // Rejeter les fichiers locaux
            if (url.startsWith('file://') || 
                url.startsWith('C:/') || 
                url.startsWith('C:\\') ||
                url.match(/^[A-Z]:[\\/]/)) {
                alert('❌ Erreur : Les fichiers locaux ne sont pas supportés par les navigateurs pour des raisons de sécurité.\n\nUtilisez une URL HTTP/HTTPS valide (ex: https://example.com/stream.mp3) ou laissez vide pour utiliser le streaming vocal Firebase.');
                console.error('❌ Tentative d\'enregistrement d\'un fichier local:', url);
                return;
            }
            
            // Valider que c'est une URL HTTP/HTTPS valide
            try {
                const urlObj = new URL(url);
                if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                    alert('❌ Erreur : Seules les URLs HTTP/HTTPS sont supportées.\n\nProtocole détecté: ' + urlObj.protocol);
                    console.error('❌ Protocole non supporté:', urlObj.protocol);
                    return;
                }
            } catch (e) {
                alert('❌ Erreur : URL invalide.\n\nFormat attendu: http://example.com/stream.mp3 ou https://example.com/stream.mp3\n\nOu laissez vide pour utiliser le streaming vocal Firebase.');
                console.error('❌ URL invalide:', url);
                return;
            }
        }
        
        database.ref('radio/streamUrl').set(url)
            .then(() => {
                console.log('✅ URL stream enregistrée:', url || '(vide - streaming vocal activé)');
                alert(url ? 'URL du stream enregistrée avec succès !' : 'URL effacée - Le streaming vocal Firebase sera utilisé.');
            })
            .catch((error) => {
                console.error('❌ Erreur enregistrement URL:', error);
                alert('Erreur lors de l\'enregistrement de l\'URL');
            });
    });
    
    // Permettre d'effacer l'URL
    streamUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveStreamUrlBtn.click();
        }
    });
    
    // Diffusion MP3 simple
    if (mp3FileInput && startMp3StreamBtn && stopMp3StreamBtn && mp3StreamStatus) {
        startMp3StreamBtn.addEventListener('click', async () => {
            const file = mp3FileInput.files[0];
            if (!file) {
                alert('Veuillez sélectionner un fichier MP3');
                return;
            }
            
            try {
                mp3StreamStatus.textContent = '⏳ Chargement du fichier...';
                
                // Créer un contexte audio
                mp3AudioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Lire le fichier
                const arrayBuffer = await file.arrayBuffer();
                mp3AudioBuffer = await mp3AudioContext.decodeAudioData(arrayBuffer);
                
                mp3StreamStatus.textContent = '✅ Fichier chargé ! Démarrage de la diffusion...';
                
                // Mettre à jour le statut dans Firebase
                database.ref(FIREBASE_RADIO_STATUS_PATH).set({
                    isLive: true,
                    startedAt: new Date().toISOString(),
                    format: 'mp3-file',
                    filename: file.name
                });
                
                // Démarrer la diffusion (en boucle)
                startMp3StreamLoop();
                
                startMp3StreamBtn.style.display = 'none';
                stopMp3StreamBtn.style.display = 'inline-block';
                mp3StreamStatus.textContent = '✅ Diffusion en cours ! Le fichier joue en boucle sur le site.';
                
            } catch (error) {
                console.error('❌ Erreur chargement MP3:', error);
                mp3StreamStatus.textContent = '❌ Erreur : ' + error.message;
                alert('Erreur lors du chargement du fichier MP3');
            }
        });
        
        stopMp3StreamBtn.addEventListener('click', () => {
            stopMp3Stream();
        });
    }
}

// Démarrer la boucle de diffusion MP3
function startMp3StreamLoop() {
    if (mp3IsStreaming) return;
    mp3IsStreaming = true;
    
    let currentTime = 0;
    const sampleRate = mp3AudioBuffer.sampleRate;
    const chunkDuration = 0.1; // 100ms par chunk
    const chunkSize = Math.floor(sampleRate * chunkDuration);
    
    function sendNextChunk() {
        if (!mp3IsStreaming) return;
        
        const startSample = Math.floor(currentTime * sampleRate);
        const endSample = Math.min(startSample + chunkSize, mp3AudioBuffer.length);
        
        if (startSample >= mp3AudioBuffer.length) {
            // Fin du fichier, recommencer
            currentTime = 0;
            sendNextChunk();
            return;
        }
        
        // Extraire les données audio
        const channelData = mp3AudioBuffer.getChannelData(0);
        const chunkData = channelData.slice(startSample, endSample);
        
        // Convertir en Int16
        const int16Data = new Int16Array(chunkData.length);
        for (let i = 0; i < chunkData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, chunkData[i] * 32768));
        }
        
        // Convertir en base64
        const uint8Array = new Uint8Array(int16Data.buffer);
        let base64Audio = '';
        const chunkSize2 = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize2) {
            const chunk = uint8Array.slice(i, i + chunkSize2);
            base64Audio += String.fromCharCode.apply(null, chunk);
        }
        base64Audio = btoa(base64Audio);
        
        // Envoyer à Firebase
        const timestamp = Date.now();
        database.ref(`radio/audioChunks/${timestamp}`).set({
            data: base64Audio,
            timestamp: timestamp,
            sampleRate: sampleRate,
            format: 'pcm16',
            bufferSize: chunkData.length
        }).catch((error) => {
            console.error('❌ Erreur envoi chunk:', error);
        });
        
        currentTime += chunkDuration;
        
        // Envoyer le prochain chunk
        mp3StreamInterval = setTimeout(sendNextChunk, chunkDuration * 1000);
    }
    
    sendNextChunk();
}

// Arrêter la diffusion MP3
function stopMp3Stream() {
    mp3IsStreaming = false;
    
    if (mp3StreamInterval) {
        clearTimeout(mp3StreamInterval);
        mp3StreamInterval = null;
    }
    
    if (mp3SourceNode) {
        mp3SourceNode.stop();
        mp3SourceNode = null;
    }
    
    if (mp3AudioContext) {
        mp3AudioContext.close();
        mp3AudioContext = null;
    }
    
    // Supprimer les chunks
    database.ref('radio/audioChunks').remove();
    
    // Mettre à jour le statut
    database.ref(FIREBASE_RADIO_STATUS_PATH).set({
        isLive: false,
        stoppedAt: new Date().toISOString()
    });
    
    document.getElementById('startMp3StreamBtn').style.display = 'inline-block';
    document.getElementById('stopMp3StreamBtn').style.display = 'none';
    document.getElementById('mp3StreamStatus').textContent = '⏹️ Diffusion arrêtée';
}

// Initialisation
checkAuth();

// Fonctions pour la gestion des informations de diffusion
function saveBroadcastSchedule() {
    if (!database) {
        alert('❌ Base de données non disponible. Veuillez rafraîchir la page.');
        return;
    }
    
    const scheduleData = {
        day: scheduleDay.value,
        start: scheduleStart.value,
        end: scheduleEnd.value,
        updatedAt: new Date().toISOString()
    };
    
    database.ref(FIREBASE_BROADCAST_INFO_PATH + '/schedule').set(scheduleData)
        .then(() => {
            alert('✅ Horaires de diffusion sauvegardés !');
            loadBroadcastInfo(); // Recharger pour mettre à jour l'affichage
        })
        .catch((error) => {
            console.error('❌ Erreur sauvegarde horaires:', error);
            alert('❌ Erreur lors de la sauvegarde: ' + error.message);
        });
}

function saveContactInfo() {
    if (!database) {
        alert('❌ Base de données non disponible. Veuillez rafraîchir la page.');
        return;
    }
    
    const contactData = {
        email: contactEmail.value,
        website: contactWebsite.value,
        phone: contactPhone.value,
        address: contactAddress.value,
        updatedAt: new Date().toISOString()
    };
    
    database.ref(FIREBASE_BROADCAST_INFO_PATH + '/contact').set(contactData)
        .then(() => {
            alert('✅ Informations de contact sauvegardées !');
            loadBroadcastInfo(); // Recharger pour mettre à jour l'affichage
        })
        .catch((error) => {
            console.error('❌ Erreur sauvegarde contact:', error);
            alert('❌ Erreur lors de la sauvegarde: ' + error.message);
        });
}

function loadBroadcastInfo() {
    // Charger les horaires
    database.ref(FIREBASE_BROADCAST_INFO_PATH + '/schedule').once('value')
        .then((snapshot) => {
            const schedule = snapshot.val();
            if (schedule) {
                scheduleDay.value = schedule.day || 'Tous les jours';
                scheduleStart.value = schedule.start || '14:00';
                scheduleEnd.value = schedule.end || '16:00';
                currentScheduleDay.textContent = schedule.day || 'Tous les jours';
                currentScheduleTime.textContent = formatTime(schedule.start) + ' - ' + formatTime(schedule.end);
            }
        })
        .catch((error) => {
            console.error('❌ Erreur chargement horaires:', error);
        });
    
    // Charger les contacts
    database.ref(FIREBASE_BROADCAST_INFO_PATH + '/contact').once('value')
        .then((snapshot) => {
            const contact = snapshot.val();
            if (contact) {
                contactEmail.value = contact.email || 'contact@fsstudio.com';
                contactWebsite.value = contact.website || 'www.fsstudio.com';
                contactPhone.value = contact.phone || '+33 1 23 45 67 89';
                contactAddress.value = contact.address || '123 Rue de la Radio, 75001 Paris, France';
            }
        })
        .catch((error) => {
            console.error('❌ Erreur chargement contact:', error);
        });
}

function formatTime(timeString) {
    if (!timeString) return '14h00';
    const [hours, minutes] = timeString.split(':');
    return `${hours}h${minutes.padStart(2, '0')}`;
}

