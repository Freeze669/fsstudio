import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, onDisconnect, runTransaction, serverTimestamp, remove } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_kUoMvXWS7c5_NTPOBAzMWvPf6xnZw60",
  authDomain: "fx-control-4f35c.firebaseapp.com",
  databaseURL: "https://fx-control-4f35c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fx-control-4f35c",
  storageBucket: "fx-control-4f35c.firebasestorage.app",
  messagingSenderId: "974303167132",
  appId: "1:974303167132:web:f0263e9f539ec7c13ee359",
  measurementId: "G-1EEMRLZWY9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const ROOM_ID = "public";
const MAX_PLAYERS = 3;
const VOTE_DURATION_MS = 60000;

let currentUid = null;
let currentSlot = null;
let playerName = null;
let playersUnsub = null;
let voteUnsub = null;
let kicksUnsub = null;
let voteTick = null;
let lastSelectedId = null;

const ui = {
  panel: document.getElementById("mp-panel"),
  status: document.getElementById("mp-status"),
  list: document.getElementById("mp-players"),
  vote: document.getElementById("mp-vote"),
  voteInfo: document.getElementById("mp-vote-info"),
  leave: document.getElementById("mp-leave")
};

function setStatus(msg){
  if(ui.status) ui.status.textContent = msg;
}

function showPanel(show){
  if(!ui.panel) return;
  ui.panel.classList.toggle("hidden", !show);
}

function randName(uid){
  return "Joueur-" + uid.slice(0,4).toUpperCase();
}

async function claimSlot(uid){
  for(let i=0;i<MAX_PLAYERS;i++){
    const slotRef = ref(db, `rooms/${ROOM_ID}/slots/${i}`);
    const res = await runTransaction(slotRef, (curr)=>{
      if(curr === null) return uid;
      return; // abort
    }, {applyLocally:false});
    if(res.committed){
      return i;
    }
  }
  return null;
}

function releaseSlot(uid, slot){
  if(slot === null || slot === undefined) return;
  const slotRef = ref(db, `rooms/${ROOM_ID}/slots/${slot}`);
  // Only clear if still ours
  runTransaction(slotRef, (curr)=>{
    if(curr === uid) return null;
    return curr;
  }, {applyLocally:false}).catch(()=>{});
}

async function joinRoom(){
  setStatus("Connexion...");
  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;
  currentUid = uid;
  window.__mp_uid = uid;
  playerName = localStorage.getItem("fx_player_name") || randName(uid);

  const slot = await claimSlot(uid);
  if(slot === null){
    setStatus("Serveur plein (3 joueurs max)");
    await signOut(auth).catch(()=>{});
    currentUid = null;
    return false;
  }
  currentSlot = slot;

  const playerRef = ref(db, `rooms/${ROOM_ID}/players/${uid}`);
  await set(playerRef, {
    name: playerName,
    slot: slot,
    selected: null,
    joinedAt: serverTimestamp()
  });

  onDisconnect(playerRef).remove();
  const slotRef = ref(db, `rooms/${ROOM_ID}/slots/${slot}`);
  onDisconnect(slotRef).set(null);

  setStatus(`Connecté (${playerName})`);
  return true;
}

async function leaveRoom(){
  if(currentUid){
    const playerRef = ref(db, `rooms/${ROOM_ID}/players/${currentUid}`);
    await remove(playerRef).catch(()=>{});
    releaseSlot(currentUid, currentSlot);
  }
  if(auth.currentUser){
    await signOut(auth).catch(()=>{});
  }
  cleanupListeners();
  currentUid = null;
  currentSlot = null;
  window.__mp_uid = null;
  showPanel(false);
}

function cleanupListeners(){
  if(playersUnsub){ playersUnsub(); playersUnsub = null; }
  if(voteUnsub){ voteUnsub(); voteUnsub = null; }
  if(kicksUnsub){ kicksUnsub(); kicksUnsub = null; }
  if(voteTick){ clearInterval(voteTick); voteTick = null; }
}

function renderPlayers(players){
  if(!ui.list) return;
  ui.list.innerHTML = "";
  const entries = Object.entries(players || {});
  entries.sort((a,b)=> (a[1]?.slot ?? 99) - (b[1]?.slot ?? 99));
  for(const [uid, p] of entries){
    const row = document.createElement("div");
    row.className = "mp-player";
    const name = document.createElement("span");
    name.textContent = p?.name || "Joueur";
    row.appendChild(name);

    if(uid !== currentUid){
      const btn = document.createElement("button");
      btn.className = "btn-small";
      btn.textContent = "Vote kick";
      btn.addEventListener("click", ()=> startVoteKick(uid, p?.name || "Joueur"));
      row.appendChild(btn);
    } else {
      const me = document.createElement("span");
      me.className = "mp-you";
      me.textContent = "(toi)";
      row.appendChild(me);
    }
    ui.list.appendChild(row);
  }
}

