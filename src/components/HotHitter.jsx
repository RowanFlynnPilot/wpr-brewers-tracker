import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchHitterGameLog } from '../api.js'
import { hitterForm } from '../games.js'
import { Loading } from './Status.jsx'

const fmt3 = (n) => n.toFixed(3).replace(/^0/, '')

// Rolling-OPS sparkline across the hitter's games, with the season OPS as a reference line.
function FormChart({ form }) {
  const { series, season } = form
  const n = series.length
  if (n < 2) return null
  const W = 640, H = 140, padL = 36, padB = 16, padT = 10, padR = 8
  const all = [...series, season]
  const lo = Math.min(...all), hi = Math.max(...all)
  const pad = (hi - lo) * 0.12 || 0.05
  const ymin = lo - pad, ymax = hi + pad
  const x = (i) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (v) => padT + ((ymax - v) / (ymax - ymin)) * (H - padT - padB)
  const path = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Rolling OPS by game">
      {[ymax, (ymin + ymax) / 2, ymin].map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke={theme.rule} strokeWidth="0.75" />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontFamily={theme.sans} fontSize="9" fill={theme.muted}>{fmt3(v)}</text>
        </g>
      ))}
      {/* season reference */}
      <line x1={padL} y1={y(season)} x2={W - padR} y2={y(season)} stroke={theme.gold} strokeWidth="1.25" strokeDasharray="5 4" />
      <text x={W - padR} y={y(season) - 4} textAnchor="end" fontFamily={theme.sans} fontSize="9" fill={theme.gold} fontWeight="700">season {fmt3(season)}</text>
      <path d={path} fill="none" stroke={theme.navy} strokeWidth="2" />
      <circle cx={x(n - 1)} cy={y(series[n - 1])} r="4" fill={theme.gold} stroke={theme.ink} strokeWidth="1" />
      <text x={padL} y={H - 4} fontFamily={theme.sans} fontSize="8.5" fill={theme.muted}>Game 1</text>
      <text x={W - padR} y={H - 4} textAnchor="end" fontFamily={theme.sans} fontSize="8.5" fill={theme.muted}>Latest</text>
    </svg>
  )
}

// "Hot or not" — a hitter's trailing-10-game OPS streak line vs their season mark, with a
// heating-up / cooling-off read. Roster comes from App (already fetched); the per-hitter game
// log is fetched on selection and deferred until the section nears the viewport.
export default function HotHitter({ roster }) {
  const ref = useRef(null)
  const [armed, setArmed] = useState(false)
  const [pid, setPid] = useState(null)
  const [log, setLog] = useState(null) // splits | 'loading'

  useEffect(() => {
    if (armed || !ref.current) return
    const el = ref.current
    let io
    const t = setTimeout(() => {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setArmed(true); io.disconnect() }
      }, { rootMargin: '300px' })
      io.observe(el)
    }, 800)
    return () => { clearTimeout(t); if (io) io.disconnect() }
  }, [armed])

  // Qualified hitters from the shared roster, sorted by season OPS.
  const hitters = (roster || [])
    .map((r) => {
      const stat = (r.person.stats || []).find((s) => s.group.displayName === 'hitting')?.splits?.[0]?.stat
      return stat && stat.atBats > 60 ? { id: r.person.id, name: r.person.fullName, ops: parseFloat(stat.ops) || 0 } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.ops - a.ops)

  const selectedId = pid ?? hitters[0]?.id

  useEffect(() => {
    if (!armed || !selectedId) return
    let alive = true
    setLog('loading')
    fetchHitterGameLog(selectedId).then((s) => { if (alive) setLog(s) }).catch(() => { if (alive) setLog([]) })
    return () => { alive = false }
  }, [armed, selectedId])

  if (!roster) return <div ref={ref}><Loading lines={3} /></div>
  if (!hitters.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>Not enough plate appearances yet this season.</div>

  const form = log && log !== 'loading' ? hitterForm(log, 10) : null
  const trendColor = form?.trend === 'Heating up' ? theme.navy : form?.trend === 'Cooling off' ? theme.red : theme.muted
  const arrow = form?.trend === 'Heating up' ? '↑' : form?.trend === 'Cooling off' ? '↓' : ''

  const selectStyle = {
    fontFamily: theme.sans, fontSize: 13, color: theme.navy, background: '#fff',
    border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '7px 10px', maxWidth: '100%', cursor: 'pointer',
  }

  return (
    <div ref={ref}>
      <div style={{ marginBottom: 16 }}>
        <select aria-label="Hitter" value={selectedId || ''} onChange={(e) => setPid(Number(e.target.value))} style={selectStyle}>
          {hitters.map((h) => <option key={h.id} value={h.id}>{h.name} — {fmt3(h.ops)} OPS</option>)}
        </select>
      </div>

      {(!form || log === 'loading') && <Loading lines={3} />}

      {form && log !== 'loading' && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedId && <img src={headshot(selectedId)} alt="" width={52} height={52} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />}
            <div>
              <div style={{ display: 'inline-block', fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: '#fff', background: trendColor, borderRadius: 5, padding: '3px 9px' }}>{form.trend} {arrow}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 6 }}>
                Last 10: <span style={{ color: theme.ink, fontWeight: 700 }}>{fmt3(form.last)}</span> OPS
              </div>
              <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 1 }}>
                Season: <span style={{ color: theme.ink, fontWeight: 700 }}>{fmt3(form.season)}</span> OPS
              </div>
            </div>
          </div>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginBottom: 4 }}>10-game rolling OPS</div>
            <FormChart form={form} />
          </div>
        </div>
      )}
    </div>
  )
}
