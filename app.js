"use strict";

/* ============================================================
   STATE
   ============================================================ */
const STORAGE_KEY_ENTRIES = "hitster-generator-entries-v1";
const STORAGE_KEY_SETTINGS = "hitster-generator-settings-v1";
const CARDS_PER_PAGE = 6; // 2 columns x 3 rows at 8x8cm fits one A4 page

let entries = [];
let settings = {
  prefix: "A",
  startnum: 1,
  spotifyClientId: "",
  selectedPlaylistId: ""
};
let editingId = null;

/* ============================================================
   PERSISTENCE
   ============================================================ */
function loadState() {
  try {
    const rawEntries = localStorage.getItem(STORAGE_KEY_ENTRIES);
    if (rawEntries) entries = JSON.parse(rawEntries);
  } catch (e) { entries = []; }

  try {
    const rawSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (rawSettings) settings = Object.assign(settings, JSON.parse(rawSettings));
  } catch (e) { /* keep defaults */ }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

/* ============================================================
   HELPERS
   ============================================================ */
function uid() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function decadeColor(year) {
  const y = Number(year) || 0;
  const decade = Math.floor(y / 10);
  const hue = (decade * 53) % 360;
  return `hsl(${hue} 58% 47%)`;
}

function spotifySearchUrl(entry) {
  const q = `${entry.title} ${entry.artist}`.trim();
  return `https://open.spotify.com/search/${encodeURIComponent(q)}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function setStatus(msg, persistent) {
  const el = document.getElementById("status");
  el.textContent = msg;
  clearTimeout(setStatus._t);
  if (msg && !persistent) {
    setStatus._t = setTimeout(() => { el.textContent = ""; }, 3500);
  }
}

function suggestNextCode() {
  const prefix = (settings.prefix || "A").trim() || "A";
  const used = new Set(entries.map((e) => e.code));
  let n = Number(settings.startnum) || 1;
  while (used.has(prefix + n)) n++;
  return prefix + n;
}

/* ============================================================
   FORM HANDLING
   ============================================================ */
function fillFormDefaults() {
  document.getElementById("code").value = suggestNextCode();
}

function resetForm() {
  document.getElementById("card-form").reset();
  editingId = null;
  document.getElementById("submit-btn").textContent = "Karte hinzufügen";
  document.getElementById("cancel-edit-btn").hidden = true;
  fillFormDefaults();
  document.getElementById("year").focus();
}

function loadEntryIntoForm(entry) {
  editingId = entry.id;
  document.getElementById("year").value = entry.year;
  document.getElementById("artist").value = entry.artist;
  document.getElementById("title").value = entry.title;
  document.getElementById("link").value = entry.link || "";
  document.getElementById("code").value = entry.code;
  document.getElementById("submit-btn").textContent = "Aktualisieren";
  document.getElementById("cancel-edit-btn").hidden = false;
  document.getElementById("form-heading").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleFormSubmit(ev) {
  ev.preventDefault();

  const year = document.getElementById("year").value.trim();
  const artist = document.getElementById("artist").value.trim();
  const title = document.getElementById("title").value.trim();
  const link = document.getElementById("link").value.trim();
  let code = document.getElementById("code").value.trim();

  if (!year || !artist || !title) {
    setStatus("Bitte Jahr, Interpret und Titel ausfüllen.");
    return;
  }
  if (!code) code = suggestNextCode();

  // make sure code stays unique (ignore the entry currently being edited)
  const codeTaken = entries.some((e) => e.code === code && e.id !== editingId);
  if (codeTaken) {
    setStatus(`Code "${code}" wird schon verwendet — bitte einen anderen wählen.`);
    return;
  }

  if (editingId) {
    const entry = entries.find((e) => e.id === editingId);
    Object.assign(entry, { year, artist, title, link, code });
    setStatus("Karte aktualisiert.");
  } else {
    entries.push({ id: uid(), year, artist, title, link, code });
    setStatus("Karte hinzugefügt.");
  }

  saveState();
  resetForm();
  renderAll();
}

/* ============================================================
   LIST (entries table)
   ============================================================ */
function moveEntry(id, dir) {
  const i = entries.findIndex((e) => e.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= entries.length) return;
  [entries[i], entries[j]] = [entries[j], entries[i]];
  saveState();
  renderAll();
}

function deleteEntry(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  if (!confirm(`Karte "${entry.code}" (${entry.year} – ${entry.artist}) wirklich löschen?`)) return;
  entries = entries.filter((e) => e.id !== id);
  if (editingId === id) resetForm();
  saveState();
  renderAll();
}

function renderEntriesTable() {
  const body = document.getElementById("entries-body");
  const emptyHint = document.getElementById("empty-list-hint");
  body.innerHTML = "";

  document.getElementById("entry-count").textContent = entries.length;
  emptyHint.style.display = entries.length === 0 ? "block" : "none";

  entries.forEach((entry, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-order">
        <button type="button" class="row-btn" data-action="up" data-id="${entry.id}" ${i === 0 ? "disabled" : ""} title="Nach oben">▲</button>
        <button type="button" class="row-btn" data-action="down" data-id="${entry.id}" ${i === entries.length - 1 ? "disabled" : ""} title="Nach unten">▼</button>
      </td>
      <td class="cell-code">${escapeHtml(entry.code)}</td>
      <td>${escapeHtml(entry.year)}</td>
      <td>${escapeHtml(entry.artist)}</td>
      <td class="cell-title">${escapeHtml(entry.title)}</td>
      <td class="col-actions">
        <button type="button" class="row-btn" data-action="edit" data-id="${entry.id}" title="Bearbeiten">✎</button>
        <button type="button" class="row-btn danger" data-action="delete" data-id="${entry.id}" title="Löschen">✕</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function handleTableClick(ev) {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (action === "up") moveEntry(id, -1);
  else if (action === "down") moveEntry(id, 1);
  else if (action === "delete") deleteEntry(id);
  else if (action === "edit") {
    const entry = entries.find((e) => e.id === id);
    if (entry) loadEntryIntoForm(entry);
  }
}

/* ============================================================
   PRINT PAGES (front / back)
   ============================================================ */
function buildPageLabel(text) {
  const div = document.createElement("div");
  div.className = "page-label";
  div.textContent = text;
  return div;
}

function buildCardFront(entry) {
  const card = document.createElement("div");
  card.className = "card front";
  card.innerHTML = `
    <div class="decade-stripe" style="background:${decadeColor(entry.year)}"></div>
    <div class="qr-slot" data-qr-for="${entry.id}"></div>
    <div class="code-tag">${escapeHtml(entry.code)}</div>
  `;
  return card;
}

function buildCardBack(entry) {
  const card = document.createElement("div");
  card.className = "card back";
  card.innerHTML = `
    <div class="decade-stripe" style="background:${decadeColor(entry.year)}"></div>
    <div class="back-content">
      <div class="year">${escapeHtml(entry.year)}</div>
      <div class="artist">${escapeHtml(entry.artist)}</div>
      <div class="title">${escapeHtml(entry.title)}</div>
    </div>
    <div class="code-tag">${escapeHtml(entry.code)}</div>
  `;
  return card;
}

function buildPage(group, side) {
  const page = document.createElement("div");
  page.className = "page";
  const grid = document.createElement("div");
  grid.className = "grid";
  group.forEach((entry) => {
    grid.appendChild(side === "front" ? buildCardFront(entry) : buildCardBack(entry));
  });
  page.appendChild(grid);
  return page;
}

function renderPages() {
  const pagesEl = document.getElementById("pages");
  pagesEl.innerHTML = "";

  if (entries.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "Noch keine Karten — füge links deine erste Karte hinzu, um die Druckvorschau zu sehen.";
    pagesEl.appendChild(p);
    updateCountInfo();
    return;
  }

  const groups = chunk(entries, CARDS_PER_PAGE);

  groups.forEach((group, i) => {
    pagesEl.appendChild(buildPageLabel(`Vorderseiten — Seite ${i + 1} von ${groups.length}`));
    pagesEl.appendChild(buildPage(group, "front"));
  });
  groups.forEach((group, i) => {
    pagesEl.appendChild(buildPageLabel(`Rückseiten — Seite ${i + 1} von ${groups.length}`));
    pagesEl.appendChild(buildPage(group, "back"));
  });

  renderAllQrCodes();
  updateCountInfo();
}

function renderAllQrCodes() {
  if (typeof QRCode === "undefined") return; // CDN library not loaded (e.g. offline)
  document.querySelectorAll(".qr-slot").forEach((slot) => {
    const entry = entries.find((e) => e.id === slot.dataset.qrFor);
    if (!entry) return;
    const content = entry.link ? entry.link : spotifySearchUrl(entry);
    slot.innerHTML = "";
    // eslint-disable-next-line no-new
    new QRCode(slot, {
      text: content,
      width: 300,
      height: 300,
      correctLevel: QRCode.CorrectLevel.M
    });
  });
}

function updateCountInfo() {
  const pages = Math.ceil(entries.length / CARDS_PER_PAGE);
  document.getElementById("count-info").textContent =
    entries.length === 0
      ? "0 Karten"
      : `${entries.length} Karte${entries.length === 1 ? "" : "n"} · ${pages} Vorder- + ${pages} Rückseite${pages === 1 ? "" : "n"} (je 6 Karten pro A4-Seite)`;
}

/* ============================================================
   SETTINGS
   ============================================================ */
function bindSettings() {
  const prefixEl = document.getElementById("prefix");
  const startEl = document.getElementById("startnum");
  prefixEl.value = settings.prefix;
  startEl.value = settings.startnum;

  function persistAndSuggest() {
    settings.prefix = prefixEl.value.trim() || "A";
    settings.startnum = Number(startEl.value) || 1;
    saveState();
    if (!editingId) document.getElementById("code").value = suggestNextCode();
  }

  prefixEl.addEventListener("change", persistAndSuggest);
  startEl.addEventListener("change", persistAndSuggest);

  document.getElementById("renumber-btn").addEventListener("click", () => {
    const prefix = settings.prefix || "A";
    const start = Number(settings.startnum) || 1;
    entries.forEach((entry, i) => { entry.code = prefix + (start + i); });
    saveState();
    renderAll();
    setStatus("Codes wurden neu vergeben.");
  });

  // Spotify-Verbindung
  const redirectUri = getRedirectUri();
  document.getElementById("redirect-uri-display").textContent = redirectUri;
  document.getElementById("copy-redirect-btn").addEventListener("click", () => {
    navigator.clipboard?.writeText(redirectUri);
    setStatus("Redirect-URI kopiert.");
  });

  const spClientIdEl = document.getElementById("spotify-client-id");
  spClientIdEl.value = settings.spotifyClientId || "";
  spClientIdEl.addEventListener("change", () => {
    settings.spotifyClientId = spClientIdEl.value.trim();
    saveState();
  });

  document.getElementById("spotify-login-btn").addEventListener("click", async () => {
    settings.spotifyClientId = spClientIdEl.value.trim();
    saveState();
    try {
      await spotifyLogin();
    } catch (err) {
      document.getElementById("spotify-auth-status").textContent = err.message;
    }
  });

  document.getElementById("spotify-logout-btn").addEventListener("click", () => {
    spotifyLogout();
    document.getElementById("playlist-picker").hidden = true;
    document.getElementById("spotify-auth-status").textContent =
      "Getrennt. Bitte erneut verbinden (löst eine frische Anmeldung mit korrekten Berechtigungen aus).";
  });

  document.getElementById("spotify-playlist-select").addEventListener("change", (ev) => {
    settings.selectedPlaylistId = ev.target.value;
    saveState();
    updatePlaylistCacheInfo(readPlaylistTracksCache(settings.selectedPlaylistId));
  });

  document.getElementById("refresh-cache-btn").addEventListener("click", async () => {
    const btn = document.getElementById("refresh-cache-btn");
    if (!settings.selectedPlaylistId) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Lade …";
    try {
      const songs = await refreshPlaylistTracksCache(settings.selectedPlaylistId);
      setStatus(`Playlist aktualisiert: ${songs.length} Songs.`);
    } catch (err) {
      setStatus(spotifyApiErrorMessage(err));
    }
    btn.disabled = false;
    btn.textContent = original;
  });

  if (isLoggedIn()) {
    populatePlaylistSelect();
  } else {
    document.getElementById("spotify-auth-status").textContent = "Noch nicht verbunden.";
  }
}

/* ============================================================
   IMPORT / EXPORT
   ============================================================ */
function exportJson() {
  const data = JSON.stringify({ settings, entries }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hitster-karten.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("JSON exportiert.");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.entries)) throw new Error("Ungültiges Format");
      entries = data.entries.map((e) => ({
        id: uid(),
        year: e.year ?? "",
        artist: e.artist ?? "",
        title: e.title ?? "",
        link: e.link ?? "",
        code: e.code ?? ""
      }));
      if (data.settings) settings = Object.assign(settings, data.settings);
      saveState();
      renderAll();
      setStatus(`${entries.length} Karten importiert.`);
    } catch (err) {
      setStatus("Import fehlgeschlagen: Datei ist kein gültiges JSON aus diesem Generator.");
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   RANDOM GENERATOR — sources real songs directly from one of
   YOUR OWN Spotify playlists. No YouTube, no fuzzy title parsing,
   no separate verification step: year, artist, title and the
   exact track link all come straight from the Spotify Web API,
   because they're read directly off the playlist's tracks.

   Auth uses the Authorization Code Flow WITH PKCE (no client
   secret needed — safe for a static site with no backend). Since
   Spotify's Feb 2026 API changes, playlist track listings are
   only returned for playlists the logged-in account owns or
   collaborates on — so build your own playlist with songs across
   decades in the regular Spotify app, then pick it here.

   Setup needed (see "Spotify-Verbindung" panel):
   - A free Spotify Client ID (Spotify Developer Dashboard,
     "Development Mode" app — requires the account to have an
     active Premium plan, and the redirect URI shown below must
     be registered exactly in the dashboard)
   - Logging in once with the Spotify account that owns/follows
     the playlist you want to use
   ============================================================ */

const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SPOTIFY_SCOPES = "playlist-read-private playlist-read-collaborative";
const PLAYLIST_TRACKS_CACHE_KEY = "hitster-generator-playlist-tracks-v1";

const SP_KEYS = {
  verifier: "hitster-generator-spotify-verifier",
  accessToken: "hitster-generator-spotify-access-token",
  expiresAt: "hitster-generator-spotify-expires-at",
  refreshToken: "hitster-generator-spotify-refresh-token"
};

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

/* ---------- PKCE helpers ---------- */
function generateRandomString(length) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  let text = "";
  values.forEach((v) => { text += possible[v % possible.length]; });
  return text;
}

async function sha256(plain) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}

function base64UrlEncode(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeChallenge(verifier) {
  return base64UrlEncode(await sha256(verifier));
}

function saveSpotifyTokens(data) {
  const expiresAt = Date.now() + (data.expires_in - 30) * 1000;
  localStorage.setItem(SP_KEYS.accessToken, data.access_token);
  localStorage.setItem(SP_KEYS.expiresAt, String(expiresAt));
  if (data.refresh_token) localStorage.setItem(SP_KEYS.refreshToken, data.refresh_token);
}

/* ---------- PKCE Auth Flow ---------- */
async function spotifyLogin() {
  if (!settings.spotifyClientId) {
    throw new Error("Bitte zuerst deine Spotify Client-ID eintragen.");
  }
  const verifier = generateRandomString(64);
  localStorage.setItem(SP_KEYS.verifier, verifier);
  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams({
    client_id: settings.spotifyClientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SPOTIFY_SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge
  });
  window.location.href = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
}

async function handleSpotifyRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");

  if (error) {
    history.replaceState({}, document.title, window.location.pathname);
    throw new Error(`Spotify hat die Anfrage abgelehnt: ${error}`);
  }
  if (!code) return false;

  const verifier = localStorage.getItem(SP_KEYS.verifier);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: settings.spotifyClientId,
    code_verifier: verifier
  });

  const res = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json().catch(() => null);
  history.replaceState({}, document.title, window.location.pathname);

  if (!res.ok || !data) {
    throw new Error((data && data.error_description) || "Token-Austausch fehlgeschlagen.");
  }
  saveSpotifyTokens(data);
  return true;
}

async function refreshSpotifyAccessToken() {
  const refreshToken = localStorage.getItem(SP_KEYS.refreshToken);
  if (!refreshToken) throw new Error("Keine gültige Sitzung — bitte neu verbinden.");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: settings.spotifyClientId
  });
  const res = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error((data && data.error_description) || "Sitzung erneuern fehlgeschlagen — bitte neu verbinden.");
  }
  saveSpotifyTokens(data);
  return data.access_token;
}

async function getValidAccessToken() {
  const token = localStorage.getItem(SP_KEYS.accessToken);
  const expiresAt = Number(localStorage.getItem(SP_KEYS.expiresAt) || 0);
  if (token && Date.now() < expiresAt) return token;
  return refreshSpotifyAccessToken();
}

function isLoggedIn() {
  return !!localStorage.getItem(SP_KEYS.refreshToken);
}

function spotifyLogout() {
  Object.values(SP_KEYS).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem(PLAYLIST_TRACKS_CACHE_KEY);
}

function spotifyApiErrorMessage(err) {
  const msg = (err && err.message) || "";
  if (/access token expired|invalid_grant/i.test(msg)) {
    return "Sitzung abgelaufen — bitte unter „Spotify-Verbindung“ neu verbinden.";
  }
  if (/429/.test(msg)) return "Spotify-API gerade ausgelastet — kurz warten und nochmal versuchen.";
  return `Spotify-API-Fehler: ${msg || "unbekannt"}.`;
}

/* ---------- Spotify Web API: eigene Playlists + ihre Tracks ---------- */
async function fetchUserPlaylists() {
  const token = await getValidAccessToken();
  let items = [];
  let url = "https://api.spotify.com/v1/me/playlists?limit=50";
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
    }
    items = items.concat(data.items || []);
    url = data.next;
  }
  return items.filter(Boolean);
}

async function fetchPlaylistTracks(playlistId) {
  const token = await getValidAccessToken();
  let items = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
    }
    items = items.concat(data.items || []);
    url = data.next;
  }

  const songs = [];
  const currentYear = new Date().getFullYear();
  items.forEach((item) => {
    const track = item && item.item;
    if (!track || track.is_local) return;
    const releaseDate = track.album && track.album.release_date;
    if (!releaseDate || !track.name || !track.artists || !track.artists.length) return;
    const year = Number(String(releaseDate).slice(0, 4));
    if (!year || year < 1900 || year > currentYear) return;
    songs.push({
      year: String(year),
      artist: track.artists.map((a) => a.name).join(", "),
      title: track.name,
      link: (track.external_urls && track.external_urls.spotify) || `https://open.spotify.com/track/${track.id}`
    });
  });
  return songs;
}

