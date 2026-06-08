// Derivations over division schedules (the same feed the race chart uses). Pure functions — no fetching.
import { TEAM_ID } from './config.js'

// A team's completed games in date order, each flagged won/lost with the score + opponent.
function finals(dates, teamId) {
  const out = []
  dates.forEach((day) =>
    day.games.forEach((g) => {
      if (g.status.detailedState !== 'Final') return
      const home = g.teams.home.team.id === teamId
      const me = home ? g.teams.home : g.teams.away
      const opp = home ? g.teams.away : g.teams.home
      if (me.score == null || opp.score == null) return
      out.push({ date: day.date, won: me.score > opp.score, me: me.score, opp: opp.score, oppName: opp.team.name.replace('Milwaukee ', ''), home })
    })
  )
  return out
}

// Map of teamId -> last N win/loss booleans (oldest → newest), for the standings sparklines.
export function recentForm(schedules, n = 10) {
  const map = {}
  schedules.forEach(({ id, dates }) => { map[id] = finals(dates, id).slice(-n).map((g) => g.won) })
  return map
}

// The home team's most recent completed game, summarized for the pulse recap line.
export function lastFinalGame(schedules) {
  const mine = schedules.find((s) => s.id === TEAM_ID)
  if (!mine) return null
  const fs = finals(mine.dates, TEAM_ID)
  return fs.length ? fs[fs.length - 1] : null
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
    let meCum = 0, oppCum = 0, maxDef = 0, mePrev = 0, oppPrev = 0
    innings.forEach((inn, idx) => {
      if (idx === innings.length - 1) { mePrev = meCum; oppPrev = oppCum }
      meCum += inn[meSide]?.runs || 0
      oppCum += inn[oppSide]?.runs || 0
      if (oppCum - meCum > maxDef) maxDef = oppCum - meCum
    })
    const lastInning = innings[innings.length - 1]
    const walkoff = home && won && (lastInning?.home?.runs || 0) > 0 && mePrev <= oppPrev

    let rank, category, text
    if (won && oppHits === 0) { rank = 7; category = 'no-hitter'; text = `the Brewers no-hit the ${oppName}, ${me}–${opp}.` }
    else if (walkoff) { rank = 6; category = 'walk-off'; text = `the Brewers walked off the ${oppName}, ${me}–${opp}${extra ? `, in ${ls.currentInning} innings` : ''}.` }
    else if (won && maxDef >= 3) { rank = 5; category = 'comeback'; text = `the Brewers rallied from ${maxDef} runs down to beat the ${oppName}, ${me}–${opp}.` }
    else if (won && extra) { rank = 4; category = 'extra innings'; text = `the Brewers outlasted the ${oppName} in ${ls.currentInning} innings, ${me}–${opp}.` }
    else if (won && opp === 0) { rank = 3; category = 'shutout'; text = `the Brewers shut out the ${oppName}, ${me}–${opp}.` }
    else if (won && margin >= 7) { rank = 3; category = 'blowout'; text = `the Brewers routed the ${oppName}, ${me}–${opp}.` }
    else if (won) { rank = 1; category = 'win'; text = `the Brewers beat the ${oppName}, ${me}–${opp}.` }
    else { rank = 0; category = 'loss'; text = `the Brewers fell to the ${oppName}, ${opp}–${me}.` }

    return { year, gamePk: game.gamePk, me, opp, oppName, won, rank, category, margin, maxDef, text }
  })
  scored.sort((a, b) => b.rank - a.rank || b.maxDef - a.maxDef || b.margin - a.margin || b.year - a.year)
  return scored
}
