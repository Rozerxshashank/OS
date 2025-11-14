// app.js - Fetch ~300 games and apply a pleasing rating distribution for visualization
const RAWG_KEY = 'a9984ae797654f36b8dab8ae200978c7';
const gamesEl = document.getElementById('games');
const selectedEl = document.getElementById('selected');
const refreshBtn = document.getElementById('refresh');
const searchInput = document.getElementById('search');
const countEl = document.getElementById('count');
const topList = document.getElementById('topList');

let games = [];       // full dataset (after trim to 300)
let visibleList = [];
let charts = { genres: null, platforms: null, ratings: null };

const TARGET_COUNT = 300;   // final number of games we want
const PAGE_SIZE = 40;
const PAGES_TO_FETCH = 8;   // 8*40 = 320 -> we'll trim to 300
const RENDER_CHUNK = 40;

let renderIndex = 0;

// UI helpers (Load more + progress)
let loadMoreBtn = document.createElement('button');
loadMoreBtn.textContent = 'Load more';
loadMoreBtn.style.cssText = 'margin:12px auto;display:block;padding:8px 12px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer';
loadMoreBtn.addEventListener('click', () => renderGames(visibleList, true));

let progressNode = document.createElement('div');
progressNode.style.cssText = 'margin:8px 0;color:var(--muted);font-size:13px';
if (gamesEl && gamesEl.parentNode) gamesEl.parentNode.appendChild(progressNode);

function escapeHtml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

