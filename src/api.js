// MLB Stats API client. One job: fetch and return JSON. Fail fast (throw on non-200); the
// calling component renders its own error state. The API is public and CORS-open, so this runs
// in the browser. Live feeds (standings, schedules, hero) are NOT cached; only the heavy
// season-wide scans below memoize for a short TTL so flipping between tabs doesn't refetch them.
import { SEASON, LEAGUE_ID, DIVISION_ID, TEAM_ID, DIVISION, TEAM_NAMES } from './config.js'

const BASE = 'https://statsapi.mlb.com/api/v1'

// Fail fast: a bad response throws, the calling component shows its error state.
async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`MLB Stats API ${res.status} for ${path}`)
  return res.json()
}

// Session memo with a TTL — shares one in-flight promise across concurrent callers (e.g. the
// strikeout/arsenal/game-flow pickers all asking for the season game list at once) and avoids
// refetching the expensive scans when a reader returns to a tab. Failures aren't cached.
const _memo = new Map()
function cached(key, ttl, fn) {
  const hit = _memo.get(key)
  if (hit && Date.now() - hit.t < ttl) return hit.p
  const p = fn().catch((e) => { _memo.delete(key); throw e })
  _memo.set(key, { t: Date.now(), p })
  return p
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

// The newsletter "digest" mini needs two games in one shot: the last completed game (with the
// winning/losing pitcher, via the `decisions` hydrate) and the next scheduled game (probable
// pitchers). One schedule call over a window around today; the component fetches each pitcher's
// season line separately (hydrate can't carry those). Fail fast like the rest.
export async function fetchDigestGames() {
  const t = new Date()
  const back = new Date(t); back.setDate(t.getDate() - 12)
  const fwd = new Date(t); fwd.setDate(t.getDate() + 12)
  const data = await getJSON(`/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${localDate(back)}&endDate=${localDate(fwd)}&hydrate=team,linescore,decisions,probablePitcher`)
  const games = data.dates.flatMap((d) => d.games)
  const finals = games.filter((g) => g.gameType === 'R' && g.status.abstractGameState === 'Final' && g.teams.home.score != null && g.teams.away.score != null)
  const previews = games.filter((g) => g.status.abstractGameState === 'Preview')
  return { last: finals[finals.length - 1] || null, next: previews[0] || null }
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

// Box score for a COMPLETED game, cached (static once final) — the bullpen check reads the last
// couple of games and shouldn't refetch on tab flips. Live callers keep using fetchBoxscore.
export function fetchFinalBoxscore(gamePk) {
  return cached(`finalBox:${gamePk}`, 600000, () => fetchBoxscore(gamePk))
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

// MLB-wide leaders for the milestone-watch categories → { category: { personId: {rank, value, tied} } }.
// Lets the milestone chips add league context ("tied for the MLB lead in wins").
export function fetchLeagueLeaders() {
  return cached('leaders', 300000, async () => {
    const [hit, pit] = await Promise.all([
      getJSON(`/stats/leaders?leaderCategories=homeRuns,runsBattedIn,hits,stolenBases&season=${SEASON}&sportId=1&statGroup=hitting&limit=10`),
      getJSON(`/stats/leaders?leaderCategories=wins,strikeouts,saves&season=${SEASON}&sportId=1&statGroup=pitching&limit=10`),
    ])
    const map = {}
    ;[...(hit.leagueLeaders || []), ...(pit.leagueLeaders || [])].forEach((c) => {
      const atRank = {}
      c.leaders.forEach((l) => { atRank[l.rank] = (atRank[l.rank] || 0) + 1 })
      const byPerson = {}
      c.leaders.forEach((l) => { byPerson[l.person.id] = { rank: l.rank, value: l.value, tied: atRank[l.rank] > 1 } })
      map[c.leaderCategory] = byPerson
    })
    return map
  })
}

// Completed regular-season Brewers games, newest first — the stat lab's game picker (cached:
// every tracker that has a game dropdown shares this one fetch).
export function fetchSeasonFinals() {
  return cached('finals', 120000, async () => {
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
          oppId: opp.id,
          oppName: opp.teamName || opp.name.replace('Milwaukee ', ''),
          me: g.teams[home ? 'home' : 'away'].score,
          them: g.teams[home ? 'away' : 'home'].score,
        }
      })
    return games.reverse()
  })
}

// One opposing team's current form (record, streak, last 10, division rank) for the hero's
// scouting line. Fetches BOTH leagues' standings once (cached — any opponent resolves from the
// same map) and looks the team up.
export function fetchTeamContext(teamId) {
  return cached('mlbStandings', 120000, async () => {
    const data = await getJSON(`/standings?leagueId=103,104&season=${SEASON}`)
    const map = {}
    data.records.forEach((r) => r.teamRecords.forEach((t) => {
      map[t.team.id] = {
        wins: t.wins,
        losses: t.losses,
        streak: t.streak?.streakCode || null,
        divRank: t.divisionRank || null,
        l10: (t.records?.splitRecords || []).find((s) => s.type === 'lastTen') || null,
      }
    }))
    return map
  }).then((m) => m[teamId] || null)
}

