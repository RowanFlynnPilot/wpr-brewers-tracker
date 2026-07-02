import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { fetchLeagueTable } from '../api.js'
import Section from './Section.jsx'

const SIMS = 4000
const NL_DIVISIONS = [203, 204, 205] // West, East, Central

// Monte Carlo the rest of the NL season, in the browser (no backend, per the architecture).
// Model, honestly simple: each team's true talent is its win% regressed toward .500 with 25
// games of ballast; remaining wins are drawn from a normal approximation of the binomial
// (fast — 4,000 seasons in well under a second). Three division winners + three wild cards
// advance. Ties break by a per-sim random jitter. This is a HOUSE MODEL for editorial flavor,
// not Vegas — the label under the dials says so.
function simulate(teams) {
  let post = 0, division = 0, winSum = 0
  const n = teams.length
  const talent = teams.map((t) => (t.wins + 12.5) / (t.wins + t.losses + 25))
  const remaining = teams.map((t) => Math.max(0, 162 - t.wins - t.losses))
  const meIdx = teams.findIndex((t) => t.id === TEAM_ID)
  const normal = () => {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  for (let s = 0; s < SIMS; s++) {
    const finals = new Array(n)
    for (let i = 0; i < n; i++) {
      const r = remaining[i], p = talent[i]
      const mu = r * p, sd = Math.sqrt(Math.max(0.0001, r * p * (1 - p)))
      const add = Math.min(r, Math.max(0, Math.round(mu + sd * normal())))
      finals[i] = teams[i].wins + add + Math.random() * 0.5 // jitter breaks ties randomly
    }
    winSum += finals[meIdx]
    const winners = new Set()
    NL_DIVISIONS.forEach((div) => {
      let best = -1
      teams.forEach((t, i) => { if (t.divId === div && (best === -1 || finals[i] > finals[best])) best = i })
      if (best >= 0) winners.add(best)
    })
    const wc = teams.map((_, i) => i).filter((i) => !winners.has(i)).sort((a, b) => finals[b] - finals[a]).slice(0, 3)
    if (winners.has(meIdx)) { post++; division++ }
    else if (wc.includes(meIdx)) post++
  }
  return {
    postseason: Math.round((post / SIMS) * 100),
    division: Math.round((division / SIMS) * 100),
    medianWins: Math.round(winSum / SIMS),
  }
}

// SVG donut dial: value% filled, big number centered. Until a spot is mathematically decided,
// nothing is truly 0 or 100 — the display caps at >99% / <1% so the model never claims a lock.
function Dial({ value, label, color }) {
  const R = 44, C = 2 * Math.PI * R
  const text = value >= 100 ? '>99%' : value <= 0 ? '<1%' : `${value}%`
  return (
    <div style={{ textAlign: 'center', flex: '0 1 170px' }}>
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${label}: ${text}`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke={theme.rule} strokeWidth="10" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(Math.min(99.5, Math.max(0.5, value)) / 100) * C} ${C}`} transform="rotate(-90 60 60)" />
        <text x="60" y="66" textAnchor="middle" fontFamily={theme.serif} fontSize="26" fill={theme.ink}>{text}</text>
      </svg>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginTop: 4 }}>{label}</div>
    </div>
  )
}

// "The October picture" — playoff + division odds from the in-browser simulation. Owns its
// Section; renders nothing until the league table loads (and never on failure).
export default function PlayoffOdds() {
  const [odds, setOdds] = useState(null)

  useEffect(() => {
    let alive = true
    fetchLeagueTable().then((map) => {
      if (!alive) return
      const nl = Object.entries(map)
        .map(([id, t]) => ({ id: Number(id), ...t }))
        .filter((t) => NL_DIVISIONS.includes(t.divId))
      if (nl.length < 12) return // sanity: a short table means a bad response — skip quietly
      setOdds(simulate(nl))
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!odds) return null

  return (
    <Section kicker="The October picture" title="Playoff odds">
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap' }}>
        <Dial value={odds.postseason} label="Make the postseason" color={theme.navy} />
        <Dial value={odds.division} label="Win the NL Central" color={theme.gold} />
      </div>
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 14 }}>
        Median simulated finish: <span style={{ color: theme.navy, fontWeight: 700 }}>{odds.medianWins} wins</span>
      </div>
      <div style={{ textAlign: 'center', fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, marginTop: 5 }}>
        Our house model — {SIMS.toLocaleString()} rest-of-season simulations run in your browser, refreshed with the standings.
      </div>
    </Section>
  )
}
