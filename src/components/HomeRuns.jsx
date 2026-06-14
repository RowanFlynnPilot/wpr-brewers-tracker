import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchSeasonHomeRuns } from '../api.js'
import { homeRunsByPlayer } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading } from './Status.jsx'

// MLB hit coordinates live in a ~250-wide space: home plate ≈ (125, 198), deeper balls have a
// smaller y. We plot landing spots directly in that space over a stylized field.
const VB_W = 250, VB_H = 212
const HOME = { x: 125, y: 198 }
const LF = { x: 28, y: 70 }, RF = { x: 222, y: 70 }

function Field({ hrs }) {
  const [hover, setHover] = useState(null) // { h, cx, cy }
  const located = hrs.filter((h) => h.coordX != null && h.coordY != null)
  const below = hover && (hover.cy / VB_H) * 100 < 42
  const shortDate = (d) => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <div style={{ position: 'relative', maxWidth: 340 }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Spray chart of home run landing spots">
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
        {located.map((h, i) => {
          const isHover = hover?.h === h
          return (
            <circle key={i} cx={h.coordX} cy={h.coordY} r={isHover ? 7 : 5} fill={theme.navy}
              stroke={isHover ? theme.gold : '#fff'} strokeWidth={isHover ? 2 : 1.25} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover({ h, cx: h.coordX, cy: h.coordY })} onClick={() => setHover({ h, cx: h.coordX, cy: h.coordY })} />
          )
        })}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', left: `${Math.min(86, Math.max(14, (hover.cx / VB_W) * 100))}%`, top: `${(hover.cy / VB_H) * 100}%`,
          transform: `translate(-50%, ${below ? '24%' : '-120%'})`, pointerEvents: 'none', zIndex: 2,
          background: '#fff', border: `1px solid ${theme.rule}`, borderRadius: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.12)', padding: '6px 9px', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.navy }}>{hover.h.dist != null ? `${hover.h.dist} ft` : 'Home run'}</div>
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 2 }}>
            {hover.h.ev != null ? `${hover.h.ev} mph · ` : ''}{hover.h.la != null ? `${hover.h.la}° · ` : ''}{shortDate(hover.h.date)}{hover.h.opp ? ` ${hover.h.isHome ? 'vs' : '@'} ${hover.h.opp}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomeRuns() {
  const ref = useRef(null)
  const narrow = useIsNarrow()
  const [armed, setArmed] = useState(false)
  const [hrs, setHrs] = useState(null)
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
    fetchSeasonHomeRuns().then((h) => setHrs(h)).catch(() => setError(true))
  }, [armed])

  if (error) return null
  if (!hrs) return <div ref={ref}><div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginBottom: 8 }}>Loading season home runs…</div><Loading lines={3} /></div>
  if (!hrs.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No Brewers home runs yet this season.</div>

  const players = homeRunsByPlayer(hrs)
  const selectedId = pid ?? players[0].id
  const player = players.find((p) => p.id === selectedId) || players[0]
  const longest = player.hrs.reduce((a, h) => (h.dist != null && (!a || h.dist > a.dist) ? h : a), null)
  const top5 = players.slice(0, 5)

  const selectStyle = {
    fontFamily: theme.sans, fontSize: 13, color: theme.navy, background: '#fff',
    border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '7px 10px', maxWidth: '100%', cursor: 'pointer',
  }

  return (
    <div ref={ref}>
      <div style={{ marginBottom: 18 }}>
        <select aria-label="Player" value={selectedId} onChange={(e) => setPid(Number(e.target.value))} style={selectStyle}>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.count} HR</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: narrow ? '1 1 100%' : '0 0 340px' }}>
          <Field hrs={player.hrs} />
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, textAlign: 'center', marginTop: 2 }}>
            {player.name} · {player.count} HR{player.avgDist != null ? ` · ${player.avgDist} ft avg` : ''}
            {longest?.dist != null ? <> · Longest <span style={{ color: theme.navy, fontWeight: 700 }}>{longest.dist} ft</span></> : null}
          </div>
        </div>

        {/* Team leaderboard */}
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700, marginBottom: 8 }}>Team home run leaders</div>
          {top5.map((p, i) => (
            <button key={p.id} onClick={() => setPid(p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', cursor: 'pointer', background: p.id === selectedId ? theme.wash : 'transparent', border: 'none', borderTop: `1px solid ${theme.rule}`, padding: '8px 6px', fontFamily: theme.sans }}>
              <span style={{ fontFamily: theme.serif, fontSize: 15, fontWeight: 700, color: theme.muted, width: 16, flexShrink: 0 }}>{i + 1}</span>
              <img src={headshot(p.id)} alt="" width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 14, color: theme.ink, fontWeight: 700 }}>{p.name}</span>
                <br />
                <span style={{ fontSize: 12, color: theme.muted }}>{p.count} HR{p.avgDist != null ? ` · ${p.avgDist} ft avg` : ''}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
