// MLB Stats API client. One job: fetch and return JSON. No fallbacks, no caching layer.
// The API is public and CORS-open (access-control-allow-origin: *), so this runs in the browser.
import { SEASON, LEAGUE_ID, DIVISION_ID, TEAM_ID, DIVISION, TEAM_NAMES } from './config.js'

const BASE = 'https://statsapi.mlb.com/api/v1'

// Fail fast: a bad response throws, the calling component shows its error state.
async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`MLB Stats API ${res.status} for ${path}`)
  return res.json()
}

// Local calendar dates, not UTC — toISOString() rolls to "tomorrow" after 7 PM Central,
// which would drop tonight's game from date-windowed requests (e.g. the calendar export).
const pad2 = (n) => String(n).padStart(2, '0')
const localDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const today = () => localDate(new Date())

// One /standings call feeds both the division table and the Brewers' NL ranks
// (runs scored: most first; runs allowed: fewest first) — they share the endpoint.
export async function fetchStandingsBundle() {
  const data = await getJSON(`/standings?leagueId=${LEAGUE_ID}&season=${SEASON}`)
  const record = data.records.find((r) => r.division.id === DIVISION_ID)
  if (!record) throw new Error('Division not found in standings response')
  const teams = data.records.flatMap((r) => r.teamRecords)
  const rankBy = (cmp) => {
    const sorted = [...teams].sort(cmp)
    return { rank: sorted.findIndex((t) => t.team.id === TEAM_ID) + 1, of: teams.length }
  }
  return {
    standings: record.teamRecords,
    ranks: {
      runsScored: rankBy((a, b) => b.runsScored - a.runsScored),
      runsAllowed: rankBy((a, b) => a.runsAllowed - b.runsAllowed),
    },
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

// The rest of the season's games (today → season end) for the calendar export. Fetched on demand.
export async function fetchUpcomingSchedule() {
  const data = await getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${today()}&endDate=${SEASON}-10-01&hydrate=team,venue`)
  return data.dates.flatMap((d) => d.games)
}

// Recent + upcoming games for the home team, with probable pitchers hydrated.
export async function fetchTeamSchedule() {
  const t = new Date()
  const back = new Date(t); back.setDate(t.getDate() - 6)
  const fwd = new Date(t); fwd.setDate(t.getDate() + 10)
  const data = await getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${localDate(back)}&endDate=${localDate(fwd)}&hydrate=probablePitcher,team`)
  return data.dates.flatMap((day) => day.games.map((g) => ({ date: day.date, game: g })))
}

// The single "featured" game for the hero: live now; else a just-finished final (held through
// the post-game check-in window rather than flipping straight to the next matchup); else the
// next upcoming game; else the last final. Hydrates linescore for the live inning/outs/score.
export async function fetchFeaturedGame() {
  const t = new Date()
  const back = new Date(t); back.setDate(t.getDate() - 1)
  const fwd = new Date(t); fwd.setDate(t.getDate() + 7)
  const data = await getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${localDate(back)}&endDate=${localDate(fwd)}&hydrate=probablePitcher,linescore,team`)
  const games = data.dates.flatMap((day) => day.games)
  if (!games.length) return null
  // abstractGameState is 'Live' | 'Preview' | 'Final' — cleaner than detailedState for picking.
  const live = games.find((g) => g.status.abstractGameState === 'Live')
  if (live) return live
  const previews = games.filter((g) => g.status.abstractGameState === 'Preview')
  const finals = games.filter((g) => g.status.abstractGameState === 'Final')
  const lastFinal = finals[finals.length - 1]
  // "Recent" = first pitch today or within the past 8 hours. A doubleheader nightcap
  // (a Preview on the same day as the final) takes the hero back over.
  const sameLocalDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
  if (lastFinal && (sameLocalDay(lastFinal.gameDate, t) || t - new Date(lastFinal.gameDate) < 8 * 3600 * 1000)) {
    return previews.find((g) => sameLocalDay(g.gameDate, lastFinal.gameDate)) || lastFinal
  }
  return previews[0] || lastFinal || games[games.length - 1]
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

// Box score alone — the mini scoreboard's player-of-the-game needs just this.
export async function fetchBoxscore(gamePk) {
  return getJSON(`/game/${gamePk}/boxscore`)
}

// Full box score for one game: player batting/pitching lines + the inning-by-inning linescore.
// Fetched on demand when a schedule card is opened.
export async function fetchGameBox(gamePk) {
  const [box, line] = await Promise.all([
    fetchBoxscore(gamePk),
    getJSON(`/game/${gamePk}/linescore`),
  ])
  return { box, line }
}

// Live extras for the MINI scoreboard: win probability + the live box score (for the current
// batter/pitcher game lines). Lighter than fetchLiveExtras — no play-by-play payload.
export async function fetchMiniLive(gamePk) {
  const [cm, box] = await Promise.all([
    getJSON(`/game/${gamePk}/contextMetrics`).catch(() => ({})),
    fetchBoxscore(gamePk).catch(() => null),
  ])
  return {
    homeWinPct: typeof cm.homeWinProbability === 'number' ? cm.homeWinProbability : null,
    awayWinPct: typeof cm.awayWinProbability === 'number' ? cm.awayWinProbability : null,
    box,
  }
}

// Live extras for the game hero: win probability + the most recent plays. Only fetched while a
// game is in progress, on the hero's refresh cadence.
export async function fetchLiveExtras(gamePk) {
  const [cm, pbp] = await Promise.all([
    getJSON(`/game/${gamePk}/contextMetrics`).catch(() => ({})),
    getJSON(`/game/${gamePk}/playByPlay`).catch(() => ({})),
  ])
  const plays = (pbp.allPlays || []).slice(-3).reverse().map((p) => ({
    half: p.about?.halfInning,
    inning: p.about?.inning,
    scoring: !!p.about?.isScoringPlay,
    desc: p.result?.description || '',
  }))
  return {
    homeWinPct: typeof cm.homeWinProbability === 'number' ? cm.homeWinProbability : null,
    awayWinPct: typeof cm.awayWinProbability === 'number' ? cm.awayWinProbability : null,
    plays,
  }
}

// Completed regular-season Brewers games, newest first — the strikeout tracker's game picker.
export async function fetchSeasonFinals() {
  const data = await getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${SEASON}-03-01&endDate=${today()}&hydrate=team`)
  const seen = new Set() // a rescheduled game appears twice — once as a scoreless placeholder on
  // its original date, once with the real result. Drop scoreless records first, then dedupe by
  // gamePk so the played game (with scores) is the one kept.
  const games = data.dates
    .flatMap((d) => d.games)
    .filter((g) => g.gameType === 'R' && g.status.abstractGameState === 'Final')
    .filter((g) => g.teams.home.score != null && g.teams.away.score != null)
    .filter((g) => (seen.has(g.gamePk) ? false : seen.add(g.gamePk)))
    .map((g) => {
      const home = g.teams.home.team.id === TEAM_ID
      const opp = (home ? g.teams.away : g.teams.home).team
      return {
        gamePk: g.gamePk,
        date: g.officialDate || g.gameDate.slice(0, 10),
        home,
        oppName: opp.teamName || opp.name.replace('Milwaukee ', ''),
        me: g.teams[home ? 'home' : 'away'].score,
        them: g.teams[home ? 'away' : 'home'].score,
      }
    })
  return games.reverse()
}

