// overlay.js — HUD non cliquable + panneau animé via hotkey, OAuth facultatif

const DEFAULT_SERVER = window.location.origin;
const HOTKEY = { code: 'KeyO', shiftKey: true, altKey: true }; // Shift+Alt+O

let serverUrl = localStorage.getItem('greg_server') || DEFAULT_SERVER;
let guildId   = localStorage.getItem('greg_guild')  || "";
let userId    = "";      // vient de /api/me si connecté
let repeatAll = false;
let socket    = null;

// ---------- Helpers ----------
function setStatus(msg, ok = true) {
  const el = document.getElementById('statusMessage');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'status-message ' + (ok ? 'status-success' : 'status-error');
}
function fmtTime(s) {
  if (s == null || isNaN(s)) return "0:00";
  s = Math.max(0, parseInt(s, 10) || 0);
  const m = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}
function setPlayPauseVisual(isPaused) {
  const btn = document.getElementById('playPauseBtn');
  if (!btn) return;

  const use = btn.querySelector('use');
  if (use) use.setAttribute('href', isPaused ? '#icon-play' : '#icon-pause');

  btn.title = isPaused ? 'Lecture' : 'Pause';
  btn.classList.toggle('playing', !isPaused);
}

function applyRepeatVisual() {
  const btn = document.getElementById('repeatBtn');
  if (btn) btn.classList.toggle('active', !!repeatAll);
}
function safeURL(str) {
  try { return new URL(str); } catch {}
  try { return new URL('https://' + String(str).replace(/^\/+/, '')); } catch {}
  return null;
}
async function fetchJSON(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function updateAuthLinks() {
  const loginBtn  = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (loginBtn)  loginBtn.href  = `${serverUrl}/login`;
  if (logoutBtn) logoutBtn.href = `${serverUrl}/logout`;
}
function toggleHud(forceState) {
  const body = document.body;
  const wantPanel = (typeof forceState === 'boolean') ? forceState : !body.classList.contains('panel-open');
  if (wantPanel) {
    body.classList.add('panel-open');
    body.classList.remove('hud-only');
  } else {
    body.classList.add('hud-only');
    body.classList.remove('panel-open');
  }
}

// ---------- OAuth awareness ----------
async function fetchMe() {
  try {
    const me = await fetchJSON(`${serverUrl}/api/me`);
    const authBlock = document.getElementById('authBlock');
    const loginBtn  = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if (me && me.auth) {
      userId = me.id;
      authBlock.textContent = `Connecté : ${me.username}`;
      authBlock.className = 'status-message status-success';
      loginBtn.style.display  = 'none';
      logoutBtn.style.display = 'inline-block';
    } else {
      userId = "";
      authBlock.textContent = "Non connecté — utilisez Discord OAuth.";
      authBlock.className = 'status-message status-error';
      loginBtn.style.display  = 'inline-block';
      logoutBtn.style.display = 'none';
    }
  } catch {
    userId = "";
    const authBlock = document.getElementById('authBlock');
    const loginBtn  = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    authBlock.textContent = "Session indisponible (utilisez le même domaine que le serveur pour OAuth).";
    authBlock.className = 'status-message status-error';
    loginBtn.style.display  = 'inline-block';
    logoutBtn.style.display = 'none';
  }
}

// ---------- Config logique ----------
async function fetchGuilds() {
  try {
    const r = await fetch(`${serverUrl}/api/guilds`, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    setStatus(`Impossible de charger les serveurs: ${e}`, false);
    return [];
  }
}
async function populateGuildSelect() {
  const sel = document.getElementById('configGuild');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Chargement… —</option>`;
  const items = await fetchGuilds();
  sel.innerHTML = '';
  if (!items.length) {
    sel.innerHTML = `<option value="">(Aucun serveur trouvé)</option>`;
    return;
  }
  for (const g of items) {
    const opt = document.createElement('option');
    opt.value = String(g.id);
    opt.textContent = `${g.name} (${g.id})`;
    sel.appendChild(opt);
  }
  if (guildId) sel.value = String(guildId);
}
async function applyServerFromInput() {
  const input = document.getElementById('configServerInput');
  const val = (input?.value || '').trim();
  const u = safeURL(val || serverUrl || DEFAULT_SERVER);
  if (!u) { setStatus("URL de serveur invalide.", false); return false; }
  serverUrl = u.origin;
  localStorage.setItem('greg_server', serverUrl);
  updateAuthLinks();
  await fetchMe();
  await populateGuildSelect();
  setStatus(`Serveur défini: ${serverUrl}`);
  reconnectSocket();
  return true;
}
function saveConfig() {
  const selGuild = document.getElementById('configGuild');
  guildId = (selGuild?.value || '').trim();
  localStorage.setItem('greg_guild', guildId);
  if (!guildId) return setStatus("Choisis un serveur.", false);
  if (!userId)  setStatus("Note: pas connecté — /api/play exigera user_id.", false);
  else          setStatus(`Config OK → serveur: ${serverUrl} | guild: ${guildId}`);
}
function apiPost(endpoint, payload) {
  return fetch(`${serverUrl}${endpoint}`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    credentials: 'include',
    body: JSON.stringify(payload || {})
  });
}
function apiAction(action) {
  if (!guildId) { setStatus('guild_id manquant.', false); return; }
  return apiPost(`/api/${action}`, { guild_id: guildId }).catch(e => console.warn('API error', e));
}
function addTrack(text) {
  if (!text || !guildId) { setStatus('Config incomplète (guild).', false); return; }
  const body = { title: text, url: text, guild_id: guildId };
  return apiPost('/api/play', body).catch(e => console.warn('API error', e));
}

// ---------- Autocomplete ----------
const SUGG_MAX = 3;
function debounce(fn, delay = 250) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay);} }
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
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `
      <div class="suggestion-title">${it.title || it.url || 'Sans titre'}</div>
      <div class="suggestion-info">${(it.url || it.webpage_url || '').replace(/^https?:\/\//,'')}</div>
    `;
    div.onclick = () => {
      addTrack(it.url || it.webpage_url || it.title || '');
      clearSuggestions();
      const input = document.getElementById('urlInput');
      if (input) input.value = '';
    };
    box.appendChild(div);
  });
  box.classList.remove('hidden');
}
async function fetchSuggestions(q) {
  try {
    const r = await fetch(`${serverUrl}/autocomplete?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.results) ? data.results.slice(0, SUGG_MAX) : [];
  } catch { return []; }
}

// ---------- Socket.IO ----------
function connectSocket() {
  if (!serverUrl) return;
  try {
    socket = io(serverUrl, { transports: ['websocket'], reconnection: true, withCredentials: true });
    socket.on('connect',    () => setStatus(`Connecté à ${serverUrl}`));
    socket.on('disconnect', () => setStatus(`Déconnecté de ${serverUrl}`, false));
    socket.on('playlist_update', payload => updateUI(payload));
  } catch (e) {
    console.error('Socket.IO error:', e);
    setStatus('Erreur Socket.IO', false);
  }
}
function reconnectSocket() {
  if (socket) { try { socket.disconnect(); } catch {} socket = null; }
  connectSocket();
}

// ---------- UI Update ----------
function updateUI(data) {
  // File d’attente (panneau)
  const queueEl = document.getElementById('queueList');
  queueEl.innerHTML = '';
  const queue = (data && data.queue) || [];
  const current = data && data.current;

  queue.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'queue-item' + ((current && (current.url === it.url || current.title === it.title)) ? ' playing' : '');
    row.innerHTML = `
      <div class="queue-number">${i+1}</div>
      <div class="queue-info"><div class="queue-track">${it.title || it.url}</div></div>
      <div class="queue-duration">${it.duration ? fmtTime(it.duration) : ''}</div>
      <button class="queue-remove" title="Retirer (bientôt)">✕</button>
    `;
    queueEl.appendChild(row);
  });

  // Texte & jaquette panneau
  const titleEl = document.getElementById('trackTitle');
  const artistEl = document.getElementById('trackArtist');
  const artwork  = document.getElementById('artwork');
  const prog = (data && data.progress) || {};
  const elapsed = prog.elapsed ?? 0;
  const duration = prog.duration ?? 0;

  if (current) {
    titleEl.textContent = current.title || 'Sans titre';
    artistEl.textContent = current.url || '';
  } else {
    titleEl.textContent = 'Aucune piste';
    artistEl.textContent = 'En attente...';
  }

  if (data && data.thumbnail) {
    artwork.style.backgroundImage = `url("${data.thumbnail}")`;
    artwork.textContent = '';
    artwork.classList.add('has-img');
  } else {
    artwork.style.backgroundImage = '';
    artwork.textContent = '🎵';
    artwork.classList.remove('has-img');
  }

  // Progress panneau
  document.getElementById('currentTime').textContent = fmtTime(elapsed);
  document.getElementById('totalTime').textContent   = duration ? fmtTime(duration) : "0:00";
  const pct = (duration > 0) ? Math.min(100, Math.floor(elapsed*100/duration)) : 0;
  document.getElementById('progressFill').style.width = pct + '%';

  // HUD (toujours à jour, non cliquable)
  const hudTitle = document.getElementById('hudTitle');
  const hudArt   = document.getElementById('hudArt');
  const hudTime  = document.getElementById('hudTime');
  const hudFill  = document.getElementById('hudProgressFill');

  hudTitle.textContent = current ? (current.title || 'Sans titre') : 'Aucune piste';
  hudTime.textContent  = `${fmtTime(elapsed)} / ${duration ? fmtTime(duration) : '0:00'}`;
  hudFill.style.width  = pct + '%';
  if (data && data.thumbnail) {
    hudArt.style.backgroundImage = `url("${data.thumbnail}")`;
    hudArt.textContent = '';
  } else {
    hudArt.style.backgroundImage = '';
    hudArt.textContent = '🎵';
  }

  // Play/Pause & Repeat
  setPlayPauseVisual(data && data.is_paused);
  if (typeof data.repeat_all === 'boolean') {
    repeatAll = data.repeat_all; applyRepeatVisual();
  }

  // Désactivation des boutons si pas de guild
  const disabled = !guildId;
  for (const id of ['stopBtn','prevBtn','playPauseBtn','nextBtn','repeatBtn','addBtn']) {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  }
}

