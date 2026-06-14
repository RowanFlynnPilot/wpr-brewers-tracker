import { useEffect, useState, useCallback, useRef } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, TEAM_ACCENT, SPONSORS, headshot } from '../config.js'
import { fetchFeaturedGame, fetchPitcherSeason, fetchMiniLive, fetchBoxscore } from '../api.js'
import { fetchFirstPitchForecast } from '../weather.js'
import { playerOfTheGame, liveMatchupLines } from '../games.js'
import { track } from '../analytics.js'
import { destination } from '../embed.js'
import TeamLogo from './TeamLogo.jsx'

const REFRESH_MS = 45000
const IDLE_REFRESH_MS = 120000

// "Misiorowski (7-2, 1.50)" — the broadcast notation for a probable's record + ERA.
const pitcherLine = (pitcher, stat) => {
  const last = pitcher.fullName.split(' ').pop()
  return stat ? `${last} (${stat.wins}-${stat.losses}, ${stat.era})` : last
}

const Headshot = ({ id, size }) => (
  <img src={headshot(id)} alt="" width={size} height={size}
    style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }}
    onError={(e) => { e.currentTarget.style.display = 'none' }} />
)

// Tiny bases diamond for the live state — occupied bases fill gold.
function MiniBases({ offense }) {
  const sq = (on) => ({
    position: 'absolute', width: 11, height: 11, transform: 'rotate(45deg)',
    background: on ? theme.gold : 'transparent', border: `1.5px solid ${on ? theme.gold : theme.muted}`,
  })
  return (
    <span style={{ position: 'relative', width: 40, height: 26, display: 'inline-block' }}>
      <span style={{ ...sq(!!offense?.second), left: 14, top: 0 }} />
      <span style={{ ...sq(!!offense?.third), left: 1, top: 10 }} />
      <span style={{ ...sq(!!offense?.first), left: 27, top: 10 }} />
    </span>
  )
}

