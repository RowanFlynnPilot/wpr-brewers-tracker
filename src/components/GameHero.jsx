import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SPONSORS } from '../config.js'
import { fetchFeaturedGame } from '../api.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Sponsor from './Sponsor.jsx'
import TeamLogo from './TeamLogo.jsx'
import PitcherLine from './PitcherLine.jsx'

const REFRESH_MS = 45000 // API caches 60s; poll a touch faster so a live score never feels stale.

// Bases diamond for live games — occupied bases fill gold.
function Bases({ first, second, third }) {
  const sq = (on) => ({
    position: 'absolute', width: 13, height: 13, transform: 'rotate(45deg)',
    background: on ? theme.gold : 'transparent', border: `1.5px solid ${on ? theme.gold : theme.muted}`,
  })
  return (
    <div style={{ position: 'relative', width: 48, height: 34, margin: '0 auto' }}>
      <span style={{ ...sq(second), left: 17, top: 0 }} />
      <span style={{ ...sq(third), left: 1, top: 12 }} />
      <span style={{ ...sq(first), left: 33, top: 12 }} />
    </div>
  )
}

// Sponsored "featured game" hero — the centerpiece. Self-contained: fetches its own feed and,
// while a game is live, auto-refreshes the score + situation (pausing when the tab is hidden).
// Hidden entirely if it can't load, so a failure here never breaks the page below it.
export default function GameHero() {
  const [game, setGame] = useState(null)
  const [error, setError] = useState(false)
  const [now, setNow] = useState(Date.now())
  const narrow = useIsNarrow()

  const load = useCallback(() => {
    fetchFeaturedGame().then((g) => { setGame(g); setError(false) }).catch(() => setError(true))
  }, [])

  useEffect(() => { load() }, [load])

  // Minute tick drives the pre-game countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const live = game?.status?.abstractGameState === 'Live'
  useEffect(() => {
    if (!live) return
    const refresh = () => { if (!document.hidden) load() }
    const id = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, load])

  if (error || !game) return null

  const final = game.status.abstractGameState === 'Final'
  const home = game.teams.home.team.id === TEAM_ID
  const me = game.teams[home ? 'home' : 'away']
  const opp = game.teams[home ? 'away' : 'home']
  const oppName = opp.team.name.replace('Milwaukee ', '')
  const isToday = new Date(game.gameDate).toDateString() === new Date().toDateString()
  const ls = game.linescore || {}
  const showScore = live || final
  const won = final && me.score > opp.score

  const kicker = live ? 'Live' : final ? 'Final' : isToday ? "Today's game" : 'Next game'
  const inning = live ? `${ls.inningHalf || ''} ${ls.currentInningOrdinal || ''}`.trim() : null
  const series = game.gamesInSeries ? `Game ${game.seriesGameNumber} of ${game.gamesInSeries}` : null
  const when = !live && !final
    ? new Date(game.gameDate).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  // Pre-game countdown when first pitch is within the next 12 hours.
  const msToStart = !live && !final ? new Date(game.gameDate).getTime() - now : null
  let countdown = null
  if (msToStart != null && msToStart > 0 && msToStart < 12 * 3600 * 1000) {
    const h = Math.floor(msToStart / 3600000)
    const m = Math.floor((msToStart % 3600000) / 60000)
    countdown = h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${m}m`
  }

  // Responsive sizing for phones / narrow iframes.
  const logoSize = narrow ? 54 : 72
  const nameSize = narrow ? 20 : 24
  const scoreSize = narrow ? 40 : 52
  const matchupGap = narrow ? 12 : 22

  const TeamBlock = ({ team, name }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: narrow ? '0 1 120px' : '0 1 190px' }}>
      <TeamLogo id={team.team.id} size={logoSize} />
      <div style={{ fontFamily: theme.serif, fontSize: nameSize, color: theme.ink, lineHeight: 1.05 }}>{name}</div>
    </div>
  )

  return (
    <div style={{ marginTop: 22, border: `1px solid ${theme.rule}`, borderTop: `4px solid ${theme.gold}`, borderRadius: 10, background: theme.wash, padding: narrow ? '24px 14px 22px' : '30px 24px 26px', textAlign: 'center' }}>
      {/* Header */}
      <div style={{ fontFamily: theme.sans, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: live ? theme.gold : theme.muted, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {live && <span className="live-dot" style={{ width: 9, height: 9, borderRadius: '50%', background: theme.gold }} />}
        {kicker}{inning ? ` · ${inning}` : ''}
      </div>
      {(when || series || countdown) && (
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 6 }}>
          {[when, series, countdown].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Matchup */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: matchupGap, flexWrap: 'wrap', margin: '22px 0 18px' }}>
        <TeamBlock team={me} name="Brewers" />
        {showScore ? (
          <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: theme.serif, fontSize: scoreSize, lineHeight: 1 }}>
            <span style={{ color: won ? theme.navy : theme.ink, fontWeight: won ? 700 : 400 }}>{me.score}</span>
            <span style={{ fontSize: scoreSize * 0.5, color: theme.muted }}>–</span>
            <span style={{ color: theme.ink }}>{opp.score}</span>
          </div>
        ) : (
          <div style={{ fontFamily: theme.sans, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted }}>{home ? 'vs' : 'at'}</div>
        )}
        <TeamBlock team={opp} name={oppName} />
      </div>

      {/* Live situation */}
      {live && (
        <div aria-live="polite" style={{ margin: '0 0 18px' }}>
          <Bases first={!!ls.offense?.first} second={!!ls.offense?.second} third={!!ls.offense?.third} />
          <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.ink, marginTop: 8 }}>
            {ls.balls ?? 0}-{ls.strikes ?? 0}, {ls.outs ?? 0} out{ls.outs === 1 ? '' : 's'}
          </div>
          {(ls.offense?.batter || ls.defense?.pitcher) && (
            <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 4 }}>
              {[ls.offense?.batter && `At bat: ${ls.offense.batter.fullName}`, ls.defense?.pitcher && `P: ${ls.defense.pitcher.fullName}`].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* Probable pitchers (upcoming games) */}
      {!live && !final && (me.probablePitcher || opp.probablePitcher) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: narrow ? 24 : 40, flexWrap: 'wrap', margin: '2px 0 20px' }}>
          {[me, opp].map((side, i) => side.probablePitcher && (
            <PitcherLine key={i} personId={side.probablePitcher.id} fullName={side.probablePitcher.fullName} size={34} center />
          ))}
        </div>
      )}

      {final && (
        <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 15, color: theme.muted, margin: '0 0 18px' }}>
          {won ? 'Brewers win' : 'Final'}
        </div>
      )}

      {/* Sponsor */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Sponsor sponsor={SPONSORS.header} variant="light" compact slot="hero" />
      </div>
    </div>
  )
}
