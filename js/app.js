/* Enhanced app: icons (SVG data), airports, enemies, fighters, loading overlay, improved selection */
const canvas = document.getElementById('radar');
const ctx = canvas.getContext('2d');
// status helper shown in HUD and console
const _statusEl = document.getElementById && document.getElementById('info');
function setStatus(msg){ try{ if(_statusEl) _statusEl.textContent = msg; }catch(e){} console.log('[MiniATC] '+msg); }
setStatus('Initialisation...');
window.addEventListener('error', ev=>{ console.error(ev.error||ev.message); try{ if(_statusEl) _statusEl.textContent = 'Erreur: '+(ev.error?.message||ev.message); }catch(e){} }); 
window.addEventListener('unhandledrejection', ev=>{ console.error('UnhandledRejection', ev.reason); try{ if(_statusEl) _statusEl.textContent = 'Erreur promise: '+(ev.reason?.message||String(ev.reason)); }catch(e){} });

// Notification system
let notificationsEnabled = true;
const notificationHistory = new Map();
const NOTIF_MIN_GAP_MS = 4000;
const NOTIF_MAX_VISIBLE = 4;
function clearNotifications(){
  const notifEl = document.getElementById('notifications');
  if(notifEl) notifEl.innerHTML = '';
  notificationHistory.clear();
}
function showNotification(message, type='info', duration=5000, force=false){
  if(!notificationsEnabled && !force) return;
  const notifEl = document.getElementById('notifications');
  if(!notifEl) return;

  const key = type + '|' + message;
  const now = Date.now();
  const last = notificationHistory.get(key) || 0;
  if(!force && now - last < NOTIF_MIN_GAP_MS) return;
  notificationHistory.set(key, now);

  const visible = notifEl.querySelectorAll('.notification');
  if(visible.length >= NOTIF_MAX_VISIBLE && visible[0]){
    visible[0].remove();
  }

  const notif = document.createElement('div');
  notif.className = 'notification ' + type;
  notif.textContent = message;
  notifEl.appendChild(notif);
  setTimeout(()=>{
    notif.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(()=>notif.remove(), 300);
  }, duration);
}
// camera for pan (world coordinates) - declared early so resize() can use it
const cam = {x:0,y:0,zoom:0.72}; // Base zoom (user-adjustable)
let isPanning = false, panLast = null;
let W, H, cx, cy;
// Radio system
let radioFreq = 121.500; // MHz
const RADIO_BASE = 118.000, RADIO_MAX = 136.975, RADIO_STEP = 0.025;
const RADIO_STEPS = Math.round((RADIO_MAX - RADIO_BASE)/RADIO_STEP);
function formatFreq(f){ return f.toFixed(3); }
function toTicks(f){ return Math.min(RADIO_STEPS, Math.max(0, Math.round((f - RADIO_BASE)/RADIO_STEP))); }
function fromTicks(t){ return Number((RADIO_BASE + t*RADIO_STEP).toFixed(3)); }
function setRadioFromTicks(t){ const f = fromTicks(t); radioFreq = f; const el = document.getElementById('radio-freq'); if(el) el.textContent = formatFreq(f); updateRadioLink(); }
function setRadio(f){ setRadioFromTicks(toTicks(f)); }
function stepRadio(delta){ setRadioFromTicks(toTicks(radioFreq) + delta); }
function randomFreq(){ const i = Math.floor(Math.random()*(RADIO_STEPS+1)); return fromTicks(i); }
function updateRadioLink(){ const sel = entities.find(e=>e.selected); const linkEl = document.getElementById('radio-link'); if(!linkEl){return;} if(sel && Math.abs((sel.freq||0)-radioFreq)<1e-6){ linkEl.textContent='SYNC'; linkEl.style.color='#2dd4bf'; } else { linkEl.textContent='NO LINK'; linkEl.style.color='rgba(230,242,255,0.7)'; } }
function sameFrequencyValue(p, freq){ return p && Math.abs((p.freq||0)-(freq||0))<1e-6; }
let _miniatc_loop_started = false;
let mpMode = 'local';
let mpIsHost = false;
let gamePaused = true; // Jeu en pause tant que le menu serveur est affiché
function safeLocalStorageGet(key){
  try{ return window.localStorage.getItem(key); }catch(e){ return null; }
}
const DISCORD_WEBHOOK_URL = (
  window.DISCORD_WEBHOOK_URL ||
  safeLocalStorageGet('fx_discord_webhook') ||
  'https://discord.com/api/webhooks/1472984817330159736/ymoLT0fHNW97mtYqf-Pr-fsIUBi1YSnRpmCrjpQ8DdYKcHPC3MptSdl8w4IH-YNJcO2z'
).trim();
let discordSessionSent = false;
let playElapsedMs = 0;
let followSelected = false;
let followedEntityId = null;

function formatElapsedTime(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if(h > 0) return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updatePlayTimeHud(){
  const el = document.getElementById('session-time');
  if(!el) return;
  el.textContent = 'Temps: ' + formatElapsedTime(playElapsedMs);
}

function updateFollowCamera(){
  if(!followSelected || !followedEntityId) return;
  const target = entities.find(e => e.id === followedEntityId && !e._crashed);
  if(!target){
    followSelected = false;
    followedEntityId = null;
    return;
  }
  const desiredX = (target.x - cx) * cam.zoom;
  const desiredY = (target.y - cy) * cam.zoom;
  cam.x += (desiredX - cam.x) * 0.14;
  cam.y += (desiredY - cam.y) * 0.14;
}

function cancelCameraFollow(){
  followSelected = false;
  followedEntityId = null;
}

async function sendDiscordPlayNotification(){
  if(!DISCORD_WEBHOOK_URL || discordSessionSent) return;
  discordSessionSent = true;
  try{
    const nowIso = new Date().toISOString();
    const payload = {
      username: 'FX CONTROL',
      content: 'Un joueur vient de lancer une partie.',
      embeds: [{
        title: 'Session en direct',
        color: 2277396,
        fields: [
          {name: 'Heure UTC', value: nowIso, inline: true},
          {name: 'Plateforme', value: navigator.userAgent.slice(0, 180), inline: false}
        ]
      }]
    };
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      discordSessionSent = false;
      console.warn('Discord webhook error', res.status);
    }
  }catch(err){
    discordSessionSent = false;
    console.warn('Discord webhook failed', err);
  }
}
function startMainLoop(){ if(!_miniatc_loop_started){ _miniatc_loop_started = true; try{ setStatus('Démarrage boucle'); hideLoading(); requestAnimationFrame(loop); setStatus(''); }catch(e){ console.error(e); setStatus('Erreur au démarrage: '+(e.message||e)); } } }
function resize(){
  const dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth = canvas.offsetWidth;
  H = canvas.clientHeight = canvas.offsetHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  cx = W/2; cy = H/2;
  // center camera on world center by default (if camera exists)
  if(typeof cam !== 'undefined'){ cam.x = cx - W/2; cam.y = cy - H/2; }
  // recompute airports/zones based on new center
  initAirports(); initZonesAndRoutes();
  initClouds();
  clampCamera();
}

function getMapSize(){
  const mapW = Math.max(W,H) * MAP_SCALE;
  const mapH = mapW * MAP_ASPECT;
  return {mapW, mapH};
}

function latLonToWorld(lat, lon){
  const {mapW, mapH} = getMapSize();
  const lonClamped = Math.max(MAP_LON_MIN, Math.min(MAP_LON_MAX, lon));
  const latClamped = Math.max(MAP_LAT_MIN, Math.min(MAP_LAT_MAX, lat));
  const lonRange = MAP_LON_MAX - MAP_LON_MIN;
  const latRange = MAP_LAT_MAX - MAP_LAT_MIN;
  const nx = (lonClamped - MAP_LON_MIN) / lonRange;
  const ny = (MAP_LAT_MAX - latClamped) / latRange;
  const x = cx - mapW/2 + nx * mapW;
  const y = cy - mapH/2 + ny * mapH;
  return {x, y};
}

function clampCamera(){
  if(!W || !H) return;
  const {mapW, mapH} = getMapSize();
  const left = cx - mapW/2;
  const right = cx + mapW/2;
  const top = cy - mapH/2;
  const bottom = cy + mapH/2;

  const minCamX = (left - cx) * cam.zoom + cx;
  const maxCamX = (right - cx) * cam.zoom - W + cx;
  if(minCamX > maxCamX){
    cam.x = cx - W/2;
  } else {
    cam.x = Math.min(maxCamX, Math.max(minCamX, cam.x));
  }

  const minCamY = (top - cy) * cam.zoom + cy;
  const maxCamY = (bottom - cy) * cam.zoom - H + cy;
  if(minCamY > maxCamY){
    cam.y = cy - H/2;
  } else {
    cam.y = Math.min(maxCamY, Math.max(minCamY, cam.y));
  }
}

const entities = []; // planes, fighters, enemies
const airports = [];
let showTrajectory = true;
let showRadarZones = true;
let last = performance.now();
function rand(min,max){return Math.random()*(max-min)+min}
function callsign(){const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ";return chars[Math.floor(Math.random()*chars.length)]+chars[Math.floor(Math.random()*chars.length)]+Math.floor(rand(10,999)).toString();}

// SVG icon data URLs - Realistic white aircraft logos
function svgDataURL(svg){ return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg); }

// Realistic aircraft silhouettes in white
const svgPlane = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><path fill="%23ffffff" d="M5 15 L20 8 L75 8 L90 15 L75 22 L20 22 Z M20 10 L70 10 L85 15 L70 20 L20 20 Z M25 12 L30 12 L30 18 L25 18 Z M35 12 L40 12 L40 18 L35 18 Z"/><circle cx="15" cy="15" r="2" fill="%23ffffff"/><circle cx="85" cy="15" r="2" fill="%23ffffff"/></svg>');
const svgFighter = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><path fill="%23ff4444" d="M10 15 L25 5 L70 5 L85 15 L70 25 L25 25 Z M25 8 L65 8 L80 15 L65 22 L25 22 Z M30 10 L35 10 L35 20 L30 20 Z M40 10 L45 10 L45 20 L40 20 Z"/><circle cx="20" cy="15" r="2" fill="%23ff4444"/><circle cx="80" cy="15" r="2" fill="%23ff4444"/></svg>');
const svgRafale = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 34"><path fill="%233da9fc" d="M12 17 L32 7 L84 7 L106 17 L84 27 L32 27 Z M32 10 L80 10 L100 17 L80 24 L32 24 Z M40 12 L46 12 L46 22 L40 22 Z M52 12 L58 12 L58 22 L52 22 Z"/><path fill="%23dbeafe" d="M24 17 L34 12 L34 22 Z M92 14 L102 17 L92 20 Z"/><circle cx="18" cy="17" r="2" fill="%233da9fc"/><circle cx="106" cy="17" r="2" fill="%233da9fc"/></svg>');
const svgEnemy = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ff2d55" stroke="%23ffffff" stroke-width="3"/><path fill="%23ffffff" d="M30 50 L50 30 L70 50 L50 70 Z"/></svg>');
const svgAirport = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="4" rx="1" fill="%232dd4bf"/></svg>');

