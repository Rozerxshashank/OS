// app.js - Simple single-page fetch + grid + charts + click-to-details
const RAWG_KEY = "a9984ae797654f36b8dab8ae200978c7";
const PAGE_SIZE = 40; // single-page size

// DOM refs
const gamesEl = document.getElementById("games");
const selectedEl = document.getElementById("selected");
const refreshBtn = document.getElementById("refresh");
const searchInput = document.getElementById("search");
const countEl = document.getElementById("count");
const topList = document.getElementById("topList");

const genresCanvas = document.getElementById("genresChart");
const platformsCanvas = document.getElementById("platformChart");
const ratingCanvas = document.getElementById("ratingChart");

// Small state
let games = [];       // games loaded from single API page
let filtered = [];    // games after search/filter
let charts = { genres: null, platforms: null, ratings: null };

// ---- Helpers ----
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

// ---- Fetch single page of trending games ----
async function loadOnePage() {
  gamesEl.innerHTML = '<div class="muted">Loading trending games…</div>';
  try {
    const url = `https://api.rawg.io/api/games?key=${RAWG_KEY}&page_size=${PAGE_SIZE}&ordering=-added`;
    const data = await fetchJson(url);
    games = Array.isArray(data.results) ? data.results : [];
    filtered = games.slice();
    renderAll();
  } catch (err) {
    gamesEl.innerHTML = `<div class="muted">Failed to load: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

// ---- Render grid + top list + charts ----
function renderAll() {
  renderGrid(filtered);
  renderTopList(filtered);
  updateCharts(filtered);
  countEl.textContent = `${filtered.length} results`;
}

function createCard(g) {
  const card = document.createElement("div");
  card.className = "game-card";
  const img = escapeHtml(g.background_image || "https://via.placeholder.com/320x180?text=No+Image");
  const title = escapeHtml(g.name || "Unknown");
  const rating = g.rating !== undefined && g.rating !== null ? g.rating : "—";
  const added = g.added !== undefined && g.added !== null ? g.added : "—";
  const released = g.released || "—";

  card.innerHTML = `
    <img src="${img}" alt="${title}" />
    <div class="game-meta">
      <div class="title">${title}</div>
      <div class="sub">Rating: ${rating} • Added: ${added}</div>
      <div class="sub">Released: ${released}</div>
    </div>
  `;

  card.addEventListener("click", () => onGameClick(g));
  return card;
}

function renderGrid(list) {
  gamesEl.innerHTML = "";
  if (!list || list.length === 0) {
    gamesEl.innerHTML = '<div class="muted">No games to show</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const g of list) frag.appendChild(createCard(g));
  gamesEl.appendChild(frag);
}

function renderTopList(list) {
  topList.innerHTML = "";
  const top = (list || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6);
  for (const g of top) {
    const li = document.createElement("li");
    li.textContent = `${g.name} — ${g.rating || 0}`;
    topList.appendChild(li);
  }
}

// ---- Charts: compute stats and draw ----
function computeStats(list) {
  const genreMap = {};
  const platformMap = {};
  const ratingBuckets = [0, 0, 0, 0, 0]; // 0-2,2-4,4-6,6-8,8-10

  for (const g of list || []) {
    (g.genres || []).forEach(ge => {
      if (!ge || !ge.name) return;
      genreMap[ge.name] = (genreMap[ge.name] || 0) + 1;
    });
    (g.platforms || []).forEach(p => {
      const name = p?.platform?.name || p?.name || "Unknown";
      platformMap[name] = (platformMap[name] || 0) + 1;
    });
    const r = g.rating || 0;
    if (r < 2) ratingBuckets[0]++; else if (r < 4) ratingBuckets[1]++;
    else if (r < 6) ratingBuckets[2]++; else if (r < 8) ratingBuckets[3]++; else ratingBuckets[4]++;
  }
  return { genreMap, platformMap, ratingBuckets };
}

function updateCharts(list) {
  const n = (list || []).length || 1;
  const { genreMap, platformMap, ratingBuckets } = computeStats(list);

  const sortedGenres = Object.entries(genreMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const genreLabels = sortedGenres.map(x=>x[0]);
  const genreCounts = sortedGenres.map(x=>x[1]);
  const genrePerc = genreCounts.map(c => +(c/n*100).toFixed(1));

  const sortedPlatforms = Object.entries(platformMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const platLabels = sortedPlatforms.map(x=>x[0]);
  const platCounts = sortedPlatforms.map(x=>x[1]);
  const platPerc = platCounts.map(c => +(c/n*100).toFixed(1));

  const ratingLabels = ["0-2","2-4","4-6","6-8","8-10"];
  const ratingCounts = ratingBuckets.slice();
  const ratingPerc = ratingCounts.map(c => +(c/n*100).toFixed(1));

  const colors = ["#3b82f6","#fb7185","#fb923c","#fcd34d","#34d399","#60a5fa","#a78bfa","#94a3b8"];

  // genres pie
  if (genresCanvas) {
    const ctx = genresCanvas.getContext("2d");
    const data = { labels: genreLabels, datasets: [{ data: genrePerc, backgroundColor: colors.slice(0, genreLabels.length) }]};
    const opts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:"bottom"}, tooltip:{ callbacks:{ label: ctx => `${ctx.label}: ${ctx.parsed}% (${genreCounts[ctx.dataIndex]} games)` } } } };
    if (charts.genres) { charts.genres.data = data; charts.genres.options = opts; charts.genres.update(); }
    else charts.genres = new Chart(ctx, { type:"pie", data, options: opts });
  }

  // platforms doughnut
  if (platformsCanvas) {
    const ctx = platformsCanvas.getContext("2d");
    const data = { labels: platLabels, datasets: [{ data: platPerc, backgroundColor: colors.slice(0, platLabels.length) }]};
    const opts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:"bottom"}, tooltip:{ callbacks:{ label: ctx => `${ctx.label}: ${ctx.parsed}% (${platCounts[ctx.dataIndex]} games)` } } } };
    if (charts.platforms) { charts.platforms.data = data; charts.platforms.options = opts; charts.platforms.update(); }
    else charts.platforms = new Chart(ctx, { type:"doughnut", data, options: opts });
  }

  // ratings bar
  if (ratingCanvas) {
    const ctx = ratingCanvas.getContext("2d");
    const data = { labels: ratingLabels, datasets: [{ label: "% of games", data: ratingPerc, backgroundColor: ["#3b82f6","#fb7185","#fb923c","#fcd34d","#34d399"] }]};
    const opts = { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, ticks:{ callback: v => v + "%" } } }, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.parsed}% (${ratingCounts[ctx.dataIndex]} games)` } } } };
    if (charts.ratings) { charts.ratings.data = data; charts.ratings.options = opts; charts.ratings.update(); }
    else charts.ratings = new Chart(ctx, { type:"bar", data, options: opts });
  }
}

