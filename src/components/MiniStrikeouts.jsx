import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { pitchColor, SPONSORS } from '../config.js'
import { fetchSeasonFinals, fetchPlayByPlay } from '../api.js'
import { gameStrikeouts } from '../games.js'
import { track } from '../analytics.js'
import { destination } from '../embed.js'

// Strike-zone plot geometry (catcher's view), shared with the full tracker.
const X0 = -2, X1 = 2, Z0 = 0.5, Z1 = 4.5, PLATE = 0.708, SIZE = 200, PAD = 8
const sx = (pX) => PAD + ((pX - X0) / (X1 - X0)) * (SIZE - 2 * PAD)
const sy = (pZ) => PAD + ((Z1 - pZ) / (Z1 - Z0)) * (SIZE - 2 * PAD)

function MiniZone({ ks }) {
  const located = ks.filter((k) => k.pX != null && k.pZ != null)
  const top = located.filter((k) => k.szTop).reduce((a, k, _, arr) => a + k.szTop / arr.length, 0) || 3.4
  const bot = located.filter((k) => k.szBot).reduce((a, k, _, arr) => a + k.szBot / arr.length, 0) || 1.5
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 210, display: 'block', margin: '0 auto' }} role="img" aria-label="Strikeout pitch locations">
      <rect x={sx(-PLATE)} y={sy(top)} width={sx(PLATE) - sx(-PLATE)} height={sy(bot) - sy(top)} fill="none" stroke={theme.muted} strokeWidth="1.5" />
      {located.map((k, i) => {
        const color = pitchColor(k.typeCode)
        return (
          <circle key={i} cx={sx(k.pX)} cy={sy(k.pZ)} r="6" fill={k.looking ? '#fff' : color} stroke={color} strokeWidth={k.looking ? 2.25 : 1.25} />
        )
      })}
    </svg>
  )
}

// Compact "latest strikeout performance" embed: auto-features the top strikeout pitcher from the
// most recent game. The whole card links to the full (interactive) tracker. Fail-soft.
export default function MiniStrikeouts() {
  const [state, setState] = useState(null) // { game, pitcher } | 'empty'

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const games = await fetchSeasonFinals()
        // Use the most recent game that has a Brewers strikeout (almost always the latest).
        for (const g of games.slice(0, 3)) {
          const plays = await fetchPlayByPlay(g.gamePk)
          const pitchers = gameStrikeouts(plays, g.home ? 'top' : 'bottom')
          if (pitchers.length) { if (alive) setState({ game: g, pitcher: pitchers[0] }); return }
        }
        if (alive) setState('empty')
      } catch { if (alive) setState('empty') }
    })()
    return () => { alive = false }
  }, [])

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
    borderRadius: 8, fontFamily: theme.sans, textAlign: 'center',
  }
  const band = (
    <div style={{ background: theme.navy, color: '#fff', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px' }}>Strikeout tracker</div>
  )
  const footer = (
    <div style={{ borderTop: `1px solid ${theme.rule}`, margin: '9px 12px 0', padding: '7px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: theme.gold, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
          {SPONSORS.header.logo
            ? <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 20, objectFit: 'contain', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            : <span style={{ fontSize: 8.5, color: theme.muted, whiteSpace: 'nowrap' }}>{SPONSORS.header.name}</span>}
        </span>
      ) : <span />}
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.navy, whiteSpace: 'nowrap' }}>Full tracker {'→'}</span>
    </div>
  )
  const linkProps = { href: destination(), target: '_top', onClick: () => track('Mini Click', { widget: 'strikeouts' }) }

  if (!state || state === 'empty') {
    return (
      <a {...linkProps} className="mini-card" style={card}>
        {band}
        <div style={{ padding: '16px 14px 6px', fontFamily: theme.serif, fontSize: 16, color: theme.ink }}>The Brewers, by the numbers</div>
        <div style={{ padding: '0 14px 4px', fontSize: 11.5, color: theme.muted }}>Every strikeout, pitch by pitch</div>
        {footer}
      </a>
    )
  }

  const { game, pitcher } = state
  const ks = pitcher.strikeouts
  const present = [...new Set(ks.map((k) => k.typeCode))]
  const dateLabel = new Date(game.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <a {...linkProps} className="mini-card" style={card}>
      {band}
      <div style={{ padding: '9px 14px 4px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, color: theme.muted, textTransform: 'uppercase' }}>
          {dateLabel} {game.home ? 'vs' : '@'} {game.oppName}
        </div>
        <div style={{ fontFamily: theme.serif, fontSize: 19, color: theme.ink, marginTop: 2 }}>
          {pitcher.name} · <span style={{ color: theme.navy, fontWeight: 700 }}>{ks.length} K</span>
        </div>
        <div style={{ marginTop: 6 }}><MiniZone ks={ks} /></div>
        {present.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', justifyContent: 'center', marginTop: 6 }}>
            {present.map((code) => {
              const ex = ks.find((k) => k.typeCode === code)
              return (
                <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: theme.ink }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: pitchColor(code) }} />{ex.type}
                </span>
              )
            })}
          </div>
        )}
        <div style={{ fontSize: 9.5, color: theme.muted, marginTop: 5 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: theme.muted, marginRight: 3, verticalAlign: -1 }} />Swinging
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', border: `2px solid ${theme.muted}`, margin: '0 3px 0 10px', verticalAlign: -1 }} />Looking
        </div>
      </div>
      {footer}
    </a>
  )
}