// Realistic model-specific aircraft in white
const svgA320 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path fill="%23ffffff" d="M10 20 L25 12 L85 12 L100 20 L85 28 L25 28 Z M25 14 L80 14 L95 20 L80 26 L25 26 Z M30 16 L35 16 L35 24 L30 24 Z M40 16 L45 16 L45 24 L40 24 Z M50 16 L55 16 L55 24 L50 24 Z M60 16 L65 16 L65 24 L60 24 Z M70 16 L75 16 L75 24 L70 24 Z"/><circle cx="20" cy="20" r="2.5" fill="%23ffffff"/><circle cx="100" cy="20" r="2.5" fill="%23ffffff"/></svg>');
const svgB737 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path fill="%23ffffff" d="M8 20 L22 11 L88 11 L102 20 L88 29 L22 29 Z M22 13 L85 13 L99 20 L85 27 L22 27 Z M28 15 L32 15 L32 25 L28 25 Z M38 15 L42 15 L42 25 L38 25 Z M48 15 L52 15 L52 25 L48 25 Z M58 15 L62 15 L62 25 L58 25 Z M68 15 L72 15 L72 25 L68 25 Z M78 15 L82 15 L82 25 L78 25 Z"/><circle cx="18" cy="20" r="2.5" fill="%23ffffff"/><circle cx="102" cy="20" r="2.5" fill="%23ffffff"/></svg>');
const svgE195 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 35"><path fill="%23ffffff" d="M8 17.5 L20 10 L70 10 L82 17.5 L70 25 L20 25 Z M20 12 L68 12 L80 17.5 L68 23 L20 23 Z M25 14 L30 14 L30 21 L25 21 Z M35 14 L40 14 L40 21 L35 21 Z M45 14 L50 14 L50 21 L45 21 Z M55 14 L60 14 L60 21 L55 21 Z"/><circle cx="15" cy="17.5" r="2" fill="%23ffffff"/><circle cx="85" cy="17.5" r="2" fill="%23ffffff"/></svg>');
const svgA321 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 40"><path fill="%23ffffff" d="M10 20 L26 11 L94 11 L110 20 L94 29 L26 29 Z M26 13 L90 13 L106 20 L90 27 L26 27 Z M32 15 L37 15 L37 25 L32 25 Z M42 15 L47 15 L47 25 L42 25 Z M52 15 L57 15 L57 25 L52 25 Z M62 15 L67 15 L67 25 L62 25 Z M72 15 L77 15 L77 25 L72 25 Z M82 15 L87 15 L87 25 L82 25 Z"/><circle cx="20" cy="20" r="2.5" fill="%23ffffff"/><circle cx="110" cy="20" r="2.5" fill="%23ffffff"/></svg>');
// Transport/Cargo planes
const svgCargo = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 45"><path fill="%23ffffff" d="M8 22.5 L22 10 L88 10 L102 22.5 L88 35 L22 35 Z M22 13 L85 13 L99 22.5 L85 32 L22 32 Z M28 16 L32 16 L32 29 L28 29 Z M38 16 L42 16 L42 29 L38 29 Z M48 16 L52 16 L52 29 L48 29 Z M58 16 L62 16 L62 29 L58 29 Z M68 16 L72 16 L72 29 L68 29 Z M78 16 L82 16 L82 29 L78 29 Z"/><circle cx="18" cy="22.5" r="2.5" fill="%23ffffff"/><circle cx="102" cy="22.5" r="2.5" fill="%23ffffff"/></svg>');
const svgA330 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 45"><path fill="%23ffffff" d="M10 22.5 L28 10 L102 10 L120 22.5 L102 35 L28 35 Z M28 13 L98 13 L116 22.5 L98 32 L28 32 Z M34 16 L39 16 L39 29 L34 29 Z M44 16 L49 16 L49 29 L44 29 Z M54 16 L59 16 L59 29 L54 29 Z M64 16 L69 16 L69 29 L64 29 Z M74 16 L79 16 L79 29 L74 29 Z M84 16 L89 16 L89 29 L84 29 Z"/><circle cx="22" cy="22.5" r="3" fill="%23ffffff"/><circle cx="118" cy="22.5" r="3" fill="%23ffffff"/></svg>');
const svgB777 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 45"><path fill="%23ffffff" d="M10 22.5 L30 9 L110 9 L130 22.5 L110 36 L30 36 Z M30 12 L108 12 L128 22.5 L108 33 L30 33 Z M36 15 L42 15 L42 30 L36 30 Z M48 15 L54 15 L54 30 L48 30 Z M60 15 L66 15 L66 30 L60 30 Z M72 15 L78 15 L78 30 L72 30 Z M84 15 L90 15 L90 30 L84 30 Z M96 15 L102 15 L102 30 L96 30 Z"/><circle cx="24" cy="22.5" r="3" fill="%23ffffff"/><circle cx="126" cy="22.5" r="3" fill="%23ffffff"/></svg>');

// New aircraft SVGs
const svgA350 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 46"><path fill="%23ffffff" d="M12 23 L32 10 L120 10 L146 23 L120 36 L32 36 Z M32 12 L116 12 L142 23 L116 34 L32 34 Z M38 15 L44 15 L44 31 L38 31 Z M50 15 L56 15 L56 31 L50 31 Z M62 15 L68 15 L68 31 L62 31 Z M74 15 L80 15 L80 31 L74 31 Z M86 15 L92 15 L92 31 L86 31 Z M98 15 L104 15 L104 31 L98 31 Z"/><circle cx="26" cy="23" r="3" fill="%23ffffff"/><circle cx="150" cy="23" r="3" fill="%23ffffff"/></svg>');
const svgB787 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 155 44"><path fill="%23ffffff" d="M10 22 L30 10 L116 10 L140 22 L116 34 L30 34 Z M30 12 L112 12 L136 22 L112 32 L30 32 Z M36 14 L42 14 L42 30 L36 30 Z M48 14 L54 14 L54 30 L48 30 Z M60 14 L66 14 L66 30 L60 30 Z M72 14 L78 14 L78 30 L72 30 Z M84 14 L90 14 L90 30 L84 30 Z M96 14 L102 14 L102 30 L96 30 Z"/><circle cx="24" cy="22" r="3" fill="%23ffffff"/><circle cx="144" cy="22" r="3" fill="%23ffffff"/></svg>');
const svgB747 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 165 48"><path fill="%23ffffff" d="M12 24 L34 11 L126 11 L152 24 L126 37 L34 37 Z M34 13 L122 13 L148 24 L122 35 L34 35 Z M40 16 L46 16 L46 32 L40 32 Z M52 16 L58 16 L58 32 L52 32 Z M64 16 L70 16 L70 32 L64 32 Z M76 16 L82 16 L82 32 L76 32 Z M88 16 L94 16 L94 32 L88 32 Z M100 16 L106 16 L106 32 L100 32 Z"/><circle cx="28" cy="24" r="3" fill="%23ffffff"/><circle cx="156" cy="24" r="3" fill="%23ffffff"/></svg>');
const svgATR72 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 38"><path fill="%23ffffff" d="M10 19 L24 12 L80 12 L94 19 L80 26 L24 26 Z M24 14 L78 14 L92 19 L78 24 L24 24 Z"/><rect x="32" y="9" width="4" height="6" fill="%23ffffff"/><rect x="32" y="23" width="4" height="6" fill="%23ffffff"/><rect x="62" y="9" width="4" height="6" fill="%23ffffff"/><rect x="62" y="23" width="4" height="6" fill="%23ffffff"/><circle cx="18" cy="19" r="2" fill="%23ffffff"/><circle cx="98" cy="19" r="2" fill="%23ffffff"/></svg>');
const svgC172 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 30"><path fill="%23ffffff" d="M8 15 L18 10 L56 10 L66 15 L56 20 L18 20 Z M18 12 L54 12 L64 15 L54 18 L18 18 Z"/><rect x="30" y="8" width="20" height="2" fill="%23ffffff"/><rect x="30" y="20" width="20" height="2" fill="%23ffffff"/><circle cx="14" cy="15" r="2" fill="%23ffffff"/><circle cx="70" cy="15" r="2" fill="%23ffffff"/></svg>');

const imgPlane = new Image(); imgPlane.src = svgPlane;
const imgFighter = new Image(); imgFighter.src = svgFighter;
const imgRafale = new Image(); imgRafale.src = svgRafale;
const imgEnemy = new Image(); imgEnemy.src = svgEnemy;
const imgAirport = new Image(); imgAirport.src = svgAirport;
const imgCargo = new Image(); imgCargo.src = svgCargo;
const imgA320 = new Image(); imgA320.src = svgA320;
const imgB737 = new Image(); imgB737.src = svgB737;
const imgE195 = new Image(); imgE195.src = svgE195;
const imgA321 = new Image(); imgA321.src = svgA321;
const imgA330 = new Image(); imgA330.src = svgA330;
const imgB777 = new Image(); imgB777.src = svgB777;
const imgA350 = new Image(); imgA350.src = svgA350;
const imgB787 = new Image(); imgB787.src = svgB787;
const imgB747 = new Image(); imgB747.src = svgB747;
const imgATR72 = new Image(); imgATR72.src = svgATR72;
const imgC172 = new Image(); imgC172.src = svgC172;

const aircraftImageByModel = {
  'A320': imgA320,
  'B737': imgB737,
  'E195': imgE195,
  'A321': imgA321,
  'A330': imgA330,
  'B777': imgB777,
  'A350': imgA350,
  'B787': imgB787,
  'B747': imgB747,
  'ATR72': imgATR72,
  'C172': imgC172,
  'A330F': imgA330,
  'B777F': imgB777,
  'Cargo': imgCargo,
  'KC-135': imgCargo,
  'F-16': imgFighter,
  'Rafale': imgRafale,
  'Unknown': imgEnemy
};

const aircraftVisualProfile = {
  'A320': {w: 34, h: 16},
  'B737': {w: 35, h: 16},
  'E195': {w: 31, h: 15},
  'A321': {w: 38, h: 16},
  'A330': {w: 44, h: 19},
  'B777': {w: 48, h: 20},
  'A350': {w: 50, h: 21},
  'B787': {w: 47, h: 20},
  'B747': {w: 54, h: 22},
  'ATR72': {w: 30, h: 15},
  'C172': {w: 24, h: 12},
  'A330F': {w: 45, h: 19},
  'B777F': {w: 50, h: 21},
  'Cargo': {w: 38, h: 17},
  'KC-135': {w: 42, h: 18},
  'F-16': {w: 30, h: 14},
  'Rafale': {w: 32, h: 14},
  'Unknown': {w: 24, h: 24}
};

function getAircraftRenderInfo(p){
  if(!p) return {img: imgPlane, w: 30, h: 14};
  if(p.type === 'enemy') return {img: imgEnemy, w: 24, h: 24};
  const profile = aircraftVisualProfile[p.model] || (
    p.type === 'fighter' ? {w: 30, h: 14} :
    p.type === 'tanker' ? {w: 42, h: 18} :
    p.type === 'cargo' || p.type === 'transport' ? {w: 38, h: 17} :
    {w: 34, h: 16}
  );
  const img = aircraftImageByModel[p.model] || (
    p.type === 'fighter' ? imgFighter :
    p.type === 'tanker' ? imgCargo :
    p.type === 'cargo' || p.type === 'transport' ? imgCargo :
    imgPlane
  );
  return {img, w: profile.w, h: profile.h};
}

function getAircraftSelectRadius(p){
  const info = getAircraftRenderInfo(p);
  return Math.max(18, Math.max(info.w, info.h) * 0.65);
}

function getAircraftRadarColor(p){
  if(!p) return '#ffffff';
  if(p.selected) return '#ffe56b';
  if(p.type === 'enemy') return '#ff8a65';
  return '#ffd21f';
}

function getAircraftRadarBadge(p){
  if(!p) return null;
  if(p.type === 'enemy') return {text:'!', bg:'#ff4d5a', fg:'#ffffff'};
  if(p.type === 'fighter') return {text:'F', bg:'#3da9fc', fg:'#ffffff'};
  if(p.type === 'tanker') return {text:'T', bg:'#14b8a6', fg:'#ffffff'};
  if(p.type === 'cargo' || p.type === 'transport') return {text:'C', bg:'#475569', fg:'#f8fafc'};
  return {text:'A', bg:'#0f172a', fg:'#ffe56b'};
}

