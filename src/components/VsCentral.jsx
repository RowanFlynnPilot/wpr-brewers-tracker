import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION } from '../config.js'
import { fetchSeasonFinals } from '../api.js'
import TeamLogo from './TeamLogo.jsx'

// Season head-to-head vs each division rival — a slim strip under the standings table, from the
// cached season finals (zero extra fetches). Fail-soft: renders nothing until there are results.
export default function VsCentral() {
  const [records, setRecords] = useState(null)

  useEffect(() => {
    let alive = true
    fetchSeasonFinals().then((finals) => {
      if (!alive) return
      const byOpp = {}
      finals.forEach((f) => {
        if (!DIVISION[f.oppId] || f.oppId === TEAM_ID) return
        const r = byOpp[f.oppId] || (byOpp[f.oppId] = { w: 0, l: 0 })
        if (f.me > f.them) r.w++; else r.l++
      })
      setRecords(byOpp)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!records || !Object.keys(records).length) return null

  const rivals = Object.keys(DIVISION).map(Number).filter((id) => id !== TEAM_ID && records[id])
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginBottom: 8 }}>
        Brewers vs the Central this season
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rivals.map((id) => {
          const r = records[id]
          const up = r.w > r.l
          return (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '5px 10px', background: up ? theme.wash : '#fff' }}>
              <TeamLogo id={id} size={16} />
              <span style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.ink }}>
                <span style={{ fontWeight: 700, color: up ? theme.navy : r.w < r.l ? theme.red : theme.ink }}>{r.w}–{r.l}</span>
                {' '}vs {DIVISION[id]}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