// ---------- DOM Ready ----------
window.addEventListener('DOMContentLoaded', async () => {
  // Raccourci clavier HUD <-> panneau
  window.addEventListener('keydown', (e) => {
    if (e.code === HOTKEY.code && !!e.altKey === HOTKEY.altKey && !!e.shiftKey === HOTKEY.shiftKey) {
      toggleHud(); e.preventDefault();
    }
  });

  // Panneau config
  document.getElementById('settingsToggle').addEventListener('click', () => {
    document.getElementById('configPanel').classList.toggle('hidden');
  });
  document.getElementById('configClose').addEventListener('click', () => {
    document.getElementById('configPanel').classList.add('hidden');
  });

  // URL serveur
  const serverInput = document.getElementById('configServerInput');
  if (serverInput) serverInput.value = serverUrl || '';
  serverInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') { await applyServerFromInput(); }
  });

  // Boutons config
  document.getElementById('configSave').addEventListener('click', saveConfig);
  document.getElementById('configReload').addEventListener('click', () => populateGuildSelect());

  // OAuth + guilds + socket
  updateAuthLinks();
  await fetchMe();
  await populateGuildSelect();
  connectSocket();

  // Input + suggestions
  const urlInput = document.getElementById('urlInput');
  const addBtn = document.getElementById('addBtn');
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const first = document.querySelector('#suggestions .suggestion-item');
      if (first) { first.click(); e.preventDefault(); return; }
      addTrack(urlInput.value.trim());
      urlInput.value = ''; clearSuggestions();
    }
    if (e.key === 'Escape') clearSuggestions();
  });
  urlInput.addEventListener('input', debounce(async () => {
    const q = urlInput.value.trim();
    if (q.length < 3) { clearSuggestions(); return; }
    renderSuggestions(await fetchSuggestions(q));
  }, 250));
  addBtn.addEventListener('click', () => {
    const v = urlInput.value.trim();
    if (!v) return;
    addTrack(v); urlInput.value = ''; clearSuggestions();
  });
  document.addEventListener('click', (ev) => {
    const s = document.getElementById('suggestions');
    if (!s) return;
    if (!s.contains(ev.target) && ev.target !== urlInput) clearSuggestions();
  });

  // Contrôles
  document.getElementById('stopBtn').addEventListener('click', () => apiAction('stop'));
  document.getElementById('nextBtn').addEventListener('click', () => apiAction('skip'));
  document.getElementById('playPauseBtn').addEventListener('click', () => apiAction('toggle_pause'));
  document.getElementById('prevBtn').addEventListener('click', () => apiAction('restart'));
  document.getElementById('repeatBtn').addEventListener('click', async () => {
    if (!guildId) { setStatus('guild_id manquant.', false); return; }
    try {
      const res = await apiPost('/api/repeat', { guild_id: guildId });
      const json = await res.json().catch(() => ({}));
      if (typeof json.repeat_all === 'boolean') {
        repeatAll = json.repeat_all; applyRepeatVisual();
      }
    } catch (e) { console.warn(e); }
  });

  // État initial
  setStatus(serverUrl ? `Prêt (serveur: ${serverUrl})` : 'Serveur non défini', !!serverUrl);
  setPlayPauseVisual(true);
});