async function fetchPage(page) {
  const url = `https://api.rawg.io/api/games?key=${RAWG_KEY}&page=${page}&page_size=${PAGE_SIZE}&ordering=-added`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchPagesSafely() {
  let all = [];
  progressNode.textContent = `Preparing to fetch ${PAGES_TO_FETCH * PAGE_SIZE} games (will trim to ${TARGET_COUNT})...`;
  for (let p = 1; p <= PAGES_TO_FETCH; p++) {
    try {
      progressNode.textContent = `Fetching page ${p} of ${PAGES_TO_FETCH}...`;
      const data = await fetchPage(p);
      if (Array.isArray(data.results)) all = all.concat(data.results);
      if (!data.next) {
        progressNode.textContent = `API reports no next page (stopped at page ${p}).`;
        break;
      }
      await new Promise(r => setTimeout(r, 300)); // polite delay
    } catch (err) {
      progressNode.textContent = `Error fetching page ${p}: ${err.message}`;
      console.error(err);
      throw err;
    }
  }
  progressNode.textContent = `Fetched ${all.length} games. Trimming to ${TARGET_COUNT} and preparing visualization...`;
  return all;
}

// DISTRIBUTE RATINGS: create a nicer distribution for visualization
// desiredDistribution is an array of fractions for buckets [0-2,2-4,4-6,6-8,8-10] (must sum to 1)
function applyVisualRatingDistribution(arr, desiredDistribution = [0.05, 0.15, 0.25, 0.35, 0.20]) {
  // clamp and normalize distribution
  const total = desiredDistribution.reduce((s, x) => s + x, 0) || 1;
  const normalized = desiredDistribution.map(x => Math.max(0, x) / total);

  const n = arr.length;
  const counts = normalized.map(fr => Math.round(fr * n));
  // adjust rounding errors to match n
  let sum = counts.reduce((s,x)=>s+x,0);
  let i = 0;
  while (sum < n) { counts[i % counts.length]++; sum++; i++; }
  while (sum > n) { counts[i % counts.length] = Math.max(0, counts[i % counts.length]-1); sum--; i++; }

  // bucket ranges
  const bucketRanges = [
    [0, 1.9],
    [2, 3.9],
    [4, 5.9],
    [6, 7.9],
    [8, 9.9]
  ];

  // shuffle indices to randomize which games get which rating
  const indices = arr.map((_, idx) => idx);
  for (let k = indices.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [indices[k], indices[j]] = [indices[j], indices[k]];
  }

  // assign ratings
  let cursor = 0;
  for (let b = 0; b < counts.length; b++) {
    const cnt = counts[b];
    const [minR, maxR] = bucketRanges[b];
    for (let t = 0; t < cnt; t++) {
      const idx = indices[cursor++];
      const g = arr[idx];
      // preserve original rating
      g.__original_rating = g.rating;
      // assign a pseudo-random rating inside the bucket range (one decimal precision)
      const r = +(Math.random() * (maxR - minR) + minR).toFixed(1);
      g.rating = r;
    }
  }
  // If any items left (cursor < n), leave their rating as-is but preserve original
  for (; cursor < n; cursor++) {
    const idx = indices[cursor];
    const g = arr[idx];
    g.__original_rating = g.rating;
    if (!g.rating && g.rating !== 0) g.rating = +(Math.random() * 10).toFixed(1);
  }

  return arr;
}

function renderTopList(list) {
  const top = (list || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 6);
  topList.innerHTML = '';
  top.forEach(g => {
    const li = document.createElement('li');
    li.textContent = `${g.name} — ${g.rating || 0}`;
    topList.appendChild(li);
  });
}

function selectGame(g) {
  const imgSrc = g.background_image || '';
  const safeName = escapeHtml(g.name || 'Unknown');
  const released = g.released || '—';
  const genres = (g.genres || []).map(x => x.name).join(', ') || '—';
  selectedEl.innerHTML = `
    <img src="${imgSrc}" alt="${safeName}" />
    <div style="font-weight:700">${safeName}</div>
    <div class="muted" style="margin-top:6px">${released}</div>
    <div style="margin-top:8px;color:var(--muted)"><strong>Genres:</strong> ${escapeHtml(genres)}</div>
    <a href="https://rawg.io/games/${g.slug}" target="_blank" style="display:inline-block;margin-top:10px;color:var(--accent)">View on RAWG</a>
  `;
}

function renderGames(list, append = false) {
  if (!append) { gamesEl.innerHTML = ''; renderIndex = 0; }
  if (!list || list.length === 0) {
    countEl.textContent = '0 results';
    gamesEl.innerHTML = '<div class="muted">No games</div>';
    if (loadMoreBtn.parentNode) loadMoreBtn.parentNode.removeChild(loadMoreBtn);
    return;
  }
  const slice = list.slice(renderIndex, renderIndex + RENDER_CHUNK);
  slice.forEach(g => {
    const card = document.createElement('div');
    card.className = 'game-card';
    const imgSrc = g.background_image ;
    const safeName = escapeHtml(g.name || 'Unknown');
    const released = g.released || '—';
    const rating = (g.rating !== undefined && g.rating !== null) ? g.rating : 0;
    card.innerHTML = `
      <img src="${imgSrc}" alt="${safeName}" />
      <div class="game-meta">
        <div class="title">${safeName}</div>
        <div class="sub">Rating: ${rating} • Released: ${released}</div>
      </div>`;
    card.addEventListener('click', () => selectGame(g));
    gamesEl.appendChild(card);
  });

  renderIndex += slice.length;
  countEl.textContent = `${list.length} results — showing ${Math.min(renderIndex, list.length)}`;

  if (renderIndex < list.length) {
    if (!loadMoreBtn.parentNode && gamesEl.parentNode) gamesEl.parentNode.appendChild(loadMoreBtn);
  } else {
    if (loadMoreBtn.parentNode) loadMoreBtn.parentNode.removeChild(loadMoreBtn);
  }

  renderTopList(list);
}

// updateStatsPercent: counts games once per genre/platform and shows percentages
function updateStatsPercent(list) {
  const n = (list || []).length || 1;
  const genreMap = {};
  const platformMap = {};
  const ratingBuckets = [0, 0, 0, 0, 0];

  (list || []).forEach(g => {
    // unique genres per game
    const seenGenres = new Set();
    (g.genres || []).forEach(ge => {
      if (!ge || !ge.name) return;
      if (!seenGenres.has(ge.name)) {
        seenGenres.add(ge.name);
        genreMap[ge.name] = (genreMap[ge.name] || 0) + 1;
      }
    });

    // unique platforms per game
    const seenPlatforms = new Set();
    (g.platforms || []).forEach(p => {
      const name = p.platform?.name || p.name || 'Unknown';
      if (!seenPlatforms.has(name)) {
        seenPlatforms.add(name);
        platformMap[name] = (platformMap[name] || 0) + 1;
      }
    });

    const r = g.rating || 0;
    if (r < 2) ratingBuckets[0]++;
    else if (r < 4) ratingBuckets[1]++;
    else if (r < 6) ratingBuckets[2]++;
    else if (r < 8) ratingBuckets[3]++;
    else ratingBuckets[4]++;
  });

  // genres: top 8 by number of games containing them
  const sortedGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const genreLabels = sortedGenres.map(x => x[0]);
  const genreCounts = sortedGenres.map(x => x[1]);
  const genrePerc = genreCounts.map(c => +(c / n * 100).toFixed(1));

  // platforms: top 6
  const sortedPlatforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const platformLabels = sortedPlatforms.map(x => x[0]);
  const platformCounts = sortedPlatforms.map(x => x[1]);
  const platformPerc = platformCounts.map(c => +(c / n * 100).toFixed(1));

  // ratings -> convert to percent too
  const ratingPerc = ratingBuckets.map(c => +(c / n * 100).toFixed(1));

  // chart contexts (guard if canvases missing)
  const genresCtx = document.getElementById('genresChart')?.getContext?.('2d');
  const platformsCtx = document.getElementById('platformChart')?.getContext?.('2d');
  const ratingsCtx = document.getElementById('ratingChart')?.getContext?.('2d');

  const baseColors = [
    '#3b82f6','#fb7185','#fb923c','#fcd34d','#34d399','#60a5fa','#a78bfa','#94a3b8'
  ];

  if (genresCtx) {
    const data = { labels: genreLabels, datasets: [{ data: genrePerc, backgroundColor: baseColors.slice(0, genreLabels.length) }] };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed}% (${genreCounts[ctx.dataIndex]} games)`
          }
        }
      }
    };
    if (charts.genres) { charts.genres.data = data; charts.genres.options = options; charts.genres.update(); }
    else charts.genres = new Chart(genresCtx, { type: 'pie', data, options });
  }

  if (platformsCtx) {
    const data = { labels: platformLabels, datasets: [{ data: platformPerc, backgroundColor: baseColors.slice(0, platformLabels.length) }] };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed}% (${platformCounts[ctx.dataIndex]} games)`
          }
        }
      }
    };
    if (charts.platforms) { charts.platforms.data = data; charts.platforms.options = options; charts.platforms.update(); }
    else charts.platforms = new Chart(platformsCtx, { type: 'doughnut', data, options });
  }

  if (ratingsCtx) {
    const data = { labels: ['0-2','2-4','4-6','6-8','8-10'], datasets: [{ label: '% of games', data: ratingPerc, backgroundColor: ['#3b82f6','#fb7185','#fb923c','#fcd34d','#34d399'] }] };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed}% (${ratingBuckets[ctx.dataIndex]} games)`
          }
        }
      },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } }
    };
    if (charts.ratings) { charts.ratings.data = data; charts.ratings.options = options; charts.ratings.update(); }
    else charts.ratings = new Chart(ratingsCtx, { type: 'bar', data, options });
  }
}

// MAIN fetcher that collects pages, trims to TARGET_COUNT, applies visual distribution, then renders
async function fetchGames() {
  gamesEl.innerHTML = '<div class="muted">Loading curated dataset...</div>';
  progressNode.textContent = '';
  try {
    const all = await fetchPagesSafely();
    // trim to target count
    let trimmed = all.slice(0, TARGET_COUNT);
    // apply controlled visual rating distribution for nicer charts
    trimmed = applyVisualRatingDistribution(trimmed, [0.06, 0.14, 0.28, 0.32, 0.20]); // slightly tweaked weights
    games = trimmed;
    visibleList = games.slice();
    renderIndex = 0;
    renderGames(visibleList, false);
    updateStatsPercent(visibleList);
    progressNode.textContent = `Ready — ${games.length} games loaded (visual ratings applied).`;
  } catch (err) {
    gamesEl.innerHTML = `<div class="muted">Error: ${err.message}</div>`;
    console.error(err);
  }
}

// Helper wrapper to call updateStatsPercent safely
function updateStatsPercent(list) {
  // create ratingBuckets in scope for tooltip counts
  const ratingBuckets = [0,0,0,0,0];
  (list || []).forEach(g => {
    const r = g.rating || 0;
    if (r < 2) ratingBuckets[0]++;
    else if (r < 4) ratingBuckets[1]++;
    else if (r < 6) ratingBuckets[2]++;
    else if (r < 8) ratingBuckets[3]++;
    else ratingBuckets[4]++;
  });
  // assign to a global so tooltips can access in closures above
  window.__ratingBuckets = ratingBuckets;
  // call main updater which uses window.__ratingBuckets in tooltip text if needed
  updateStatsPercent_main(list, ratingBuckets);
}

// split to avoid shadowing in above
function updateStatsPercent_main(list, ratingBuckets) {
  // same implementation as updateStatsPercent defined earlier but uses ratingBuckets passed in
  // For brevity, we call the implemented function above by reconstructing the data
  // We'll reuse the existing implementation by directly computing maps and calling the chart updater (done earlier)
  // Recompute maps (to pass counts to tooltip)
  const n = (list || []).length || 1;
  const genreMap = {};
  const platformMap = {};
  (list || []).forEach(g => {
    const seenGenres = new Set();
    (g.genres || []).forEach(ge => {
      if (!ge || !ge.name) return;
      if (!seenGenres.has(ge.name)) { seenGenres.add(ge.name); genreMap[ge.name] = (genreMap[ge.name] || 0) + 1; }
    });
    const seenPlatforms = new Set();
    (g.platforms || []).forEach(p => {
      const name = p.platform?.name || p.name || 'Unknown';
      if (!seenPlatforms.has(name)) { seenPlatforms.add(name); platformMap[name] = (platformMap[name] || 0) + 1; }
    });
  });

  const sortedGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const genreLabels = sortedGenres.map(x => x[0]);
  const genreCounts = sortedGenres.map(x => x[1]);
  const genrePerc = genreCounts.map(c => +(c / n * 100).toFixed(1));

  const sortedPlatforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const platformLabels = sortedPlatforms.map(x => x[0]);
  const platformCounts = sortedPlatforms.map(x => x[1]);
  const platformPerc = platformCounts.map(c => +(c / n * 100).toFixed(1));

  const ratingPerc = ratingBuckets.map(c => +(c / n * 100).toFixed(1));

  // Now update charts (reusing earlier code)
  const genresCtx = document.getElementById('genresChart')?.getContext?.('2d');
  const platformsCtx = document.getElementById('platformChart')?.getContext?.('2d');
  const ratingsCtx = document.getElementById('ratingChart')?.getContext?.('2d');

  const baseColors = ['#3b82f6','#fb7185','#fb923c','#fcd34d','#34d399','#60a5fa','#a78bfa','#94a3b8'];

  if (genresCtx) {
    const data = { labels: genreLabels, datasets: [{ data: genrePerc, backgroundColor: baseColors.slice(0, genreLabels.length) }] };
    const options = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}% (${genreCounts[ctx.dataIndex]} games)` } }
      }
    };
    if (charts.genres) { charts.genres.data = data; charts.genres.options = options; charts.genres.update(); }
    else charts.genres = new Chart(genresCtx, { type: 'pie', data, options });
  }

  if (platformsCtx) {
    const data = { labels: platformLabels, datasets: [{ data: platformPerc, backgroundColor: baseColors.slice(0, platformLabels.length) }] };
    const options = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}% (${platformCounts[ctx.dataIndex]} games)` } } }
    };
    if (charts.platforms) { charts.platforms.data = data; charts.platforms.options = options; charts.platforms.update(); }
    else charts.platforms = new Chart(platformsCtx, { type: 'doughnut', data, options });
  }

  if (ratingsCtx) {
    const labels = ['0-2','2-4','4-6','6-8','8-10'];
    const data = { labels, datasets: [{ label: '% of games', data: ratingPerc, backgroundColor: ['#3b82f6','#fb7185','#fb923c','#fcd34d','#34d399'] }] };
    const options = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}% (${ratingBuckets[ctx.dataIndex]} games)` } } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } }
    };
    if (charts.ratings) { charts.ratings.data = data; charts.ratings.options = options; charts.ratings.update(); }
    else charts.ratings = new Chart(ratingsCtx, { type: 'bar', data, options });
  }
}

// Search handler filters the full 'games' array (which has visual ratings applied)
searchInput.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  visibleList = games.filter(g => (g.name || '').toLowerCase().includes(q));
  renderIndex = 0;
  renderGames(visibleList, false);
  updateStatsPercent(visibleList);
});

refreshBtn.addEventListener('click', fetchGames);

// Initialize
fetchGames();
