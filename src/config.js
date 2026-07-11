// Single source of truth for the tweakable bits. Change a team or sponsor here, nowhere else.

export const SEASON = 2026
export const LEAGUE_ID = 104        // National League
export const DIVISION_ID = 205      // NL Central
export const TEAM_ID = 158          // Milwaukee Brewers

// NL Central, used by the standings + division-race modules.
export const DIVISION = { 158: 'Brewers', 138: 'Cardinals', 134: 'Pirates', 112: 'Cubs', 113: 'Reds' }
export const TEAM_ABBR = { 158: 'MIL', 138: 'STL', 134: 'PIT', 112: 'CHC', 113: 'CIN' }

// Line colors for the race chart. The home team is emphasized in the component, not here.
// Calmer, distinct hues for the rivals so the navy Brewers line stays the focus.
export const TEAM_COLORS = { 158: '#12284b', 138: '#a23b46', 134: '#c08a2e', 112: '#4e72a8', 113: '#6f9e6a' }

// MLB team id → short club name (from /teams?sportId=1). Used to label opponents where the
// feed only carries a team id (e.g. the game-log opponent in the home run tracker).
export const TEAM_NAMES = {
  108: 'Angels', 109: 'D-backs', 110: 'Orioles', 111: 'Red Sox', 112: 'Cubs', 113: 'Reds',
  114: 'Guardians', 115: 'Rockies', 116: 'Tigers', 117: 'Astros', 118: 'Royals', 119: 'Dodgers',
  120: 'Nationals', 121: 'Mets', 133: 'Athletics', 134: 'Pirates', 135: 'Padres', 136: 'Mariners',
  137: 'Giants', 138: 'Cardinals', 139: 'Rays', 140: 'Rangers', 141: 'Blue Jays', 142: 'Twins',
  143: 'Phillies', 144: 'Braves', 145: 'White Sox', 146: 'Marlins', 147: 'Yankees', 158: 'Brewers',
}

// Marked outfield fence distances (ft) per park, by zone [LF line, LF gap, CF, RF gap, RF line],
// keyed by the home team's id. Public, stable signage figures — used only for the home run
// tracker's *estimated* "out in N/30 parks" (distance + spray direction vs these fences; it does
// not model wall height or trajectory, so it won't always match Statcast's official figure).
export const PARK_DISTANCES = {
  108: [330, 387, 396, 370, 330], 109: [330, 374, 407, 374, 334], 110: [333, 384, 400, 373, 318],
  111: [310, 379, 390, 420, 302], 112: [355, 368, 400, 368, 353], 113: [328, 379, 404, 370, 325],
  114: [325, 370, 405, 375, 325], 115: [347, 390, 415, 375, 350], 116: [345, 370, 420, 365, 330],
  117: [315, 362, 409, 373, 326], 118: [330, 387, 410, 387, 330], 119: [330, 385, 395, 385, 330],
  120: [336, 377, 402, 370, 335], 121: [335, 379, 408, 383, 330], 133: [330, 388, 400, 388, 330],
  134: [325, 383, 399, 375, 320], 135: [336, 367, 396, 387, 322], 136: [331, 378, 401, 381, 326],
  137: [339, 364, 399, 415, 309], 138: [336, 375, 400, 375, 335], 139: [315, 370, 404, 370, 322],
  140: [329, 372, 407, 374, 326], 141: [328, 375, 400, 375, 328], 142: [339, 377, 404, 367, 328],
  143: [329, 374, 401, 369, 330], 144: [335, 385, 400, 375, 325], 145: [330, 377, 400, 372, 335],
  146: [344, 386, 400, 387, 335], 147: [318, 399, 408, 385, 314], 158: [344, 371, 400, 374, 345],
}

