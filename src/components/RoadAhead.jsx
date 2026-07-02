import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION } from '../config.js'
import { fetchRemainingSchedules, fetchLeagueTable } from '../api.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "The road ahead" — how hard each NL Central team's remaining schedule is: the aggregate
// current win% of their unplayed opponents, weighted by games. Hardest road first; the bars are
// stretched across the observed range so small differences still read. Owns its Section; fail-soft.
export default function RoadAhead() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([fetchRemainingSchedules(), fetchLeagueTable()]).then(([rem, table]) => {
      if (!alive) return
      const out = rem.map(({ id, opps }) => {
        let w = 0, g = 0
        opps.forEach((oid) => {
          const t = table[oid]
          if (!t || t.wins + t.losses === 0) return
          w += t.wins / (t.wins + t.losses)
          g++
        })
        return { id, games: opps.length, oppPct: g ? w / g : null }
      }).filter((r) => r.oppPct != null && r.games > 0)
      out.sort((a, b) => b.oppPct - a.oppPct)
      setRows(out)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!rows || rows.length < 2) return null

  const pcts = rows.map((r) => r.oppPct)
  const lo = Math.min(...pcts), hi = Math.max(...pcts)
  const span = Math.max(0.02, hi - lo) // floor the range so near-identical schedules don't zero out
  const width = (v) => 25 + ((v - lo) / span) * 75 // 25–100% keeps every bar visible
  const fmt = (v) => `.${Math.round(v * 1000)}`

  // Editorial verdict: Brewers vs their closest rival (best current record among the others).
  const me = rows.find((r) => r.id === TEAM_ID)
  const rival = rows.filter((r) => r.id !== TEAM_ID).sort((a, b) => a.oppPct - b.oppPct)[0]
  const verdict = me && rival
    ? me.oppPct < rival.oppPct
      ? `Milwaukee's remaining slate (${fmt(me.oppPct)} opponents) is softer than every rival's — the schedule leans their way.`
      : `The ${DIVISION[rival.id]} have the softest road left (${fmt(rival.oppPct)} opponents vs Milwaukee's ${fmt(me.oppPct)}).`
    : null

  return (
    <Section kicker="Strength of schedule" title="The road ahead">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        Combined winning percentage of each team's remaining opponents — the longer the bar, the harder the road.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 620 }}>
        {rows.map((r) => {
          const isMe = r.id === TEAM_ID
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 110, flexShrink: 0 }}>
                <TeamLogo id={r.id} size={18} />
                <span style={{ fontFamily: theme.serif, fontSize: 14, fontWeight: isMe ? 700 : 400, color: isMe ? theme.navy : theme.ink }}>{DIVISION[r.id]}</span>
              </span>
              <div style={{ flex: 1, height: 12, borderRadius: 6, background: theme.wash, overflow: 'hidden' }}>
                <div style={{ width: `${width(r.oppPct)}%`, height: '100%', borderRadius: 6, background: isMe ? theme.navy : theme.rule, border: isMe ? 'none' : `1px solid ${theme.rule}` }} />
              </div>
              <span style={{ fontFamily: theme.sans, fontSize: 12, color: isMe ? theme.navy : theme.muted, fontWeight: isMe ? 700 : 400, width: 86, flexShrink: 0 }}>
                {fmt(r.oppPct)} · {r.games} left
              </span>
            </div>
          )
        })}
      </div>
      {verdict && <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 14, maxWidth: 620, lineHeight: 1.5 }}>{verdict}</div>}
    </Section>
  )
}
