// Derivations over division schedules (the same feed the race chart uses). Pure functions — no fetching.
import { TEAM_ID } from './config.js'

// A team's completed regular-season games in date order, each flagged won/lost with the score
// + opponent. abstractGameState (not detailedState) so "Game Over"/"Completed Early" count too;
// gameType 'R' so spring-training results never leak into recaps or form.
function finals(dates, teamId) {
  const out = []
  dates.forEach((day) =>
    day.games.forEach((g) => {
      if (g.status.abstractGameState !== 'Final' || g.gameType !== 'R') return
      const home = g.teams.home.team.id === teamId
      const me = home ? g.teams.home : g.teams.away
      const opp = home ? g.teams.away : g.teams.home
      if (me.score == null || opp.score == null) return
      out.push({ date: day.date, won: me.score > opp.score, me: me.score, opp: opp.score, oppName: opp.team.name.replace('Milwaukee ', ''), home })
    })
  )
  return out
}

// The home team's most recent completed game, summarized for the pulse recap line.
export function lastFinalGame(schedules) {
  const mine = schedules.find((s) => s.id === TEAM_ID)
  if (!mine) return null
  const fs = finals(mine.dates, TEAM_ID)
  return fs.length ? fs[fs.length - 1] : null
}

// A team's last n results, oldest → newest — feeds the standings form strip.
export function recentResults(schedules, teamId, n = 10) {
  const team = schedules?.find((s) => s.id === teamId)
  if (!team) return []
  return finals(team.dates, teamId).slice(-n).map((g) => g.won)
}

// Brewers strikeouts in a game, grouped by pitcher, each with its final (put-away) pitch.
// `pitchingHalf` is the half-inning the Brewers pitch in ('top' when home, 'bottom' when away),
// which isolates Brewers pitchers from the opponent's. Pitchers sorted by K count (most first);
// each pitcher's strikeouts stay in chronological order.
export function gameStrikeouts(allPlays, pitchingHalf) {
  const ks = (allPlays || []).filter((p) => p.result?.eventType === 'strikeout' && p.about?.halfInning === pitchingHalf)
  const byId = new Map()
  ks.forEach((p) => {
    const last = (p.playEvents || []).filter((e) => e.isPitch).pop()
    const pd = last?.pitchData
    const det = last?.details
    const call = det?.call?.description || ''
    const id = p.matchup.pitcher.id
    if (!byId.has(id)) byId.set(id, { id, name: p.matchup.pitcher.fullName, strikeouts: [] })
    byId.get(id).strikeouts.push({
      batter: p.matchup.batter.fullName,
      batSide: p.matchup.batSide?.code || '',
      inning: p.about.inning,
      mph: pd?.startSpeed ?? null,
      type: det?.type?.description || 'Pitch',
      typeCode: det?.type?.code || '',
      call,
      looking: call === 'Called Strike',
      pX: pd?.coordinates?.pX ?? null,
      pZ: pd?.coordinates?.pZ ?? null,
      szTop: pd?.strikeZoneTop ?? null,
      szBot: pd?.strikeZoneBottom ?? null,
    })
  })
  return [...byId.values()].sort((a, b) => b.strikeouts.length - a.strikeouts.length)
}

