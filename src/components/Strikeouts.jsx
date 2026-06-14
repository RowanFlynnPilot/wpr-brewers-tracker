import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { fetchSeasonFinals, fetchPlayByPlay } from '../api.js'
import { gameStrikeouts } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading } from './Status.jsx'

// Pitch-type colors (by MLB pitch code), grouped by family. Fallback gray for anything unmapped.
const PITCH_COLORS = {
  FF: '#d8402f', FA: '#d8402f',                 // four-seam / fastball — red
  SI: '#e8842a', FT: '#e8842a',                 // sinker / two-seam — orange
  FC: '#8e44ad',                                // cutter — purple
  SL: '#c8a23a', ST: '#b07d1f', SV: '#c8a23a',  // slider / sweeper / slurve — gold
  CU: '#2e6fb0', KC: '#2e6fb0', CS: '#2e6fb0',  // curve / knuckle-curve — blue
  CH: '#2e9e6a', FS: '#16a0a0', FO: '#16a0a0',  // change / split — green/teal
  KN: '#777',
}
const pitchColor = (code) => PITCH_COLORS[code] || theme.muted

// Strike-zone plot domain, in feet (catcher's view: +x = catcher's right, +z = up).
const X0 = -2, X1 = 2, Z0 = 0.5, Z1 = 4.5
const PLATE = 0.708 // home-plate half-width (17") in feet — the rulebook zone edges
const SIZE = 300, PAD = 10
const sx = (pX) => PAD + ((pX - X0) / (X1 - X0)) * (SIZE - 2 * PAD)
const sy = (pZ) => PAD + ((Z1 - pZ) / (Z1 - Z0)) * (SIZE - 2 * PAD)

