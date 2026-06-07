# Handoff to Claude Code

Everything Claude Code needs is in `CLAUDE.md`. This file is the startup checklist and the
first prompt to run.

## Pre-flight (before opening Claude Code)

- [ ] Node 18+ installed (`node -v`). The deploy workflow uses Node 20.
- [ ] Extracted to `C:\Users\rpfly\Projects\wpr-brewers-tracker`.
- [ ] `gh auth status` is logged in (for `gh repo create` / push later).
- [ ] Open the folder in your terminal, then run `claude`.

## First prompt to paste into Claude Code

> Read CLAUDE.md first. Then run `npm install` and `npm run dev`, and confirm the dev
> server starts at /wpr-brewers-tracker/. Don't change any code yet — I want to verify the
> five sections (pulse, standings, race chart, schedule, team leaders) all load live data
> in the browser first. Report what you see, including any console errors. Note: this repo
> is intentionally client-side only — do NOT add a scraper, cron, or cached JSON layer.

## Setup is done when

- [ ] `npm run dev` serves with no build errors.
- [ ] All five sections render real data (Brewers record in the pulse, full NL Central
      table, a multi-line race chart, dated schedule cards, populated leader tables).
- [ ] Player headshots and both logos load (WPR + Brewers).
- [ ] `npm run build` succeeds.

## Dev-only gotchas (so they don't get "fixed" by mistake)

- **Double fetch in dev is expected.** React 18 StrictMode runs effects twice in
  development only. It does not happen in the production build. Leave StrictMode on.
- **Fonts need network.** Fraunces + Public Sans load from Google Fonts at runtime; an
  offline machine falls back to Georgia/system sans. That's fine.
- **PowerShell 5.1 chains with `;`,** not `&&`.
- **One source of truth is `src/config.js`.** Season rollover, sponsor names, and the
  logo toggle all live there — don't scatter those values into components.

## Deploy (after verifying locally)

```
gh repo create wpr-brewers-tracker --public --source=. --push
```
Then repo Settings -> Pages -> source = "GitHub Actions" (one time). Keep the repo name
`wpr-brewers-tracker` or update `base` in `vite.config.js` to match.

## First real work (pick one, keep it self-contained)

- Probable-pitcher stat line on schedule cards.
- Expected-record (Pythagorean) note in the pulse from run differential.
- Recent-form sparkline per standings row.
