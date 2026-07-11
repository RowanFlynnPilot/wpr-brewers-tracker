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

TWO sanctioned scheduled jobs exist, and NEITHER is a data cron:
1. The deploy workflow's twice-daily `schedule` regenerates the **email image** (`digest.png`).
   Email clients strip iframes and can't run JS, so the digest is snapshotted to a PNG (headless
   screenshot of `mini-digest.html` via `scripts/render-digest.mjs`). This bakes an *image* for
   email; it does NOT cache the widget's data — the tracker still fetches the API live.
2. `prospect-check.yml` runs monthly and is NOTIFICATION-ONLY: it compares `TOP_PROSPECTS` with
   MLB Pipeline's current list (`scripts/check-prospects.mjs`) and opens a GitHub issue with a
   paste-ready update when they drift. It never writes site data — a human reviews and applies
   the sync.
Don't delete these schedules thinking they're drift, and don't extend either to caching data.

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
- `mini*.html` + `src/mini*.jsx` — extra Vite entries: compact sidebar/in-article embeds, each
  its own page so they stay lightweight. `MiniGame.jsx` (featured-game scoreboard),
  `MiniStandings.jsx` (NL Central table), `MiniStrikeouts.jsx` (latest game's top-K performance
  on a strike zone), `MiniDigest.jsx` (newsletter combo: last final w/ winning+losing pitcher via
  the schedule `decisions` hydrate, next game's probables, and the NL Central table — one card).
  Each card is one link to the full tracker; the embed's `?to=` param overrides
  the destination (http/https only — shared `src/embed.js` `destination()`). Clicks fire a
  `Mini Click` event tagged with `widget`. Keep them tiny — no service worker, no recharts.
- Sections are grouped into tabs in `App.jsx` (`TABS` + `TabBar.jsx`): Season (hero + platoon edge +
  pulse + milestones + standings/vs-Central + race + playoff odds + road ahead), Schedule (watch
  guide + schedule + homestand + injuries + roster moves + coverage + sponsor band + this-day),
  Hitters (leaders + HR + spray + form), Pitching (leaders + bullpen check + strikeout + arsenal +
  game flow), Farm (prospect watch). Tabs are deep-linkable (`?tab=schedule`; switching rewrites
  the param via replaceState, preserving other params). Only the active tab renders, so a
  tab's heavy season-wide fetches fire only when opened — and `api.js` memoizes those scans
  (`cached()`, short TTL) so flipping back to a tab is instant, not a refetch. Masthead, banner +
  title sponsor, the updated stamp, and the footer stay pinned across all tabs. Tab switches fire a
  Plausible `Tab` event.
- `src/autosize.js` — when embedded, posts document height to the host on every change
  (ResizeObserver) so the iframe fits the active tab (no fixed height / inner scroll). The host
  embed listens for `{ type: 'wpr-brewers-height' }` (snippet in README). No-op when standalone.
- `src/components/` — one file per concern (separation of concerns):
  - `Masthead`, `BrewersBanner`, `Section`, `TabBar` — chrome.
  - `BookmarkButton` — stickiness nudge pinned in the top bar (all tabs). No browser exposes a
    programmatic add-bookmark API, so it shows the OS-correct shortcut (⌘/Ctrl + D — which, in the
    iframe, bookmarks the *host WPR page*) plus a phone-friendly "copy link" to the canonical WPR
    Brewers page. Fires a Plausible `Bookmark` event (open + `{ action: 'copy' }`).
  - `Pulse`, `Standings` — consume shared standings fetched once in `App`.
  - `Race`, `Schedule`, `Players` — self-contained, fetch their own feed. `Race` draws direct
    end-of-line labels (logo + GB) instead of a legend; `Players` takes the shared league-leaders
    map (`mlbLeaders`) and chips MLB top-5 ranks under names.
  - `MatchupEdge`, `InjuryReport`, `RosterMoves`, `BullpenCheck`, `PlayoffOdds`, `RoadAhead`,
    `HomestandGuide`, `Coverage`, `ThisDay` — fail-soft sections that OWN their `Section` chrome:
    on error/empty the heading disappears with the content (never render an orphaned title over
    blank space — follow this pattern for any new fail-soft section).
  - `WhereToWatch` — the game-day guide: bar/restaurant listings sold PER LISTING from
    `WATCH_VENUES` in config (empty = no section). SALES DEMO MODE: append `?demo` to any URL
    and every OPEN sponsor slot (title excluded when sold) + the watch guide fill with "Your
    Brand Here" placeholders for prospect walkthroughs — implemented at the bottom of
    `config.js`, browser-only, never visible without the param. Same pattern as the Packers
    tracker. Demo link for sales: `/?demo&tab=schedule`.
  - `PlayerCard` — tap-any-player modal. One `<PlayerCardHost/>` mounts in App; any surface calls
    the exported `openPlayerCard(id, sportId?)` (module-level hook, no prop threading). Card data
    is one cached bundle (`fetchPlayerCard`): bio + season line + last-5 log + hitter L/R splits
    (majors only). `sportId` targets a minor league so Prospect Watch cards work.
  - `ProspectWatch` (the Farm tab) — top-prospect list with LIVE MiLB data: current club + level
    (from `fetchFarmLevels`, which also trade-proofs the list — players off the org's clubs are
    dropped), season line at that level, and a last-10 form blurb from the game log. The ORDERING
    is `TOP_PROSPECTS` in config — hand-synced with MLB Pipeline (mlb.com/milb/prospects/brewers;
    its backing GraphQL at data-graph.mlb.com is NOT CORS-open, verified — don't try to fetch it
    live or add a cron). Photos use `prospectHeadshot()` (img.mlbstatic MiLB portraits with
    MLB's own generic fallback baked into the URL).
  - `PlayoffOdds` runs a 4,000-sim rest-of-season Monte Carlo IN THE BROWSER (regressed win%,
    normal-approx binomial) — a deliberate house model, labeled as such; not a data cron.
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

`digest.png` (the email-newsletter image) is generated in CI by `scripts/render-digest.mjs`
(Playwright headless screenshot of `mini-digest.html`) and published to the Pages root. It is
NOT committed — it's built fresh on every deploy and on the twice-daily `schedule` in
`deploy.yml`. The newsletter embeds it as `<img src=".../digest.png">` (snippet in README); the
live data still comes from the browser, this is just the email-safe rendering of the same card.

## Third external API (deliberate, not drift)

`src/wpr.js` reads WPR's own recent Brewers coverage from the WordPress REST API
(`/wp-json/wp/v2/posts?categories=<Milwaukee Brewers>`), rendered by `Coverage.jsx`. Same rules
as the other clients: browser fetch, keyless, CORS-open (WP echoes the Origin; verified from a
real browser — note Cloudflare 403s server-side/datacenter requests but allows genuine browsers),
fail-soft (the "From the newsroom" section renders nothing on error), deferred until near the
viewport, and `_fields`-trimmed so the payload stays small. This is a live read of WPR's CMS, NOT
the forbidden scraper/committed-JSON pattern. Category id + endpoints live in `config.js`
(`WPR_NEWS`; set null to hide the section). Article links use `target=_top` to drive readers into
WPR's coverage.

## Possible next features

(Shipped: pitcher stat lines, expected-wins note, form strips, series framing, wild-card
context, first-pitch forecast, hero linescore, share button, the stat lab — strikeout tracker,
home run tracker w/ estimated parks, pitch arsenal, game-flow win-probability chart, hot-hitter
rolling-OPS form, full batted-ball spray chart — and the WPR newsroom feed + three mini embeds.)
- A localStorage "pick'em" (call tonight's game, graded after the final) — sponsorable. Owner
  wants to clear this with WPR before building.
- Plausible public dashboard links per sponsor once the account is live.
Keep each as a small, self-contained addition.
