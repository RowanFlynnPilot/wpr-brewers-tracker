import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SPONSORS, SITE_URL } from '../config.js'
import { fetchFeaturedGame, fetchPitcherSeason } from '../api.js'
import { fetchFirstPitchForecast } from '../weather.js'
import { track } from '../analytics.js'
import TeamLogo from './TeamLogo.jsx'

const REFRESH_MS = 45000
const IDLE_REFRESH_MS = 120000

// Where a tap lands: the embed can pass ?to=<full-tracker page on the news site>; until that
// page exists, fall back to the standalone tracker. http(s) only — never a script URL.
function destination() {
  const to = new URLSearchParams(window.location.search).get('to')
  return to && /^https?:\/\//i.test(to) ? to : SITE_URL
}

// "Misiorowski (7-0, 1.50)" — the broadcast notation for a probable's record + ERA.
const pitcherLine = (pitcher, stat) => {
  const last = pitcher.fullName.split(' ').pop()
  return stat ? `${last} (${stat.wins}-${stat.losses}, ${stat.era})` : last
}

// Compact featured-game scoreboard for sidebars/articles. The whole card is one link into the
// full tracker (target=_top so it navigates the page hosting the iframe, not the iframe).
// Self-contained and fail-soft: with no data it still renders a useful branded link.
export default function MiniGame() {
  const [game, setGame] = useState(null)
  const [pitchers, setPitchers] = useState(null) // { me, opp } season pitching stats
  const [forecast, setForecast] = useState(null)

  const load = useCallback(() => {
    fetchFeaturedGame().then(setGame).catch(() => {})
  }, [])

  const state = game?.status?.abstractGameState
  const gamePk = game?.gamePk
  const live = state === 'Live'
  useEffect(() => {
    load()
    const refresh = () => { if (!document.hidden) load() }
    const id = setInterval(refresh, live ? REFRESH_MS : IDLE_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, load])

  // Probable pitchers' season lines + the first-pitch forecast (home games only, like the
  // hero) — both upcoming-game extras, both fail-soft.
  useEffect(() => {
    setPitchers(null)
    setForecast(null)
    if (!game || state !== 'Preview') return
    let alive = true
    const home = game.teams.home.team.id === TEAM_ID
    const a = game.teams[home ? 'home' : 'away'].probablePitcher
    const b = game.teams[home ? 'away' : 'home'].probablePitcher
    if (a && b) {
      Promise.all([fetchPitcherSeason(a.id).catch(() => null), fetchPitcherSeason(b.id).catch(() => null)])
        .then(([sa, sb]) => { if (alive) setPitchers({ me: sa, opp: sb }) })
    }
    if (home) fetchFirstPitchForecast(game.gameDate).then((f) => { if (alive) setForecast(f) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- game object churns every poll; pk+state pin the fetch
  }, [gamePk, state])

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
    borderRadius: 8, textAlign: 'center', fontFamily: theme.sans,
  }
  const band = (text) => (
    <div style={{ background: theme.navy, color: '#fff', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {live && <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: theme.gold, flexShrink: 0 }} />}
      {text}
    </div>
  )
  const footer = (
    <div style={{ borderTop: `1px solid ${theme.rule}`, marginTop: 9, paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ fontSize: 8.5, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Presented by {SPONSORS.header.name}
        </span>
      ) : <span />}
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.navy, whiteSpace: 'nowrap' }}>Full tracker {'→'}</span>
    </div>
  )
  const linkProps = {
    href: destination(),
    target: '_top',
    onClick: () => track('Mini Click', { state: state || 'none' }),
  }

  // No data (yet, or at all): a branded doorway rather than an empty box.
  if (!game) {
    return (
      <a {...linkProps} className="link-hover" style={card}>
        {band('Brewers tracker')}
        <div style={{ padding: '9px 14px 10px' }}>
          <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, padding: '12px 0 4px' }}>The Brewers, by the numbers</div>
          <div style={{ fontSize: 11.5, color: theme.muted, paddingBottom: 4 }}>Live scores, standings and the division race</div>
          {footer}
        </div>
      </a>
    )
  }

  const final = state === 'Final'
  const home = game.teams.home.team.id === TEAM_ID
  const me = game.teams[home ? 'home' : 'away']
  const opp = game.teams[home ? 'away' : 'home']
  const oppName = opp.team.teamName || opp.team.name.replace('Milwaukee ', '')
  const won = final && me.score > opp.score
  const ls = game.linescore || {}
  const isToday = new Date(game.gameDate).toDateString() === new Date().toDateString()

  const kicker = live
    ? `${`${ls.inningHalf || ''} ${ls.currentInningOrdinal || ''}`.trim()}${ls.outs != null ? ` · ${ls.outs} out${ls.outs === 1 ? '' : 's'}` : ''}`.toUpperCase()
    : final
    ? `${new Date(game.gameDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}${won ? ' · BREWERS WIN' : ''}`
    : `${isToday ? 'TONIGHT' : new Date(game.gameDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()} · ${new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  const probables = !live && !final && me.probablePitcher && opp.probablePitcher
    ? `${pitcherLine(me.probablePitcher, pitchers?.me)} vs ${pitcherLine(opp.probablePitcher, pitchers?.opp)}`
    : null

  const TeamCol = ({ team, name, bold }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 92 }}>
      <TeamLogo id={team.team.id} size={30} />
      <span style={{ fontFamily: theme.serif, fontSize: 13, color: bold ? theme.navy : theme.ink, fontWeight: bold ? 700 : 400, lineHeight: 1.1 }}>{name}</span>
    </span>
  )

  return (
    <a {...linkProps} className="link-hover" style={card}>
      {band(live ? 'Current game' : final ? 'Final score' : 'Upcoming game')}
      <div style={{ padding: '9px 14px 10px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: live ? theme.gold : theme.muted }}>
          {kicker}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '7px 0 2px' }}>
          <TeamCol team={me} name="Brewers" bold={won} />
          {live || final ? (
            <span style={{ fontFamily: theme.serif, fontSize: 26, color: theme.ink, whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: won ? 700 : 400, color: won ? theme.navy : theme.ink }}>{me.score}</span>
              <span style={{ fontSize: 16, color: theme.muted }}> – </span>
              {opp.score}
            </span>
          ) : (
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted }}>{home ? 'vs' : 'at'}</span>
          )}
          <TeamCol team={opp} name={oppName} />
        </div>
        {probables && <div style={{ fontSize: 11, color: theme.muted, lineHeight: 1.45 }}>{probables}</div>}
        {forecast && (
          <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 3 }}>
            First pitch: {forecast.tempF}°F, {forecast.label} · {forecast.precipPct}% rain
          </div>
        )}
        {footer}
      </div>
    </a>
  )
}
