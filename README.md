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

```html
<iframe src="https://rowanflynnpilot.github.io/wpr-brewers-tracker/"
        style="width:100%;border:0;min-height:1600px" loading="lazy"
        title="The Brewers, by the numbers"></iframe>
```

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