// ---- Click a game: fetch details and show ----
async function fetchGameDetails(idOrSlug) {
  const url = `https://api.rawg.io/api/games/${idOrSlug}?key=${RAWG_KEY}`;
  return fetchJson(url);
}

async function onGameClick(g) {
  selectedEl.innerHTML = `<div class="muted">Loading details for ${escapeHtml(g.name)}…</div>`;
  try {
    const details = await fetchGameDetails(g.slug || g.id);
    const img = details.background_image || g.background_image || "";
    const name = escapeHtml(details.name || g.name || "Unknown");
    const released = details.released || g.released || "—";
    const genres = (details.genres || g.genres || []).map(x=>x.name).join(", ");
    const platforms = (details.platforms || g.platforms || []).map(p => p?.platform?.name || p?.name || "Unknown").join(", ");
    const rating = details.rating || g.rating || "—";
    const ratings_count = details.ratings_count || details.reviews_count || g.ratings_count || 0;
    const metacritic = details.metacritic || "—";
    const description = details.description_raw ? escapeHtml(details.description_raw.slice(0,600)) + (details.description_raw.length>600 ? "…" : "") : "";

    selectedEl.innerHTML = `
      <img src="${img}" alt="${name}" />
      <div style="margin-top:8px;font-weight:700">${name}</div>
      <div class="muted" style="margin-top:6px">Released: ${released}</div>
      <div style="margin-top:6px;color:var(--muted)"><strong>Genres:</strong> ${escapeHtml(genres)}</div>
      <div style="margin-top:6px;color:var(--muted)"><strong>Platforms:</strong> ${escapeHtml(platforms)}</div>
      <div style="margin-top:8px"><strong>Rating:</strong> ${rating} (${ratings_count} votes) • <strong>Metacritic:</strong> ${metacritic}</div>
      <div style="margin-top:8px;color:var(--muted);font-size:13px">${description}</div>
      <div style="margin-top:8px"><a href="https://rawg.io/games/${details.slug || g.slug}" target="_blank" style="color:var(--accent)">View on RAWG</a></div>
    `;
  } catch (err) {
    selectedEl.innerHTML = `<div class="muted">Failed to load details: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

// ---- Search / refresh bindings ----
searchInput?.addEventListener("input", () => {
  const q = (searchInput.value || "").trim().toLowerCase();
  filtered = q ? games.filter(g => (g.name||"").toLowerCase().includes(q)) : games.slice();
  renderAll();
});

refreshBtn?.addEventListener("click", () => loadOnePage());

// ---- init ----
loadOnePage();
