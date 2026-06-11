import { useEffect, useState, useCallback, useRef } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, SPONSORS, SITE_URL } from '../config.js'
import { fetchFeaturedGame, fetchLiveExtras } from '../api.js'
import { fetchFirstPitchForecast } from '../weather.js'
import { track } from '../analytics.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Sponsor from './Sponsor.jsx'
import TeamLogo from './TeamLogo.jsx'
import PitcherLine from './PitcherLine.jsx'

const REFRESH_MS = 45000 // API caches 60s; poll a touch faster so a live score never feels stale.
const IDLE_REFRESH_MS = 120000 // pre-game/final cadence — keeps the hero able to flip to Live on its own.

// Inning-by-inning scoreboard for live/final games, from the hydrated linescore.
function LinescoreStrip({ ls, homeIsMe, oppName }) {
  const innings = ls?.innings || []
  if (!innings.length || !ls.teams) return null
  const cell = { padding: '3px 7px', fontFamily: theme.sans, fontSize: 12, color: theme.ink, textAlign: 'center' }
  const head = { ...cell, color: theme.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }
  const rows = [
    { side: 'away', name: homeIsMe ? oppName : 'Brewers' },
    { side: 'home', name: homeIsMe ? 'Brewers' : oppName },
  ]
  return (
    <div style={{ overflowX: 'auto', margin: '0 0 18px' }}>
      <table style={{ borderCollapse: 'collapse', margin: '0 auto', width: 'auto' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }} />
            {innings.map((i) => <th key={i.num} style={head}>{i.num}</th>)}
            <th style={{ ...head, borderLeft: `1px solid ${theme.rule}` }}>R</th>
            <th style={head}>H</th>
            <th style={head}>E</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isMe = (r.side === 'home') === homeIsMe
            const tot = ls.teams[r.side] || {}
            return (
              <tr key={r.side}>
                <td style={{ ...cell, textAlign: 'left', fontFamily: theme.serif, fontSize: 13, fontWeight: isMe ? 700 : 400, color: isMe ? theme.navy : theme.ink }}>{r.name}</td>
                {innings.map((i) => <td key={i.num} style={cell}>{i[r.side]?.runs ?? ''}</td>)}
                <td style={{ ...cell, fontWeight: 700, borderLeft: `1px solid ${theme.rule}` }}>{tot.runs ?? ''}</td>
                <td style={cell}>{tot.hits ?? ''}</td>
                <td style={cell}>{tot.errors ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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
  const [extras, setExtras] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [copied, setCopied] = useState(false) // share-button clipboard feedback
  const narrow = useIsNarrow()

  // Opt-in game alert. Notifications only work on the standalone page (cross-origin iframes block
  // them), and — without a push backend — only fire while this tab/app is open. Honest + feature-gated.
  const canAlert = typeof window !== 'undefined' && 'Notification' in window && window.self === window.top
  const [alertsOn, setAlertsOn] = useState(() => {
    try { return localStorage.getItem('brewersAlerts') === '1' } catch { return false }
  })
  const wasLive = useRef(null)
  const toggleAlerts = () => {
    const persist = (v) => { try { localStorage.setItem('brewersAlerts', v ? '1' : '0') } catch {} }
    if (alertsOn) { setAlertsOn(false); persist(false); return }
    if (Notification.permission === 'granted') { setAlertsOn(true); persist(true); return }
    Notification.requestPermission().then((p) => { if (p === 'granted') { setAlertsOn(true); persist(true) } })
  }

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
  const gamePk = game?.gamePk
  // Poll the feed always — fast while live (with win-probability/plays extras), gently otherwise.
  // Without the idle cadence the hero would never notice a game going live, and the opt-in alert
  // (which watches for that flip) could never fire.
  useEffect(() => {
    if (!live) setExtras(null)
    const refresh = () => {
      if (document.hidden) return
      load()
      if (live && gamePk) fetchLiveExtras(gamePk).then(setExtras).catch(() => {})
    }
    if (live) refresh()
    const id = setInterval(refresh, live ? REFRESH_MS : IDLE_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [live, gamePk, load])

  // Fire an alert once when the featured game flips to live (only if opted in + permitted).
  // wasLive starts null so a page opened mid-game sets the baseline silently — only an
  // observed not-live → live transition notifies.
  useEffect(() => {
    if (!game) return
    if (wasLive.current === false && live && alertsOn && canAlert && Notification.permission === 'granted') {
      const h = game.teams.home.team.id === TEAM_ID
      const opp = (h ? game.teams.away : game.teams.home).team.name.replace('Milwaukee ', '')
      try { new Notification('Brewers game is underway', { body: `${h ? 'vs' : '@'} ${opp}`, icon: `${import.meta.env.BASE_URL}icon.svg` }) } catch {}
    }
    wasLive.current = live
  }, [live, alertsOn, canAlert, game])

  // First-pitch forecast for upcoming HOME games (Open-Meteo covers the Milwaukee ballpark;
  // away cities are out of scope). Fail-soft — the line simply doesn't render.
  const gameState = game?.status?.abstractGameState
  useEffect(() => {
    setForecast(null)
    if (!game || gameState !== 'Preview' || game.teams.home.team.id !== TEAM_ID) return
    let alive = true
    fetchFirstPitchForecast(game.gameDate).then((f) => { if (alive) setForecast(f) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- game object churns every poll; pk+state pin the fetch
  }, [gamePk, gameState])

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

  // Share the game (native sheet on mobile, clipboard elsewhere). When embedded, share the
  // hosting WPR page rather than the bare iframe URL.
  const share = () => {
    const url = window.self === window.top ? window.location.href : (document.referrer || SITE_URL)
    const text = live
      ? `Brewers ${me.score}–${opp.score} ${home ? 'vs' : 'at'} the ${oppName} — live now`
      : final
      ? `Final: Brewers ${won ? 'beat' : 'fall to'} the ${oppName}, ${won ? `${me.score}–${opp.score}` : `${opp.score}–${me.score}`}`
      : `Brewers ${home ? 'vs' : 'at'} the ${oppName} — ${when}`
    track('Share', { context: kicker })
    if (navigator.share) {
      navigator.share({ title: 'Brewers tracker — Wausau Pilot & Review', text, url }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text} — ${url}`).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    }
  }

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
      {!live && !final && forecast && (
        <div style={{ fontFamily: theme.sans, fontSize: 12.5, color: theme.muted, marginTop: 5 }}>
          First-pitch forecast: {forecast.tempF}°F, {forecast.label} · {forecast.precipPct}% chance of rain · {forecast.windMph} mph wind
          {SPONSORS.forecast && <> · <Sponsor sponsor={SPONSORS.forecast} compact slot="forecast" /></>}
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

      {/* Win probability + recent plays (live) */}
      {live && extras && (
        <div style={{ margin: '0 0 18px' }}>
          {extras.homeWinPct != null && (() => {
            const mePct = Math.round(home ? extras.homeWinPct : extras.awayWinPct)
            return (
              <div style={{ maxWidth: 320, margin: '0 auto' }}>
                <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, marginBottom: 5 }}>Win probability</div>
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: theme.rule }}>
                  <div style={{ width: `${mePct}%`, background: theme.navy }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 11, marginTop: 4 }}>
                  <span style={{ color: theme.navy, fontWeight: 700 }}>Brewers {mePct}%</span>
                  <span style={{ color: theme.muted }}>{oppName} {100 - mePct}%</span>
                </div>
              </div>
            )
          })()}
          {extras.plays?.length > 0 && (
            <div style={{ maxWidth: 440, margin: '14px auto 0', textAlign: 'left' }}>
              <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.muted, marginBottom: 4 }}>Latest plays</div>
              {extras.plays.map((p, i) => (
                <div key={i} style={{ fontFamily: theme.sans, fontSize: 12, color: p.scoring ? theme.ink : theme.muted, lineHeight: 1.4, padding: '4px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
                  <span style={{ color: theme.gold, fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>{p.half === 'top' ? 'Top' : 'Bot'} {p.inning}</span>{' '}
                  {p.desc.length > 96 ? p.desc.slice(0, 95).replace(/\s+\S*$/, '') + '…' : p.desc}
                </div>
              ))}
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

      {/* Inning-by-inning scoreboard */}
      {(live || final) && <LinescoreStrip ls={ls} homeIsMe={home} oppName={oppName} />}

      {/* Sponsor */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Sponsor sponsor={SPONSORS.header} variant="light" compact slot="hero" />
      </div>

      {/* Share + opt-in game alert (alerts: standalone app only) */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <button onClick={share} className="link-hover" style={{ cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.04em', color: copied ? theme.navy : theme.muted, fontWeight: copied ? 700 : 400 }}>
          {copied ? 'Link copied' : 'Share this game'}
        </button>
        {canAlert && (
          <button onClick={toggleAlerts} className="link-hover" style={{ cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.04em', color: alertsOn ? theme.navy : theme.muted, fontWeight: alertsOn ? 700 : 400 }}>
            {alertsOn ? 'Game alerts on (while this tab is open)' : 'Alert me at game time'}
          </button>
        )}
      </div>
    </div>
  )
}
