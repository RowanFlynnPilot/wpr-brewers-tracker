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

// Active roster with season stats hydrated in a single call.
export async function fetchRosterStats() {
  const data = await getJSON(`/teams/${TEAM_ID}/roster?rosterType=active&hydrate=person(stats(type=season,season=${SEASON}))`)
  return data.roster
}
