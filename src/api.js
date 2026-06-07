// MLB Stats API client. One job: fetch and return JSON. No fallbacks, no caching layer.
// The API is public and CORS-open (access-control-allow-origin: *), so this runs in the browser.
import { SEASON, LEAGUE_ID, DIVISION_ID, TEAM_ID, DIVISION } from './config.js'

const BASE = 'https://statsapi.mlb.com/api/v1'

// Fail fast: a bad response throws, the calling component shows its error state.
async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`MLB Stats API ${res.status} for ${path}`)
  return res.json()
}

const today = () => new Date().toISOString().slice(0, 10)

// Current division standings (team records array).
export async function fetchDivisionStandings() {
  const data = await getJSON(`/standings?leagueId=${LEAGUE_ID}&season=${SEASON}`)
  const record = data.records.find((r) => r.division.id === DIVISION_ID)
  if (!record) throw new Error('Division not found in standings response')
  return record.teamRecords
}

// Brewers' rank across the National League: runs scored (most first) and runs allowed (fewest first).
export async function fetchLeagueRanks() {
  const data = await getJSON(`/standings?leagueId=${LEAGUE_ID}&season=${SEASON}`)
  const teams = data.records.flatMap((r) => r.teamRecords)
  const rankBy = (cmp) => {
    const sorted = [...teams].sort(cmp)
    return { rank: sorted.findIndex((t) => t.team.id === TEAM_ID) + 1, of: teams.length }
  }
  return {
    runsScored: rankBy((a, b) => b.runsScored - a.runsScored),
    runsAllowed: rankBy((a, b) => a.runsAllowed - b.runsAllowed),
  }
}

// Season schedules for every division team — used to derive games-back over time client-side.
export async function fetchDivisionSchedules() {
  const ids = Object.keys(DIVISION)
  return Promise.all(
    ids.map(async (id) => {
      const data = await getJSON(`/schedule?sportId=1&teamId=${id}&startDate=${SEASON}-03-01&endDate=${today()}`)
      return { id: Number(id), dates: data.dates }
    })
  )
}

// Recent + upcoming games for the home team, with probable pitchers hydrated.
export async function fetchTeamSchedule() {
  const t = new Date()
  const back = new Date(t); back.setDate(t.getDate() - 6)
  const fwd = new Date(t); fwd.setDate(t.getDate() + 10)
  const fmt = (d) => d.toISOString().slice(0, 10)
  const data = await getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${fmt(back)}&endDate=${fmt(fwd)}&hydrate=probablePitcher,team`)
  return data.dates.flatMap((day) => day.games.map((g) => ({ date: day.date, game: g })))
}

// The single "featured" game for the hero: live now, else next upcoming, else last final.
// Hydrates linescore so the hero can show inning/outs/score while a game is in progress.
export async function fetchFeaturedGame() {
  const t = new Date()
  const back = new Date(t); back.setDate(t.getDate() - 1)
  const fwd = new Date(t); fwd.setDate(t.getDate() + 7)
  const fmt = (d) => d.toISOString().slice(0, 10)
  const data = await getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${fmt(back)}&endDate=${fmt(fwd)}&hydrate=probablePitcher,linescore,team`)
  const games = data.dates.flatMap((day) => day.games)
  if (!games.length) return null
  // abstractGameState is 'Live' | 'Preview' | 'Final' — cleaner than detailedState for picking.
  return (
    games.find((g) => g.status.abstractGameState === 'Live') ||
    games.find((g) => g.status.abstractGameState === 'Preview') ||
    games.filter((g) => g.status.abstractGameState === 'Final').pop() ||
    games[games.length - 1]
  )
}

// One pitcher's season pitching line (ERA, W-L, K, …). Returns the stat object, or null if the
// pitcher has no season splits yet. Schedule/hydrate can't carry these, so the hero + schedule
// cards fetch them per probable pitcher on demand.
export async function fetchPitcherSeason(personId) {
  const data = await getJSON(`/people/${personId}/stats?stats=season&season=${SEASON}&group=pitching`)
  return data.stats?.[0]?.splits?.[0]?.stat || null
}

// Brewers' Final games played on a given month/day across past seasons — for "this day in history".
// One small request per year (run in parallel, failures tolerated); kept client-side per the
// project architecture — no scraper, no committed history file.
export async function fetchThisDayGames(month, day, fromYear, toYear) {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const years = []
  for (let y = fromYear; y <= toYear; y++) years.push(y)
  const results = await Promise.allSettled(
    years.map((y) => getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${y}-${mm}-${dd}&endDate=${y}-${mm}-${dd}&hydrate=linescore,team,decisions`))
  )
  const games = []
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    ;(r.value.dates || []).forEach((d) => d.games.forEach((g) => {
      if (g.status.detailedState === 'Final') games.push({ year: years[i], game: g })
    }))
  })
  return games
}

// Active roster with season stats hydrated in a single call.
export async function fetchRosterStats() {
  const data = await getJSON(`/teams/${TEAM_ID}/roster?rosterType=active&hydrate=person(stats(type=season,season=${SEASON}))`)
  return data.roster
}
