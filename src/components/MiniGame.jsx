import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SPONSORS, SITE_URL } from '../config.js'
import { fetchFeaturedGame } from '../api.js'
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

// Compact featured-game scoreboard for sidebars/articles. The whole card is one link into the
// full tracker (target=_top so it navigates the page hosting the iframe, not the iframe).
// Self-contained and fail-soft: with no data it still renders a useful branded link.
export default function MiniGame() {
  const [game, setGame] = useState(null)

  const load = useCallback(() => {
    fetchFeaturedGame().then(setGame).catch(() => {})
  }, [])

  const live = game?.status?.abstractGameState === 'Live'
  useEffect(() => {
    load()
    const refresh = () => { if (!document.hidden) load() }
    const id = setInterval(refresh, live ? REFRESH_MS : IDLE_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, load])

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none',
    background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
    borderRadius: 8, padding: '12px 14px 10px', textAlign: 'center', fontFamily: theme.sans,
  }
  const footer = (
    <div style={{ borderTop: `1px solid ${theme.rule}`, marginTop: 10, paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
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
    onClick: () => track('Mini Click', { state: game?.status?.abstractGameState || 'none' }),
  }

  // No data (yet, or at all): a branded doorway rather than an empty box.
  if (!game) {
    return (
      <a {...linkProps} className="link-hover" style={card}>
        <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, padding: '14px 0 4px' }}>The Brewers, by the numbers</div>
        <div style={{ fontSize: 11.5, color: theme.muted, paddingBottom: 6 }}>Live scores, standings and the division race</div>
        {footer}
      </a>
    )
  }

  const final = game.status.abstractGameState === 'Final'
  const home = game.teams.home.team.id === TEAM_ID
  const me = game.teams[home ? 'home' : 'away']
  const opp = game.teams[home ? 'away' : 'home']
  const oppName = opp.team.teamName || opp.team.name.replace('Milwaukee ', '')
  const won = final && me.score > opp.score
  const ls = game.linescore || {}
  const isToday = new Date(game.gameDate).toDateString() === new Date().toDateString()

  const kicker = live
    ? `LIVE · ${`${ls.inningHalf || ''} ${ls.currentInningOrdinal || ''}`.trim().toUpperCase()}`
    : final
    ? (won ? 'FINAL · BREWERS WIN' : 'FINAL')
    : `${isToday ? 'TONIGHT' : new Date(game.gameDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()} · ${new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  const probables = !live && !final && me.probablePitcher && opp.probablePitcher
    ? `${me.probablePitcher.fullName.split(' ').pop()} vs ${opp.probablePitcher.fullName.split(' ').pop()}`
    : null

  const TeamCol = ({ team, name, bold }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 92 }}>
      <TeamLogo id={team.team.id} size={30} />
      <span style={{ fontFamily: theme.serif, fontSize: 13, color: bold ? theme.navy : theme.ink, fontWeight: bold ? 700 : 400, lineHeight: 1.1 }}>{name}</span>
    </span>
  )

  return (
    <a {...linkProps} className="link-hover" style={card}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: live ? theme.gold : theme.muted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {live && <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: theme.gold }} />}
        {kicker}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '8px 0 2px' }}>
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
      {probables && <div style={{ fontSize: 11, color: theme.muted }}>{probables}</div>}
      {footer}
    </a>
  )
}