function readPlaylistTracksCache(playlistId) {
  try {
    const raw = localStorage.getItem(PLAYLIST_TRACKS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (cache && cache.playlistId === playlistId && Array.isArray(cache.songs) && cache.songs.length) {
      return cache;
    }
  } catch (e) { /* ignore corrupt cache */ }
  return null;
}

async function refreshPlaylistTracksCache(playlistId) {
  const songs = await fetchPlaylistTracks(playlistId);
  const cache = { playlistId, songs, cachedAt: Date.now() };
  localStorage.setItem(PLAYLIST_TRACKS_CACHE_KEY, JSON.stringify(cache));
  updatePlaylistCacheInfo(cache);
  return songs;
}

async function ensurePlaylistTracksCache(playlistId) {
  const cached = readPlaylistTracksCache(playlistId);
  if (cached) {
    updatePlaylistCacheInfo(cached);
    return cached.songs;
  }
  return refreshPlaylistTracksCache(playlistId);
}

function updatePlaylistCacheInfo(cache) {
  const el = document.getElementById("playlist-cache-info");
  if (!el) return;
  if (!cache) {
    el.textContent = "Noch keine Songs geladen.";
    return;
  }
  const ageMin = Math.round((Date.now() - cache.cachedAt) / 60000);
  el.textContent = `${cache.songs.length} Songs geladen (zuletzt aktualisiert: vor ${ageMin} Min.).`;
}

async function populatePlaylistSelect() {
  const select = document.getElementById("spotify-playlist-select");
  const picker = document.getElementById("playlist-picker");
  const statusEl = document.getElementById("spotify-auth-status");
  try {
    const playlists = await fetchUserPlaylists();
    select.innerHTML = "";
    if (playlists.length === 0) {
      select.innerHTML = '<option value="">Keine eigenen Playlists gefunden</option>';
    } else {
      playlists.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        const total = p.tracks && p.tracks.total;
        opt.textContent = `${p.name} (${total ?? "?"} Songs)`;
        select.appendChild(opt);
      });
      if (settings.selectedPlaylistId && playlists.some((p) => p.id === settings.selectedPlaylistId)) {
        select.value = settings.selectedPlaylistId;
      } else {
        settings.selectedPlaylistId = select.value;
        saveState();
      }
    }
    picker.hidden = false;
    statusEl.textContent = "Mit Spotify verbunden.";
    updatePlaylistCacheInfo(readPlaylistTracksCache(settings.selectedPlaylistId));
  } catch (err) {
    statusEl.textContent = spotifyApiErrorMessage(err);
  }
}