// Compact featured-game scoreboard for sidebars/articles. The whole card is one link into the
// full tracker (target=_top so it navigates the page hosting the iframe, not the iframe).
// Self-contained and fail-soft: with no data it still renders a useful branded link.
export default function MiniGame() {
  const [game, setGame] = useState(null)
  const [pitchers, setPitchers] = useState(null) // { me, opp } season pitching stats
  const [forecast, setForecast] = useState(null)
  const [extras, setExtras] = useState(null) // win probability + live box while in progress
  const [star, setStar] = useState(null) // player of the game after a final
  const [now, setNow] = useState(Date.now()) // drives the first-pitch countdown chip
  const [pop, setPop] = useState(false) // score-change animation trigger
  const prevScore = useRef(null)

  const load = useCallback(() => {
    fetchFeaturedGame().then(setGame).catch(() => {})
  }, [])

  const state = game?.status?.abstractGameState
  const gamePk = game?.gamePk
  const live = state === 'Live'

  // Poll the feed (fast while live, gently otherwise) + win probability and the live box
  // (current batter/pitcher game lines) during play.
  useEffect(() => {
    if (!live) setExtras(null)
    const refresh = () => {
      if (document.hidden) return
      load()
      if (live && gamePk) fetchMiniLive(gamePk).then(setExtras).catch(() => {})
    }
    if (live) refresh(); else load()
    const id = setInterval(refresh, live ? REFRESH_MS : IDLE_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, gamePk, load])

  // Minute tick keeps the countdown chip honest.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Pop the score once whenever it changes during play (never on first paint).
  useEffect(() => {
    if (!game || state === 'Preview') { prevScore.current = null; return }
    const key = `${game.teams.home.score}-${game.teams.away.score}`
    if (prevScore.current != null && prevScore.current !== key) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 600)
      prevScore.current = key
      return () => clearTimeout(t)
    }
    prevScore.current = key
  }, [game, state])

  // Upcoming-game extras (probables' season lines + home-game forecast) and, after a final,
  // the Brewers' player of the game from the box score. All fail-soft.
  useEffect(() => {
    setPitchers(null)
    setForecast(null)
    setStar(null)
    if (!game) return
    let alive = true
    if (state === 'Preview') {
      const home = game.teams.home.team.id === TEAM_ID
      const a = game.teams[home ? 'home' : 'away'].probablePitcher
      const b = game.teams[home ? 'away' : 'home'].probablePitcher
      if (a && b) {
        Promise.all([fetchPitcherSeason(a.id).catch(() => null), fetchPitcherSeason(b.id).catch(() => null)])
          .then(([sa, sb]) => { if (alive) setPitchers({ me: sa, opp: sb }) })
      }
      if (home) fetchFirstPitchForecast(game.gameDate).then((f) => { if (alive) setForecast(f) }).catch(() => {})
    }
    if (state === 'Final') {
      fetchBoxscore(gamePk).then((box) => { if (alive) setStar(playerOfTheGame(box)) }).catch(() => {})
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- game object churns every poll; pk+state pin the fetch
  }, [gamePk, state])

  const final = state === 'Final'
  const home = game ? game.teams.home.team.id === TEAM_ID : true
  const me = game?.teams[home ? 'home' : 'away']
  const opp = game?.teams[home ? 'away' : 'home']

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderRadius: 8,
    textAlign: 'center', fontFamily: theme.sans,
  }
  // Split top edge: Brewers navy meets the opponent's color (gold until we know the opponent).
  const edge = (
    <div style={{ display: 'flex', height: 3 }}>
      <span style={{ flex: 1, background: theme.navy }} />
      <span style={{ flex: 1, background: opp ? (TEAM_ACCENT[opp.team.id] || theme.gold) : theme.gold }} />
    </div>
  )
  const band = (text) => (
    <div style={{ background: theme.navy, color: '#fff', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {live && <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: theme.gold, flexShrink: 0 }} />}
      {text}
    </div>
  )
  // Sponsor credit with the logo. The whole card is one link to the tracker, so the logo is an
  // impression here — the clickable sponsor lockups live on the full page it leads to.
  const footer = (
    <div style={{ borderTop: `1px solid ${theme.rule}`, marginTop: 9, paddingTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: theme.gold, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
          {SPONSORS.header.logo ? (
            <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 22, objectFit: 'contain', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <span style={{ fontSize: 8.5, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPONSORS.header.name}</span>
          )}
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
      <a {...linkProps} className="mini-card" style={card}>
        {edge}
        {band('Brewers tracker')}
        <div style={{ padding: '9px 14px 10px' }}>
          <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, padding: '12px 0 4px' }}>The Brewers, by the numbers</div>
          <div style={{ fontSize: 11.5, color: theme.muted, paddingBottom: 4 }}>Live scores, standings and the division race</div>
          {footer}
        </div>
      </a>
    )
  }

  const oppName = opp.team.teamName || opp.team.name.replace('Milwaukee ', '')
  const won = final && me.score > opp.score
  const ls = game.linescore || {}
  const isToday = new Date(game.gameDate).toDateString() === new Date().toDateString()

  const kicker = live
    ? `${`${ls.inningHalf || ''} ${ls.currentInningOrdinal || ''}`.trim()}${ls.outs != null ? ` · ${ls.outs} out${ls.outs === 1 ? '' : 's'}` : ''}`.toUpperCase()
    : final
    ? new Date(game.gameDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
    : `${isToday ? 'TONIGHT' : new Date(game.gameDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()} · ${new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

  // Countdown chip when first pitch is inside 12 hours.
  const msToStart = state === 'Preview' ? new Date(game.gameDate).getTime() - now : null
  let countdown = null
  if (msToStart != null && msToStart > 0 && msToStart < 12 * 3600 * 1000) {
    const h = Math.floor(msToStart / 3600000)
    const m = Math.floor((msToStart % 3600000) / 60000)
    countdown = h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const probables = state === 'Preview' && me.probablePitcher && opp.probablePitcher
    ? `${pitcherLine(me.probablePitcher, pitchers?.me)} vs ${pitcherLine(opp.probablePitcher, pitchers?.opp)}`
    : null
  const mePct = live && extras?.homeWinPct != null ? Math.round(home ? extras.homeWinPct : extras.awayWinPct) : null
  const matchup = live ? liveMatchupLines(extras?.box, ls.offense?.batter?.id, ls.defense?.pitcher?.id) : { batter: null, pitcher: null }

  const TeamCol = ({ team, name, bold }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 92 }}>
      <TeamLogo id={team.team.id} size={30} />
      <span style={{ fontFamily: theme.serif, fontSize: 13, color: bold ? theme.navy : theme.ink, fontWeight: bold ? 700 : 400, lineHeight: 1.1 }}>{name}</span>
    </span>
  )

  return (
    <a {...linkProps} className={`mini-card${live ? ' is-live' : ''}`} style={card}>
      {edge}
      {band(live ? 'Current game' : final ? 'Final score' : 'Upcoming game')}
      <div style={{ padding: '9px 14px 10px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: live ? theme.gold : theme.muted }}>
          {kicker}
        </div>
        {countdown && (
          <div style={{ display: 'inline-block', background: theme.gold, color: theme.navy, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 10, padding: '2px 9px', marginTop: 5 }}>
            FIRST PITCH IN {countdown}
          </div>
        )}
        {won && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: theme.navy, borderRadius: 10, padding: '2px 10px 2px 4px', marginTop: 5 }}>
            <span style={{ width: 15, height: 15, borderRadius: '50%', background: theme.gold, color: theme.navy, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>W</span>
            <span style={{ color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em' }}>BREWERS WIN</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '7px 0 2px' }}>
          <TeamCol team={me} name="Brewers" bold={won} />
          {live || final ? (
            <span className={pop ? 'score-pop' : undefined} style={{ display: 'inline-block', fontFamily: theme.serif, fontSize: 26, color: theme.ink, whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: won ? 700 : 400, color: won ? theme.navy : theme.ink }}>{me.score}</span>
              <span style={{ fontSize: 16, color: theme.muted }}> – </span>
              {opp.score}
            </span>
          ) : (
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted }}>{home ? 'vs' : 'at'}</span>
          )}
          <TeamCol team={opp} name={oppName} />
        </div>

        {live && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '2px 0 4px' }}>
            <MiniBases offense={ls.offense} />
            <span style={{ fontSize: 11, color: theme.ink }}>{ls.balls ?? 0}-{ls.strikes ?? 0}</span>
          </div>
        )}
        {(matchup.batter || matchup.pitcher) && (
          <div style={{ fontSize: 10.5, lineHeight: 1.6, margin: '0 0 4px' }}>
            {matchup.batter && (
              <div>
                <span style={{ color: theme.gold, fontWeight: 700, fontSize: 8.5, letterSpacing: '0.1em' }}>AT BAT</span>
                <span style={{ color: theme.ink }}> {matchup.batter}</span>
              </div>
            )}
            {matchup.pitcher && (
              <div>
                <span style={{ color: theme.gold, fontWeight: 700, fontSize: 8.5, letterSpacing: '0.1em' }}>PITCHING</span>
                <span style={{ color: theme.ink }}> {matchup.pitcher}</span>
              </div>
            )}
          </div>
        )}
        {mePct != null && (
          <div style={{ maxWidth: 200, margin: '0 auto 2px' }}>
            <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: theme.rule }}>
              <span style={{ width: `${mePct}%`, background: theme.navy }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 2 }}>
              <span style={{ color: theme.navy, fontWeight: 700 }}>{me.team.abbreviation || 'MIL'} {mePct}%</span>
              <span style={{ color: theme.muted }}>{opp.team.abbreviation || oppName} {100 - mePct}%</span>
            </div>
          </div>
        )}

        {probables && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, fontSize: 11, color: theme.muted, lineHeight: 1.45 }}>
            <Headshot id={me.probablePitcher.id} size={24} />
            <span>{probables}</span>
            <Headshot id={opp.probablePitcher.id} size={24} />
          </div>
        )}
        {forecast && (
          <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 3 }}>
            First pitch: {forecast.tempF}°F, {forecast.label} · {forecast.precipPct}% rain
          </div>
        )}

        {final && star && (
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: 8.5, letterSpacing: '0.14em', fontWeight: 700, color: theme.gold, textTransform: 'uppercase' }}>
              {won ? 'Player of the game' : 'Top performer'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 3 }}>
              <Headshot id={star.id} size={26} />
              <span style={{ fontSize: 11.5 }}>
                <span style={{ fontWeight: 700, color: theme.ink }}>{star.name}</span>
                <span style={{ color: theme.muted }}> · {star.line}</span>
              </span>
            </div>
          </div>
        )}

        {footer}
      </div>
    </a>
  )
}
