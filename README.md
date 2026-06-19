# wpr-brewers-tracker

Live Milwaukee Brewers stats widget for **Wausau Pilot & Review** — a single-scroll,
chart-led page covering the season pulse, NL Central standings, the division race over
time, the schedule, and team leaders. Embedded into the WPR WordPress site via iframe
from GitHub Pages.

## How this differs from the other WPR widgets

Every other widget (`wpr-gas-prices`, `wpr-woodchucks-widget`, `marathon-meetings`, etc.)
runs the standard pipeline: **Python scraper → GitHub Actions cron → static JSON →
React/Vite → Pages**. That layer exists because those sources are scrape-fragile.

This one does **not**. The MLB Stats API (`statsapi.mlb.com`) is public, stable, and
CORS-open (`access-control-allow-origin: *`), so the widget fetches it **directly in the
browser**. No scraper, no cron, no committed JSON. The only GitHub Action here builds and
deploys. This is deliberate — see `CLAUDE.md`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/wpr-brewers-tracker/
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Deploy

Push to `main`. The `Deploy to GitHub Pages` workflow builds and publishes automatically.
In the repo Settings → Pages, set the source to **GitHub Actions** once.

Live URL: `https://rowanflynnpilot.github.io/wpr-brewers-tracker/`

## Embed

The tool is organized into tabs (Season / Schedule / Hitters / Pitching) and **auto-resizes**:
it posts its height to the host page on every tab switch, so the iframe always fits the active
tab with no inner scroll. Paste BOTH the iframe and the little script into a WordPress
**Custom HTML** block:

```html
<iframe id="wpr-brewers" src="https://rowanflynnpilot.github.io/wpr-brewers-tracker/"
        style="width:100%;border:0;height:1600px" loading="lazy"
        allow="web-share; clipboard-write"
        title="The Brewers, by the numbers — live stats tracker"></iframe>
<script>
window.addEventListener('message', function (e) {
  if (e.origin !== 'https://rowanflynnpilot.github.io') return
  if (e.data && e.data.type === 'wpr-brewers-height') {
    var f = document.getElementById('wpr-brewers')
    if (f && e.data.height) f.style.height = e.data.height + 'px'
  }
})
</script>
```

The `height` in the style is just a first-paint fallback (the script takes over once it loads).
`allow` lets the share button use the native share sheet / clipboard inside the iframe.
Embedded views are tracked automatically (they appear in Plausible with
wausaupilotandreview.com as the source); tab switches fire a `Tab` event, and the "Bookmark"
button (a stickiness nudge — shows the ⌘/Ctrl + D shortcut plus a copy-link) fires a `Bookmark`
event. The `clipboard-write` in `allow` is what lets the copy-link work inside the iframe.

### Mini scoreboard (sidebar / in-article)

A compact featured-game card at `/mini.html` — the whole card is a link into the full
tracker. The `to` parameter sets where a tap lands (the tracker's page on the news site);
without it, the card links to the standalone tracker.

```html
<iframe src="https://rowanflynnpilot.github.io/wpr-brewers-tracker/mini.html?to=https://wausaupilotandreview.com/milwaukee-brewers/"
        style="width:100%;border:0;height:280px" loading="lazy"
        title="Brewers scoreboard — tap for the full tracker"></iframe>
```

Mini impressions show in Plausible as the `/wpr-brewers-tracker/mini.html` page;
clicks fire a `Mini Click` event (add it as a goal to report on it).

### Mini standings (sidebar / in-article)

A compact NL Central standings card at `/mini-standings.html`. Same `to` + click behavior.

```html
<iframe src="https://rowanflynnpilot.github.io/wpr-brewers-tracker/mini-standings.html?to=https://wausaupilotandreview.com/milwaukee-brewers/"
        style="width:100%;border:0;height:260px" loading="lazy"
        title="NL Central standings — tap for the full tracker"></iframe>
```

### Mini strikeout tracker (sidebar / in-article)

A compact card at `/mini-strikeouts.html` that auto-features the Brewers' top strikeout
performance from the most recent game (strike-zone plot, pitch types, swinging/looking).

```html
<iframe src="https://rowanflynnpilot.github.io/wpr-brewers-tracker/mini-strikeouts.html?to=https://wausaupilotandreview.com/milwaukee-brewers/"
        style="width:100%;border:0;height:390px" loading="lazy"
        title="Brewers strikeout tracker — tap for the full tracker"></iframe>
```

Each mini is its own Plausible page (`/mini-standings.html`, `/mini-strikeouts.html`);
clicks fire a `Mini Click` event tagged with the `widget` (scoreboard/standings/strikeouts).

## Configure

Everything tweakable lives in `src/config.js`: season, team, division, sponsor strings,
and `USE_TEAM_LOGO`. To repoint at a different MLB team, change `TEAM_ID`, `DIVISION_ID`,
and the `DIVISION` map.

## Trademark note

The Brewers logo and player headshots are referenced from MLB's official CDN, not redrawn.
The footer carries a non-affiliation line. A team mark on a sponsored surface can imply
endorsement — confirm with WPR/MLB before going paid, or set `USE_TEAM_LOGO = false` for a
colors-only header.

## If `.github/` or `.gitignore` went missing from the zip

Some Windows unzip tools strip dotfiles. If they're absent after extracting:
`.gitignore` should contain `node_modules`, `dist`, `.DS_Store`, `*.local`, `.vite`.
The workflow file is reproduced in `docs/deploy.yml.txt` as a backup.