async function setSelected(id){
  if(!currentUid) return;
  if(lastSelectedId === id) return;
  lastSelectedId = id;
  const selRef = ref(db, `rooms/${ROOM_ID}/players/${currentUid}/selected`);
  await set(selRef, id || null).catch(()=>{});
}

async function clearSelected(){
  return setSelected(null);
}

async function startVoteKick(targetUid, targetName){
  if(!currentUid) return;
  const voteRef = ref(db, `rooms/${ROOM_ID}/voteKick`);
  const now = Date.now();
  await set(voteRef, {
    targetUid,
    targetName,
    startedAt: now,
    expiresAt: now + VOTE_DURATION_MS,
    votes: {
      [currentUid]: true
    }
  });
}

async function castVote(){
  if(!currentUid) return;
  const voteRef = ref(db, `rooms/${ROOM_ID}/voteKick/votes/${currentUid}`);
  await set(voteRef, true);
}

function attachVoteListener(){
  const voteRef = ref(db, `rooms/${ROOM_ID}/voteKick`);
  voteUnsub = onValue(voteRef, (snap)=>{
    const vote = snap.val();
    if(!vote){
      if(ui.voteInfo) ui.voteInfo.textContent = "Aucun vote en cours";
      if(ui.vote) ui.vote.classList.add("hidden");
      if(voteTick){ clearInterval(voteTick); voteTick=null; }
      return;
    }

    const now = Date.now();
    const remaining = Math.max(0, vote.expiresAt - now);
    if(ui.voteInfo){
      ui.voteInfo.textContent = `Vote kick: ${vote.targetName || "Joueur"} (${Math.ceil(remaining/1000)}s)`;
    }

    if(ui.vote){
      ui.vote.classList.remove("hidden");
      ui.vote.onclick = castVote;
    }

    if(!voteTick){
      voteTick = setInterval(()=>{
        const now2 = Date.now();
        const rem2 = Math.max(0, vote.expiresAt - now2);
        if(ui.voteInfo){
          ui.voteInfo.textContent = `Vote kick: ${vote.targetName || "Joueur"} (${Math.ceil(rem2/1000)}s)`;
        }
        if(rem2 <= 0){
          clearInterval(voteTick); voteTick = null;
        }
      }, 500);
    }

    // If vote expired, clear it (any client can)
    if(now > vote.expiresAt){
      remove(voteRef).catch(()=>{});
      return;
    }

    // Check unanimity
    const players = window.__mp_players || {};
    const eligible = Object.keys(players).filter(uid => uid !== vote.targetUid);
    const votes = vote.votes ? Object.keys(vote.votes) : [];
    const unanimous = eligible.length > 0 && eligible.every(uid => votes.includes(uid));

    if(unanimous){
      const kickRef = ref(db, `rooms/${ROOM_ID}/kicks/${vote.targetUid}`);
      set(kickRef, {by: "vote", at: serverTimestamp()}).catch(()=>{});
      remove(voteRef).catch(()=>{});
    }
  });
}

function attachPlayersListener(){
  const playersRef = ref(db, `rooms/${ROOM_ID}/players`);
  playersUnsub = onValue(playersRef, (snap)=>{
    const players = snap.val() || {};
    window.__mp_players = players;
    renderPlayers(players);
  });
}

function attachKicksListener(){
  const kickRef = ref(db, `rooms/${ROOM_ID}/kicks/${currentUid}`);
  kicksUnsub = onValue(kickRef, (snap)=>{
    if(!snap.exists()) return;
    setStatus("Vous avez été expulsé");
    leaveRoom();
  });
}

async function start(){
  showPanel(true);
  const ok = await joinRoom();
  if(!ok){
    showPanel(false);
    return;
  }
  attachPlayersListener();
  attachVoteListener();
  attachKicksListener();
}

function init(){
  if(ui.leave) ui.leave.addEventListener("click", leaveRoom);
  onAuthStateChanged(auth, (user)=>{
    if(!user){
      currentUid = null;
      currentSlot = null;
    }
  });
}

init();

window.MP = { start, leave: leaveRoom, setSelected, clearSelected };

