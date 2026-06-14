import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { fetchSeasonBattedBalls } from '../api.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading } from './Status.jsx'

// Field geometry (MLB hit-coordinate space): home plate ≈ (125, 198), deeper balls smaller y.
const VB_W = 250, VB_H = 212
const HOME = { x: 125, y: 198 }
const LF = { x: 28, y: 70 }, RF = { x: 222, y: 70 }

// Batted-ball outcome → category + color. Outs sit behind as a muted cloud; hits pop on top.
const HIT = { single: '1B', double: '2B', triple: '3B', home_run: 'HR' }
const cat = (event) => HIT[event] || 'OUT'
const CAT = {
  HR: { color: '#12284b', r: 4.5 }, '3B': { color: '#9b2226', r: 4 },
  '2B': { color: '#c8a23a', r: 3.5 }, '1B': { color: '#2e9e6a', r: 3 },
  OUT: { color: '#b4b2a9', r: 2 },
}
const ORDER = ['HR', '3B', '2B', '1B', 'OUT']
const LABEL = { HR: 'Home run', '3B': 'Triple', '2B': 'Double', '1B': 'Single', OUT: 'Out' }

function Field({ balls }) {
  const located = balls.filter((b) => b.coordX != null && b.coordY != null)
  // Draw outs first (behind), then hits on top so they're not buried.
  const sorted = [...located].sort((a, b) => (cat(a.event) === 'OUT' ? 0 : 1) - (cat(b.event) === 'OUT' ? 0 : 1))
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ maxWidth: 360, display: 'block' }} role="img" aria-label="Spray chart of batted balls">
      <path d={`M${HOME.x},${HOME.y} L${LF.x},${LF.y} Q125,-28 ${RF.x},${RF.y} Z`} fill={theme.wash} stroke="none" />
      <path d={`M${LF.x},${LF.y} Q125,-28 ${RF.x},${RF.y}`} fill="none" stroke={theme.muted} strokeWidth="1.5" />
      <line x1={HOME.x} y1={HOME.y} x2={LF.x} y2={LF.y} stroke={theme.rule} strokeWidth="1.5" />
      <line x1={HOME.x} y1={HOME.y} x2={RF.x} y2={RF.y} stroke={theme.rule} strokeWidth="1.5" />
      {(() => {
        const b = 26
        const second = { x: HOME.x, y: HOME.y - b * 1.4 }
        const first = { x: HOME.x + b, y: HOME.y - b * 0.7 }
        const third = { x: HOME.x - b, y: HOME.y - b * 0.7 }
        return <polygon points={`${HOME.x},${HOME.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`} fill="none" stroke={theme.rule} strokeWidth="1.25" />
      })()}
      {sorted.map((b, i) => {
        const c = CAT[cat(b.event)]
        const out = cat(b.event) === 'OUT'
        return <circle key={i} cx={b.coordX} cy={b.coordY} r={c.r} fill={c.color} opacity={out ? 0.5 : 0.9} stroke={out ? 'none' : '#fff'} strokeWidth={out ? 0 : 0.5} />
      })}
    </svg>
  )
}

export default function Spray() {
  const ref = useRef(null)
  const narrow = useIsNarrow()
  const [armed, setArmed] = useState(false)
  const [balls, setBalls] = useState(null)
  const [error, setError] = useState(false)
  const [pid, setPid] = useState(null)

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

  useEffect(() => {
    if (!armed) return
    fetchSeasonBattedBalls().then(setBalls).catch(() => setError(true))
  }, [armed])

  if (error) return null
  if (!balls) return <div ref={ref}><div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginBottom: 8 }}>Loading season batted balls…</div><Loading lines={3} /></div>
  if (!balls.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No batted-ball data yet this season.</div>

  // Group by hitter; keep those with a meaningful sample, most batted balls first.
  const byId = new Map()
  balls.forEach((b) => {
    if (!byId.has(b.id)) byId.set(b.id, { id: b.id, name: b.name, balls: [] })
    byId.get(b.id).balls.push(b)
  })
  const batters = [...byId.values()].filter((p) => p.balls.length >= 20).sort((a, b) => b.balls.length - a.balls.length)
  const selectedId = pid ?? batters[0]?.id
  const player = batters.find((p) => p.id === selectedId) || batters[0]

  const counts = ORDER.reduce((m, k) => ({ ...m, [k]: 0 }), {})
  player.balls.forEach((b) => { counts[cat(b.event)]++ })
  const hits = counts.HR + counts['3B'] + counts['2B'] + counts['1B']

  const selectStyle = {
    fontFamily: theme.sans, fontSize: 13, color: theme.navy, background: '#fff',
    border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '7px 10px', maxWidth: '100%', cursor: 'pointer',
  }

  return (
    <div ref={ref}>
      <div style={{ marginBottom: 18 }}>
        <select aria-label="Hitter" value={selectedId || ''} onChange={(e) => setPid(Number(e.target.value))} style={selectStyle}>
          {batters.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.balls.length} balls in play</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: narrow ? '1 1 100%' : '0 0 360px' }}>
          <Field balls={player.balls} />
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, textAlign: 'center', marginTop: 2 }}>
            {player.name} · {player.balls.length} balls in play · <span style={{ color: theme.navy, fontWeight: 700 }}>{hits} hits</span>
          </div>
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700, marginBottom: 10 }}>Where they hit it</div>
          {ORDER.map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px', borderTop: `1px solid ${theme.rule}` }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: CAT[k].color, opacity: k === 'OUT' ? 0.6 : 1, flexShrink: 0 }} />
              <span style={{ fontFamily: theme.sans, fontSize: 13, color: theme.ink, flex: 1 }}>{LABEL[k]}{k !== 'OUT' ? 's' : 's'}</span>
              <span style={{ fontFamily: theme.serif, fontSize: 15, fontWeight: 700, color: theme.ink }}>{counts[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