// Raw play-by-play for one game (strikeout tracker derives pitch-level data from this).
export async function fetchPlayByPlay(gamePk) {
  const data = await getJSON(`/game/${gamePk}/playByPlay`)
  return data.allPlays || []
}

// Every Brewers home run this season, with Statcast batted-ball data + landing coordinates.
// Pre-filters via the team game log (only games where the Brewers actually homered) so the
// per-game play-by-play fan-out is ~half the schedule, pooled and failure-tolerant — the same
// deliberate client-side fan-out pattern as "this day in history".
export async function fetchSeasonHomeRuns() {
  const log = await getJSON(`/teams/${TEAM_ID}/stats?stats=gameLog&group=hitting&season=${SEASON}`)
  const hrGames = (log.stats?.[0]?.splits || []).filter((s) => (s.stat?.homeRuns || 0) > 0 && s.game?.gamePk)
  const games = await pooled(hrGames, 6, async (s) => {
    const data = await getJSON(`/game/${s.game.gamePk}/playByPlay`)
    return { isHome: s.isHome, date: s.date, opp: TEAM_NAMES[s.opponent?.id] || '', plays: data.allPlays || [] }
  })
  const hrs = []
  games.forEach((g) => {
    if (!g) return
    const half = g.isHome ? 'bottom' : 'top'
    g.plays.filter((p) => p.result?.eventType === 'home_run' && p.about?.halfInning === half).forEach((p) => {
      const ev = (p.playEvents || []).filter((e) => e.isPitch).pop()
      const h = ev?.hitData || {}
      hrs.push({
        id: p.matchup.batter.id,
        batter: p.matchup.batter.fullName,
        date: g.date,
        opp: g.opp,
        isHome: g.isHome,
        inning: p.about.inning,
        dist: h.totalDistance ?? null,
        ev: h.launchSpeed ?? null,
        la: h.launchAngle ?? null,
        coordX: h.coordinates?.coordX ?? null,
        coordY: h.coordinates?.coordY ?? null,
        field: (p.result.description || '').match(/to ([a-z ]*field)/i)?.[1]?.trim() || '',
      })
    })
  })
  return hrs
}

