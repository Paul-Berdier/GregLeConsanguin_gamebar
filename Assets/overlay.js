// overlay.js
//
// This script runs inside the Game Bar widget's WebView.  It connects to the
// backend via Socket.IO to receive playlist updates and uses fetch() to issue
// control commands.  The server URL and guild/user IDs are stored in
// localStorage; edit DEFAULT_SERVER to match your environment if needed.

// ✅ Railway public URL (HTTPS, no port)
const DEFAULT_SERVER = "https://gregleconsanguin.up.railway.app";

// Attempt to load persistent settings from localStorage
let serverUrl = localStorage.getItem('greg_server') || DEFAULT_SERVER;
let guildId  = localStorage.getItem('greg_guild')  || "";
let userId   = localStorage.getItem('greg_user')   || "";

// --- Autocomplete helpers ---
const SUGG_MAX = 3;

function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function clearSuggestions() {
  const box = document.getElementById('suggestions');
  if (!box) return;
  box.innerHTML = '';
  box.classList.add('hidden');
}

function renderSuggestions(items) {
  const box = document.getElementById('suggestions');
  if (!box) return;
  box.innerHTML = '';
  if (!items || items.length === 0) {
    box.classList.add('hidden');
    return;
  }
  items.slice(0, SUGG_MAX).forEach(it => {
    const li = document.createElement('li');
    li.textContent = it.title || it.url || 'Sans titre';
    li.onclick = () => {
      // joue directement l’URL si dispo, sinon le texte
      addTrack(it.url || it.webpage_url || it.title || '');
      clearSuggestions();
      const entry = document.getElementById('entry');
      if (entry) entry.value = '';
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
  } catch {
    return [];
  }
}

// Connect to Socket.IO and listen for playlist updates
function connectSocket() {
  if (!serverUrl) return;
  try {
    const socket = io(serverUrl, { transports: ['websocket'], reconnection: true });
    socket.on('connect', () => console.log('[Greg] Socket connected'));
    socket.on('playlist_update', payload => {
      updatePlaylist(payload);
    });
    socket.on('disconnect', () => console.log('[Greg] Socket disconnected'));
  } catch (e) {
    console.error('Socket.IO error:', e);
  }
}

// Render the playlist in the UI
function updatePlaylist(data) {
  const list = document.getElementById('playlist');
  list.innerHTML = '';
  const q = (data && data.queue) || [];
  const cur = data && data.current;
  q.forEach((item, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${item.title || item.url}`;
    if (cur && (cur.url === item.url || cur.title === item.title)) {
      li.classList.add('playing');
    }
    list.appendChild(li);
  });
}

// Send a POST request to the backend for the given action
function apiCall(action, body = {}) {
  if (!serverUrl || !guildId) return;
  fetch(`${serverUrl}/api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guild_id: guildId, ...body })
  }).catch(err => console.warn('API error', err));
}

// Add a track to the queue
function addTrack(text) {
  if (!text || !serverUrl || !guildId || !userId) return;
  fetch(`${serverUrl}/api/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: text, url: text, guild_id: guildId, user_id: userId })
  }).catch(err => console.warn('API error', err));
}

// Initialize UI and connect the socket after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Start the socket connection
  connectSocket();

  const entry = document.getElementById('entry');

  entry.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      // Si des suggestions sont visibles, on prend la 1ère
      const first = document.querySelector('#suggestions li');
      if (first) {
        first.click();
        e.preventDefault();
        return;
      }
      addTrack(entry.value.trim());
      entry.value = '';
      clearSuggestions();
    }
    if (e.key === 'Escape') {
      clearSuggestions();
    }
  });

  // Autocomplete (debounce 250ms)
  entry.addEventListener('input', debounce(async () => {
    const q = entry.value.trim();
    if (q.length < 3) {
      clearSuggestions();
      return;
    }
    const sugg = await fetchSuggestions(q);
    renderSuggestions(sugg);
  }, 250));

  // Fermer la liste si on clique ailleurs
  document.addEventListener('click', (ev) => {
    const s = document.getElementById('suggestions');
    if (!s) return;
    if (!s.contains(ev.target) && ev.target !== entry) clearSuggestions();
  });

  // Boutons d’action
  document.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      apiCall(action);
      clearSuggestions();
    });
  });
});
