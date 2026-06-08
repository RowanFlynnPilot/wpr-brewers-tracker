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

// Run async `worker` over `items` with at most `size` in flight; failures resolve to null.
async function pooled(items, size, worker) {
  const out = new Array(items.length)
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const i = next++
      try { out[i] = await worker(items[i], i) } catch { out[i] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run))
  return out
}

// Brewers' Final games played on a given month/day across past seasons — for "this day in history".
// One small request per year, throttled to a few at a time (failures tolerated). Only `linescore`
// is hydrated (enough for the score, innings, and hits). Kept client-side per the project
// architecture — no scraper, no committed history file.
export async function fetchThisDayGames(month, day, fromYear, toYear) {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const years = []
  for (let y = fromYear; y <= toYear; y++) years.push(y)
  const responses = await pooled(years, 8, (y) =>
    getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${y}-${mm}-${dd}&endDate=${y}-${mm}-${dd}&hydrate=linescore`)
  )
  const games = []
  responses.forEach((data, i) => {
    if (!data) return
    ;(data.dates || []).forEach((d) => d.games.forEach((g) => {
      if (g.status.detailedState === 'Final') games.push({ year: years[i], game: g })
    }))
  })
  return games
}

// The go-ahead (game-winning) hit of a game, from play-by-play: the scoring play after which the
// winner took a lead they never gave back. Returns { batter, description } or null if unavailable
// (older games may lack play-by-play). One request, fetched only for the featured "this day" game.
export async function fetchDecisivePlay(gamePk) {
  const data = await getJSON(`/game/${gamePk}/playByPlay`)
  const scoring = (data.allPlays || []).filter((p) => p.about?.isScoringPlay && p.result)
  if (!scoring.length) return null
  const last = scoring[scoring.length - 1].result
  const homeWon = last.homeScore > last.awayScore
  const winScore = (r) => (homeWon ? r.homeScore : r.awayScore)
  const loseScore = (r) => (homeWon ? r.awayScore : r.homeScore)
  let decisive = scoring.find((p, i) => winScore(p.result) > loseScore(p.result) && scoring.slice(i).every((q) => winScore(q.result) > loseScore(q.result)))
  decisive = decisive || scoring[scoring.length - 1]
  return { batter: decisive.matchup?.batter?.fullName || null, description: decisive.result?.description || null }
}

// Full box score for one game: player batting/pitching lines + the inning-by-inning linescore.
// Fetched on demand when a schedule card is opened.
export async function fetchGameBox(gamePk) {
  const [box, line] = await Promise.all([
    getJSON(`/game/${gamePk}/boxscore`),
    getJSON(`/game/${gamePk}/linescore`),
  ])
  return { box, line }
}

// Active roster with season stats hydrated in a single call.
export async function fetchRosterStats() {
  const data = await getJSON(`/teams/${TEAM_ID}/roster?rosterType=active&hydrate=person(stats(type=season,season=${SEASON}))`)
  return data.roster
}