// The Brewers' standout performer from a box score — best batting OR pitching line, scored on
// simple heuristics (extra bases, RBI, innings, strikeouts, decisions). Returns
// { id, name, line } like { name: 'William Contreras', line: '3-for-4, 2 HR, 4 RBI' },
// or null when nobody clears the bar (a quiet game shouldn't headline anyone).
export function playerOfTheGame(box) {
  const side = box.teams.home.team.id === TEAM_ID ? 'home' : 'away'
  const t = box.teams[side]
  let best = null
  const push = (score, person, line) => {
    if (score > 2.5 && score > (best?.score ?? -1)) best = { score, id: person.id, name: person.fullName, line }
  }

  t.batters.map((id) => t.players['ID' + id]).forEach((p) => {
    const s = p?.stats?.batting
    if (!s || (!s.atBats && !s.baseOnBalls)) return
    const singles = s.hits - s.doubles - s.triples - s.homeRuns
    const score = singles + 1.5 * s.doubles + 2 * s.triples + 3 * s.homeRuns + s.rbi + 0.5 * s.runs + 0.3 * s.baseOnBalls + 0.5 * (s.stolenBases || 0)
    const bits = [`${s.hits}-for-${s.atBats}`]
    if (s.homeRuns) bits.push(s.homeRuns > 1 ? `${s.homeRuns} HR` : 'HR')
    if (s.rbi) bits.push(`${s.rbi} RBI`)
    if (s.runs > 1) bits.push(`${s.runs} R`)
    if (s.stolenBases) bits.push(`${s.stolenBases} SB`)
    push(score, p.person, bits.join(', '))
  })

  t.pitchers.map((id) => t.players['ID' + id]).forEach((p) => {
    const s = p?.stats?.pitching
    if (!s || !s.inningsPitched) return
    const decision = s.note && s.note.match(/\((W|L|S)/)
    const score = parseFloat(s.inningsPitched) + 0.4 * s.strikeOuts - 1.8 * s.earnedRuns + (decision && decision[1] !== 'L' ? 2 : 0)
    const bits = [`${s.inningsPitched} IP`, `${s.earnedRuns} ER`, `${s.strikeOuts} K`]
    if (decision && decision[1] !== 'L') bits.push(decision[1] === 'W' ? 'W' : 'SV')
    push(score, p.person, bits.join(', '))
  })

  return best
}

// In-game lines for the players currently at bat and on the mound, from a live box score:
// { batter: 'A. Vaughn · 2-for-3, HR', pitcher: 'K. Harrison · 2.0 IP, 3 ER, 4 K' }.
// Either side is null when the player can't be found (mid-substitution) or has no line yet.
const shortName = (fullName) => {
  const parts = fullName.split(' ')
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}
export function liveMatchupLines(box, batterId, pitcherId) {
  if (!box) return { batter: null, pitcher: null }
  const find = (id) => {
    if (!id) return null
    return box.teams.home.players['ID' + id] || box.teams.away.players['ID' + id] || null
  }
  const b = find(batterId)
  const bs = b?.stats?.batting
  let batter = null
  if (b && bs) {
    const bits = bs.atBats > 0 ? [`${bs.hits}-for-${bs.atBats}`] : []
    if (bs.homeRuns) bits.push(bs.homeRuns > 1 ? `${bs.homeRuns} HR` : 'HR')
    if (bs.rbi) bits.push(`${bs.rbi} RBI`)
    batter = bits.length ? `${shortName(b.person.fullName)} · ${bits.join(', ')}` : shortName(b.person.fullName)
  }
  const p = find(pitcherId)
  const ps = p?.stats?.pitching
  const pitcher = p && ps && ps.inningsPitched != null
    ? `${shortName(p.person.fullName)} · ${ps.inningsPitched} IP, ${ps.earnedRuns} ER, ${ps.strikeOuts} K`
    : null
  return { batter, pitcher }
}

// Series framing over the team-schedule feed ({date, game} rows): short lines for the last
// completed series and the one in progress, e.g. "Won 2 of 3 vs the Cubs" · "Up 1–0 on the
// Athletics". Series whose first game falls outside the window are skipped (can't score them).
export function seriesSummary(rows) {
  const groups = []
  rows.forEach(({ game }) => {
    if (game.gameType !== 'R') return
    const home = game.teams.home.team.id === TEAM_ID
    const opp = (home ? game.teams.away : game.teams.home).team
    const last = groups[groups.length - 1]
    if (last && last.oppId === opp.id) last.games.push(game)
    // teamName is the short club name ("Cubs") — present because the schedule hydrates team.
    else groups.push({ oppId: opp.id, oppName: opp.teamName || opp.name.replace('Milwaukee ', ''), games: [game] })
  })

  let lastDone = null
  let current = null
  groups.forEach((grp) => {
    if (grp.games[0].seriesGameNumber !== 1) return
    const total = grp.games[0].gamesInSeries || grp.games.length
    let w = 0, l = 0
    grp.games.forEach((g) => {
      if (g.status.abstractGameState !== 'Final') return
      const home = g.teams.home.team.id === TEAM_ID
      const me = home ? g.teams.home : g.teams.away
      const op = home ? g.teams.away : g.teams.home
      if (me.score == null || op.score == null) return
      if (me.score > op.score) w++; else l++
    })
    if (w + l === 0) return
    const item = { oppName: grp.oppName, w, l, total }
    if (w + l === total) lastDone = item
    else current = item
  })

  const lines = []
  if (lastDone) {
    const { w, l, total, oppName } = lastDone
    lines.push(
      w === total ? `Swept the ${oppName}` :
      l === total ? `Swept by the ${oppName}` :
      w > l ? `Won ${w} of ${total} vs the ${oppName}` :
      w === l ? `Split the series with the ${oppName}` :
      `Dropped ${l} of ${total} vs the ${oppName}`
    )
  }
  if (current) {
    const { w, l, oppName } = current
    lines.push(w > l ? `Up ${w}–${l} on the ${oppName}` : w < l ? `Down ${w}–${l} to the ${oppName}` : `Tied ${w}–${l} with the ${oppName}`)
  }
  return lines
}

// Turn a raw play-by-play decisive play into a natural sentence about the go-ahead hit.
// e.g. { batter: 'Aramis Ramirez', description: 'Aramis Ramirez singles ... Jean Segura scores.' }
//   -> "Aramis Ramirez singled home Jean Segura with the go-ahead run."
export function winningHitSentence(detail) {
  if (!detail || !detail.batter) return null
  const d = detail.description || ''
  const batter = detail.batter
  const after = d.slice(d.indexOf(batter) + batter.length)
  const verb =
    /grand slam/i.test(after) ? 'grand-slam' :
    /home run|homers/i.test(after) ? 'homer' :
    /doubles/i.test(after) ? 'doubled' :
    /triples/i.test(after) ? 'tripled' :
    /singles/i.test(after) ? 'singled' :
    /sacrifice fly|sac fly/i.test(after) ? 'sacfly' :
    /walks/i.test(after) ? 'walked' : null
  // The scorer sits in the sentence ending "... <Name> scores". Isolate that sentence first (so we
  // don't span a fielder's name in the hit clause), then take the trailing capitalized name.
  const scoreSentence = d.split('. ').find((s) => / scores\b/.test(s)) || ''
  const before = scoreSentence.split(/ scores\b/)[0]
  const sm = before.match(/([A-ZÀ-Þ][a-zà-ÿ'’-]+(?: [A-ZÀ-Þ][a-zà-ÿ'’-]+)*)\s*$/)
  const scorer = sm ? sm[1] : null

  if (verb === 'homer') return `${batter} homered to put the Brewers ahead for good.`
  if (verb === 'grand-slam') return `${batter} hit a grand slam to put the Brewers ahead for good.`
  if (scorer && (verb === 'singled' || verb === 'doubled' || verb === 'tripled')) return `${batter} ${verb} home ${scorer} with the go-ahead run.`
  if (scorer && verb === 'sacfly') return `${batter} brought ${scorer} home on a sacrifice fly for the go-ahead run.`
  if (scorer) return `${batter} drove in ${scorer} with the go-ahead run.`
  return `${batter} drove in the go-ahead run.`
}

