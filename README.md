# Oddsify Intel — Live Sports Hub

A single dashboard for MLB, NBA, NCAAB, Premier League, Champions League,
MLS, and USL Championship: live scores, standings, and odds (where the
feed publishes them), with a scrolling ticker across all seven leagues.

No build step. No framework. Open `index.html` and it runs.

**Also included:**
- **Home dashboard** — the app now opens on a "⌂ Home" tab: live counts across
  every league, a "Featured right now" row (pinned teams first, then live
  games, then games with a posted line), one-click cards into each league,
  and a "Recently finished" grid (5 per row, with team logos) of the latest
  logged results. Every other tab still exists exactly as before — Home is
  a jumping-off point, not a replacement.
- **Line movement** — every poll snapshots each game's odds in
  `localStorage`; once a line moves from its opening number, the card
  shows an ▲/▼ badge with the delta and the original line.
- **Watchlist** — click the ☆ next to any team to pin it. Pinned teams
  get their own "★ Watchlist" tab (aggregated across every league),
  jump to the front of their league's game list, and move to the front
  of the ticker in amber.
- **Matchup context** — venue, city, and broadcast network, shown
  directly from the ESPN feed (no extra API calls).
- **History log** — as games complete, they're logged locally with
  their closing line under the "History" tab. This is intentionally
  minimal — a seed for real edge-finding (e.g. "how often did the
  favorite cover") once you have enough logged games to look at
  patterns, not an analytics engine yet.
- **Card grid** — game cards lay out 3 per row (2 on tablet, 1 on
  phone), each with a small league badge and both teams' logos.
- **Team & league logos** — team logos come straight from the ESPN
  feed itself (already embedded per competitor, no extra request).
  League badges use ESPN's CDN convention for league artwork, which
  isn't guaranteed by the API the way team logos are — every logo
  `<img>` has an `onerror` that just hides the image instead of
  showing a broken-image icon, so a stale badge URL degrades quietly.
  If a particular league's badge never loads, the fix is one line in
  `js/config.js` (the `logo` field on that league's entry).
- **Settings tab** — toggle the ticker's auto-scroll on/off and pick
  its speed (slow/normal/fast). Turning it off doesn't hide anything,
  it just stops the motion so you can read or scroll it manually.
- **Game details on click** — click any card for a full-screen modal
  with weather at the venue, both teams' reported injuries, and
  related headlines, pulled from ESPN's per-event summary and news
  endpoints. Coverage varies by league and sport the same way odds do
  — indoor sports won't have weather, and lightly-covered leagues
  (USL Championship, Champions League qualifying) may come back with
  no injury data. Each section says so plainly rather than showing a
  blank space.
- **Weather / News / Injuries tabs** — the same per-game data from the
  modal above, but organized into its own page and grouped into a
  section per league, so you can scan every league's outdoor games,
  injury reports, or headlines in one place instead of opening a
  modal per game. These three tabs fetch **lazily**: nothing is
  requested until you open the tab, and each league is capped at its
  first 10 games (`MAX_GAMES_PER_LEAGUE_FOR_DETAILS` in `js/app.js`)
  so a busy MLB slate across 7 leagues doesn't turn into hundreds of
  requests in one shot. News is one call per league either way, so it
  isn't capped.

All four of these are pure client-side (`localStorage`), so they're
per-browser and free — no database, no login. If you want this shared
across devices or users, that's the natural next step (see below).

## Quick start

**Option A — just open it**
Double-click `index.html`, or serve the folder with any static file
server:
```
npx serve .
```

**Option B — run the included proxy** (recommended for real hosting —
see "CORS & the proxy" below)
```
npm install    # no dependencies to install, this just confirms Node is set up
node server.js
```
Then visit `http://localhost:8787`.

## How it gets data

Every league pulls from ESPN's public site API
(`site.api.espn.com/apis/site/v2/sports/...`) — the same feed that
powers espn.com's own scoreboards. It's unauthenticated, so there's no
API key to configure, but it's also unofficial: ESPN could change the
response shape or rate-limit it without notice. `js/config.js` documents
each league's endpoint slug in one place if you ever need to fix one.

**Odds coverage is inconsistent by design, not a bug.** MLB, NBA, EPL,
and MLS scoreboards usually carry a spread/over-under from ESPN's
odds partner. NCAAB, Champions League, and USL Championship usually
don't — those panels are set to hide the odds row entirely (see
`hasOdds` in `js/config.js`) rather than show "no odds" on every card.
If you want firmer odds coverage across every league, the cleanest
upgrade path is swapping in a dedicated odds API (The Odds API,
OddsJam, SportsDataIO) behind the same `Api.getScoreboard()` call —
the rendering layer already expects an `oddsText` / `overUnder` pair
per game, so you'd only touch `js/api.js`.

## CORS & the proxy

Calling ESPN directly from the browser works in most environments
today. If you deploy this somewhere and start seeing "Couldn't load
scoreboard" errors, that's almost always CORS being blocked by the
host, browser extension, or a corporate network — not a bug in this
code. Fix: run `server.js`, which serves the static site *and* proxies
`/api/espn/*` to ESPN with permissive headers, then change `API_BASE`
in `js/config.js` from the ESPN URL to `/api/espn`.

## Icons & social preview

- `favicon.ico`, `icons/` — favicon and app icons (16 through 512px,
  plus a full-bleed maskable variant for Android). Same amber-diamond
  mark as the in-app wordmark.
- `site.webmanifest` — makes the dashboard installable as a PWA
  ("Add to Home Screen" / desktop install).
- `assets/social-preview.png` — the 1200×630 image shown when a link
  to this app is shared (Slack, X, iMessage, etc.), wired up via the
  `og:image`/`twitter:image` tags in `index.html`.
- `assets-src/` — the two small Python (Pillow) scripts that generate
  all of the above. Re-run either after changing the palette in
  `css/styles.css` so the icons/preview stay in sync:
  ```
  python3 assets-src/build_icons.py
  python3 assets-src/build_social_preview.py
  ```

## File map

```
index.html         page shell
css/styles.css      design tokens + layout (dark terminal / ticker theme)
js/config.js        league list, ESPN slugs, refresh interval — edit here first
js/storage.js        localStorage: watchlist, odds-movement history, results log
js/api.js           fetch + 20s in-memory cache, never throws
js/render.js        JSON -> DOM (ticker, game cards, standings, watchlist, history)
js/app.js           tabs, refresh loop, wiring
server.js           optional static host + CORS proxy (no dependencies)
```

## Extending it

- **Add a league:** add one entry to the `LEAGUES` array in
  `js/config.js` with its ESPN `sport`/`slug` pair. Everything else
  (tabs, ticker, standings) wires up automatically.
- **Swap the data source:** `js/api.js` is the only file that knows
  about ESPN. Point `getScoreboard`/`getStandings` at a different API
  and keep the same return shape (`{ ok, data }` or `{ ok: false, error }`)
  and nothing downstream needs to change.
- **Change the refresh cadence:** `REFRESH_INTERVAL_MS` in
  `js/config.js`.

## What's deliberately left out (for now)

These were on the original brainstorm list but need either a paid API
key or real backend storage, so they weren't in scope for a lightweight
first pass:

- **Recent form (last 5-10 results)** — needs a team schedule endpoint
  fetched per team, not just per league or per game.
- **Cross-book odds comparison** — ESPN's feed is one book's line, not
  several. A real "best line" feature needs a dedicated odds API (The
  Odds API, OddsJam, SportsDataIO).
- **Shared/synced watchlist and history** — currently per-browser via
  `localStorage`. Making it follow you across devices means real user
  accounts and a database.

All three are natural "next" additions — the codebase is structured
(one file per concern) so none of them require rewriting what's here.
(Weather and injuries, also originally on this list, ended up doable
for free — ESPN's per-event summary endpoint already carries both, so
they're now part of the game detail modal instead of deferred.)

## Notes on the odds shown

Every odds figure displayed is pulled straight from the upstream feed
at request time — nothing here calculates or projects its own line.
Treat it as informational context, not a source of truth for placing
bets.