function drawAircraftGlyph(p, x, y, w, h){
  const color = getAircraftRadarColor(p);
  const hdg = Number.isFinite(p?.hdg) ? p.hdg : 0;
  const bodyLen = Math.max(14, w * 0.78);
  const wingSpan = Math.max(10, h * 1.15);
  const tailSpan = Math.max(6, h * 0.62);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(hdg);
  ctx.lineJoin = 'round';

  // Compact filled aircraft silhouette (flight tracker style)
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.58, 0); // nose
  ctx.lineTo(bodyLen * 0.12, -wingSpan * 0.12);
  ctx.lineTo(bodyLen * 0.00, -wingSpan * 0.48); // main wing tip
  ctx.lineTo(-bodyLen * 0.10, -wingSpan * 0.08);
  ctx.lineTo(-bodyLen * 0.34, -tailSpan * 0.18);
  ctx.lineTo(-bodyLen * 0.50, -tailSpan * 0.40); // tail tip
  ctx.lineTo(-bodyLen * 0.56, 0); // tail center
  ctx.lineTo(-bodyLen * 0.50, tailSpan * 0.40);
  ctx.lineTo(-bodyLen * 0.34, tailSpan * 0.18);
  ctx.lineTo(-bodyLen * 0.10, wingSpan * 0.08);
  ctx.lineTo(bodyLen * 0.00, wingSpan * 0.48); // main wing tip
  ctx.lineTo(bodyLen * 0.12, wingSpan * 0.12);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-bodyLen * 0.56, 0, bodyLen * 0.58, 0);
  if(p && p.type === 'enemy'){
    grad.addColorStop(0, '#ff8a65');
    grad.addColorStop(1, '#ff4d5a');
  } else {
    grad.addColorStop(0, '#ffe56b');
    grad.addColorStop(1, '#ffbf1a');
  }
  ctx.shadowColor = p && p.selected ? '#ffe56b' : color;
  ctx.shadowBlur = p && p.selected ? 10 : 6;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Tiny edge for readability on map background
  ctx.strokeStyle = 'rgba(10,20,30,0.65)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cabin shine to make the icon feel more like a logo
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.36, -1.2);
  ctx.lineTo(-bodyLen * 0.2, -1.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  // Small badge/logo marker per aircraft category
  const badge = getAircraftRadarBadge(p);
  if(badge){
    const bx = x + Math.max(8, w * 0.24);
    const by = y - Math.max(8, h * 0.24);
    ctx.beginPath();
    ctx.arc(bx, by, 5.2, 0, Math.PI*2);
    ctx.fillStyle = badge.bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = badge.fg;
    ctx.font = 'bold 7px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.text, bx, by + 0.2);
  }

  // reset alignment so labels keep default canvas alignment
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

const aircraftWikiPageByModel = {
  'A320': 'Airbus_A320_family',
  'B737': 'Boeing_737',
  'E195': 'Embraer_195',
  'A321': 'Airbus_A320_family',
  'A330': 'Airbus_A330',
  'B777': 'Boeing_777',
  'A350': 'Airbus_A350',
  'B787': 'Boeing_787_Dreamliner',
  'B747': 'Boeing_747',
  'ATR72': 'ATR_72',
  'C172': 'Cessna_172',
  'A330F': 'Airbus_A330',
  'B777F': 'Boeing_777',
  'Cargo': 'Cargo_aircraft',
  'KC-135': 'Boeing_KC-135_Stratotanker',
  'F-16': 'General_Dynamics_F-16_Fighting_Falcon',
  'Rafale': 'Dassault_Rafale'
};
const aircraftPhotoCache = new Map();

function getAircraftWikiPage(p){
  if(!p) return null;
  if(p.model && aircraftWikiPageByModel[p.model]) return aircraftWikiPageByModel[p.model];
  if(p.type === 'fighter') return 'General_Dynamics_F-16_Fighting_Falcon';
  if(p.type === 'tanker') return 'Boeing_KC-135_Stratotanker';
  if(p.type === 'cargo' || p.type === 'transport') return 'Cargo_aircraft';
  if(p.type === 'civil') return 'Airliner';
  return null;
}

async function setSelectedInfoPhoto(p){
  const imgEl = document.getElementById('info-img');
  if(!imgEl || !p) return;
  const fallback = p.img || svgPlane;
  imgEl.src = fallback;
  imgEl.alt = 'Photo ' + (p.model || p.type || 'avion');
  imgEl.onerror = () => { imgEl.src = fallback; };

  const pageTitle = getAircraftWikiPage(p);
  if(!pageTitle) return;

  if(aircraftPhotoCache.has(pageTitle)){
    const cachedSrc = aircraftPhotoCache.get(pageTitle);
    const selected = entities.find(e=>e.selected);
    if(selected === p && cachedSrc) imgEl.src = cachedSrc;
    return;
  }

  try{
    const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(pageTitle);
    const res = await fetch(url);
    if(!res.ok) return;
    const data = await res.json();
    const src = (data && data.thumbnail && data.thumbnail.source) || (data && data.originalimage && data.originalimage.source) || '';
    if(!src) return;
    aircraftPhotoCache.set(pageTitle, src);
    const selected = entities.find(e=>e.selected);
    if(selected === p) imgEl.src = src;
  }catch(e){}
}

// World map background (image file)
const imgEuropeMap = new Image();
imgEuropeMap.src = 'assets/world-map.png';
const useAbstractMap = false;
const MAP_SCALE = 2.6;
const MAP_ASPECT = 0.5;
const MAP_LAT_MIN = -85;
const MAP_LAT_MAX = 85;
const MAP_LON_MIN = -180;
const MAP_LON_MAX = 180;

function spawnPlane(type='civil', x=null, y=null, hdg=null){
  const angle = rand(0,Math.PI*2);
  const {mapW, mapH} = getMapSize();
  const px = x!==null? x : cx + rand(-0.45, 0.45) * mapW;
  const py = y!==null? y : cy + rand(-0.45, 0.45) * mapH;
  const phd = hdg!==null? hdg : ((angle + Math.PI) % (Math.PI*2));
  const base = {id:Date.now().toString(36)+Math.floor(Math.random()*1000),call:callsign(),x:px,y:py,hdg:phd,spd:rand(80,220),alt:rand(2000,36000),selected:false,type:type};
  
  // Find nearest airport for origin
  let nearestOrigin = null; let dminOrigin = Infinity;
  for(let a of airports){ const d = Math.hypot(a.x-px, a.y-py); if(d<dminOrigin){ dminOrigin=d; nearestOrigin=a; } }
  base.originAirport = nearestOrigin ? nearestOrigin.name : 'Inconnu';
  base.originCountry = nearestOrigin ? nearestOrigin.country : 'Inconnu';
  base.origin = base.originAirport + ' (' + base.originCountry + ')';
  
  // Pick random destination airport
  if(airports.length > 0){
    const destIndex = Math.floor(Math.random() * airports.length);
    const destAirport = airports[destIndex];
    base.destinationAirport = destAirport.name;
    base.destinationCountry = destAirport.country;
    base.destination = destAirport.name + ' (' + destAirport.country + ')';
  } else {
    base.destinationAirport = 'Inconnu';
    base.destinationCountry = 'Inconnu';
    base.destination = 'Inconnu';
  }
  
  // Airlines list
  const airlines = ['Air France', 'Lufthansa', 'British Airways', 'Emirates', 'KLM', 'Iberia', 'Swiss', 'Austrian', 'SAS', 'TAP', 'Alitalia', 'Aegean'];
  
  // assign model and tweak speeds
  if(type==='fighter'){ 
    base.spd = 380; 
    base.targetId = null; 
    base.model = Math.random() < 0.5 ? 'F-16' : 'Rafale';
    base.img = base.model === 'Rafale' ? svgRafale : svgFighter;
    base.origin = 'Base Militaire';
    base.originCountry = 'France';
    base.destination = 'Patrouille';
    base.passengers = 0;
    base.weight = '12 t';
    base.airline = 'Armée de l\'Air';
    base.fuel = Math.round(rand(60, 100)) + '%';
  }
  else if(type==='tanker'){
    base.spd = rand(240,300);
    base.alt = rand(20000,32000);
    base.targetId = null;
    base.model = 'KC-135';
    base.img = svgCargo;
    base.origin = 'Base de Ravitaillement';
    base.originCountry = 'France';
    base.destination = 'Mission de ravitaillement';
    base.passengers = 6;
    base.weight = '40 t';
    base.airline = 'Escadron Ravitailleur';
    base._fuel = Math.round(rand(65, 95));
    base.fuel = Math.round(base._fuel) + '%';
  }
  else if(type==='enemy'){ 
    base.spd = rand(160,300); 
    base.model = 'Unknown'; 
    base.img = svgEnemy;
    base.origin = 'Inconnu';
    base.originCountry = 'Inconnu';
    base.destination = 'Inconnu';
    base.destinationCountry = 'Inconnu';
    base.passengers = '?';
    base.weight = '?';
    base.airline = 'Inconnu';
    base.fuel = '?';
  }
  else if(type==='cargo' || type==='transport'){ 
    base.spd = rand(140,200); // Cargo planes are slower
    base.alt = rand(18000,30000); // Usually fly lower
    const cargoModels = ['Cargo','A330F','B777F'];
    base.model = cargoModels[Math.floor(Math.random()*cargoModels.length)];
    if(base.model==='Cargo') base.img = svgCargo;
    else if(base.model==='A330F') base.img = svgA330;
    else if(base.model==='B777F') base.img = svgB777;
    else base.img = svgCargo;
    
    // Cargo specific data
    if(base.model==='A330F'){ base.passengers = 0; base.weight = Math.round(rand(45, 70)) + ' t'; }
    else if(base.model==='B777F'){ base.passengers = 0; base.weight = Math.round(rand(100, 140)) + ' t'; }
    else { base.passengers = 0; base.weight = Math.round(rand(20, 50)) + ' t'; }
    base.airline = airlines[Math.floor(Math.random()*airlines.length)] + ' Cargo';
    base.fuel = Math.round(rand(40, 90)) + '%';
  }
  else { // civil passenger
    const civilModels = ['A320','B737','E195','A321','A330','B777','A350','B787','B747','ATR72','C172'];
    base.model = civilModels[Math.floor(Math.random()*civilModels.length)];
    // pick model-specific SVG
    if(base.model==='A320') base.img = svgA320;
    else if(base.model==='B737') base.img = svgB737;
    else if(base.model==='E195') base.img = svgE195;
    else if(base.model==='A321') base.img = svgA321;
    else if(base.model==='A330') base.img = svgA330;
    else if(base.model==='B777') base.img = svgB777;
    else if(base.model==='A350') base.img = svgA350;
    else if(base.model==='B787') base.img = svgB787;
    else if(base.model==='B747') base.img = svgB747;
    else if(base.model==='ATR72') base.img = svgATR72;
    else if(base.model==='C172') base.img = svgC172;
    else base.img = svgPlane;
    
    // Passenger and weight data by model
    if(base.model==='A320'){ base.passengers = Math.round(rand(120, 180)); base.weight = Math.round(rand(35, 50)) + ' t'; }
    else if(base.model==='B737'){ base.passengers = Math.round(rand(130, 190)); base.weight = Math.round(rand(40, 55)) + ' t'; }
    else if(base.model==='E195'){ base.passengers = Math.round(rand(100, 120)); base.weight = Math.round(rand(25, 35)) + ' t'; }
    else if(base.model==='A321'){ base.passengers = Math.round(rand(180, 240)); base.weight = Math.round(rand(50, 65)) + ' t'; }
    else if(base.model==='A330'){ base.passengers = Math.round(rand(250, 350)); base.weight = Math.round(rand(120, 150)) + ' t'; }
    else if(base.model==='B777'){ base.passengers = Math.round(rand(300, 450)); base.weight = Math.round(rand(150, 200)) + ' t'; }
    else if(base.model==='A350'){ base.passengers = Math.round(rand(300, 410)); base.weight = Math.round(rand(115, 140)) + ' t'; }
    else if(base.model==='B787'){ base.passengers = Math.round(rand(240, 360)); base.weight = Math.round(rand(110, 135)) + ' t'; }
    else if(base.model==='B747'){ base.passengers = Math.round(rand(350, 470)); base.weight = Math.round(rand(180, 230)) + ' t'; }
    else if(base.model==='ATR72'){ base.passengers = Math.round(rand(60, 78)); base.weight = Math.round(rand(20, 25)) + ' t'; }
    else if(base.model==='C172'){ base.passengers = Math.round(rand(2, 4)); base.weight = Math.round(rand(0.7, 1.2)) + ' t'; }
    else { base.passengers = Math.round(rand(100, 200)); base.weight = Math.round(rand(30, 60)) + ' t'; }
    
    base.airline = airlines[Math.floor(Math.random()*airlines.length)];
    base.fuel = Math.round(rand(50, 95)) + '%';
  }
  
  // record spawn time to avoid immediate interception on spawn
  base._spawnTime = performance.now();
  // assign radio frequency (ticks-based exact)
  base.freq = randomFreq();
  entities.push(base);
}

function spawnAirport(x,y,name,country='Zone Internationale'){ airports.push({x,y,name,country,r:28}); }

// define a set of countries as rounded masses (abstract world map look)
const countries = [
  {x: -540, y: -180, rx: 320, ry: 190, rot: -0.22, name: 'Nordia', color: 'rgba(22,66,110,0.18)'},
  {x: -120, y: -110, rx: 260, ry: 160, rot: 0.08, name: 'Ocevar', color: 'rgba(36,52,96,0.16)'},
  {x: 290, y: -150, rx: 300, ry: 170, rot: -0.14, name: 'Estoria', color: 'rgba(30,72,104,0.17)'},
  {x: -620, y: 210, rx: 250, ry: 150, rot: 0.16, name: 'Sud-Ouest', color: 'rgba(68,48,30,0.10)'},
  {x: -180, y: 250, rx: 280, ry: 170, rot: -0.09, name: 'Meridia', color: 'rgba(54,40,82,0.14)'},
  {x: 280, y: 260, rx: 330, ry: 190, rot: 0.19, name: 'Valoria', color: 'rgba(42,56,92,0.15)'},
  {x: 760, y: -90, rx: 220, ry: 140, rot: 0.21, name: 'Aurana', color: 'rgba(26,60,90,0.15)'},
  {x: 760, y: 250, rx: 260, ry: 150, rot: -0.18, name: 'Helios', color: 'rgba(36,68,98,0.13)'}
];

// cities computed relative to current canvas center (cx, cy) - more cities for larger map
function getCities(){
  return [
    {x: cx - 320, y: cy - 180, name: 'Ville Nord'},
    {x: cx + 240, y: cy + 160, name: 'Ville Sud'},
    {x: cx - 120, y: cy + 280, name: 'Ville Est'},
    {x: cx + 440, y: cy - 80, name: 'Ville Ouest'},
    {x: cx - 400, y: cy + 100, name: 'Ville Centre-Est'},
    {x: cx + 300, y: cy - 200, name: 'Ville Centre-Ouest'}
  ];
}

// Create airports based on cities so there are more airports - more airports for larger map
function initAirports(){
  airports.length = 0;
  const airportDefs = [
    {name:'Paris CDG', country:'France', lat:49.0097, lon:2.5479},
    {name:'London Heathrow', country:'United Kingdom', lat:51.4700, lon:-0.4543},
    {name:'Frankfurt', country:'Germany', lat:50.0379, lon:8.5622},
    {name:'Madrid Barajas', country:'Spain', lat:40.4983, lon:-3.5676},
    {name:'Rome Fiumicino', country:'Italy', lat:41.8003, lon:12.2389},
    {name:'Istanbul', country:'Turkey', lat:41.2753, lon:28.7519},
    {name:'Moscow Sheremetyevo', country:'Russia', lat:55.9726, lon:37.4146},
    {name:'Cairo', country:'Egypt', lat:30.1219, lon:31.4056},
    {name:'Dubai', country:'UAE', lat:25.2532, lon:55.3657},
    {name:'Lagos', country:'Nigeria', lat:6.5774, lon:3.3212},
    {name:'Johannesburg', country:'South Africa', lat:-26.1337, lon:28.2420},
    {name:'Nairobi', country:'Kenya', lat:-1.3192, lon:36.9278},
    {name:'Delhi', country:'India', lat:28.5562, lon:77.1000},
    {name:'Mumbai', country:'India', lat:19.0896, lon:72.8656},
    {name:'Singapore', country:'Singapore', lat:1.3644, lon:103.9915},
    {name:'Bangkok', country:'Thailand', lat:13.6900, lon:100.7501},
    {name:'Hong Kong', country:'China', lat:22.3080, lon:113.9185},
    {name:'Beijing', country:'China', lat:40.0799, lon:116.6031},
    {name:'Seoul Incheon', country:'South Korea', lat:37.4602, lon:126.4407},
    {name:'Tokyo Haneda', country:'Japan', lat:35.5494, lon:139.7798},
    {name:'Sydney', country:'Australia', lat:-33.9399, lon:151.1753},
    {name:'Auckland', country:'New Zealand', lat:-37.0082, lon:174.7850},
    {name:'Los Angeles', country:'USA', lat:33.9416, lon:-118.4085},
    {name:'San Francisco', country:'USA', lat:37.6213, lon:-122.3790},
    {name:'Chicago O’Hare', country:'USA', lat:41.9742, lon:-87.9073},
    {name:'New York JFK', country:'USA', lat:40.6413, lon:-73.7781},
    {name:'Mexico City', country:'Mexico', lat:19.4361, lon:-99.0719},
    {name:'Bogotá', country:'Colombia', lat:4.7016, lon:-74.1469},
    {name:'Lima', country:'Peru', lat:-12.0219, lon:-77.1143},
    {name:'São Paulo', country:'Brazil', lat:-23.4356, lon:-46.4731},
    {name:'Buenos Aires', country:'Argentina', lat:-34.8222, lon:-58.5358}
  ];
  for(const a of airportDefs){
    const pt = latLonToWorld(a.lat, a.lon);
    spawnAirport(pt.x, pt.y, a.name, a.country);
  }
}
initAirports();

// Airspace zones and routes (recomputed on resize) - waypoints for ATC
const zones = [];
const routes = [];
const waypoints = [];
const burstEffects = [];
const clouds = [];
function initZonesAndRoutes(){
  zones.length = 0; routes.length = 0; waypoints.length = 0;
}
initZonesAndRoutes();

function initClouds(){
  clouds.length = 0;
  const {mapW, mapH} = getMapSize();
  const count = Math.max(10, Math.round((mapW * mapH) / 450000));
  for(let i=0;i<count;i++){
    const x = cx - mapW/2 + Math.random() * mapW;
    const y = cy - mapH/2 + Math.random() * mapH;
    clouds.push({
      x, y,
      r: rand(24, 90),
      o: rand(0.08, 0.18),
      s: rand(4, 16),
      vx: rand(6, 18),
      vy: rand(-3, 3)
    });
  }
}

function addBurstEffect(x, y, color='rgba(255,120,80,0.95)'){
  burstEffects.push({x, y, color, life: 220, maxLife: 220, r: 7 + Math.random()*6});
}

function updateBurstEffects(dt){
  for(let i=burstEffects.length-1;i>=0;i--){
    burstEffects[i].life -= dt;
    if(burstEffects[i].life <= 0) burstEffects.splice(i,1);
  }
}

function drawBurstEffects(){
  for(const fx of burstEffects){
    const t = Math.max(0, fx.life / fx.maxLife);
    const rr = fx.r + (1 - t) * 16;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, rr, 0, Math.PI*2);
    ctx.strokeStyle = fx.color.replace('0.95', (0.12 + t * 0.55).toFixed(2));
    ctx.lineWidth = 1.2 + t * 2.5;
    ctx.stroke();
  }
}

