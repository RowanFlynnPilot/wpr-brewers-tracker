// Renders the digest mini widget to a PNG for email newsletters.
//
// WHY THIS EXISTS (and why it is NOT the forbidden scraper): email clients strip <iframe> and
// can't run JavaScript, so the live widget can't be embedded in a newsletter. The only way to put
// fresh digest content in email is to pre-render it to an image. This script snapshots the
// already-built mini-digest.html in headless Chromium and writes dist/digest.png. It produces an
// IMAGE for email — it does NOT cache the widget's data or feed the widget. The tracker itself
// still fetches the MLB API live in the browser, exactly as before.
//
// Run in CI after `npm run build`, against a local `vite preview` server:
//   node scripts/render-digest.mjs <url> <outPath>
import { chromium } from 'playwright'

// `image=1` tells MiniDigest this is the email screenshot, so it drops the "Full tracker →"
// affordance (dead pixels in an image — the email adds a real text link below it instead).
const base = process.argv[2] || 'http://127.0.0.1:4173/wpr-brewers-tracker/mini-digest.html'
const url = base + (base.includes('?') ? '&' : '?') + 'image=1'
const out = process.argv[3] || 'dist/digest.png'

const browser = await chromium.launch()
try {
  // 2x scale → a crisp ~840px-wide PNG that still looks sharp on retina/HiDPI email clients.
  // Pin the locale + timezone to Central: the widget formats game dates/times with toLocale*,
  // and CI runners are UTC — without this, a 6:40 PM Central game would render as "11:40 PM"
  // (and night-game dates could roll to the next day). Readers see their own local time; for a
  // Wisconsin newsletter that's Central, so the baked image matches.
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 480, height: 1000 },
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    // ESPN (Akamai) started 403ing any request that admits to being HeadlessChrome in Aug 2026 —
    // it blanked the sibling Badgers digest (2026-08-16). MLB's statsapi/mlbstatic don't block
    // headless today (verified 2026-08-18), but this script is the shared template across the WPR
    // trackers and the masked headers cost nothing. Keep the version roughly current with
    // Playwright's bundled Chromium.
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  })
  // Chromium brands sec-ch-ua "HeadlessChrome" even when the UA string is overridden — the client
  // hint has to be masked separately or UA-keyed blocks still fire.
  await page.setExtraHTTPHeaders({ 'sec-ch-ua': '"Chromium";v="149", "Not)A;Brand";v="24"' })
  await page.goto(url, { waitUntil: 'load', timeout: 60000 })

  // Wait for real data — a degraded card must NEVER ship to the newsletter (the sibling Badgers
  // tracker baked an empty one once, 2026-08-16). Fail loudly instead: the workflow then
  // re-publishes the last good digest.png. Two gates, each with a 150s window so it spans one of
  // the page's own 120s retry polls:
  //   1. the standings table has rows — the MLB standings feed answered;
  //   2. the game sections are settled — MiniDigest's data-games attribute distinguishes
  //      "schedule feed answered, no games in its ±12-day window" ('none': the offseason
  //      standings-only card, fine to ship — these crons run year-round) from "feed hasn't
  //      answered yet" (absent: keep waiting, and time out the render rather than screenshot).
  // NB: waitForFunction's options ride THIRD (second is the page-function arg) — passing
  // {timeout} second silently keeps the 30s default.
  await page.waitForSelector('.mini-card table tbody tr', { timeout: 150000 })
  await page.waitForFunction(
    () => {
      const card = document.querySelector('.mini-card')
      if (card?.dataset.games === 'none') return true
      return /LAST GAME|NEXT UP/.test(card?.innerText || '')
    },
    null,
    { timeout: 150000 },
  )

  // Let the trailing pitcher-line fetches (records/ERA) settle, and ensure web fonts + the
  // logos/headshots have painted so nothing renders in a fallback font or half-loaded.
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)

  await page.locator('.mini-card').screenshot({ path: out })
  console.log(`Wrote ${out}`)
} finally {
  await browser.close()
}
