import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SPONSORS, teamLogo } from '../config.js'
import { fetchFeaturedGame } from '../api.js'
import Sponsor from './Sponsor.jsx'

const REFRESH_MS = 45000 // API caches 60s; poll a touch faster so a live score never feels stale.

// Sponsored "featured game" hero. Self-contained: fetches its own feed and, while a game is
// live, auto-refreshes the score (pausing when the tab is hidden). Hidden entirely if it can't load
// — it's supplemental, so a failure here never breaks the page below it.
export default function GameHero() {
  const [game, setGame] = useState(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    fetchFeaturedGame().then((g) => { setGame(g); setError(false) }).catch(() => setError(true))
  }, [])

  useEffect(() => { load() }, [load])

  const live = game?.status?.abstractGameState === 'Live'
  useEffect(() => {
    if (!live) return
    const refresh = () => { if (!document.hidden) load() }
    const id = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, load])

  if (error || !game) return null

  const state = game.status.abstractGameState
  const final = state === 'Final'
  const home = game.teams.home.team.id === TEAM_ID
  const me = game.teams[home ? 'home' : 'away']
  const opp = game.teams[home ? 'away' : 'home']
  const oppName = opp.team.name.replace('Milwaukee ', '')
  const isToday = new Date(game.gameDate).toDateString() === new Date().toDateString()

  const kicker = live ? 'Live now' : final ? 'Final' : isToday ? "Today's game" : 'Next game'
  const ls = game.linescore
  const inning = ls && live ? `${ls.inningHalf || ''} ${ls.currentInning ?? ''}`.trim() : ''
  const won = final && me.score > opp.score

  const Mark = ({ id }) => (
    <img src={teamLogo(id)} alt="" width={40} height={40} style={{ objectFit: 'contain' }}
      onError={(e) => { e.currentTarget.style.display = 'none' }} />
  )

  const Side = ({ team, name, score, prob }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Mark id={team.team.id} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink, lineHeight: 1.1 }}>{name}</div>
        {(live || final) ? (
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>{prob ? prob : ' '}</div>
        ) : (
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>{prob ? `Prob: ${prob}` : 'Probable TBA'}</div>
        )}
      </div>
      {(live || final) && (
        <div style={{ fontFamily: theme.serif, fontSize: 34, color: theme.ink, marginLeft: 'auto', paddingLeft: 14 }}>{score}</div>
      )}
    </div>
  )

  return (
    <div style={{ marginTop: 28, border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: live ? theme.gold : theme.muted, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
            {live && <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.gold, display: 'inline-block' }} />}
            {kicker}
          </div>
          <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 4 }}>
            {live && inning ? inning : null}
            {!live && !final && new Date(game.gameDate).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
            {final && (won ? 'Brewers win' : 'Final')}
          </div>
        </div>
        <Sponsor sponsor={SPONSORS.header} variant="light" compact />
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <Side team={me} name="Brewers" score={me.score} prob={me.probablePitcher?.fullName} />
        <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted }}>{home ? 'vs' : 'at'}</div>
        <Side team={opp} name={oppName} score={opp.score} prob={opp.probablePitcher?.fullName} />
      </div>
    </div>
  )
}
