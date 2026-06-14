import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { fetchSeasonFinals, fetchPlayByPlay } from '../api.js'
import { gameHomeRuns } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading } from './Status.jsx'

// Distinct dot colors per hitter in a game (cycled).
const HITTER_COLORS = ['#12284b', '#c8a23a', '#9b2226', '#2e6fb0', '#2e9e6a', '#8e44ad', '#e8842a']

// MLB hit coordinates live in a ~250-wide space: home plate ≈ (125, 198), deeper balls have a
// smaller y. We plot landing spots directly in that space over a stylized field.
const VB_W = 250, VB_H = 212
const HOME = { x: 125, y: 198 }
const LF = { x: 28, y: 70 }, RF = { x: 222, y: 70 } // foul poles

function Field({ hrs, colorFor, selected, onSelect }) {
  const located = hrs.filter((h) => h.coordX != null && h.coordY != null)
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ maxWidth: 340, display: 'block' }} role="img" aria-label="Spray chart of home run landing spots">
      {/* grass fan */}
      <path d={`M${HOME.x},${HOME.y} L${LF.x},${LF.y} Q125,-28 ${RF.x},${RF.y} Z`} fill={theme.wash} stroke="none" />
      {/* outfield fence */}
      <path d={`M${LF.x},${LF.y} Q125,-28 ${RF.x},${RF.y}`} fill="none" stroke={theme.muted} strokeWidth="1.5" />
      {/* foul lines */}
      <line x1={HOME.x} y1={HOME.y} x2={LF.x} y2={LF.y} stroke={theme.rule} strokeWidth="1.5" />
      <line x1={HOME.x} y1={HOME.y} x2={RF.x} y2={RF.y} stroke={theme.rule} strokeWidth="1.5" />
      {/* infield diamond */}
      {(() => {
        const b = 26 // base path length in view units
        const second = { x: HOME.x, y: HOME.y - b * 1.4 }
        const first = { x: HOME.x + b, y: HOME.y - b * 0.7 }
        const third = { x: HOME.x - b, y: HOME.y - b * 0.7 }
        return <polygon points={`${HOME.x},${HOME.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`} fill="none" stroke={theme.rule} strokeWidth="1.25" />
      })()}
      {/* home run landing spots */}
      {located.map((h) => {
        const i = hrs.indexOf(h)
        const isSel = i === selected
        return (
          <g key={i} onMouseEnter={() => onSelect(i)} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            <circle cx={h.coordX} cy={h.coordY} r={isSel ? 7.5 : 6} fill={colorFor(h.batter)} stroke={isSel ? theme.ink : '#fff'} strokeWidth={isSel ? 2 : 1.25} />
            <text x={h.coordX} y={h.coordY + 2.6} textAnchor="middle" fontSize="7.5" fontFamily={theme.sans} fontWeight="700" fill="#fff" style={{ pointerEvents: 'none' }}>{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function HomeRuns() {
  const ref = useRef(null)
  const narrow = useIsNarrow()
  const [armed, setArmed] = useState(false)
  const [games, setGames] = useState(null)
  const [gamesError, setGamesError] = useState(false)
  const [gamePk, setGamePk] = useState(null)
  const [data, setData] = useState(null) // { gamePk, hrs } | 'loading'
  const [sel, setSel] = useState(-1)

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
    fetchSeasonFinals().then((g) => { setGames(g); if (g.length) setGamePk(g[0].gamePk) }).catch(() => setGamesError(true))
  }, [armed])

  const game = games?.find((g) => g.gamePk === gamePk)

  useEffect(() => {
    if (!game) return
    let alive = true
    setData('loading'); setSel(-1)
    fetchPlayByPlay(game.gamePk)
      .then((plays) => { if (alive) setData({ gamePk: game.gamePk, hrs: gameHomeRuns(plays, game.home ? 'bottom' : 'top') }) })
      .catch(() => { if (alive) setData({ gamePk: game.gamePk, hrs: [] }) })
    return () => { alive = false }
  }, [game])

  if (gamesError) return null
  if (!games) return <div ref={ref}><Loading lines={3} /></div>
  if (!games.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No completed games yet this season.</div>

  const hrs = data && data !== 'loading' ? data.hrs : []
  const hitters = [...new Set(hrs.map((h) => h.batter))]
  const colorFor = (name) => HITTER_COLORS[hitters.indexOf(name) % HITTER_COLORS.length]
  const longest = hrs.reduce((a, h) => (h.dist != null && (!a || h.dist > a.dist) ? h : a), null)

  const selectStyle = {
    fontFamily: theme.sans, fontSize: 13, color: theme.navy, background: '#fff',
    border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '7px 10px', maxWidth: '100%', cursor: 'pointer',
  }
  const dateLabel = (g) => `${new Date(g.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${g.home ? 'vs' : '@'} ${g.oppName} (${g.me}-${g.them})`
  const ord = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

  return (
    <div ref={ref}>
      <div style={{ marginBottom: 18 }}>
        <select aria-label="Game" value={gamePk || ''} onChange={(e) => setGamePk(Number(e.target.value))} style={selectStyle}>
          {games.map((g) => <option key={g.gamePk} value={g.gamePk}>{dateLabel(g)}</option>)}
        </select>
      </div>

      {data === 'loading' && <Loading lines={3} />}

      {data && data !== 'loading' && !hrs.length && (
        <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No Brewers home runs in this game.</div>
      )}

      {hrs.length > 0 && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: narrow ? '1 1 100%' : '0 0 340px' }}>
            <Field hrs={hrs} colorFor={colorFor} selected={sel} onSelect={setSel} />
            {longest && (
              <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, textAlign: 'center', marginTop: 2 }}>
                Longest: <span style={{ color: theme.navy, fontWeight: 700 }}>{longest.dist} ft</span> · {longest.batter.split(' ').pop()}
              </div>
            )}
            {hitters.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center', marginTop: 8 }}>
                {hitters.map((name) => (
                  <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: theme.sans, fontSize: 11, color: theme.ink }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorFor(name) }} />{name.split(' ').pop()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ol style={{ flex: '1 1 240px', listStyle: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            {hrs.map((h, i) => (
              <li key={i}>
                <button onClick={() => setSel(i)} onMouseEnter={() => setSel(i)}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 9, width: '100%', textAlign: 'left', cursor: 'pointer', background: i === sel ? theme.wash : 'transparent', border: 'none', borderTop: `1px solid ${theme.rule}`, padding: '8px 6px', fontFamily: theme.sans }}>
                  <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: '50%', background: colorFor(h.batter), color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: theme.ink, fontWeight: 700 }}>{h.batter}</span>
                    <span style={{ fontSize: 12, color: theme.muted }}> · {ord(h.inning)} inning</span>
                    <br />
                    <span style={{ fontSize: 12, color: theme.muted }}>
                      {h.dist != null ? `${h.dist} ft` : 'distance n/a'}{h.ev != null ? ` · ${h.ev} mph` : ''}{h.la != null ? ` · ${h.la}° launch` : ''}{h.field ? ` · to ${h.field}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
