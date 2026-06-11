# wpr-brewers-tracker — Claude Code context

Read this first. Persistent context for working in this repo.

## What this is

A live Milwaukee Brewers stats widget for **Wausau Pilot & Review** (WPR). Single-scroll,
chart-led editorial page: season pulse → NL Central standings → division race over time →
schedule → team leaders. Wrapped in WPR's masthead + tagline; Brewers navy/gold banner.
Embedded into the WPR WordPress site via iframe from GitHub Pages.

WPR covers all major Wisconsin sports despite being hyperlocal; this is the "Wisconsin
pride / traffic magnet" angle, sold as a standalone sponsorship surface.

## CRITICAL: this repo intentionally breaks the standard WPR pattern

Other WPR widgets run: Python scraper → GitHub Actions cron → static JSON → React/Vite →
Pages. **Do NOT add that here.** The MLB Stats API is public and CORS-open
(`access-control-allow-origin: *`), so the browser fetches it directly. No scraper, no
cron, no committed JSON. The only workflow builds and deploys.

If a future task seems to call for "caching the data" or "adding a scraper for
reliability" — don't. That contradicts the design. The API has 60s cache headers and is
built to be hit from browsers. Keeping it client-side is the whole point (simplest path,
one source of truth, nothing to keep in sync).

## Architecture

```
MLB Stats API (statsapi.mlb.com) → fetch() in browser → React/Vite → GitHub Pages → WP iframe
```

- `src/api.js` — the only place that talks to the API. Functions fail fast (throw on
  non-200); the calling component renders its own error state. No fallbacks.
- `src/config.js` — single source of truth for season, team, division, sponsors,
  `USE_TEAM_LOGO`, and brand asset URLs. Change a team here and nowhere else.
- `src/theme.js` — palette + Fraunces/Public Sans type pairing (matches the
  "Follow the Money" budget widget design system).
- `src/analytics.js` — opt-in, cookieless Plausible loader + `track()` for sponsor ROI
  (page views = impressions, `Sponsor Click` events = click-throughs per slot). Disabled
  unless `ANALYTICS.domain` is set in `config.js`; off by default = no external script, no
  dependency. This is analytics only — it is NOT the forbidden data scraper/cache.
- `mini.html` + `src/mini.jsx` — a second Vite entry: the compact featured-game scoreboard
  for sidebar/in-article embeds (`MiniGame.jsx`). The card is one link to the full tracker;
  the embed's `?to=` param overrides the destination (http/https only). Keep it tiny — no
  service worker, no recharts, just the featured-game feed.
- `src/components/` — one file per concern (separation of concerns):
  - `Masthead`, `BrewersBanner`, `Section` — chrome.
  - `Pulse`, `Standings` — consume shared standings fetched once in `App`.
  - `Race`, `Schedule`, `Players` — self-contained, fetch their own feed.
  - `Status` — `Loading` + `ErrorState`.

## Data notes (verified against the 2026 season)

- Brewers `teamId = 158`; NL Central `divisionId = 205`; NL `leagueId = 104`.
- Standings endpoint accepts a historical `date` param, but the race chart derives
  games-back from each team's full schedule instead (5 fetches, no per-day calls).
- Roster stats are hydrated in ONE call:
  `/teams/158/roster?rosterType=active&hydrate=person(stats(type=season,season=2026))`.
- Do NOT use `/teams/{id}/leaders` — it mixes career and season values. Compute leaders
  from the hydrated roster (see `Players.jsx`).
- Logos: `https://www.mlbstatic.com/team-logos/{teamId}.svg`.
  Headshots: `https://midfield.mlbstatic.com/v1/people/{personId}/spots/120`.
- "This day in history" (`ThisDay.jsx`) intentionally fires one small schedule request per season
  (1970→last year, in parallel, failures tolerated) to find games on today's date — there is no
  single historical endpoint. This is the architecture-compliant alternative to a committed
  history file; the per-year fan-out is deliberate, not an oversight. The fetch is deferred ~900ms
  so it never competes with primary content.

## Design principles in force

Surgical changes; one correct path, no fallbacks; fail fast; clarity over compatibility;
each component one responsibility; don't overengineer. Match these when editing.

## Dev / deploy

```bash
npm install
npm run dev        # http://localhost:5173/wpr-brewers-tracker/
npm run build
```
Push to `main` → auto-deploys via `.github/workflows/deploy.yml`. Set Pages source to
"GitHub Actions" once in repo Settings.

## Windows (rpfly machine) reminders

- PowerShell 5.1 chains with `;` not `&&`.
- If `.github/` or `.gitignore` vanished on unzip, restore from `docs/deploy.yml.txt`
  and the README.
- Project path: `C:\Users\rpfly\Projects\wpr-brewers-tracker`.

## Second external API (deliberate, not drift)

`src/weather.js` talks to Open-Meteo (free, keyless, CORS-open) for the hero's first-pitch
forecast on upcoming HOME games. It follows the same rules as the MLB client: browser fetch,
fail fast, no caching, and the hero renders nothing on failure. Don't add more external APIs
without the same justification (keyless + CORS-open + fail-soft + small).

`public/og-card.png` (social share card) is generated by `scripts/og-card.py` (Python/Pillow,
downloads brand fonts at run time) — rerun it only when branding changes.

## Possible next features

(Pitcher stat lines, expected-wins note, form strips, series framing, wild-card context,
first-pitch forecast, hero linescore, and the share button have all shipped.)
- A localStorage "pick'em" (call tonight's game, graded after the final) — sponsorable.
- Plausible public dashboard links per sponsor once the account is live.
Keep each as a small, self-contained addition.
