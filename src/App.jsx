import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { theme } from './theme.js'
import { SPONSORS, SPONSOR_DISCLAIMER } from './config.js'
import { fetchDivisionStandings, fetchDivisionSchedules, fetchLeagueRanks } from './api.js'
import { lastFinalGame } from './games.js'
import { initAnalytics } from './analytics.js'
import Masthead from './components/Masthead.jsx'
import BrewersBanner from './components/BrewersBanner.jsx'
import GameHero from './components/GameHero.jsx'
import Section from './components/Section.jsx'
import Pulse from './components/Pulse.jsx'
import Standings from './components/Standings.jsx'
import Schedule from './components/Schedule.jsx'
import Players from './components/Players.jsx'
import ThisDay from './components/ThisDay.jsx'
import { Loading } from './components/Status.jsx'

// Recharts is the heaviest dependency — load the race chart in its own chunk.
const Race = lazy(() => import('./components/Race.jsx'))

// Subtle "Updated Xm ago" stamp; re-renders every 30s so the relative time stays current.
function UpdatedStamp({ at }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])
  if (!at) return null
  const mins = Math.floor((Date.now() - at) / 60000)
  const label = mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : `${mins} min ago`
  return (
    <div style={{ textAlign: 'right', fontFamily: theme.sans, fontSize: 11, color: theme.muted, padding: '12px 0 0' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.gold }} /> Updated {label} · refreshes live
      </span>
    </div>
  )
}

export default function App() {
  // Standings + division schedules + NL ranks are fetched together and shared; other modules fetch their own feeds.
  const [standings, setStandings] = useState(null)
  const [schedules, setSchedules] = useState(null)
  const [ranks, setRanks] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  // Refresh on a gentle interval (and on tab focus) so the whole page — not just the hero — stays live.
  // On a refresh error we keep the prior data rather than blanking the page.
  const load = useCallback(() => {
    fetchDivisionStandings().then((s) => { setStandings(s); setUpdatedAt(Date.now()) }).catch(() => {})
    fetchDivisionSchedules().then(setSchedules).catch(() => {})
    fetchLeagueRanks().then(setRanks).catch(() => {})
  }, [])

  useEffect(() => {
    initAnalytics()
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 120000)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const lastGame = schedules ? lastFinalGame(schedules) : null

  return (
    <div style={{ background: theme.paper, color: theme.ink, minHeight: '100vh' }}>
      <Masthead />
      <BrewersBanner />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
        <UpdatedStamp at={updatedAt} />
        <GameHero />
        <Section kicker="Season pulse" title="Where things stand"><Pulse standings={standings} lastGame={lastGame} ranks={ranks} /></Section>
        <Section kicker="NL Central" title="The standings"><Standings standings={standings} /></Section>
        <Section kicker="The division race" title="NL Central, day by day" sponsor={SPONSORS.race} slot="race">
          <Suspense fallback={<Loading block />}><Race schedules={schedules} /></Suspense>
        </Section>
        <Section kicker="Recent & upcoming" title="The schedule"><Schedule /></Section>
        <Section kicker="From the vault" title="This day in Brewers history"><ThisDay /></Section>
        <Section kicker="At the plate & on the mound" title="Team leaders" sponsor={SPONSORS.leaders} slot="leaders"><Players /></Section>

        <footer style={{ borderTop: `1px solid ${theme.rule}`, padding: '22px 0 44px', fontFamily: theme.sans, fontSize: 11, color: theme.muted, lineHeight: 1.6 }}>
          Data via the MLB Stats API · refreshes live. Not affiliated with or endorsed by Major League Baseball or the Milwaukee Brewers.<br />
          {SPONSOR_DISCLAIMER && <>{SPONSOR_DISCLAIMER}<br /></>}
          Wausau Pilot &amp; Review · 602 Ruder St., Wausau WI 54403 · 715-301-5539
        </footer>
      </div>
    </div>
  )
}