// Accent hue per MLB club for the mini scoreboard's split top edge — each team's most
// recognizable color, tuned to read against Brewers navy. Decorative, not official marks.
export const TEAM_ACCENT = {
  108: '#ba0021', 109: '#a71930', 110: '#df4601', 111: '#bd3039', 112: '#0e3386',
  113: '#c6011f', 114: '#e31937', 115: '#5e5ba0', 116: '#fa4616', 117: '#eb6e1f',
  118: '#004687', 119: '#005a9c', 120: '#ab0003', 121: '#ff5910', 133: '#014a35',
  134: '#27251f', 135: '#2f241d', 136: '#005c5c', 137: '#fd5a1e', 138: '#c41e3a',
  139: '#8fbce6', 140: '#c0111f', 141: '#134a8e', 142: '#d31145', 143: '#e81828',
  144: '#ce1141', 145: '#27251f', 146: '#00a3e0', 147: '#1c2841', 158: '#12284b',
}

// Brewers logo is referenced from MLB's official CDN, not redrawn.
// A team mark on a sponsored surface can imply endorsement — set false for a colors-only header
// if WPR/MLB sign-off isn't in hand.
export const USE_TEAM_LOGO = true
export const teamLogo = (teamId) => `https://www.mlbstatic.com/team-logos/${teamId}.svg`
export const TEAM_LOGO = teamLogo(TEAM_ID)
export const headshot = (personId) => `https://midfield.mlbstatic.com/v1/people/${personId}/spots/120`

// WPR brand assets (the publication's own logo).
export const WPR_LOGO = 'https://wausaupilotandreview.com/wp-content/uploads/2024/04/WausauPilotandReviewLogo.png'
export const WPR_TAGLINE = 'Where Locals Look First For News'
export const WPR_URL = 'https://wausaupilotandreview.com/'

// Franchise-best win total — the Pulse pace bar measures the current pace against it.
// Brewers: 97–65 in 2025. Update if the club sets a new mark.
export const FRANCHISE_BEST = { wins: 97, year: 2025 }

// Canonical URL of the standalone tracker — used by the share button, the calendar-event
// description, and the social-card tags in index.html.
export const SITE_URL = 'https://rowanflynnpilot.github.io/wpr-brewers-tracker/'

// Pitch-type colors (by MLB pitch code), grouped by family — shared by the strikeout tracker
// and the pitch arsenal. Fallback gray for anything unmapped.
export const PITCH_COLORS = {
  FF: '#d8402f', FA: '#d8402f',                 // four-seam / fastball — red
  SI: '#e8842a', FT: '#e8842a',                 // sinker / two-seam — orange
  FC: '#8e44ad',                                // cutter — purple
  SL: '#c8a23a', ST: '#b07d1f', SV: '#c8a23a',  // slider / sweeper / slurve — gold
  CU: '#2e6fb0', KC: '#2e6fb0', CS: '#2e6fb0',  // curve / knuckle-curve — blue
  CH: '#2e9e6a', FS: '#16a0a0', FO: '#16a0a0',  // change / split — green/teal
  KN: '#777',
}
export const pitchColor = (code) => PITCH_COLORS[code] || '#6b6b6b'

// WPR's own Brewers coverage, pulled live from the WordPress REST API (keyless + CORS-open,
// same rules as the MLB/weather clients). `categoryId` is the "Milwaukee Brewers" category
// (slug milwaukee-brewers); `archive` is its public page. Set WPR_NEWS to null to hide the
// "From the newsroom" section.
export const WPR_NEWS = {
  base: 'https://wausaupilotandreview.com/wp-json/wp/v2',
  categoryId: 567083300,
  archive: 'https://wausaupilotandreview.com/milwaukee-brewers/',
}

// Sellable sponsor surfaces. One title slot (the navy banner) plus two inline section slots.
// A slot is either a sponsor object or null (renders as an "available" upsell card).
// Sponsor shape: { name, logo, url, tagline? } — logo optional (falls back to the name in serif).
export const SPONSORS = {
  // Title sponsor — Ho-Chunk Gaming Wittenberg, current sponsor of WPR's Brewers content.
  header: {
    name: 'Ho-Chunk Gaming Wittenberg',
    logo: 'https://wausaupilotandreview.com/wp-content/uploads/2025/07/HCG-W-Logo-1-336x115.jpg',
    url: 'https://www.ho-chunkgaming.com/wittenberg/?utm_source=wausaupilotandreview&utm_medium=widget&utm_campaign=brewers_tracker',
    tagline: '800+ slots · Hotel · Dining — Wittenberg, WI',
  },
  // Open inventory. Set to a sponsor object (same shape as above) to fill the slot.
  race: null,
  leaders: null,
  // First-pitch forecast credit (a compact "Presented by" line in the hero — no upsell card
  // when empty; the forecast simply renders unsponsored until this is sold).
  forecast: null,
}

