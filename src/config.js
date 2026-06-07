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
export const TEAM_LOGO = `https://www.mlbstatic.com/team-logos/${TEAM_ID}.svg`
export const headshot = (personId) => `https://midfield.mlbstatic.com/v1/people/${personId}/spots/120`

// WPR brand assets (the publication's own logo).
export const WPR_LOGO = 'https://wausaupilotandreview.com/wp-content/uploads/2024/04/WausauPilotandReviewLogo.png'
export const WPR_TAGLINE = 'Where Locals Look First For News'

// Sellable sponsor surfaces. Swap the strings; the layout exposes one header slot plus two inline.
export const SPONSORS = {
  header: 'Your Sponsor Here',
  race: 'Sponsor B',
  leaders: 'Sponsor C',
}
