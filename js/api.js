/**
 * Thin fetch layer. Every function resolves to a plain object even on
 * failure ({ ok: false, error }) so callers never need try/catch.
 */
const Api = (() => {
  const cache = new Map(); // key -> { data, ts }
  const CACHE_TTL_MS = 20_000;

  async function getJSON(url) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return { ok: true, data: cached.data, fromCache: true };
    }
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      cache.set(url, { data, ts: Date.now() });
      return { ok: true, data, fromCache: false };
    } catch (err) {
      return { ok: false, error: err.message || "network error" };
    }
  }

  function scoreboardUrl(league) {
    return `${API_BASE}/${league.sport}/${league.slug}/scoreboard`;
  }

  function standingsUrl(league) {
    return `${API_BASE}/${league.sport}/${league.slug}/standings`;
  }

  function summaryUrl(league, eventId) {
    return `${API_BASE}/${league.sport}/${league.slug}/summary?event=${eventId}`;
  }

  function newsUrl(league) {
    return `${API_BASE}/${league.sport}/${league.slug}/news`;
  }

  return {
    getScoreboard: (league) => getJSON(scoreboardUrl(league)),
    getStandings: (league) => getJSON(standingsUrl(league)),
    getSummary: (league, eventId) => getJSON(summaryUrl(league, eventId)),
    getNews: (league) => getJSON(newsUrl(league)),
    clearCache: () => cache.clear(),
  };
})();