// Where to send sponsorship inquiries (shown on empty slots — the upsell).
export const SPONSOR_INQUIRY = 'weber.chris@wausaupilotandreview.com'

// "Where to watch" — the game-day guide: bar/restaurant listings sold PER LISTING (each card
// is its own sponsorship). Hidden until at least one venue is sold: an empty list renders no
// section. Every field is venue-provided; each entry looks like:
//   {
//     name: 'The Tap House',                          // venue name
//     tagline: "Wausau's home for Brewers baseball",  // short pitch line
//     images: ['https://…/bar.jpg', 'https://…/patio.jpg'],  // first is the hero shot, up to
//                                                     // three more show as thumbnails ([''] or
//                                                     // [] shows a placeholder block)
//     url: 'https://…',                               // venue website / menu
//     address: '312 Third St, Wausau',
//     phone: '715-555-0140',
//     features: ['12 HDTVs', 'Sound on for every game', 'Full bar & patio'],
//     specials: ['$3 Wisconsin taps', '50-cent wings while the Brewers bat'],
//   }
// (`let`, not `const`: sales demo mode below fills it with placeholder listings.)
export let WATCH_VENUES = []

// Shown in the footer when a gaming brand is the title sponsor. Editable; set to '' to hide.
export const SPONSOR_DISCLAIMER =
  'Must be 21+. If you or someone you know has a gambling problem, call 1-800-GAMBLER.'

// Privacy-light analytics (Plausible — cookieless, no consent banner). For sponsor ROI:
// page views = impressions, plus a 'Sponsor Click' event per slot = click-throughs.
// Set `domain` to '' to disable entirely (no script loads). Data only flows once this domain
// is also added as a site in the WPR Plausible account — until then events are sent and dropped.
export const ANALYTICS = {
  domain: 'rowanflynnpilot.github.io',
  src: 'https://plausible.io/js/script.js',
}

// ---------------------------------------------------------------------------
// SALES DEMO MODE — append ?demo to any page URL and every OPEN slot fills with a "Your brand
// here" placeholder, so WPR sales can show a prospect exactly what their sponsorship looks like
// on the live page: real scores, their name on the marquee. Sold slots (the Ho-Chunk title) are
// never overridden, ordinary readers never see it (no ?demo, no placeholders), and nothing here
// runs outside the browser. Same pattern as the Packers tracker.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')) {
  const demo = {
    name: 'Your Brand Here',
    logo: null,
    url: null,
    tagline: `This placement is open for the ${SEASON} season — ${SPONSOR_INQUIRY}`,
  }
  SPONSORS.header = SPONSORS.header || demo
  SPONSORS.race = SPONSORS.race || demo
  SPONSORS.leaders = SPONSORS.leaders || demo
  SPONSORS.forecast = SPONSORS.forecast || { name: 'Your Brand Here' }
  if (!WATCH_VENUES.length) {
    WATCH_VENUES = [
      {
        name: 'Your Bar Here',
        tagline: "Wausau's home for Brewers baseball — this listing is available",
        images: [],
        url: null,
        address: `Ask about this placement: ${SPONSOR_INQUIRY}`,
        phone: '',
        features: ['12 HDTVs', 'Sound on for every game', 'Full bar & patio'],
        specials: ['$3 Wisconsin taps', '50-cent wings while the Brewers bat'],
      },
      {
        name: 'Your Restaurant Here',
        tagline: 'The family game-day headquarters — kitchen open through the 9th inning',
        images: [],
        url: null,
        address: `Ask about this placement: ${SPONSOR_INQUIRY}`,
        phone: '',
        features: ['Big-screen wall', 'Kids eat free Sundays', 'Patio seating'],
        specials: ['Brat & tap combo, $9', 'Half-price apps while the Brewers bat'],
      },
    ]
  }
}