function StrikeZone({ ks, selected, onSelect }) {
  const located = ks.filter((k) => k.pX != null && k.pZ != null)
  const top = located.filter((k) => k.szTop).reduce((a, k, _, arr) => a + k.szTop / arr.length, 0) || 3.4
  const bot = located.filter((k) => k.szBot).reduce((a, k, _, arr) => a + k.szBot / arr.length, 0) || 1.5
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 320, display: 'block' }} role="img" aria-label="Strike zone plot of strikeout pitches">
      {/* strike zone box */}
      <rect x={sx(-PLATE)} y={sy(top)} width={sx(PLATE) - sx(-PLATE)} height={sy(bot) - sy(top)} fill="none" stroke={theme.muted} strokeWidth="1.5" />
      {/* thirds (subtle) */}
      {[1, 2].map((i) => {
        const fx = -PLATE + (i * 2 * PLATE) / 3
        const fz = bot + (i * (top - bot)) / 3
        return (
          <g key={i} stroke={theme.rule} strokeWidth="0.75">
            <line x1={sx(fx)} y1={sy(top)} x2={sx(fx)} y2={sy(bot)} />
            <line x1={sx(-PLATE)} y1={sy(fz)} x2={sx(PLATE)} y2={sy(fz)} />
          </g>
        )
      })}
      {/* home plate marker at the bottom for orientation */}
      {(() => {
        const y = sy(Z0) + 2, w = sx(PLATE) - sx(0)
        const cx = sx(0)
        return <polygon points={`${cx - w},${y - 6} ${cx + w},${y - 6} ${cx + w},${y - 2} ${cx},${y + 4} ${cx - w},${y - 2}`} fill={theme.rule} />
      })()}
      {/* pitches */}
      {located.map((k) => {
        const i = ks.indexOf(k)
        const isSel = i === selected
        const color = pitchColor(k.typeCode)
        const r = isSel ? 11 : 9
        return (
          <g key={i} onMouseEnter={() => onSelect(i)} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            <circle cx={sx(k.pX)} cy={sy(k.pZ)} r={r}
              fill={k.looking ? '#fff' : color}
              stroke={isSel ? theme.ink : color}
              strokeWidth={k.looking ? 2.5 : isSel ? 2.5 : 1.5} />
            <text x={sx(k.pX)} y={sy(k.pZ) + 3.2} textAnchor="middle" fontSize="9" fontFamily={theme.sans} fontWeight="700"
              fill={k.looking ? color : '#fff'} style={{ pointerEvents: 'none' }}>{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Strikeouts() {
  const ref = useRef(null)
  const narrow = useIsNarrow()
  const [armed, setArmed] = useState(false)
  const [games, setGames] = useState(null)
  const [gamesError, setGamesError] = useState(false)
  const [gamePk, setGamePk] = useState(null)
  const [pbp, setPbp] = useState(null) // { gamePk, pitchers } or 'loading'
  const [pitcherId, setPitcherId] = useState(null)
  const [sel, setSel] = useState(-1)

  // Defer the (season-schedule) fetch until the section nears the viewport.
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
    fetchSeasonFinals().then((g) => {
      setGames(g)
      if (g.length) setGamePk(g[0].gamePk)
    }).catch(() => setGamesError(true))
  }, [armed])

  const game = games?.find((g) => g.gamePk === gamePk)

  // Load play-by-play whenever the selected game changes; derive Brewers strikeouts by pitcher.
  useEffect(() => {
    if (!game) return
    let alive = true
    setPbp('loading'); setPitcherId(null); setSel(-1)
    fetchPlayByPlay(game.gamePk)
      .then((plays) => {
        if (!alive) return
        const pitchers = gameStrikeouts(plays, game.home ? 'top' : 'bottom')
        setPbp({ gamePk: game.gamePk, pitchers })
        if (pitchers.length) setPitcherId(pitchers[0].id)
      })
      .catch(() => { if (alive) setPbp({ gamePk: game.gamePk, pitchers: [], error: true }) })
    return () => { alive = false }
  }, [game])

  if (gamesError) return null
  if (!games) return <div ref={ref}><Loading lines={3} /></div>
  if (!games.length) return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No completed games yet this season.</div>

  const pitchers = pbp && pbp !== 'loading' ? pbp.pitchers : []
  const pitcher = pitchers.find((p) => p.id === pitcherId)
  const ks = pitcher?.strikeouts || []
  const present = [...new Set(ks.map((k) => k.typeCode))] // pitch types in this set, for the legend

  const selectStyle = {
    fontFamily: theme.sans, fontSize: 13, color: theme.navy, background: '#fff',
    border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6,
    padding: '7px 10px', maxWidth: '100%', cursor: 'pointer',
  }
  const dateLabel = (g) => `${new Date(g.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${g.home ? 'vs' : '@'} ${g.oppName} (${g.me}-${g.them})`

  return (
    <div ref={ref}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <select aria-label="Game" value={gamePk || ''} onChange={(e) => setGamePk(Number(e.target.value))} style={selectStyle}>
          {games.map((g) => <option key={g.gamePk} value={g.gamePk}>{dateLabel(g)}</option>)}
        </select>
        <select aria-label="Pitcher" value={pitcherId || ''} onChange={(e) => { setPitcherId(Number(e.target.value)); setSel(-1) }} style={selectStyle} disabled={!pitchers.length}>
          {pitchers.length
            ? pitchers.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.strikeouts.length} K</option>)
            : <option>{pbp === 'loading' ? 'Loading…' : 'No strikeouts'}</option>}
        </select>
      </div>

      {pbp === 'loading' && <Loading lines={3} />}

      {pbp && pbp !== 'loading' && !pitchers.length && (
        <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No Brewers strikeouts in this game.</div>
      )}

      {pitcher && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Strike zone */}
          <div style={{ flex: narrow ? '1 1 100%' : '0 0 320px' }}>
            <StrikeZone ks={ks} selected={sel} onSelect={setSel} />
            <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, textAlign: 'center', marginTop: 2 }}>Catcher's view · {pitcher.name}</div>
            {/* legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center', marginTop: 10 }}>
              {present.map((code) => {
                const ex = ks.find((k) => k.typeCode === code)
                return (
                  <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: theme.sans, fontSize: 11, color: theme.ink }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: pitchColor(code) }} />{ex.type}
                  </span>
                )
              })}
            </div>
            <div style={{ fontFamily: theme.sans, fontSize: 10.5, color: theme.muted, textAlign: 'center', marginTop: 6 }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: theme.muted, marginRight: 4, verticalAlign: -1 }} />Swinging
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#fff', border: `2px solid ${theme.muted}`, margin: '0 4px 0 12px', verticalAlign: -1 }} />Looking
            </div>
          </div>

          {/* Strikeout list */}
          <ol style={{ flex: '1 1 240px', listStyle: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            {ks.map((k, i) => (
              <li key={i}>
                <button
                  onClick={() => setSel(i)} onMouseEnter={() => setSel(i)}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 9, width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: i === sel ? theme.wash : 'transparent', border: 'none', borderTop: `1px solid ${theme.rule}`,
                    padding: '8px 6px', fontFamily: theme.sans,
                  }}
                >
                  <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: '50%', background: k.looking ? '#fff' : pitchColor(k.typeCode), border: `${k.looking ? 2 : 1}px solid ${pitchColor(k.typeCode)}`, color: k.looking ? pitchColor(k.typeCode) : '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: theme.ink, fontWeight: 700 }}>{k.batter}</span>
                    <span style={{ fontSize: 12, color: theme.muted }}> ({k.batSide})</span>
                    <span style={{ fontSize: 12, color: theme.muted }}> · {k.looking ? 'Looking' : 'Swinging'}</span>
                    <br />
                    <span style={{ fontSize: 12, color: theme.muted }}>
                      {k.mph != null ? `${k.mph} mph ` : ''}{k.type} · {k.inning === 1 ? '1st' : k.inning === 2 ? '2nd' : k.inning === 3 ? '3rd' : `${k.inning}th`} inning
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
