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

// Canonical URL of the standalone tracker — used by the share button, the calendar-event
// description, and the social-card tags in index.html.
export const SITE_URL = 'https://rowanflynnpilot.github.io/wpr-brewers-tracker/'

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
export const SPONSOR_INQUIRY = 'sales@wausaupilotandreview.com'

// "Where to watch" — a sponsorable listing for a local bar/restaurant showing the games.
// Hidden until a venue is sold: WATCH_PARTY is null, so the whole section doesn't render.
// To activate, set WATCH_PARTY to an object with this shape (the venue provides the photo):
//   {
//     name: 'The Tap House',                        // venue name
//     tagline: "Wausau's home for Brewers baseball", // short pitch line
//     image: 'https://…/venue.jpg',                 // venue-provided photo ('' shows a placeholder)
//     url: 'https://…',                             // venue website / menu
//     address: 'Downtown Wausau',
//     features: ['12 HDTVs', 'Sound on for every game', 'Full bar & patio'],
//     specials: ['$3 Wisconsin taps', '50-cent wings while the Brewers bat'],
//   }
export const WATCH_PARTY = null

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