function markAircraftDestroyed(victim, reason){
  if(!victim || victim._crashed) return;
  victim._crashed = true;
  victim._crashTime = performance.now();
  victim._crashReason = reason || 'Detruit';
  addBurstEffect(victim.x, victim.y, 'rgba(255,80,80,0.95)');
  showNotification('CRASH: ' + victim.call + ' - ' + victim._crashReason, 'warning', 3800);
  if(victim.selected) selectEntity(null);
  setTimeout(()=>{
    const idx = entities.indexOf(victim);
    if(idx>=0) entities.splice(idx,1);
  }, 1800);
}

function enemyAttackFighters(dt){
  for(const enemy of entities){
    if(enemy.type !== 'enemy' || enemy._crashed) continue;
    enemy._attackCd = Math.max(0, (enemy._attackCd||0) - dt);
    if(enemy._attackCd > 0) continue;

    let target = null;
    let dmin = 220;
    for(const e of entities){
      if(e.type !== 'fighter' || e._crashed) continue;
      const d = Math.hypot(e.x - enemy.x, e.y - enemy.y);
      if(d < dmin){ dmin = d; target = e; }
    }
    if(!target) continue;

    enemy._attackCd = rand(900, 1700);
    const ax = (enemy.x + target.x) * 0.5 + rand(-10,10);
    const ay = (enemy.y + target.y) * 0.5 + rand(-10,10);
    addBurstEffect(ax, ay, 'rgba(255,120,70,0.95)');
    if(Math.random() < 0.38){
      markAircraftDestroyed(target, 'Abattu par avion ennemi');
      showNotification('ENNEMI: ' + enemy.call + ' a detruit ' + target.call, 'warning', 3000);
    }
  }
}

// now that `airports` and `zones` are defined above, register resize handler
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>{ setTimeout(resize,120); });
resize();

function update(dt){
  if(gamePaused) return;
  if(mpMode === 'multi' && !mpIsHost){
    updateFollowCamera();
    updateFuelAlertsPanel();
    return;
  }
  playElapsedMs += dt;
  updatePlayTimeHud();
  updateBurstEffects(dt);
  // move clouds slowly across the map
  if(clouds.length){
    const {mapW, mapH} = getMapSize();
    const left = cx - mapW/2 - 120;
    const right = cx + mapW/2 + 120;
    const top = cy - mapH/2 - 120;
    const bottom = cy + mapH/2 + 120;
    for(const c of clouds){
      c.x += c.vx * (dt/1000);
      c.y += c.vy * (dt/1000);
      if(c.x > right) c.x = left;
      if(c.x < left) c.x = right;
      if(c.y > bottom) c.y = top;
      if(c.y < top) c.y = bottom;
    }
  }
  enemyAttackFighters(dt);
  // entity behavior
  for(let i=entities.length-1;i>=0;i--){
    const p = entities[i];
    // maintain trajectory history
    p.history = p.history || [];
    if((p._histTimer||0) <= 0){ p.history.push({x:p.x,y:p.y}); if(p.history.length>120) p.history.shift(); p._histTimer = 200; } else p._histTimer -= dt;

    if(p.type==='fighter' && p.targetId){
      const target = entities.find(e=>e.id===p.targetId);
      if(!target){ entities.splice(i,1); continue; }
      // follow-behind behavior: aim for point behind the target
      const followDist = 80;
      const behindX = target.x - Math.cos(target.hdg)*followDist;
      const behindY = target.y - Math.sin(target.hdg)*followDist;
      const dx = behindX - p.x, dy = behindY - p.y; const dist = Math.hypot(dx,dy);
      const desired = Math.atan2(dy,dx);
      // smooth heading
      let diff = desired - p.hdg; while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2; p.hdg += diff*0.12;
      const speed = p.spd*(dt/1000)/2.5;
      p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      // Fighters now only follow - they don't destroy automatically
      // Destruction must be done manually via the Destroy button
      // Mark target as being tracked
      if(!target._beingTracked){
        target._beingTracked = true;
        target._trackedBy = p.id;
      }
      if(target.type === 'enemy' && dist < 28 && Math.random() < 0.28){
        markAircraftDestroyed(target, 'Intercepte par avion de chasse');
        if(Math.random() < 0.16){
          markAircraftDestroyed(p, 'Detruit en combat aerien');
        } else {
          p.targetId = null;
        }
      }
    } else if(p.type==='tanker' && p.targetId){
      const tgt = entities.find(e=>e.id===p.targetId);
      if(!tgt){ entities.splice(i,1); continue; }
      // steer gently to target
      const dx = tgt.x - p.x, dy = tgt.y - p.y; const desired = Math.atan2(dy,dx);
      let diff = desired - p.hdg; while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2; p.hdg += diff*0.08;
      const speed = p.spd*(dt/1000)/2.5; p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      const d = Math.hypot(dx,dy);
      if(d < 30){
        if(p._mode === 'force'){
          tgt.returning = true;
          tgt._forcedByTanker = true;
          const nearest = findNearestAirport(tgt.x, tgt.y);
          if(nearest) tgt.destination = nearest.name;
          tgt.spd = Math.max(120, tgt.spd * 0.75);
          showNotification('Atterrissage force ordonne: ' + tgt.call, 'warning', 2600);
        } else {
          tgt._lowFuel = false;
          tgt._fuel = Math.min(100, (tgt._fuel||0) + 60);
          tgt.fuel = Math.round(tgt._fuel) + '%';
          showNotification('Ravitaillement effectue: '+tgt.call, 'info', 2500);
        }
        tgt._tankerAssigned = false;
        entities.splice(i,1);
      }
    } else {
      // fuel emergency handling (low fuel + consumption)
      if(p.type!=='fighter' && p.type!=='enemy' && p.type!=='tanker'){
        if(p._fuel==null){
          if(Math.random()<0.16){ p._lowFuel = true; p._fuel = Math.round(rand(5,12)); p._fuelWarned=false; p._tankerAssigned=false; }
          else { p._lowFuel = false; p._fuel = Math.round(rand(40,95)); }
        }
        const burn = (p.spd/400) * (dt/1000) * (p._lowFuel? 1.4 : 0.28);
        p._fuel = Math.max(0, p._fuel - burn);
        p.fuel = Math.round(p._fuel) + '%';
        if(p._fuel <= 0){
          showNotification('Perte avion: carburant a 0% ('+p.call+')', 'warning', 2600);
          if(p.selected) selectEntity(null);
          entities.splice(i,1);
          continue;
        }
        if(p._lowFuel){
          if(!p._fuelWarned && p._fuel < 8){ p._fuelWarned=true; showNotification('URGENT: '+p.call+' carburant faible ('+Math.round(p._fuel)+'%)', 'warning', 3500); }
          if(p._fuel <= 2 && !p._tankerAssigned){
            if(p.spd > 140){
              p._crashed = true; p._crashTime = performance.now(); p._crashReason='Panne sèche';
              showNotification('💥 CRASH (panne sèche): '+p.call, 'warning', 5000);
              setTimeout(()=>{ const idx = entities.indexOf(p); if(idx>=0) entities.splice(idx,1); }, 2500);
            } else {
              p.spd = Math.max(60, p.spd*0.96);
            }
          }
        }
      }
      if(p._forcedByTanker && p.returning){
        const nowMs = performance.now();
        if(!p._lastForceReminder || (nowMs - p._lastForceReminder) > 10000){
          showNotification('RETOUR FORCE: ' + p.call + ' -> ' + (p.destination || 'Base'), 'warning', 4200);
          p._lastForceReminder = nowMs;
        }
      }
      // random small heading/speed variations for civil traffic
      if((p.type==='civil' || p.type==='cargo' || p.type==='transport') && !p.returning){
        p._mvTimer = (p._mvTimer==null)? rand(2500,7000) : (p._mvTimer - dt);
        if(p._mvTimer<=0){
          const delta = (Math.random()*30 - 15) * Math.PI/180;
          p.hdg += delta;
          if(Math.random()<0.5){ p.spd = Math.max(60, Math.min(260, p.spd + (Math.random()*40 - 20))); }
          p._mvTimer = rand(2500,7000);
        }
      }
      // normal movement for civil/enemy
      // if returning to airport, steer to nearest airport
      if(p.returning){ let nearest=null; let dmin=Infinity; for(let a of airports){ const d=Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){dmin=d;nearest=a;} } if(nearest){ p.hdg = Math.atan2(nearest.y-p.y, nearest.x-p.x); if(dmin<18){ if(p._forcedByTanker){ showNotification('Atterrissage force confirme: '+p.call, 'info', 2300); if(p.selected) selectEntity(null); entities.splice(i,1); continue; } p.returning=false; p.spd = Math.max(60, p.spd*0.8); } } }
      const speed = (p.spd*(dt/1000)/2.5) || 0;
      p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      
      // Check for crashes - collisions with other planes
      for(let j=0; j<entities.length; j++){
        if(i===j || entities[j].type==='fighter' && entities[j].targetId) continue;
        const other = entities[j];
        const dist = Math.hypot(p.x-other.x, p.y-other.y);
        // Check if same altitude (within 2000ft)
        const altDiff = Math.abs(p.alt - other.alt);
        if(dist < 25 && altDiff < 2000 && !p._crashed && !other._crashed){
          // CRASH! Both planes crash
          p._crashed = true;
          other._crashed = true;
          p._crashTime = performance.now();
          other._crashTime = performance.now();
          showNotification('💥 COLLISION: ' + p.call + ' et ' + other.call, 'warning', 5000);
          // Remove both planes after a short delay
          setTimeout(()=>{
            const idx1 = entities.indexOf(p); if(idx1>=0) entities.splice(idx1,1);
            const idx2 = entities.indexOf(other); if(idx2>=0) entities.splice(idx2,1);
          }, 2000);
        }
      }
      
      // Random mechanical failure (very rare - 0.001% chance per frame, much less frequent)
      if(!p._crashed && Math.random() < 0.00001 && p.type !== 'fighter' && p.type !== 'enemy'){
        p._crashed = true;
        p._crashTime = performance.now();
        p._crashReason = 'Panne mécanique';
        showNotification('⚠️ CRASH: ' + p.call + ' - ' + p._crashReason, 'warning', 5000);
        setTimeout(()=>{
          const idx = entities.indexOf(p); if(idx>=0) entities.splice(idx,1);
        }, 3000);
      }
      
      // Remove planes far outside the world map bounds
      const {mapW, mapH} = getMapSize();
      const left = cx - mapW/2 - 800;
      const right = cx + mapW/2 + 800;
      const top = cy - mapH/2 - 800;
      const bottom = cy + mapH/2 + 800;
      if(p.x < left || p.x > right || p.y < top || p.y > bottom){ entities.splice(i,1); }
    }
  }
  updateFollowCamera();
  clampCamera();
  const selected = entities.find(e => e.selected);
  if(selected){
    const fuelText = Number.isFinite(selected._fuel) ? (Math.round(selected._fuel) + '%') : (selected.fuel || '—');
    const fuelEl = document.getElementById('info-fuel');
    if(fuelEl) fuelEl.innerHTML = '<strong>Carburant:</strong> ' + fuelText;
    const statusEl = document.getElementById('info-status');
    if(statusEl){
      let status = 'En vol';
      if(selected.returning) status = 'Retour à l'aéroport';
      if(selected.type === 'tanker' && selected.targetId) status = selected._mode === 'force' ? 'Mission interception' : 'Mission ravitaillement';
      if(selected._forcedByTanker) status = 'Atterrissage force';
      if(selected._alerted) status = 'Alerte';
      statusEl.innerHTML = '<strong>Statut:</strong> ' + status;
    }
  }
}