// Every Brewers batted ball this season (for the spray chart), grouped later by hitter. Fans out
// across the full schedule — heavier than the HR fetch (can't pre-filter), so it's loaded once on
// demand and cached by the component. Pooled + failure-tolerant, same pattern as the other scans.
export async function fetchSeasonBattedBalls() {
  const games = await fetchSeasonFinals() // newest-first
  // Tag each game with its series (consecutive games vs the same opponent at the same venue),
  // so the spray chart can filter by month or by series.
  const meta = {}
  let series = -1, prevKey = null
  ;[...games].reverse().forEach((g) => {
    const key = `${g.home ? 'vs' : '@'}${g.oppName}`
    if (key !== prevKey) { series++; prevKey = key }
    meta[g.gamePk] = { date: g.date, opp: g.oppName, home: g.home, seriesId: series }
  })
  const fetched = await pooled(games, 8, async (g) => {
    const data = await getJSON(`/game/${g.gamePk}/playByPlay`)
    return { gamePk: g.gamePk, home: g.home, plays: data.allPlays || [] }
  })
  const balls = []
  fetched.forEach((r) => {
    if (!r) return
    const m = meta[r.gamePk] || {}
    const half = r.home ? 'bottom' : 'top'
    r.plays.filter((p) => p.about?.halfInning === half).forEach((p) => {
      const ev = (p.playEvents || []).filter((e) => e.isPitch).pop()
      const c = ev?.hitData?.coordinates
      if (!c || c.coordX == null) return // balls in play only (has landing coordinates)
      balls.push({
        id: p.matchup.batter.id,
        name: p.matchup.batter.fullName,
        coordX: c.coordX,
        coordY: c.coordY,
        event: p.result?.eventType || '',
        dist: ev.hitData.totalDistance ?? null,
        ev: ev.hitData.launchSpeed ?? null,
        date: m.date,
        opp: m.opp,
        home: m.home,
        seriesId: m.seriesId,
      })
    })
  })
  return balls
}

// Per-play win probability for one game (game-flow chart derives the line + biggest swing).
export async function fetchWinProbability(gamePk) {
  const data = await getJSON(`/game/${gamePk}/winProbability`)
  return Array.isArray(data) ? data : []
}

// One hitter's game-by-game log for the season (hot-or-not form chart).
export async function fetchHitterGameLog(personId) {
  const data = await getJSON(`/people/${personId}/stats?stats=gameLog&season=${SEASON}&group=hitting`)
  return data.stats?.[0]?.splits || []
}

// Active roster with season stats hydrated in a single call.
export async function fetchRosterStats() {
  const data = await getJSON(`/teams/${TEAM_ID}/roster?rosterType=active&hydrate=person(stats(type=season,season=${SEASON}))`)
  return data.roster
}
