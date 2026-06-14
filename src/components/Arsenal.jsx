import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { pitchColor } from '../config.js'
import { fetchSeasonFinals, fetchPlayByPlay } from '../api.js'
import { gamePitchers, pitchMix } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading } from './Status.jsx'

// Donut of pitch usage. R/ring math via stroke-dasharray; segments start at 12 o'clock.
function Donut({ mix, total }) {
  const R = 58, C = 2 * Math.PI * R
  let offset = 0
  return (
    <svg viewBox="0 0 150 150" width="150" height="150" role="img" aria-label="Pitch usage by type">
      <g transform="rotate(-90 75 75)">
        {mix.map((m) => {
          const len = (m.n / total) * C
          const seg = (
            <circle key={m.code} cx="75" cy="75" r={R} fill="none" stroke={pitchColor(m.code)} strokeWidth="22"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
          )
          offset += len
          return seg
        })}
      </g>
      <text x="75" y="71" textAnchor="middle" fontFamily={theme.serif} fontSize="30" fontWeight="700" fill={theme.navy}>{total}</text>
      <text x="75" y="89" textAnchor="middle" fontFamily={theme.sans} fontSize="12" fill={theme.muted}>Pitches</text>
    </svg>
  )
}

// Velocity by pitch number — shows spread by type and any late dip. Dots colored by pitch type.
// Wide aspect so it can span most of the section width.
function VeloChart({ pitches }) {
  const withV = pitches.filter((p) => p.velo != null)
  if (withV.length < 2) return null
  const W = 640, H = 150, padL = 34, padB = 20, padT = 10, padR = 12
  const vMin = Math.floor(Math.min(...withV.map((p) => p.velo)) - 1)
  const vMax = Math.ceil(Math.max(...withV.map((p) => p.velo)) + 1)
  const n = pitches.length
  const x = (i) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (v) => padT + ((vMax - v) / (vMax - vMin)) * (H - padT - padB)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Velocity by pitch number">
      {[vMin, Math.round((vMin + vMax) / 2), vMax].map((v) => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke={theme.rule} strokeWidth="0.75" />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontFamily={theme.sans} fontSize="9" fill={theme.muted}>{v}</text>
        </g>
      ))}
      {withV.map((p, i) => <circle key={i} cx={x(pitches.indexOf(p))} cy={y(p.velo)} r="3" fill={pitchColor(p.code)} />)}
      <text x={padL} y={H - 4} fontFamily={theme.sans} fontSize="9" fill={theme.muted}>First Pitch</text>
      <text x={W - padR} y={H - 4} textAnchor="end" fontFamily={theme.sans} fontSize="9" fill={theme.muted}>Last</text>
    </svg>
  )
}

export default function Arsenal() {
  const ref = useRef(null)
  const narrow = useIsNarrow()
  const [armed, setArmed] = useState(false)
  const [games, setGames] = useState(null)
  const [gamesError, setGamesError] = useState(false)
  const [gamePk, setGamePk] = useState(null)
  const [data, setData] = useState(null) // { gamePk, pitchers } | 'loading'
  const [pitcherId, setPitcherId] = useState(null)

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
    setData('loading'); setPitcherId(null)
    fetchPlayByPlay(game.gamePk)
      .then((plays) => {
        if (!alive) return
        const pitchers = gamePitchers(plays, game.home ? 'top' : 'bottom')
        setData({ gamePk: game.gamePk, pitchers })
        if (pitchers.length) setPitcherId(pitchers[0].id)
      })
      .catch(() => { if (alive) setData({ gamePk: game.gamePk, pitchers: [] }) })
    return () => { alive = false }
  }, [game])

  if (gamesError) return null
  if (!games) return <div ref={ref}><Loading lines={3} /></div>
  if (!games.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No completed games yet this season.</div>

  const pitchers = data && data !== 'loading' ? data.pitchers : []
  const pitcher = pitchers.find((p) => p.id === pitcherId)
  const mix = pitcher ? pitchMix(pitcher.pitches) : []
  const total = pitcher?.pitches.length || 0
  const topVelo = pitcher ? Math.max(...pitcher.pitches.filter((p) => p.velo != null).map((p) => p.velo), 0) : 0

  const selectStyle = {
    fontFamily: theme.sans, fontSize: 13, color: theme.navy, background: '#fff',
    border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '7px 10px', maxWidth: '100%', cursor: 'pointer',
  }
  const dateLabel = (g) => `${new Date(g.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${g.home ? 'vs' : '@'} ${g.oppName} (${g.me}-${g.them})`
  const th = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'right', padding: '6px 8px' }
  const td = { fontFamily: theme.sans, fontSize: 13, color: theme.ink, textAlign: 'right', padding: '7px 8px', borderTop: `1px solid ${theme.rule}` }

  return (
    <div ref={ref}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <select aria-label="Game" value={gamePk || ''} onChange={(e) => setGamePk(Number(e.target.value))} style={selectStyle}>
          {games.map((g) => <option key={g.gamePk} value={g.gamePk}>{dateLabel(g)}</option>)}
        </select>
        <select aria-label="Pitcher" value={pitcherId || ''} onChange={(e) => setPitcherId(Number(e.target.value))} style={selectStyle} disabled={!pitchers.length}>
          {pitchers.length
            ? pitchers.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.pitches.length} pitches</option>)
            : <option>{data === 'loading' ? 'Loading…' : 'No pitch data'}</option>}
        </select>
      </div>

      {data === 'loading' && <Loading lines={3} />}
      {data && data !== 'loading' && !pitchers.length && (
        <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No pitch data for this game.</div>
      )}

      {pitcher && (
        <>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: narrow ? '1 1 100%' : '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Donut mix={mix} total={total} />
              <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>Top Velo <span style={{ color: theme.navy, fontWeight: 700 }}>{topVelo || '—'} mph</span></div>
            </div>

            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>Pitch</th>
                    <th style={th}>Count</th><th style={th}>Usage</th><th style={th}>Avg</th><th style={th}>Top</th>
                  </tr>
                </thead>
                <tbody>
                  {mix.map((m) => (
                    <tr key={m.code}>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: pitchColor(m.code), flexShrink: 0 }} />{m.type}
                        </span>
                      </td>
                      <td style={td}>{m.n}</td>
                      <td style={td}>{m.pct}%</td>
                      <td style={td}>{m.avg != null ? m.avg.toFixed(1) : '—'}</td>
                      <td style={td}>{m.max != null ? m.max : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, marginBottom: 4 }}>Velocity through the outing</div>
            <VeloChart pitches={pitcher.pitches} />
          </div>
        </>
      )}
    </div>
  )
}
