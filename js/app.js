/**
 * App bootstrap: builds the tab bar and one panel per league, wires up
 * the refresh cycle, and aggregates every league's scoreboard into the
 * top ticker.
 */
(function () {
  const tabsEl = document.getElementById("league-tabs");
  const boardEl = document.getElementById("board");
  const tickerTrack = document.getElementById("ticker-track");
  const tickerWrap = document.getElementById("ticker-wrap");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const lastUpdatedEl = document.getElementById("last-updated");
  const refreshBtn = document.getElementById("refresh-btn");
  const modalOverlay = document.getElementById("modal-overlay");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");

  const newsCache = new Map(); // league.id -> news response (avoid refetching per card click)
  const MAX_GAMES_PER_LEAGUE_FOR_DETAILS = 10; // bounds worst-case summary calls on Weather/Injuries tabs

  let activeLeagueId = "home";
  let refreshTimer = null;
  let lastResults = []; // cached [{league, games}] from the most recent full refresh

  const SPECIAL_TABS = [
    { id: "weather", label: "🌤 Weather" },
    { id: "news", label: "📰 News" },
    { id: "injuries", label: "🩹 Injuries" },
    { id: "watchlist", label: "★ Watchlist" },
    { id: "history", label: "History" },
    { id: "settings", label: "⚙ Settings" },
  ];
  const leagueLabelById = Object.fromEntries(LEAGUES.map((l) => [l.id, l.label]));

  /* ---------- build static shell (tabs + empty panels) ---------- */
  function buildShell() {
    // Home is always first and always the default landing tab.
    const homeTab = document.createElement("button");
    homeTab.className = "tab-btn";
    homeTab.type = "button";
    homeTab.textContent = "⌂ Home";
    homeTab.dataset.league = "home";
    homeTab.setAttribute("role", "tab");
    homeTab.setAttribute("aria-selected", "true");
    homeTab.addEventListener("click", () => selectLeague("home"));
    tabsEl.appendChild(homeTab);

    const homePanel = document.createElement("section");
    homePanel.className = "panel active";
    homePanel.id = "panel-home";
    homePanel.innerHTML = `
      <div class="panel-head">
        <div>
          <div class="panel-title">Today across every league</div>
          <div class="panel-sub">live counts, featured games, and quick jumps</div>
        </div>
      </div>
      <div id="home-body">
        <div class="skeleton" style="width:100%;height:80px;margin-bottom:12px"></div>
        <div class="skeleton" style="width:100%;height:200px"></div>
      </div>
    `;
    boardEl.appendChild(homePanel);

    LEAGUES.forEach((league) => {
      const tab = document.createElement("button");
      tab.className = "tab-btn";
      tab.type = "button";
      tab.innerHTML = `${league.logo ? `<img class="tab-logo" src="${league.logo}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}<span>${league.label}</span>`;
      tab.dataset.league = league.id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", league.id === activeLeagueId ? "true" : "false");
      tab.addEventListener("click", () => selectLeague(league.id));
      tabsEl.appendChild(tab);

      const panel = document.createElement("section");
      panel.className = "panel" + (league.id === activeLeagueId ? " active" : "");
      panel.id = `panel-${league.id}`;
      panel.innerHTML = `
        <div class="panel-head">
          <div>
            <div class="panel-title">${league.label}</div>
            <div class="panel-sub">live scoreboard &amp; standings</div>
          </div>
        </div>
        <div class="grid-2">
          <div>
            <p class="section-label">Today's games</p>
            <div class="game-list" id="games-${league.id}">
              <div class="skeleton" style="width:100%;height:64px;margin-bottom:8px"></div>
              <div class="skeleton" style="width:100%;height:64px"></div>
            </div>
          </div>
          <div>
            <p class="section-label">Standings</p>
            <div id="standings-${league.id}">
              <div class="skeleton" style="width:100%;height:18px;margin-bottom:8px"></div>
              <div class="skeleton" style="width:100%;height:18px;margin-bottom:8px"></div>
              <div class="skeleton" style="width:100%;height:18px"></div>
            </div>
          </div>
        </div>
      `;
      boardEl.appendChild(panel);
    });

    SPECIAL_TABS.forEach((special) => {
      const tab = document.createElement("button");
      tab.className = "tab-btn";
      tab.type = "button";
      tab.textContent = special.label;
      tab.dataset.league = special.id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", "false");
      tab.addEventListener("click", () => selectLeague(special.id));
      tabsEl.appendChild(tab);

      const panel = document.createElement("section");
      panel.className = "panel";
      panel.id = `panel-${special.id}`;
      if (special.id === "weather") {
        panel.innerHTML = `
          <div class="panel-head">
            <div>
              <div class="panel-title">🌤 Weather</div>
              <div class="panel-sub">venue conditions for today's games, by league</div>
            </div>
          </div>
          <div id="weather-body"><div class="empty-note">Loading…</div></div>
        `;
      } else if (special.id === "news") {
        panel.innerHTML = `
          <div class="panel-head">
            <div>
              <div class="panel-title">📰 News</div>
              <div class="panel-sub">recent headlines, by league</div>
            </div>
          </div>
          <div id="news-body"><div class="empty-note">Loading…</div></div>
        `;
      } else if (special.id === "injuries") {
        panel.innerHTML = `
          <div class="panel-head">
            <div>
              <div class="panel-title">🩹 Injuries</div>
              <div class="panel-sub">reported injuries for today's games, by league</div>
            </div>
          </div>
          <div id="injuries-body"><div class="empty-note">Loading…</div></div>
        `;
      } else if (special.id === "watchlist") {
        panel.innerHTML = `
          <div class="panel-head">
            <div>
              <div class="panel-title">★ Watchlist</div>
              <div class="panel-sub">games featuring your pinned teams, across every league</div>
            </div>
          </div>
          <div class="game-list" id="watchlist-list"></div>
        `;
      } else if (special.id === "history") {
        panel.innerHTML = `
          <div class="panel-head">
            <div>
              <div class="panel-title">History</div>
              <div class="panel-sub">completed games logged locally, with the closing line</div>
            </div>
          </div>
          <div id="history-table"></div>
        `;
      } else {
        panel.innerHTML = `
          <div class="panel-head">
            <div>
              <div class="panel-title">⚙ Settings</div>
              <div class="panel-sub">display preferences, stored on this device</div>
            </div>
          </div>
          <div id="settings-body"></div>
        `;
      }
      boardEl.appendChild(panel);
    });
  }

  function selectLeague(id) {
    activeLeagueId = id;
    tabsEl.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.setAttribute("aria-selected", btn.dataset.league === id ? "true" : "false");
    });
    boardEl.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${id}`);
    });
    if (id === "home") renderHomeTab();
    if (id === "weather") renderWeatherTab();
    if (id === "news") renderNewsTab();
    if (id === "injuries") renderInjuriesTab();
    if (id === "watchlist") renderWatchlistTab();
    if (id === "history") renderHistoryTab();
    if (id === "settings") renderSettingsTab();
  }

  /* ---------- ticker scroll settings ---------- */
  const SPEED_SECONDS = { slow: 90, normal: 55, fast: 28 };

  function applyTickerSettings() {
    const settings = Store.getSettings();
    tickerWrap.classList.toggle("ticker-static", !settings.tickerEnabled);
    tickerTrack.style.setProperty("--ticker-duration", `${SPEED_SECONDS[settings.tickerSpeed] || 55}s`);
    return settings;
  }

  function renderSettingsTab() {
    Render.settingsPanel(document.getElementById("settings-body"), () => {
      const settings = applyTickerSettings();
      Render.buildTicker(tickerTrack, lastResults, settings.tickerEnabled);
    });
  }

  function renderHomeTab() {
    Render.homePanel(document.getElementById("home-body"), lastResults, LEAGUES, leagueLabelById, {
      onSelectLeague: selectLeague,
      onOpenDetails: openGameDetails,
      onWatchlistChange: () => {
        Render.buildTicker(tickerTrack, lastResults, Store.getSettings().tickerEnabled);
        renderHomeTab();
      },
    });
  }

  /* ---------- weather / injuries: fetch per-game summaries, capped per league ---------- */
  async function gatherGameDetails(kind) {
    // kind: "weather" | "injuries" — same summary endpoint backs both, so one
    // fetch pass serves either tab (Api.getSummary already caches per-URL).
    const dataByLeagueId = {};
    await Promise.all(
      lastResults.map(async ({ league, games }) => {
        const subset = (games || []).slice(0, MAX_GAMES_PER_LEAGUE_FOR_DETAILS);
        const entries = await Promise.all(
          subset.map(async (game) => {
            const res = await Api.getSummary(league, game.id);
            if (!res.ok) return { game, weather: null, injuries: [] };
            return {
              game,
              weather: Render.extractWeather(res.data),
              injuries: Render.extractInjuries(res.data),
            };
          })
        );
        dataByLeagueId[league.id] = entries;
      })
    );
    return dataByLeagueId;
  }

  async function renderWeatherTab() {
    const body = document.getElementById("weather-body");
    if (!lastResults.length) return;
    body.innerHTML = `<div class="empty-note">Loading weather for today's games…</div>`;
    const dataByLeagueId = await gatherGameDetails("weather");
    if (activeLeagueId === "weather") Render.weatherPage(body, LEAGUES, dataByLeagueId);
  }

  async function renderInjuriesTab() {
    const body = document.getElementById("injuries-body");
    if (!lastResults.length) return;
    body.innerHTML = `<div class="empty-note">Loading injury reports for today's games…</div>`;
    const dataByLeagueId = await gatherGameDetails("injuries");
    if (activeLeagueId === "injuries") Render.injuriesPage(body, LEAGUES, dataByLeagueId);
  }

  async function renderNewsTab() {
    const body = document.getElementById("news-body");
    body.innerHTML = `<div class="empty-note">Loading headlines…</div>`;
    const newsByLeagueId = {};
    await Promise.all(
      LEAGUES.map(async (league) => {
        if (!newsCache.has(league.id)) newsCache.set(league.id, await Api.getNews(league));
        newsByLeagueId[league.id] = newsCache.get(league.id);
      })
    );
    if (activeLeagueId === "news") Render.newsPage(body, LEAGUES, newsByLeagueId);
  }

  function renderWatchlistTab() {
    Render.watchlistPanel(
      document.getElementById("watchlist-list"),
      lastResults,
      () => {
        renderWatchlistTab();
        Render.buildTicker(tickerTrack, lastResults, Store.getSettings().tickerEnabled);
      },
      openGameDetails
    );
  }

  function renderHistoryTab() {
    Render.historyPanel(document.getElementById("history-table"), leagueLabelById);
  }

  /* ---------- game detail modal ---------- */
  async function openGameDetails(game, league) {
    modalBody.innerHTML = `<p class="modal-loading">Loading game details…</p>`;
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";

    const [summaryRes, newsRes] = await Promise.all([
      Api.getSummary(league, game.id),
      newsCache.has(league.id) ? Promise.resolve(newsCache.get(league.id)) : Api.getNews(league),
    ]);
    if (!newsCache.has(league.id)) newsCache.set(league.id, newsRes);

    Render.gameDetailModal(modalBody, league, game, summaryRes, newsRes);
  }

  function closeGameDetails() {
    modalOverlay.hidden = true;
    document.body.style.overflow = "";
  }

  modalClose.addEventListener("click", closeGameDetails);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeGameDetails();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) closeGameDetails();
  });

  /* ---------- fetch + render one league ---------- */
  async function loadLeague(league) {
    const [scoreRes, standRes] = await Promise.all([
      Api.getScoreboard(league),
      Api.getStandings(league),
    ]);

    const gamesContainer = document.getElementById(`games-${league.id}`);
    const standingsContainer = document.getElementById(`standings-${league.id}`);

    if (scoreRes.ok) {
      Render.gameList(
        gamesContainer,
        scoreRes.data.events,
        league,
        () => {
          Render.buildTicker(tickerTrack, lastResults, Store.getSettings().tickerEnabled);
          if (document.getElementById(`panel-watchlist`).classList.contains("active")) renderWatchlistTab();
        },
        openGameDetails
      );
    } else {
      gamesContainer.innerHTML = "";
      gamesContainer.appendChild(
        Object.assign(document.createElement("div"), {
          className: "error-note",
          textContent: `Couldn't load scoreboard (${scoreRes.error}). If this persists, see the README section on CORS.`,
        })
      );
    }

    if (standRes.ok) {
      Render.standingsTable(standingsContainer, standRes.data);
    } else {
      standingsContainer.innerHTML = "";
      standingsContainer.appendChild(
        Object.assign(document.createElement("div"), {
          className: "error-note",
          textContent: `Couldn't load standings (${standRes.error}).`,
        })
      );
    }

    return {
      league,
      games: scoreRes.ok ? (scoreRes.data.events || []).map(Render.normalizeEvent).filter(Boolean) : [],
    };
  }

  /* ---------- full refresh cycle across all leagues ---------- */
  async function refreshAll(isManual) {
    refreshBtn.disabled = true;
    statusDot.className = "status-dot";
    statusText.textContent = isManual ? "refreshing…" : "syncing…";

    try {
      const results = await Promise.all(LEAGUES.map(loadLeague));
      lastResults = results;
      const settings = applyTickerSettings();
      Render.buildTicker(tickerTrack, results, settings.tickerEnabled);
      if (activeLeagueId === "home") renderHomeTab();
      if (activeLeagueId === "watchlist") renderWatchlistTab();
      if (activeLeagueId === "history") renderHistoryTab();

      const anyLive = results.some((r) => r.games.some((g) => g.state === "in"));
      statusDot.className = "status-dot" + (anyLive ? " live" : "");
      statusText.textContent = anyLive ? "live games in progress" : "up to date";
      lastUpdatedEl.textContent = `updated ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      statusDot.className = "status-dot error";
      statusText.textContent = "feed error";
    } finally {
      refreshBtn.disabled = false;
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshAll(false), REFRESH_INTERVAL_MS);
  }

  refreshBtn.addEventListener("click", () => {
    Api.clearCache();
    refreshAll(true);
  });

  buildShell();
  applyTickerSettings();
  refreshAll(false);
  scheduleRefresh();
})();
