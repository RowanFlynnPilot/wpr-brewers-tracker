import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { fetchSeasonFinals, fetchWinProbability } from '../api.js'
import { gameFlow } from '../games.js'
import { Loading } from './Status.jsx'

const W = 660, H = 220, padL = 30, padB = 24, padT = 10, padR = 10

function FlowChart({ flow, oppName }) {
  const [hover, setHover] = useState(null) // { p, cx, cy }
  const { points, biggest } = flow
  const n = points.length
  const x = (i) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (wp) => padT + ((100 - wp) / 100) * (H - padT - padB)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.wp).toFixed(1)}`).join(' ')
  // First play index of each inning, for light orientation ticks.
  const inningStarts = []
  let lastInn = 0
  points.forEach((p, i) => { if (p.inning && p.inning !== lastInn) { inningStarts.push({ i, inning: p.inning }); lastInn = p.inning } })
  const below = hover && (hover.cy / H) * 100 < 40
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Win probability through the game">
        {/* y gridlines */}
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke={theme.rule} strokeWidth={v === 50 ? 1 : 0.75} strokeDasharray={v === 50 ? '4 4' : undefined} />
            <text x={padL - 4} y={y(v) + 3} textAnchor="end" fontFamily={theme.sans} fontSize="9" fill={theme.muted}>{v}</text>
          </g>
        ))}
        {/* inning ticks */}
        {inningStarts.map((s) => (
          <text key={s.i} x={x(s.i)} y={H - 4} textAnchor="middle" fontFamily={theme.sans} fontSize="8" fill={theme.muted}>{s.inning}</text>
        ))}
        {/* win-probability line */}
        <path d={path} fill="none" stroke={theme.navy} strokeWidth="2" />
        {/* scoring plays */}
        {points.map((p, i) => p.scoring && i !== biggest ? (
          <circle key={i} cx={x(i)} cy={y(p.wp)} r="3.5" fill="#fff" stroke={theme.navy} strokeWidth="1.5" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover({ p, cx: x(i), cy: y(p.wp) })} onClick={() => setHover({ p, cx: x(i), cy: y(p.wp) })} />
        ) : null)}
        {/* biggest swing */}
        {biggest >= 0 && (
          <circle cx={x(biggest)} cy={y(points[biggest].wp)} r="6" fill={theme.gold} stroke={theme.ink} strokeWidth="1.5" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover({ p: points[biggest], cx: x(biggest), cy: y(points[biggest].wp) })} onClick={() => setHover({ p: points[biggest], cx: x(biggest), cy: y(points[biggest].wp) })} />
        )}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', left: `${Math.min(82, Math.max(18, (hover.cx / W) * 100))}%`, top: `${(hover.cy / H) * 100}%`,
          transform: `translate(-50%, ${below ? '24%' : '-118%'})`, pointerEvents: 'none', zIndex: 2, maxWidth: 260,
          background: '#fff', border: `1px solid ${theme.rule}`, borderRadius: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.12)', padding: '6px 9px',
        }}>
          <div style={{ fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.navy }}>
            Brewers {Math.round(hover.p.wp)}% <span style={{ color: theme.muted, fontWeight: 400 }}>· {hover.p.half === 'top' ? 'Top' : 'Bot'} {hover.p.inning}</span>
          </div>
          {hover.p.bs != null && (
            <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.ink, fontWeight: 700, marginTop: 1 }}>Brewers {hover.p.bs}, {oppName} {hover.p.os}</div>
          )}
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 2, lineHeight: 1.35 }}>{hover.p.desc}</div>
        </div>
      )}
    </div>
  )
}

export default function GameFlow() {
  const ref = useRef(null)
  const [armed, setArmed] = useState(false)
  const [games, setGames] = useState(null)
  const [gamesError, setGamesError] = useState(false)
  const [gamePk, setGamePk] = useState(null)
  const [data, setData] = useState(null) // { gamePk, flow, won } | 'loading'

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
    setData('loading')
    fetchWinProbability(game.gamePk)
      .then((entries) => { if (alive) setData({ gamePk: game.gamePk, flow: gameFlow(entries, game.home), won: game.me > game.them }) })
      .catch(() => { if (alive) setData({ gamePk: game.gamePk, flow: { points: [], biggest: -1 } }) })
    return () => { alive = false }
  }, [game])

  if (gamesError) return null
  if (!games) return <div ref={ref}><Loading lines={3} /></div>
  if (!games.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No completed games yet this season.</div>

  const flow = data && data !== 'loading' ? data.flow : null
  const big = flow && flow.biggest >= 0 ? flow.points[flow.biggest] : null
  const selectStyle = {
    fontFamily: theme.sans, fontSize: 13, color: theme.navy, background: '#fff',
    border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '7px 10px', maxWidth: '100%', cursor: 'pointer',
  }
  const dateLabel = (g) => `${new Date(g.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${g.home ? 'vs' : '@'} ${g.oppName} (${g.me}-${g.them})`

  return (
    <div ref={ref}>
      <div style={{ marginBottom: 16 }}>
        <select aria-label="Game" value={gamePk || ''} onChange={(e) => setGamePk(Number(e.target.value))} style={selectStyle}>
          {games.map((g) => <option key={g.gamePk} value={g.gamePk}>{dateLabel(g)}</option>)}
        </select>
      </div>

      {data === 'loading' && <Loading lines={3} />}
      {flow && !flow.points.length && data !== 'loading' && (
        <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>Win probability isn't available for this game.</div>
      )}

      {flow && flow.points.length > 0 && (
        <>
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginBottom: 4 }}>Brewers win probability (%) — inning by inning</div>
          <FlowChart flow={flow} oppName={game?.oppName || 'Opp'} />
          {big && (
            <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.ink, marginTop: 8, lineHeight: 1.5, maxWidth: 620 }}>
              <span style={{ fontWeight: 700, color: theme.gold }}>Biggest swing</span> <span style={{ color: theme.muted }}>({big.wpa > 0 ? '+' : ''}{Math.round(big.wpa)}% for the Brewers)</span>: {big.desc}
              {big.bs != null && <span style={{ fontWeight: 700 }}> Brewers {big.bs}, {game?.oppName || 'Opp'} {big.os}.</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
