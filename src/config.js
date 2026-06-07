// Single source of truth for the tweakable bits. Change a team or sponsor here, nowhere else.

export const SEASON = 2026
export const LEAGUE_ID = 104        // National League
export const DIVISION_ID = 205      // NL Central
export const TEAM_ID = 158          // Milwaukee Brewers

// NL Central, used by the standings + division-race modules.
export const DIVISION = { 158: 'Brewers', 138: 'Cardinals', 134: 'Pirates', 112: 'Cubs', 113: 'Reds' }

// Line colors for the race chart. The home team is emphasized in the component, not here.
export const TEAM_COLORS = { 158: '#12284b', 138: '#b0228c', 134: '#a89878', 112: '#9aa6b2', 113: '#7a9b7a' }

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

// Sellable sponsor surfaces. One title slot (the navy banner) plus two inline section slots.
// A slot is either a sponsor object or null (renders as an "available" upsell card).
// Sponsor shape: { name, logo, url, tagline? } — logo optional (falls back to the name in serif).
export const SPONSORS = {
  // Title sponsor — Ho-Chunk Gaming Wittenberg, current sponsor of WPR's Brewers content.
  header: {
    name: 'Ho-Chunk Gaming Wittenberg',
    logo: 'https://wausaupilotandreview.com/wp-content/uploads/2025/07/HCG-W-Logo-1-336x115.jpg',
    url: 'https://www.ho-chunkgaming.com/wittenberg/',
    tagline: '800+ slots · Hotel · Dining — Wittenberg, WI',
  },
  // Open inventory. Set to a sponsor object (same shape as above) to fill the slot.
  race: null,
  leaders: null,
}

// Where to send sponsorship inquiries (shown on empty slots — the upsell).
export const SPONSOR_INQUIRY = 'sales@wausaupilotandreview.com'

// Shown in the footer when a gaming brand is the title sponsor. Editable; set to '' to hide.
export const SPONSOR_DISCLAIMER =
  'Must be 21+. If you or someone you know has a gambling problem, call 1-800-GAMBLER.'

// Privacy-light analytics (Plausible — cookieless, no consent banner). For sponsor ROI:
// page views = impressions, plus a 'Sponsor Click' event per slot = click-throughs.
// Set `domain` to your Plausible site to enable; leave '' and nothing loads (no dependency).
export const ANALYTICS = {
  domain: '', // e.g. 'rowanflynnpilot.github.io' — the site you add in your Plausible dashboard
  src: 'https://plausible.io/js/script.js',
}
