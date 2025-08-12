// overlay.js

// ✅ Railway public URL par défaut (HTTPS)
const DEFAULT_SERVER = "https://TON-SOUS-DOMAINE.up.railway.app";

// État (persisté dans localStorage)
let serverUrl = localStorage.getItem('greg_server') || DEFAULT_SERVER;
let guildId   = localStorage.getItem('greg_guild')  || "";
let userId    = localStorage.getItem('greg_user')   || "";

let socket = null;

// ----- Helpers UI -----
function setStatus(msg, ok = true) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = ok ? '#8f8' : '#f88';
}

function safeURL(str) {
  try { return new URL(str); } catch {}
  // Si l’user a oublié https:// on tente d’ajouter
  try { return new URL('https://' + str.replace(/^\/+/, '')); } catch {}
  return null;
}

function parseAndSaveConfig(inputStr) {
  const u = safeURL(inputStr.trim());
  if (!u) { setStatus("URL invalide.", false); return false; }

  // Server = origine (https://host)
  const nextServer = u.origin;

  // guild/user depuis query (?guild=...&user=...) ou alias ?g=...&u=...
  const qp = u.searchParams;
  const nextGuild = qp.get('guild') || qp.get('g') || guildId;
  const nextUser  = qp.get('user')  || qp.get('u') || userId;

  // Sauvegarde
  serverUrl = nextServer;
  guildId   = nextGuild || "";
  userId    = nextUser  || "";

  localStorage.setItem('greg_server', serverUrl);
  localStorage.setItem('greg_guild',  guildId);
  localStorage.setItem('greg_user',   userId);

  setStatus(`Config OK → serveur: ${serverUrl}  |  guild: ${guildId || '—'}  |  user: ${userId || '—'}`);
  reconnectSocket();
  return true;
}

// ----- Autocomplete -----
const SUGG_MAX = 3;
function debounce(fn, delay = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
function clearSuggestions() {
  const box = document.getElementById('suggestions');
  if (!box) return; box.innerHTML = ''; box.classList.add('hidden');
}
function renderSuggestions(items) {
  const box = document.getElementById('suggestions');
  if (!box) return;
  box.innerHTML = '';
  if (!items || items.length === 0) { box.classList.add('hidden'); return; }
  items.slice(0, SUGG_MAX).forEach(it => {
    const li = document.createElement('li');
    li.textContent = it.title || it.url || 'Sans titre';
    li.onclick = () => {
      addTrack(it.url || it.webpage_url || it.title || '');
      clearSuggestions();
      const entry = document.getElementById('entry'); if (entry) entry.value = '';
    };
    box.appendChild(li);
  });
  box.classList.remove('hidden');
}
async function fetchSuggestions(q) {
  const base = serverUrl || DEFAULT_SERVER;
  const url = `${base}/autocomplete?q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.results) ? data.results.slice(0, SUGG_MAX) : [];
  } catch { return []; }
}

// ----- Socket.IO -----
function connectSocket() {
  if (!serverUrl) return;
  try {
    socket = io(serverUrl, { transports: ['websocket'], reconnection: true });
    socket.on('connect',    () => setStatus(`Connecté à ${serverUrl}`));
    socket.on('disconnect', () => setStatus(`Déconnecté de ${serverUrl}`, false));
    socket.on('playlist_update', payload => updatePlaylist(payload));
  } catch (e) {
    console.error('Socket.IO error:', e);
    setStatus('Erreur Socket.IO', false);
  }
}
function reconnectSocket() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }
  connectSocket();
}

// ----- Playlist -----
function updatePlaylist(data) {
  const list = document.getElementById('playlist');
  list.innerHTML = '';
  const q = (data && data.queue) || [];
  const cur = data && data.current;
  q.forEach((item, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${item.title || item.url}`;
    if (cur && (cur.url === item.url || cur.title === item.title)) li.classList.add('playing');
    list.appendChild(li);
  });
}

// ----- API calls -----
function apiCall(action, body = {}) {
  if (!serverUrl || !guildId) { setStatus('Config incomplète (serveur/guild).', false); return; }
  fetch(`${serverUrl}/api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guild_id: guildId, ...body })
  }).catch(err => console.warn('API error', err));
}
function addTrack(text) {
  if (!text || !serverUrl || !guildId || !userId) { setStatus('Config incomplète (serveur/guild/user).', false); return; }
  fetch(`${serverUrl}/api/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: text, url: text, guild_id: guildId, user_id: userId })
  }).catch(err => console.warn('API error', err));
}

// ----- Boot -----
window.addEventListener('DOMContentLoaded', () => {
  // Préremplis l’input avec la valeur actuelle
  const cfg = document.getElementById('configInput');
  if (cfg) cfg.value = serverUrl + (guildId ? `/?guild=${guildId}` : '') + (userId ? `${guildId ? '&' : '/?'}user=${userId}` : '');

  document.getElementById('saveConfig')?.addEventListener('click', () => {
    const ok = parseAndSaveConfig(cfg.value || '');
    if (!ok) return;
  });
  cfg?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      parseAndSaveConfig(cfg.value || '');
      e.preventDefault();
    }
  });

  // Connexion socket
  connectSocket();
  setStatus(serverUrl ? `Prêt (serveur: ${serverUrl})` : 'Serveur non défini', !!serverUrl);

  // Saisie + autocomplete
  const entry = document.getElementById('entry');
  entry.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const first = document.querySelector('#suggestions li');
      if (first) { first.click(); e.preventDefault(); return; }
      addTrack(entry.value.trim());
      entry.value = '';
      clearSuggestions();
    }
    if (e.key === 'Escape') clearSuggestions();
  });
  entry.addEventListener('input', debounce(async () => {
    const q = entry.value.trim();
    if (q.length < 3) { clearSuggestions(); return; }
    const sugg = await fetchSuggestions(q);
    renderSuggestions(sugg);
  }, 250));
  document.addEventListener('click', (ev) => {
    const s = document.getElementById('suggestions');
    if (!s) return;
    if (!s.contains(ev.target) && ev.target !== entry) clearSuggestions();
  });

  // Boutons
  document.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      apiCall(action);
      clearSuggestions();
    });
  });
});