function norm(v){ return v === undefined ? null : v; }
function snapshotEntity(p){
  return {
    id: norm(p.id),
    call: norm(p.call),
    x: norm(p.x), y: norm(p.y), hdg: norm(p.hdg),
    spd: norm(p.spd), alt: norm(p.alt),
    type: norm(p.type), model: norm(p.model),
    origin: norm(p.origin), originCountry: norm(p.originCountry),
    destination: norm(p.destination), destinationCountry: norm(p.destinationCountry),
    passengers: norm(p.passengers), weight: norm(p.weight), airline: norm(p.airline),
    fuel: norm(p.fuel), _fuel: norm(p._fuel),
    returning: norm(p.returning), _forcedByTanker: norm(p._forcedByTanker),
    _alerted: norm(p._alerted), _crashed: norm(p._crashed),
    _crashTime: norm(p._crashTime), _crashReason: norm(p._crashReason),
    targetId: norm(p.targetId), _mode: norm(p._mode), _beingTracked: norm(p._beingTracked)
  };
}

function getEntitiesSnapshot(){
  return entities.map(snapshotEntity);
}

function applyEntitiesSnapshot(list){
  const byId = new Map();
  entities.forEach(e=>{ byId.set(e.id, e); });
  entities.length = 0;
  for(const s of (list || [])){
    const prev = byId.get(s.id);
    const e = prev ? prev : {history: []};
    Object.assign(e, s);
    if(prev && prev.selected) e.selected = true;
    if(prev && prev.history && prev.history.length){
      e.history = prev.history;
      e.history.push({x: e.x, y: e.y});
      if(e.history.length > 120) e.history.shift();
    } else {
      e.history = [{x: e.x, y: e.y}];
    }
    entities.push(e);
  }
}

function setMultiplayerMode(isMulti, isHost){
  mpMode = isMulti ? 'multi' : 'local';
  mpIsHost = !!isHost;
}