// Score + describe each "this day in history" game, best first. Surfaces the fun angle:
// no-hitter > walk-off > comeback > extra innings > shutout/blowout > win > loss.
export function rankThisDay(games) {
  const scored = games.map(({ year, game }) => {
    const home = game.teams.home.team.id === TEAM_ID
    const meSide = home ? 'home' : 'away'
    const oppSide = home ? 'away' : 'home'
    const me = game.teams[meSide].score
    const opp = game.teams[oppSide].score
    const oppName = (home ? game.teams.away : game.teams.home).team.name.replace('Milwaukee ', '')
    const ls = game.linescore || {}
    const innings = ls.innings || []
    const oppHits = ls.teams?.[oppSide]?.hits
    const scheduled = ls.scheduledInnings || 9
    const extra = (ls.currentInning || scheduled) > scheduled
    const won = me > opp
    const margin = Math.abs(me - opp)

    // Walk through innings to find the largest deficit faced (for comebacks) and a walk-off.
    let meCum = 0, oppCum = 0, maxDef = 0, mePrev = 0
    innings.forEach((inn, idx) => {
      if (idx === innings.length - 1) mePrev = meCum
      meCum += inn[meSide]?.runs || 0
      oppCum += inn[oppSide]?.runs || 0
      if (oppCum - meCum > maxDef) maxDef = oppCum - meCum
    })
    const lastInning = innings[innings.length - 1]
    // Walk-off: entering their final at-bat the Brewers were at or behind the opponent's FINAL
    // total (the away team has already finished batting), and won by scoring in that at-bat.
    const walkoff = home && won && (lastInning?.home?.runs || 0) > 0 && mePrev <= opp

    const lr = game.teams[meSide]?.leagueRecord
    const record = lr && lr.wins != null ? { wins: lr.wins, losses: lr.losses } : null

    // Result clauses have no trailing period — the component appends the record + period.
    let rank, category, text
    if (won && oppHits === 0) { rank = 7; category = 'no-hitter'; text = `the Brewers no-hit the ${oppName}, ${me}–${opp}` }
    else if (walkoff) { rank = 6; category = 'walk-off'; text = `the Brewers walked off the ${oppName}, ${me}–${opp}${extra ? `, in ${ls.currentInning} innings` : ''}` }
    else if (won && maxDef >= 3) { rank = 5; category = 'comeback'; text = `the Brewers rallied from ${maxDef} runs down to beat the ${oppName}, ${me}–${opp}` }
    else if (won && extra) { rank = 4; category = 'extra innings'; text = `the Brewers outlasted the ${oppName} in ${ls.currentInning} innings, ${me}–${opp}` }
    else if (won && opp === 0) { rank = 3; category = 'shutout'; text = `the Brewers shut out the ${oppName}, ${me}–${opp}` }
    else if (won && margin >= 7) { rank = 3; category = 'blowout'; text = `the Brewers routed the ${oppName}, ${me}–${opp}` }
    else if (won) { rank = 1; category = 'win'; text = `the Brewers beat the ${oppName}, ${me}–${opp}` }
    else { rank = 0; category = 'loss'; text = `the Brewers fell to the ${oppName}, ${opp}–${me}` }

    return { year, gamePk: game.gamePk, me, opp, oppName, won, rank, category, margin, maxDef, text, record }
  })
  scored.sort((a, b) => b.rank - a.rank || b.maxDef - a.maxDef || b.margin - a.margin || b.year - a.year)
  return scored
}