// Raw play-by-play for one game — cached (a completed game's play-by-play is static, and the
// spray + HR scans reuse the same games), so reopening a tab/game is instant.
export function fetchPlayByPlay(gamePk) {
  return cached(`pbp:${gamePk}`, 600000, async () => {
    const data = await getJSON(`/game/${gamePk}/playByPlay`)
    return data.allPlays || []
  })
}

// Every Brewers home run this season, with Statcast batted-ball data + landing coordinates.
// Pre-filters via the team game log (only games where the Brewers actually homered) so the
// per-game play-by-play fan-out is ~half the schedule, pooled and failure-tolerant — the same
// deliberate client-side fan-out pattern as "this day in history".
export function fetchSeasonHomeRuns() {
  return cached('homeRuns', 300000, async () => {
    const log = await getJSON(`/teams/${TEAM_ID}/stats?stats=gameLog&group=hitting&season=${SEASON}`)
    const hrGames = (log.stats?.[0]?.splits || []).filter((s) => (s.stat?.homeRuns || 0) > 0 && s.game?.gamePk)
    const games = await pooled(hrGames, 6, async (s) => {
      const plays = await fetchPlayByPlay(s.game.gamePk) // shares the play-by-play cache with the spray scan
      return { isHome: s.isHome, date: s.date, opp: TEAM_NAMES[s.opponent?.id] || '', plays }
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
  })
}

// Every Brewers batted ball this season (for the spray chart), grouped later by hitter. Fans out
// across the full schedule — heavier than the HR fetch (can't pre-filter), so it's loaded once on
// demand and cached by the component. Pooled + failure-tolerant, same pattern as the other scans.
export function fetchSeasonBattedBalls() {
  return cached('battedBalls', 300000, async () => {
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
      const plays = await fetchPlayByPlay(g.gamePk)
      return { gamePk: g.gamePk, home: g.home, plays }
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
          gamePk: r.gamePk,
          date: m.date,
          opp: m.opp,
          home: m.home,
          seriesId: m.seriesId,
        })
      })
    })
    return balls
  })
}

// Per-play win probability for one game (game-flow chart derives the line + biggest swing).
export async function fetchWinProbability(gamePk) {
  const data = await getJSON(`/game/${gamePk}/winProbability`)
  return Array.isArray(data) ? data : []
}

// The opposing probable's throwing hand — the schedule hydrate doesn't carry it.
export async function fetchPitcherHand(personId) {
  const data = await getJSON(`/people/${personId}`)
  return data.people?.[0]?.pitchHand?.code || null
}

// One hitter's season splits vs LHP/RHP (cached — the matchup-edge module asks for several at
// once, and flipping back to the tab shouldn't refetch).
export function fetchHitterSplits(personId) {
  return cached(`splits:${personId}`, 300000, async () => {
    const data = await getJSON(`/people/${personId}/stats?stats=statSplits&sitCodes=vl,vr&season=${SEASON}&group=hitting`)
    const out = { vl: null, vr: null }
    ;(data.stats?.[0]?.splits || []).forEach((s) => {
      if (s.split?.code === 'vl') out.vl = s.stat
      if (s.split?.code === 'vr') out.vr = s.stat
    })
    return out
  })
}

// One hitter's game-by-game log for the season (hot-or-not form chart).
export async function fetchHitterGameLog(personId) {
  const data = await getJSON(`/people/${personId}/stats?stats=gameLog&season=${SEASON}&group=hitting`)
  return data.stats?.[0]?.splits || []
}

// Brewers currently on an injured list, from the 40-man roster's status codes (D10/D15/D60).
// Sorted soonest-back first (10-day before 60-day). One small call, fail-soft at the component.
export async function fetchInjuries() {
  const data = await getJSON(`/teams/${TEAM_ID}/roster?rosterType=40Man`)
  const tier = (code) => Number(code.slice(1)) || 99
  return (data.roster || [])
    .filter((r) => (r.status?.code || '').startsWith('D'))
    .map((r) => ({
      id: r.person.id,
      name: r.person.fullName,
      pos: r.position?.abbreviation || '',
      code: r.status.code,
      label: /^D\d+$/.test(r.status.code) ? `${r.status.code.slice(1)}-day IL` : (r.status.description || r.status.code),
    }))
    .sort((a, b) => tier(a.code) - tier(b.code) || a.name.localeCompare(b.name))
}

// Brewers roster moves over a recent window, from the transactions endpoint — readable
// one-liners ("activated RHP Brandon Woodruff from the 15-day injured list"), newest first.
export async function fetchTransactions(days = 14) {
  const t = new Date()
  const back = new Date(t); back.setDate(t.getDate() - days)
  const data = await getJSON(`/transactions?teamId=${TEAM_ID}&startDate=${localDate(back)}&endDate=${localDate(t)}`)
  const seen = new Set() // the wire occasionally carries the same move twice under different ids
  return (data.transactions || [])
    .filter((x) => x.description)
    .filter((x) => { const k = `${x.date}|${x.description}`; return seen.has(k) ? false : seen.add(k) })
    .map((x) => ({ id: x.id, date: x.date, type: x.typeDesc || '', text: x.description, personId: x.person?.id || null }))
    .reverse()
}

// Active roster with season stats hydrated in a single call.
export async function fetchRosterStats() {
  const data = await getJSON(`/teams/${TEAM_ID}/roster?rosterType=active&hydrate=person(stats(type=season,season=${SEASON}))`)
  return data.roster
}