function drawBackgroundScreen(){
  ctx.clearRect(0,0,W,H);
  // richer background gradient
  const grad = ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,'#04101d'); grad.addColorStop(1,'#071428');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  ctx.save();
  // Keep background map in the exact same world transform as entities/airports.
  ctx.translate(-cam.x, -cam.y);
  ctx.translate(cx, cy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cx, -cy);
  // draw world map image behind everything (if loaded)
  try{
    const {mapW, mapH} = getMapSize();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(imgEuropeMap, cx - mapW/2, cy - mapH/2, mapW, mapH);
    ctx.globalAlpha = 1.0;
  }catch(e){}
  if(useAbstractMap){
    for(const c of countries){
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI*2);
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(230,242,255,0.08)';
      ctx.font='11px system-ui';
      ctx.fillText(c.name, -c.rx*0.25, -c.ry - 8);
      ctx.restore();
    }
    // draw city dots
    for(const c of getCities()){ ctx.beginPath(); ctx.fillStyle='rgba(255,230,180,0.9)'; ctx.arc(c.x, c.y, 5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(230,242,255,0.9)'; ctx.font='12px system-ui'; ctx.fillText(c.name, c.x + 10, c.y + 4); }
  }
  // moving clouds
  if(clouds.length){
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for(const c of clouds){
      const grad = ctx.createRadialGradient(c.x, c.y, c.r*0.2, c.x, c.y, c.r);
      grad.addColorStop(0, `rgba(255,255,255,${c.o})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r * 1.2, c.r * 0.8, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  // dark overlay to keep HUD/aircraft readable
  ctx.fillStyle = 'rgba(3,10,18,0.35)';
  ctx.fillRect(0,0,W,H);
  // subtle vignette for focus
  const vignette = ctx.createRadialGradient(cx, cy, Math.min(W,H)*0.2, cx, cy, Math.max(W,H)*0.75);
  vignette.addColorStop(0,'rgba(0,0,0,0)');
  vignette.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0,0,W,H);
  // subtle grid - larger spacing for bigger map
  ctx.strokeStyle = 'rgba(255,255,255,0.01)'; ctx.lineWidth = 1;
  const g = 60; // Larger grid spacing
  for(let x = - (cam.x % g); x < W; x += g){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y = - (cam.y % g); y < H; y += g){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function drawRadar(){
  if(!showRadarZones) return;
  // draw zones (world coordinates assumed)
  // draw zones
  zones.forEach(z=>{
    ctx.beginPath(); ctx.arc(z.x,z.y,z.r,0,Math.PI*2);
    ctx.fillStyle = z.color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(230,242,255,0.8)'; ctx.font='13px system-ui'; ctx.fillText(z.name, z.x - 30, z.y - z.r + 20);
  });
  // draw route lines (airways)
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(45,212,191,0.25)';
  routes.forEach(route=>{ 
    ctx.beginPath(); 
    route.forEach((pt,i)=>{ 
      if(i===0) ctx.moveTo(pt.x,pt.y); 
      else ctx.lineTo(pt.x,pt.y); 
    }); 
    ctx.stroke();
    // Draw route labels
    if(route.length > 1) {
      const mid = Math.floor(route.length / 2);
      ctx.fillStyle = 'rgba(45,212,191,0.4)'; ctx.font='10px system-ui';
      ctx.fillText('AWY', route[mid].x + 5, route[mid].y - 5);
    }
  });
  // draw waypoints
  waypoints.forEach(wp=>{
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 4, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,0,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,0,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,200,0.9)'; ctx.font='11px system-ui';
    ctx.fillText(wp.name, wp.x + 8, wp.y - 6);
  });
  // rings - larger for bigger map
  ctx.save(); ctx.translate(cx,cy);
  const maxR = Math.min(W,H)/1.5 - 20;
  ctx.strokeStyle = 'rgba(200,240,255,0.05)'; ctx.lineWidth = 1;
  for(let r= maxR; r>0; r-=maxR/4){ ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke(); }
  ctx.restore();
}

function getOtherSelections(){
  const players = window.__mp_players || {};
  const selfUid = window.__mp_uid;
  const map = new Map();
  for(const [uid, p] of Object.entries(players)){
    if(!p || uid === selfUid) continue;
    const sel = p.selected;
    if(!sel) continue;
    if(!map.has(sel)) map.set(sel, []);
    map.get(sel).push(p.name || 'Joueur');
  }
  return map;
}

function drawEntities(){
  const selectionMap = getOtherSelections();
  const selectedPlane = entities.find(e => e.selected);
  // draw airports
  airports.forEach(a=>{
    ctx.drawImage(imgAirport, a.x-12, a.y-12, 24,24);
    ctx.fillStyle = 'rgba(230,242,255,0.8)'; ctx.font='12px system-ui'; ctx.fillText(a.name, a.x+16, a.y+4);
  });
  entities.forEach(p=>{
    const dx = p.x, dy = p.y;
    const render = getAircraftRenderInfo(p);
    const selectRadius = getAircraftSelectRadius(p);
    // White trail only for the single currently selected aircraft.
    if(showTrajectory && selectedPlane && p.id === selectedPlane.id && p.history && p.history.length>1){ ctx.beginPath(); ctx.moveTo(p.history[0].x,p.history[0].y); for(let i=1;i<p.history.length;i++){ ctx.lineTo(p.history[i].x,p.history[i].y); } ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=1.8; ctx.stroke(); }

    // Draw crash indicator
    if(p._crashed){
      ctx.beginPath(); ctx.arc(dx,dy,35,0,Math.PI*2); ctx.strokeStyle='rgba(255,0,0,0.8)'; ctx.lineWidth=3; ctx.stroke();
      ctx.fillStyle='rgba(255,0,0,0.9)'; ctx.font='12px system-ui'; ctx.fillText('💥 CRASH', dx-25, dy-25);
      // Draw explosion effect
      const timeSinceCrash = performance.now() - (p._crashTime || 0);
      if(timeSinceCrash < 2000){
        const alpha = 1 - (timeSinceCrash / 2000);
        ctx.beginPath(); ctx.arc(dx,dy,20 + timeSinceCrash/50,0,Math.PI*2); ctx.fillStyle=`rgba(255,165,0,${alpha*0.5})`; ctx.fill();
      }
    }

    if(p.selected){ // halo
      ctx.beginPath(); ctx.arc(dx,dy,selectRadius + 8,0,Math.PI*2); ctx.strokeStyle='rgba(255,206,102,0.25)'; ctx.lineWidth=3; ctx.stroke();
    }
    if(Number.isFinite(p._fuel) && p._fuel <= 10){
      const pulse = selectRadius + Math.sin(performance.now()/180)*4;
      ctx.beginPath(); ctx.arc(dx,dy,pulse,0,Math.PI*2);
      ctx.strokeStyle = p._fuel <= 4 ? 'rgba(255,0,0,0.85)' : 'rgba(255,165,0,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,120,0.95)';
      ctx.font='10px system-ui';
      ctx.fillText('FUEL ' + Math.round(p._fuel) + '%', dx-20, dy-22);
    }
    if(p._forcedByTanker){
      ctx.beginPath(); ctx.arc(dx,dy,selectRadius + 12,0,Math.PI*2);
      ctx.strokeStyle='rgba(255,90,90,0.9)'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle='rgba(255,150,150,0.95)'; ctx.font='10px system-ui';
      ctx.fillText('FORCE RTB', dx-24, dy-30);
    }
    if(p.type==='enemy'){
      drawAircraftGlyph(p, dx, dy, render.w, render.h);
      // Draw alert indicator if alerted
      if(p._alerted){
        ctx.beginPath(); ctx.arc(dx,dy,selectRadius + 10,0,Math.PI*2); ctx.strokeStyle='rgba(255,165,0,0.6)'; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle='rgba(255,165,0,0.9)'; ctx.font='10px system-ui'; ctx.fillText('⚠️ ALERTE', dx-20, dy-18);
      }
    } else {
      drawAircraftGlyph(p, dx, dy, render.w, render.h);
      if(p.type==='tanker'){
        ctx.beginPath(); ctx.arc(dx,dy,selectRadius + 3,0,Math.PI*2); ctx.strokeStyle='rgba(45,212,191,0.85)'; ctx.lineWidth=2; ctx.stroke();
      }
    }
    const typeShort =
      p.type === 'fighter' ? 'CHASSE' :
      p.type === 'enemy' ? 'ENNEMI' :
      p.type === 'tanker' ? 'TANKER' :
      (p.type === 'cargo' || p.type === 'transport') ? 'CARGO' :
      'CIVIL';
    const hdgDeg = Math.round((p.hdg*180/Math.PI+360)%360);
    const fuelLabel = Number.isFinite(p._fuel) ? ('FUEL ' + Math.round(p._fuel) + '%') : '';
    const line2 = 'ALT ' + Math.round(p.alt) + ' ft  |  SPD ' + Math.round(p.spd) + ' kt';
    const line3 = 'HDG ' + hdgDeg + '°  |  ' + typeShort + (fuelLabel ? ('  |  ' + fuelLabel) : '');

    ctx.fillStyle = p.selected? 'rgba(255,206,102,0.95)' : 'rgba(230,242,255,0.95)';
    ctx.font='12px system-ui';
    ctx.fillText(p.call, dx+14, dy-8);
    ctx.fillStyle = 'rgba(230,242,255,0.72)';
    ctx.font='10px system-ui';
    ctx.fillText(line2, dx+14, dy+7);
    ctx.fillStyle = 'rgba(230,242,255,0.58)';
    ctx.fillText(line3, dx+14, dy+20);

    const selectors = selectionMap.get(p.id);
    if(selectors && selectors.length){
      const label = selectors.slice(0,2).join(', ') + (selectors.length > 2 ? ` +${selectors.length-2}` : '');
      ctx.fillStyle = 'rgba(45,212,191,0.9)';
      ctx.font='10px system-ui';
      ctx.fillText('SEL: ' + label, dx+14, dy-20);
    }
  });
  drawBurstEffects();
}
function loop(now){
  const dt = now - last; last = now;
  update(dt);
  
  drawBackgroundScreen();
  ctx.save();
  // apply camera transform with zoom centered at screen center
  ctx.translate(-cam.x, -cam.y);
  ctx.translate(cx, cy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cx, -cy);
  drawRadar();
  drawEntities();
  ctx.restore();
  requestAnimationFrame(loop);
}

window.MP_APP = {
  getEntitiesSnapshot,
  applyEntitiesSnapshot,
  setMultiplayerMode,
  applyCommand
};

// initial spawning - traffic increased, hostile traffic reduced
for(let i=0;i<14;i++) spawnPlane('civil');
for(let i=0;i<5;i++) spawnPlane('cargo');
setInterval(()=>{ if(gamePaused) return; if(entities.filter(e=>e.type==='civil').length<32) spawnPlane('civil'); }, 900);
setInterval(()=>{ if(gamePaused) return; if(entities.filter(e=>e.type==='cargo'||e.type==='transport').length<10) spawnPlane('cargo'); }, 2400);
// fewer suspect aircraft
setInterval(()=>{ if(gamePaused) return; if(entities.filter(e=>e.type==='enemy').length<1) spawnPlane('enemy'); }, 22000);

// Menu serveur: toujours afficher à l'ouverture, bouton de retour, et pause du jeu
(function initServerSelection(){
  const panel = document.getElementById('server-select');
  const btnLocal = document.getElementById('server-local-btn');
  const btnMulti = document.getElementById('server-multi-btn');
  const btnPartner = document.getElementById('server-partner-btn');
  const cinematicOverlay = document.getElementById('local-cinematic');
  const cinematicFrame = document.getElementById('local-cinematic-frame');
  const skipCinematicBtn = document.getElementById('skip-cinematic-btn');
  const cinematicProgressLabel = document.getElementById('cinematic-progress-label');
  const cinematicProgressBuffer = document.getElementById('cinematic-progress-buffer');
  const cinematicProgressFill = document.getElementById('cinematic-progress-fill');
  const openBtn = document.getElementById('btn-open-menu');
  const LOCAL_CINEMATIC_YT_ID = 'PbNqF4rkg8c';
  const LOCAL_CINEMATIC_MAX_MS = 180000;
  const LOCAL_IMMERSION_LINES = [
    'ATC local: trafic stable sur le secteur principal.',
    'Tour locale: vent calme, operations nominales.',
    'Centre radar: separation verticale confirmée.',
    'ATC local: couloir Ouest prioritaire actif.',
    'Tour locale: surveillance carburant en cours.',
    'Centre radar: aucun conflit détecté.'
  ];
  let localLaunchInProgress = false;
  let ytSdkPromise = null;
  let ytPlayer = null;
  let localImmersionTick = null;

  function setCinematicProgress(value){
    if(!cinematicProgressFill) return;
    const clamped = Math.max(0, Math.min(1, Number(value) || 0));
    cinematicProgressFill.style.width = String(Math.round(clamped * 1000) / 10) + '%';
  }
  function setCinematicBuffer(value){
    if(!cinematicProgressBuffer) return;
    const clamped = Math.max(0, Math.min(1, Number(value) || 0));
    cinematicProgressBuffer.style.width = String(Math.round(clamped * 1000) / 10) + '%';
  }
  function setCinematicLabel(text){
    if(!cinematicProgressLabel) return;
    cinematicProgressLabel.textContent = text || '';
  }
  function stopLocalImmersion(){
    if(localImmersionTick){
      clearInterval(localImmersionTick);
      localImmersionTick = null;
    }
  }
  function startLocalImmersion(){
    if(localImmersionTick) return;
    setStatus('Mode local immersif actif.');
    showNotification('Mode local immersif active.', 'info', 1400, true);
    localImmersionTick = setInterval(()=>{
      if(gamePaused || mpMode !== 'local') return;
      const selected = entities.find(e => e.selected && !e._crashed);
      if(selected && Math.random() < 0.45){
        showNotification('ATC: ' + selected.call + ' maintenez cap ' + Math.round((selected.hdg*180/Math.PI+360)%360) + '°', 'info', 2200);
        return;
      }
      const line = LOCAL_IMMERSION_LINES[Math.floor(Math.random() * LOCAL_IMMERSION_LINES.length)];
      showNotification(line, 'info', 2100);
    }, 16000);
  }

  function loadYouTubeSdk(){
    if(window.YT && window.YT.Player) return Promise.resolve();
    if(ytSdkPromise) return ytSdkPromise;
    ytSdkPromise = new Promise((resolve, reject)=>{
      const existing = document.querySelector('script[data-yt-sdk="1"]');
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function(){
        try{ if(typeof prevReady === 'function') prevReady(); }catch(e){}
        resolve();
      };
      if(existing){
        setTimeout(()=>{
          if(window.YT && window.YT.Player) resolve();
        }, 300);
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.setAttribute('data-yt-sdk', '1');
      s.onerror = ()=> reject(new Error('YouTube SDK load failed'));
      document.head.appendChild(s);
    });
    return ytSdkPromise;
  }

  function playLocalCinematic(){
    if(!cinematicOverlay){
      return Promise.resolve();
    }

    return new Promise((resolve)=>{
      let finished = false;
      let tick = null;
      let safetyTimer = null;
      let fallbackProgress = 0;

      function finish(){
        if(finished) return;
        finished = true;
        if(tick) clearInterval(tick);
        if(safetyTimer) clearTimeout(safetyTimer);
        setCinematicProgress(1);
        setCinematicBuffer(1);
        setCinematicLabel('Lecture terminée');
        if(skipCinematicBtn) skipCinematicBtn.removeEventListener('click', onSkip);
        if(ytPlayer && typeof ytPlayer.destroy === 'function'){
          try{ ytPlayer.destroy(); }catch(e){}
          ytPlayer = null;
        }
        if(cinematicFrame) cinematicFrame.setAttribute('src', 'about:blank');
        cinematicOverlay.classList.add('hidden');
        cinematicOverlay.setAttribute('aria-hidden', 'true');
        resolve();
      }

      function onSkip(){ finish(); }
      function onPlayerError(){
        showNotification('Video YouTube indisponible, lancement direct.', 'warning', 1800, true);
        finish();
      }
      function onPlayerStateChange(ev){
        if(!window.YT || !ev) return;
        if(ev.data === window.YT.PlayerState.ENDED){
          finish();
        }
      }
      function startProgressLoop(){
        tick = setInterval(()=>{
          if(finished) return;
          let duration = 0;
          let current = 0;
          let buffered = 0;
          try{
            if(ytPlayer){
              duration = Number(ytPlayer.getDuration?.() || 0);
              current = Number(ytPlayer.getCurrentTime?.() || 0);
              buffered = Number(ytPlayer.getVideoLoadedFraction?.() || 0);
            }
          }catch(e){}

          if(duration > 0 && current >= 0){
            const frac = Math.max(0, Math.min(1, current / duration));
            setCinematicProgress(frac);
            setCinematicBuffer(Math.max(frac, Math.max(0, Math.min(1, buffered))));
            setCinematicLabel('Lecture ' + Math.round(frac * 100) + '%');
          } else {
            fallbackProgress = Math.min(0.94, fallbackProgress + 0.01);
            setCinematicProgress(fallbackProgress);
            setCinematicBuffer(Math.max(fallbackProgress, 0.22));
            setCinematicLabel('Chargement video YouTube...');
          }
        }, 120);
      }
      function attachYouTube(){
        if(!cinematicFrame) return;
        const src = 'https://www.youtube.com/embed/' + LOCAL_CINEMATIC_YT_ID + '?enablejsapi=1&autoplay=1&playsinline=1&rel=0&modestbranding=1';
        cinematicFrame.setAttribute('src', src);
        ytPlayer = new window.YT.Player(cinematicFrame, {
          events: {
            onReady: (ev)=>{ try{ ev.target.playVideo(); }catch(e){} },
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
      }

      cinematicOverlay.classList.remove('hidden');
      cinematicOverlay.setAttribute('aria-hidden', 'false');
      if(cinematicFrame) cinematicFrame.setAttribute('src', 'about:blank');
      setCinematicProgress(0);
      setCinematicBuffer(0);
      setCinematicLabel('Chargement video YouTube...');
      if(skipCinematicBtn) skipCinematicBtn.addEventListener('click', onSkip);
      safetyTimer = setTimeout(finish, LOCAL_CINEMATIC_MAX_MS);
      startProgressLoop();

      loadYouTubeSdk()
        .then(()=>{
          if(!window.YT || !window.YT.Player){
            onPlayerError();
            return;
          }
          attachYouTube();
        })
        .catch(()=> onPlayerError());
    });
  }

  function openMenu(){
    if(panel) panel.style.display='flex';
    gamePaused = true;
    stopLocalImmersion();
    showNotification('Menu serveur ouvert', 'info', 1500);
  }
  async function chooseLocal(){
    if(localLaunchInProgress) return;
    localLaunchInProgress = true;
    try{
      setMultiplayerMode(false, false);
      gamePaused = true;
      if(panel) panel.style.display='none';
      await playLocalCinematic();
      gamePaused = false;
      if(playElapsedMs <= 0) playElapsedMs = 0;
      updatePlayTimeHud();
      sendDiscordPlayNotification();
      if(!_miniatc_loop_started) startMainLoop();
      showNotification('Connexion: Local', 'info', 1200);
      startLocalImmersion();
    } finally {
      localLaunchInProgress = false;
    }
  }

  function chooseMulti(){
    gamePaused = true;
    stopLocalImmersion();
    if(panel) panel.style.display='flex';
    showNotification('Mode multijoueur bloque temporairement (instable).', 'warning', 3200, true);
    setStatus('Mode multijoueur désactivé temporairement.');
    return;
  }

  function choosePartner(){
    showNotification('Serveurs partenaires indisponibles pour l\'instant.', 'warning', 2200, true);
  }

  if(btnLocal) btnLocal.addEventListener('click', chooseLocal);
  if(btnMulti){
    btnMulti.classList.add('server-btn-disabled');
    btnMulti.setAttribute('aria-disabled', 'true');
    btnMulti.setAttribute('disabled', 'disabled');
    btnMulti.title = 'Mode multijoueur désactivé temporairement';
  }
  if(btnPartner) btnPartner.addEventListener('click', choosePartner);
  if(openBtn) openBtn.addEventListener('click', openMenu);

  // À chaque chargement, afficher le menu si disponible; sinon démarrer directement
  if(panel) {
    panel.style.display='flex';
    updatePlayTimeHud();
  } else {
    gamePaused = false;
    setMultiplayerMode(false, false);
    updatePlayTimeHud();
    sendDiscordPlayNotification();
    startMainLoop();
    startLocalImmersion();
  }
})();

// UI and interaction
const info = document.getElementById('info');
const controls = document.getElementById('controls');
const selectedDiv = document.getElementById('selected');
function selectEntity(p){
  if(p && p.airport) p = null;
  entities.forEach(x=>x.selected=false); 
  if(p){ p.selected=true; controls.classList.remove('hidden');
    followSelected = true;
    followedEntityId = p.id;
    if(window.MP && typeof window.MP.setSelected === 'function') window.MP.setSelected(p.id);
    cam.zoom = Math.min(cam.zoom, 0.68);
    selectedDiv.innerHTML = '<strong>'+p.call+'</strong><br>Type: '+(p.type||'civil')+' • ALT: '+Math.round(p.alt)+' ft<br>SPD: '+Math.round(p.spd)+' kt • HDG: '+Math.round((p.hdg*180/Math.PI+360)%360)+'°';
    // update top-right detailed info
    try{
      const panel = document.getElementById('selected-info'); if(panel) panel.classList.remove('hidden');
      setSelectedInfoPhoto(p);
      
      // Get type label
      let typeLabel = 'Commercial';
      if(p.type === 'cargo' || p.type === 'transport') typeLabel = 'Cargo/Transport';
      else if(p.type === 'fighter') typeLabel = 'Avion de Chasse';
      else if(p.type === 'tanker') typeLabel = 'Avion Ravitailleur';
      else if(p.type === 'enemy') typeLabel = 'Avion Suspect';
      
      // Get status
      let status = 'En vol';
      if(p.returning) status = 'Retour à l'aéroport';
      if(p.type === 'tanker' && p.targetId) status = p._mode === 'force' ? 'Mission interception' : 'Mission ravitaillement';
      if(p._forcedByTanker) status = 'Atterrissage force';
      if(p._alerted) status = '⚠️ Alerté';
      if(p._beingTracked) status = '🛡️ Suivi par chasseur';
      
      const callsignEl = document.getElementById('info-callsign'); if(callsignEl) callsignEl.textContent = p.call || '—';
      const it = document.getElementById('info-type'); if(it) it.textContent = 'Type: ' + typeLabel;
      const im = document.getElementById('info-model'); if(im) im.textContent = 'Modèle: ' + (p.model||'—');
      const originEl = document.getElementById('info-origin'); if(originEl) originEl.innerHTML = '<strong>Départ:</strong> ' + (p.origin || 'Inconnu');
      const originCountryEl = document.getElementById('info-origin-country'); if(originCountryEl) originCountryEl.innerHTML = '<strong>Pays origine:</strong> ' + (p.originCountry || 'Inconnu');
      const destEl = document.getElementById('info-destination'); if(destEl) destEl.innerHTML = '<strong>Destination:</strong> ' + (p.destination || 'Inconnu');
      const statusEl = document.getElementById('info-status'); if(statusEl) statusEl.innerHTML = '<strong>Statut:</strong> ' + status;
      const altEl = document.getElementById('info-alt'); if(altEl) altEl.innerHTML = '<strong>Altitude:</strong> ' + Math.round(p.alt) + ' ft';
      const spdEl = document.getElementById('info-spd'); if(spdEl) spdEl.innerHTML = '<strong>Vitesse:</strong> ' + Math.round(p.spd) + ' kt';
      const hdgEl = document.getElementById('info-hdg'); if(hdgEl) hdgEl.innerHTML = '<strong>Cap:</strong> ' + Math.round((p.hdg*180/Math.PI+360)%360) + '°';
      const passEl = document.getElementById('info-passengers'); if(passEl) passEl.innerHTML = '<strong>Passagers:</strong> ' + (p.passengers !== undefined ? p.passengers : '—');
      const weightEl = document.getElementById('info-weight'); if(weightEl) weightEl.innerHTML = '<strong>Poids:</strong> ' + (p.weight || '—');
      const airlineEl = document.getElementById('info-airline'); if(airlineEl) airlineEl.innerHTML = '<strong>Compagnie:</strong> ' + (p.airline || '—');
      const fuelText = Number.isFinite(p._fuel) ? (Math.round(p._fuel) + '%') : (p.fuel || '—');
      const fuelEl = document.getElementById('info-fuel'); if(fuelEl) fuelEl.innerHTML = '<strong>Carburant:</strong> ' + fuelText;
      const rEl = document.getElementById('info-radio'); if(rEl) rEl.innerHTML = '<strong>Fréquence:</strong> ' + (p.freq ? p.freq.toFixed(3) + ' MHz' : '—');
    }catch(e){}
    const refuelBtn = document.getElementById('refuel');
    if(refuelBtn) refuelBtn.classList.toggle('hidden', p.type === 'tanker');
    updateRadioLink();
    info.textContent = ''
  } else { 
    cancelCameraFollow();
    controls.classList.add('hidden'); 
    const panel = document.getElementById('selected-info'); if(panel) panel.classList.add('hidden');
    const refuelBtn = document.getElementById('refuel'); if(refuelBtn) refuelBtn.classList.add('hidden');
    info.textContent = 'Tapez un avion pour le sélectionner' 
    updateRadioLink();
    if(window.MP && typeof window.MP.clearSelected === 'function') window.MP.clearSelected();
  } }

function findEntityAt(x,y){ // x,y are screen coords; convert to world (with zoom)
  const wx = cx + (x + cam.x - cx) / cam.zoom, wy = cy + (y + cam.y - cy) / cam.zoom;
  for(let i=entities.length-1;i>=0;i--){
    const p=entities[i];
    const dx=p.x-wx, dy=p.y-wy;
    if(Math.hypot(dx,dy) < getAircraftSelectRadius(p) + 6) return p;
  }
  // airports
  for(let a of airports){ if(Math.hypot(a.x-wx,a.y-wy) < a.r) return {airport:a}; }
  return null;
}

// Zoom with mouse wheel
canvas.addEventListener('wheel', e=>{
  const delta = Math.sign(e.deltaY);
  const prev = cam.zoom;
  cam.zoom = Math.min(2.0, Math.max(0.35, cam.zoom + (delta>0?-0.08:0.08)));
  const k = cam.zoom/prev;
  cam.x = cx - (cx - cam.x) * k;
  cam.y = cy - (cy - cam.y) * k;
  clampCamera();
});

canvas.addEventListener('click', e=>{
  const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const item = findEntityAt(x,y);
  if(item && item.airport){ // clicked airport: spawn civilian from there
    spawnPlane('civil', item.airport.x+20, item.airport.y+6, rand(0,Math.PI*2));
    info.textContent = 'Avion lancé depuis ' + item.airport.name;
    setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200);
    return;
  }
  selectEntity(item);
});

// hide top-right info when deselecting via click on empty space
canvas.addEventListener('click', e=>{
  const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const item = findEntityAt(x,y);
  if(!item){ const panel = document.getElementById('selected-info'); if(panel) panel.classList.add('hidden'); }
});

function sameFrequency(p){ return p && Math.abs((p.freq||0)-radioFreq)<1e-6; }
function orderRefusalChance(p){
  if(!p) return 0;
  if(p.type === 'enemy') return 0.45;
  if(p.type === 'fighter') return 0.08;
  if(p.type === 'tanker') return 0.15;
  return 0.22;
}
function orderRejected(p, orderLabel){
  if(!p) return false;
  const chance = orderRefusalChance(p);
  if(Math.random() >= chance) return false;
  showNotification((p.call || 'Avion') + ' refuse ordre: ' + orderLabel, 'warning', 2200);
  return true;
}
function findNearestAirport(x, y){
  let nearest = null;
  let dmin = Infinity;
  for(const a of airports){
    const d = Math.hypot(a.x - x, a.y - y);
    if(d < dmin){ dmin = d; nearest = a; }
  }
  return nearest;
}
function dispatchTankerTo(target, source='Commande', mode='force'){
  if(!target) return false;
  if(target.type === 'tanker'){
    info.textContent = 'Impossible: deja un tanker';
    setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200);
    return false;
  }
  if(target._tankerAssigned){
    showNotification('Tanker deja assigne a ' + target.call, 'warning', 1700);
    return false;
  }

  const nearest = findNearestAirport(target.x, target.y);
  if(!nearest){
    showNotification('Aeroport introuvable pour tanker', 'warning', 1800);
    return false;
  }

  spawnPlane('tanker', nearest.x+6, nearest.y, Math.atan2(target.y-nearest.y, target.x-nearest.x));
  const tanker = entities[entities.length-1];
  if(!tanker) return false;

  tanker.call = 'TK' + Math.floor(rand(100, 999));
  tanker.targetId = target.id;
  tanker.spd = Math.max(260, tanker.spd);
  tanker.alt = Math.max(18000, Number(target.alt) || 0);
  tanker.destination = mode === 'refuel' ? ('Ravitaillement de ' + target.call) : ('Interception de ' + target.call);
  tanker._mode = mode;
  target._tankerAssigned = true;
  if(!Number.isFinite(target._fuel)) target._fuel = 40;
  target._lowFuel = target._fuel <= 12;

  if(mode === 'refuel'){
    showNotification('Avion refuel envoye vers ' + target.call, 'info', 2200);
  } else {
    showNotification('Tanker envoye pour forcer atterrissage: ' + target.call, 'warning', 2500);
  }
  info.textContent = source + ': tanker lance depuis ' + nearest.name;
  setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1400);
  return true;
}
function updateFuelAlertsPanel(){
  const panel = document.getElementById('fuel-alerts');
  const list = document.getElementById('fuel-alerts-list');
  const countEl = document.getElementById('fuel-count');
  if(!list || !countEl) return;

  const alerts = entities
    .filter(e => e.type !== 'tanker' && Number.isFinite(e._fuel) && e._fuel > 0 && e._fuel <= 25)
    .sort((a,b) => a._fuel - b._fuel);

  countEl.textContent = String(alerts.length);
  list.innerHTML = '';

  if(alerts.length === 0){
    if(panel && !panel.classList.contains('hidden')){
      const empty = document.createElement('div');
      empty.className = 'fuel-alert-item';
      empty.textContent = 'Aucune alerte carburant';
      list.appendChild(empty);
    }
    return;
  }

  alerts.slice(0, 12).forEach(a => {
    const row = document.createElement('div');
    row.className = 'fuel-alert-item';
    const escortTag = a._tankerAssigned ? ' [TANKER EN ROUTE]' : '';
    row.textContent = a.call + ' - ' + Math.round(a._fuel) + '%' + escortTag;
    list.appendChild(row);
  });
}

function commandTurnTarget(p, deltaDeg, freq){ 
  if(!p) return; 
  const okFreq = freq != null ? sameFrequencyValue(p, freq) : sameFrequency(p);
  if(!okFreq){ showNotification('Radio: mauvaise fréquence', 'warning', 1500); updateRadioLink(); return; }
  if(orderRejected(p, 'cap')) return;
  p.hdg += (deltaDeg*Math.PI/180);
  if(p._manuallyControlled){
    showNotification('Cap modifié: ' + Math.round((p.hdg*180/Math.PI+360)%360) + '°', 'info', 2000);
  }
}
function commandSpeedTarget(p, dv, freq){ 
  if(!p) return; 
  const okFreq = freq != null ? sameFrequencyValue(p, freq) : sameFrequency(p);
  if(!okFreq){ showNotification('Radio: mauvaise fréquence', 'warning', 1500); updateRadioLink(); return; }
  if(orderRejected(p, 'vitesse')) return;
  p.spd = Math.max(40, p.spd + dv);
  if(p._manuallyControlled){
    showNotification('Vitesse: ' + Math.round(p.spd) + ' kt', 'info', 2000);
  }
}
function commandAltTarget(p, dA, freq){ 
  if(!p) return; 
  const okFreq = freq != null ? sameFrequencyValue(p, freq) : sameFrequency(p);
  if(!okFreq){ showNotification('Radio: mauvaise fréquence', 'warning', 1500); updateRadioLink(); return; }
  if(orderRejected(p, 'altitude')) return;
  p.alt = Math.max(0, p.alt + dA); 
  if(p.selected){
    selectedDiv.textContent = p.call + ' • ' + Math.round(p.alt)+' ft • '+Math.round(p.spd)+' kt';
  }
  if(p._manuallyControlled){
    showNotification('Altitude: ' + Math.round(p.alt) + ' ft', 'info', 2000);
  }
}

function runCommand(type, payload){
  const sel = entities.find(x=>x.selected);
  const cmd = Object.assign({
    type,
    targetId: payload && payload.targetId ? payload.targetId : (sel ? sel.id : null),
    radioFreq
  }, payload || {});
  if(mpMode === 'multi' && !mpIsHost){
    if(window.MP && typeof window.MP.sendCommand === 'function') window.MP.sendCommand(cmd);
    return;
  }
  applyCommand(cmd);
}

function applyCommand(cmd){
  if(!cmd || !cmd.type) return;
  const target = cmd.targetId ? entities.find(e=>e.id===cmd.targetId) : entities.find(e=>e.selected);
  const freq = cmd.radioFreq;
  switch(cmd.type){
    case 'turn':
      return commandTurnTarget(target, Number(cmd.delta||0), freq);
    case 'speed':
      return commandSpeedTarget(target, Number(cmd.dv||0), freq);
    case 'alt':
      return commandAltTarget(target, Number(cmd.dA||0), freq);
    case 'destroy': {
      const p = target; if(!p) return;
      const okFreq = (p.type!=='fighter') ? sameFrequencyValue(p, freq) : true;
      if(p.type!=='fighter' && !okFreq){ showNotification('Radio: mauvaise fréquence', 'warning', 1500); updateRadioLink(); return; }
      if(p.type !== 'fighter'){
        const fighter = entities.find(e=>e.type==='fighter' && e.targetId===p.id);
        if(!fighter){ info.textContent = 'Impossible: envoyer d\'abord un avion de chasse'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); return; }
        const idx = entities.indexOf(p); if(idx>=0){ entities.splice(idx,1); info.textContent='Cible neutralisée par le chasseur'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
        return;
      }
      if(p.type==='fighter' && p.targetId){ const t = entities.find(e=>e.id===p.targetId); if(t){ const ti=entities.indexOf(t); if(ti>=0) entities.splice(ti,1); info.textContent='Cible détruite par le chasseur'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); return; } }
      const idxf = entities.indexOf(p); if(idxf>=0){ entities.splice(idxf,1); info.textContent='Avion de chasse retiré'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
      return;
    }
    case 'alert': {
      const p = target; if(!p) return;
      if(!sameFrequencyValue(p, freq)){ showNotification('Radio: mauvaise fréquence', 'warning', 1500); updateRadioLink(); return; }
      if(orderRejected(p, 'retour base')) return;
      let nearest = null; let dmin = Infinity; for(let a of airports){ const d = Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){ dmin=d; nearest=a; } }
      if(nearest){ p.returning = true; p.hdg = Math.atan2(nearest.y-p.y, nearest.x-p.x); p.spd = Math.max(60, p.spd*0.8); info.textContent='Ordre: revenir à '+nearest.name; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
      return;
    }
    case 'dispatch': {
      const p = target; if(!p) return;
      if(!sameFrequencyValue(p, freq)){ showNotification('Radio: mauvaise fréquence', 'warning', 1500); updateRadioLink(); return; }
      let nearest = null; let dmin = Infinity; for(let a of airports){ const d = Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){ dmin=d; nearest=a; } }
      if(nearest){ spawnPlane('fighter', nearest.x+6, nearest.y, Math.atan2(p.y-nearest.y,p.x-nearest.x)); const f = entities[entities.length-1]; f.targetId = p.id; f._mode='escort'; info.textContent='Fighter lancé depuis '+nearest.name; showNotification('Fighter envoyé pour escorter ' + p.call, 'info', 3000); setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1500); }
      return;
    }
    case 'tanker': {
      const p = target; if(!p) return;
      const mode = cmd.mode === 'refuel' ? 'refuel' : 'force';
      dispatchTankerTo(p, mode === 'refuel' ? 'Refuel' : 'Commande', mode);
      return;
    }
    case 'sendController': {
      const enemies = entities.filter(e => e.type === 'enemy');
      if(enemies.length === 0){
        info.textContent = 'Aucun avion suspect détecté';
        setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1500);
        return;
      }
      enemies.forEach(enemy => {
        if(!enemy._alerted){
          enemy._alerted = true;
          enemy._alertTime = performance.now();
          showNotification('⚠️ Avion suspect alerté: ' + enemy.call, 'warning', 4000);
        }
      });
      info.textContent = 'Contrôleurs envoyés - ' + enemies.length + ' avion(s) suspect(s) alerté(s)';
      setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',2000);
      return;
    }
    case 'toggleTraj':
      showTrajectory = !showTrajectory;
      info.textContent = showTrajectory? 'Trajectoires: ON' : 'Trajectoires: OFF';
      setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',900);
      return;
    case 'toggleZones':
      showRadarZones = !showRadarZones;
      if(_elToggleZones) _elToggleZones.classList.toggle('active', showRadarZones);
      info.textContent = showRadarZones ? 'Zones radar: ON' : 'Zones radar: OFF';
      setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',900);
      return;
    default:
      return;
  }
}

function commandTurn(deltaDeg){ runCommand('turn', {delta: deltaDeg}); }
function commandSpeed(dv){ runCommand('speed', {dv}); }
function commandAlt(dA){ runCommand('alt', {dA}); }

const _elLeft = document.getElementById('left'); if(_elLeft) _elLeft.addEventListener('click', ()=>commandTurn(-15));
const _elRight = document.getElementById('right'); if(_elRight) _elRight.addEventListener('click', ()=>commandTurn(15));
const _elSlow = document.getElementById('slow'); if(_elSlow) _elSlow.addEventListener('click', ()=>commandSpeed(-20));
const _elFast = document.getElementById('fast'); if(_elFast) _elFast.addEventListener('click', ()=>commandSpeed(20));
const _elClimb = document.getElementById('climb'); if(_elClimb) _elClimb.addEventListener('click', ()=>commandAlt(1000));
const _elDesc = document.getElementById('desc'); if(_elDesc) _elDesc.addEventListener('click', ()=>commandAlt(-1000));

// Controls wired to static buttons in the HTML
const _elDestroy = document.getElementById('destroy'); if(_elDestroy) _elDestroy.addEventListener('click', ()=> runCommand('destroy'));

const _elAlert = document.getElementById('alert'); if(_elAlert) _elAlert.addEventListener('click', ()=> runCommand('alert'));

const _elDispatch = document.getElementById('dispatch'); if(_elDispatch) _elDispatch.addEventListener('click', ()=> runCommand('dispatch'));
const _elSendTanker = document.getElementById('send-tanker'); if(_elSendTanker) _elSendTanker.addEventListener('click', ()=> runCommand('tanker', {mode:'force'}));
const _elRefuel = document.getElementById('refuel'); if(_elRefuel) _elRefuel.addEventListener('click', ()=> runCommand('tanker', {mode:'refuel'}));

// Send controller to alert suspect aircraft
const _elSendController = document.getElementById('send-controller'); if(_elSendController) _elSendController.addEventListener('click', ()=> runCommand('sendController'));

const _elTraj = document.getElementById('traj'); if(_elTraj) _elTraj.addEventListener('click', ()=> runCommand('toggleTraj'));
const _elToggleZones = document.getElementById('toggle-zones'); if(_elToggleZones) _elToggleZones.addEventListener('click', ()=> runCommand('toggleZones'));
const _elToggleNotif = document.getElementById('toggle-notifications'); if(_elToggleNotif) _elToggleNotif.addEventListener('click', ()=>{
  notificationsEnabled = !notificationsEnabled;
  _elToggleNotif.classList.toggle('active', notificationsEnabled);
  const icon = _elToggleNotif.querySelector('.notif-icon');
  if(icon) icon.textContent = notificationsEnabled ? '🔔' : '🔕';
  if(!notificationsEnabled){
    clearNotifications();
  } else {
    showNotification('Notifications activees', 'info', 1200, true);
  }
});
const _elClearNotif = document.getElementById('clear-notifications'); if(_elClearNotif) _elClearNotif.addEventListener('click', ()=> clearNotifications());
const _elToggleFuelAlerts = document.getElementById('toggle-fuel-alerts'); if(_elToggleFuelAlerts) _elToggleFuelAlerts.addEventListener('click', ()=>{
  const panel = document.getElementById('fuel-alerts');
  if(!panel) return;
  panel.classList.toggle('hidden');
  updateFuelAlertsPanel();
});
const _elCloseFuelAlerts = document.getElementById('close-fuel-alerts'); if(_elCloseFuelAlerts) _elCloseFuelAlerts.addEventListener('click', ()=>{
  const panel = document.getElementById('fuel-alerts');
  if(panel) panel.classList.add('hidden');
});

// Radio UI buttons
const _rDec = document.getElementById('radio-dec'); if(_rDec) _rDec.addEventListener('click', ()=> { stepRadio(-1); showNotification('Radio: '+formatFreq(radioFreq)+' MHz', 'info', 800); });
const _rInc = document.getElementById('radio-inc'); if(_rInc) _rInc.addEventListener('click', ()=> { stepRadio(1); showNotification('Radio: '+formatFreq(radioFreq)+' MHz', 'info', 800); });
const _rSync = document.getElementById('radio-sync'); if(_rSync) _rSync.addEventListener('click', ()=>{ const p = entities.find(x=>x.selected); if(p){ setRadio(p.freq||radioFreq); showNotification('Radio réglée sur '+formatFreq(radioFreq)+' MHz', 'info', 1200); } else { showNotification('Aucun avion sélectionné', 'warning', 1200); } });

// Zoom buttons
const _zIn = document.getElementById('zoom-in'); if(_zIn) _zIn.addEventListener('click', ()=>{ const prev = cam.zoom; cam.zoom = Math.min(2.0, cam.zoom + 0.08); const k = cam.zoom/prev; cam.x = cx - (cx - cam.x) * k; cam.y = cy - (cy - cam.y) * k; clampCamera(); showNotification('Zoom: '+cam.zoom.toFixed(2), 'info', 800); });
const _zOut = document.getElementById('zoom-out'); if(_zOut) _zOut.addEventListener('click', ()=>{ const prev = cam.zoom; cam.zoom = Math.max(0.35, cam.zoom - 0.08); const k = cam.zoom/prev; cam.x = cx - (cx - cam.x) * k; cam.y = cy - (cy - cam.y) * k; clampCamera(); showNotification('Zoom: '+cam.zoom.toFixed(2), 'info', 800); });

// Init radio display
setRadio(radioFreq);
updatePlayTimeHud();
if(_elToggleZones) _elToggleZones.classList.toggle('active', showRadarZones);
updateFuelAlertsPanel();
setInterval(updateFuelAlertsPanel, 1000);

// loading overlay: hide after small delay when images ready
function hideLoading(){ const L = document.getElementById('loading'); if(L){ try{ L.style.display='none'; }catch(e){} } }
// Ensure promises are real promises (some browsers may not implement decode)
const decodes = [
  imgPlane.decode?.().catch(()=>{}), imgFighter.decode?.().catch(()=>{}), imgRafale.decode?.().catch(()=>{}), imgEnemy.decode?.().catch(()=>{}), imgAirport.decode?.().catch(()=>{}), imgCargo.decode?.().catch(()=>{}), imgA320.decode?.().catch(()=>{}), imgB737.decode?.().catch(()=>{}), imgE195.decode?.().catch(()=>{}), imgA321.decode?.().catch(()=>{}), imgA330.decode?.().catch(()=>{}), imgB777.decode?.().catch(()=>{}),
  imgA350.decode?.().catch(()=>{}), imgB787.decode?.().catch(()=>{}), imgB747.decode?.().catch(()=>{}), imgATR72.decode?.().catch(()=>{}), imgC172.decode?.().catch(()=>{})
].map(p=> p instanceof Promise ? p : Promise.resolve());
Promise.all(decodes).finally(()=>{
  // hide raw loading
  setTimeout(()=>{
    hideLoading();
  }, 300);
});
// Safety: if something blocks, forcibly hide loading after 5s
setTimeout(()=>{ 
  hideLoading(); 
}, 5000);


// pan / click handling (mouse)
let mouseDown = false, mouseStart = null, mousePanned = false;
canvas.addEventListener('mousedown', e=>{ mouseDown = true; mouseStart = {x:e.clientX, y:e.clientY}; mousePanned = false; });
window.addEventListener('mousemove', e=>{
  if(!mouseDown) return;
  const dx = e.clientX - mouseStart.x, dy = e.clientY - mouseStart.y;
  if(!mousePanned && Math.hypot(dx,dy) > 6) mousePanned = true;
  if(mousePanned){ cancelCameraFollow(); cam.x -= dx; cam.y -= dy; clampCamera(); mouseStart = {x:e.clientX, y:e.clientY}; }
});
window.addEventListener('mouseup', e=>{ if(mouseDown && !mousePanned){ /* let click handler run */ } mouseDown = false; mousePanned = false; });

// touch: single-finger tap = select, drag = pan
let touchState = null;
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1){ const t = e.touches[0]; const rect = canvas.getBoundingClientRect(); touchState = {x:t.clientX-rect.left, y:t.clientY-rect.top, screenX:t.clientX, screenY:t.clientY, time:Date.now(), panned:false}; }
  else if(e.touches.length===2){ // two-finger pan
    const t0 = e.touches[0], t1 = e.touches[1]; touchState = {x: (t0.clientX+t1.clientX)/2, y:(t0.clientY+t1.clientY)/2, screenX:(t0.clientX+t1.clientX)/2, screenY:(t0.clientY+t1.clientY)/2, panned:false}; }
});
canvas.addEventListener('touchmove', e=>{
  if(!touchState) return;
  if(e.touches.length>=1){ const t = e.touches[0]; const dx = t.clientX - touchState.screenX, dy = t.clientY - touchState.screenY; if(Math.hypot(dx,dy)>6){ touchState.panned = true; cancelCameraFollow(); cam.x -= dx; cam.y -= dy; clampCamera(); touchState.screenX = t.clientX; touchState.screenY = t.clientY; } }
});
canvas.addEventListener('touchend', e=>{
  if(!touchState) return; if(!touchState.panned){ const item = findEntityAt(touchState.x,touchState.y); selectEntity(item); }
  touchState = null;
});




