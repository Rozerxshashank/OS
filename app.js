const RAWG_KEY = 'a9984ae797654f36b8dab8ae200978c7';
const gamesEl = document.getElementById('games');
const selectedEl = document.getElementById('selected');
const refreshBtn = document.getElementById('refresh');
const searchInput = document.getElementById('search');
const countEl = document.getElementById('count');
const topList = document.getElementById('topList');

let games = [];
let charts = { genres: null, platforms: null, ratings: null };

async function fetchGames(){
  gamesEl.innerHTML = '<div class="muted">Loading…</div>';
  try{
    const res = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&page_size=40&ordering=-added`);
    if(!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    games = data.results || [];
    renderGames(games);
    updateStats(games);
  }catch(err){
    gamesEl.innerHTML = `<div class="muted">Error: ${err.message}</div>`;
  }
}

function renderGames(list){
  countEl.textContent = list.length + ' results';
  if(!list.length){ gamesEl.innerHTML = '<div class="muted">No games</div>'; return; }
  gamesEl.innerHTML = '';
  list.forEach(g =>{
    const card = document.createElement('div');
    card.className='game-card';
    card.innerHTML = `
      <img src="${g.background_image}" alt="${g.name}" />
      <div class="game-meta">
        <div class="title">${g.name}</div>
        <div class="sub">Rating: ${g.rating || 0} • Released: ${g.released||'—'}</div>
      </div>`;
    card.addEventListener('click',()=>selectGame(g));
    gamesEl.appendChild(card);
  });
  renderTopList(list);
}

function selectGame(g){
  selectedEl.innerHTML = `
    <img src="${g.background_image || ''}" alt="${g.name}" />
    <div style="font-weight:700">${g.name}</div>
    <div class="muted" style="margin-top:6px">${g.released || '—'}</div>
    <div style="margin-top:8px;color:var(--muted)"><strong>Genres:</strong> ${(g.genres||[]).map(x=>x.name).join(', ')}</div>
    <a href="https://rawg.io/games/${g.slug}" target="_blank" style="display:inline-block;margin-top:10px;color:var(--accent)">View on RAWG</a>
  `;
}

function renderTopList(list){
  const top = list.slice().sort((a,b)=> (b.rating||0)-(a.rating||0)).slice(0,6);
  topList.innerHTML = '';
  top.forEach(g => {
    const li = document.createElement('li');
    li.textContent = `${g.name} — ${g.rating || 0}`;
    topList.appendChild(li);
  });
}

// Stats helpers
function updateStats(list){
  // Genres
  const genreMap = {};
  const platformMap = {};
  const ratingBuckets = [0,0,0,0,0];
  list.forEach(g=>{
    (g.genres||[]).forEach(ge => genreMap[ge.name] = (genreMap[ge.name]||0)+1);
    (g.platforms||[]).forEach(p => {
      const name = p.platform?.name || p.name || 'Unknown';
      platformMap[name] = (platformMap[name]||0)+1;
    });
    const r = g.rating || 0;
    if(r < 2) ratingBuckets[0]++; else if(r < 4) ratingBuckets[1]++; else if(r < 6) ratingBuckets[2]++; else if(r < 8) ratingBuckets[3]++; else ratingBuckets[4]++;
  });

  const genreLabels = Object.keys(genreMap).slice(0,8);
  const genreData = genreLabels.map(l => genreMap[l]);
  const platformLabels = Object.keys(platformMap).slice(0,6);
  const platformData = platformLabels.map(l => platformMap[l]);

  // Create or update charts
  const genresCtx = document.getElementById('genresChart').getContext('2d');
  const platformsCtx = document.getElementById('platformChart').getContext('2d');
  const ratingsCtx = document.getElementById('ratingChart').getContext('2d');

  if(charts.genres) charts.genres.data.labels = genreLabels, charts.genres.data.datasets[0].data = genreData, charts.genres.update();
  else charts.genres = new Chart(genresCtx, {
    type: 'pie',
    data: { labels: genreLabels, datasets:[{data: genreData}]},
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  if(charts.platforms) charts.platforms.data.labels = platformLabels, charts.platforms.data.datasets[0].data = platformData, charts.platforms.update();
  else charts.platforms = new Chart(platformsCtx, {
    type: 'doughnut',
    data: { labels: platformLabels, datasets:[{data: platformData}]},
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  if(charts.ratings) charts.ratings.data.datasets[0].data = ratingBuckets, charts.ratings.update();
  else charts.ratings = new Chart(ratingsCtx, {
    type: 'bar',
    data: { labels: ['0-2','2-4','4-6','6-8','8-10'], datasets:[{label:'Count', data: ratingBuckets}]},
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero:true } } }
  });
}

// Search
searchInput.addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase();
  const filtered = games.filter(g => g.name.toLowerCase().includes(q));
  renderGames(filtered);
  updateStats(filtered);
});

refreshBtn.addEventListener('click', fetchGames);

// Initialize
fetchGames();