/* ---------- main pipeline ---------- */
async function generateRandomCards(n) {
  const btn = document.getElementById("random-btn");
  const originalText = btn.textContent;

  if (!isLoggedIn()) {
    setStatus("Bitte zuerst unter „Spotify-Verbindung“ mit Spotify verbinden.");
    return;
  }
  const playlistId = settings.selectedPlaylistId;
  if (!playlistId) {
    setStatus("Bitte zuerst eine eigene Playlist als Quelle auswählen.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Lade Playlist …";

  let pool;
  try {
    pool = await ensurePlaylistTracksCache(playlistId);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalText;
    setStatus(spotifyApiErrorMessage(err));
    return;
  }

  btn.disabled = false;
  btn.textContent = originalText;

  if (!pool || pool.length === 0) {
    setStatus("Diese Playlist enthält keine verwertbaren Songs (z. B. fehlendes Erscheinungsjahr).");
    return;
  }

  const existingKeys = new Set(entries.map((e) => `${e.artist}|${e.title}`.toLowerCase()));
  const titleUsed = new Set(entries.map((e) => e.title.trim().toLowerCase()));
  const order = shuffleArray(pool);
  const picks = [];

  for (const song of order) {
    if (picks.length >= n) break;
    const key = `${song.artist}|${song.title}`.toLowerCase();
    const titleKey = song.title.trim().toLowerCase();
    if (existingKeys.has(key) || titleUsed.has(titleKey)) continue;
    existingKeys.add(key);
    titleUsed.add(titleKey);
    picks.push(song);
  }

  if (picks.length === 0) {
    setStatus("Keine neuen Songs mehr in dieser Playlist (oder schon alle als Karten vorhanden).");
    return;
  }

  picks.forEach((song) => {
    entries.push({
      id: uid(),
      year: song.year,
      artist: song.artist,
      title: song.title,
      link: song.link,
      code: suggestNextCode()
    });
  });

  saveState();
  renderAll();

  setStatus(
    picks.length < n
      ? `Nur ${picks.length} von ${n} Songs gefunden — die Playlist hat nicht mehr genug unbenutzte Songs. Füge mehr Songs zur Playlist hinzu oder klicke erneut.`
      : `${picks.length} Karten direkt aus deiner Spotify-Playlist erstellt.`
  );
}


/* ============================================================
   INIT
   ============================================================ */
function renderAll() {
  renderEntriesTable();
  renderPages();
}

async function init() {
  loadState();

  document.getElementById("card-form").addEventListener("submit", handleFormSubmit);
  document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);
  document.getElementById("entries-body").addEventListener("click", handleTableClick);
  document.getElementById("print-btn").addEventListener("click", () => window.print());
  document.getElementById("clear-btn").addEventListener("click", () => {
    if (entries.length === 0) return;
    if (!confirm("Wirklich ALLE Karten löschen? Das kann nicht rückgängig gemacht werden.")) return;
    entries = [];
    saveState();
    renderAll();
    setStatus("Alle Karten gelöscht.");
  });
  document.getElementById("random-btn").addEventListener("click", () => {
    const n = Math.max(1, Math.min(100, Number(document.getElementById("random-count").value) || 20));
    generateRandomCards(n);
  });
  document.getElementById("export-btn").addEventListener("click", exportJson);
  document.getElementById("import-input").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (file) importJson(file);
    ev.target.value = "";
  });

  try {
    const handled = await handleSpotifyRedirectCallback();
    if (handled) setStatus("Mit Spotify verbunden.", true);
  } catch (err) {
    setStatus(err.message, true);
  }

  bindSettings();
  fillFormDefaults();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
