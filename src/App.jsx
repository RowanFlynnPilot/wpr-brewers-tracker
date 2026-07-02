import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { theme } from './theme.js'
import { SPONSOR_DISCLAIMER, WATCH_PARTY, WPR_NEWS } from './config.js'
import { fetchStandingsBundle, fetchDivisionSchedules, fetchRosterStats, fetchLeagueLeaders } from './api.js'
import { lastFinalGame } from './games.js'
import { initAnalytics, track } from './analytics.js'
import { setupAutoResize } from './autosize.js'
import Masthead from './components/Masthead.jsx'
import TabBar from './components/TabBar.jsx'
import BookmarkButton from './components/BookmarkButton.jsx'
import BrewersBanner from './components/BrewersBanner.jsx'
import GameHero from './components/GameHero.jsx'
import MatchupEdge from './components/MatchupEdge.jsx'
import Section from './components/Section.jsx'
import Pulse from './components/Pulse.jsx'
import Standings from './components/Standings.jsx'
import Schedule from './components/Schedule.jsx'
import Players from './components/Players.jsx'
import ThisDay from './components/ThisDay.jsx'
import WhereToWatch from './components/WhereToWatch.jsx'
import MilestoneWatch, { milestoneWatch } from './components/MilestoneWatch.jsx'
import SponsorBand from './components/SponsorBand.jsx'
import Coverage from './components/Coverage.jsx'
import InjuryReport from './components/InjuryReport.jsx'
import RosterMoves from './components/RosterMoves.jsx'
import Strikeouts from './components/Strikeouts.jsx'
import HomeRuns from './components/HomeRuns.jsx'
import Arsenal from './components/Arsenal.jsx'
import GameFlow from './components/GameFlow.jsx'
import HotHitter from './components/HotHitter.jsx'
import Spray from './components/Spray.jsx'
import { Loading } from './components/Status.jsx'

// Recharts is the heaviest dependency — load the race chart in its own chunk.
const Race = lazy(() => import('./components/Race.jsx'))

// The sections grouped into tabs (the page is too tall as one scroll). The live game hero lives
// on the default "Season" tab. Each tab renders only when active, so its heavy season-wide
// fetches fire only when a reader opens it (and the API memoizes them across revisits).
const TABS = [
  { id: 'season', label: 'Season' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'hitters', label: 'Hitters' },
  { id: 'pitching', label: 'Pitching' },
]

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
    <div style={{ textAlign: 'right', fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.gold }} /> Updated {label} · refreshes live
      </span>
    </div>
  )
}

export default function App() {
  // Standings + NL ranks (one fetch) + division schedules are fetched here and shared; other
  // modules fetch their own feeds.
  const [standings, setStandings] = useState(null)
  const [schedules, setSchedules] = useState(null)
  const [ranks, setRanks] = useState(null)
  const [roster, setRoster] = useState(null)
  const [leaders, setLeaders] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  // Per-feed failure flags so a failed FIRST load shows an error state instead of an eternal
  // skeleton. Once a feed has data, later failures keep the prior data (flag cleared on success).
  const [errors, setErrors] = useState({})
  const [tab, setTab] = useState('season')

  // Refresh on a gentle interval (and on tab focus) so the whole page — not just the hero — stays live.
  const load = useCallback(() => {
    const flag = (key, v) => setErrors((e) => (e[key] === v ? e : { ...e, [key]: v }))
    fetchStandingsBundle()
      .then(({ standings, ranks }) => { setStandings(standings); setRanks(ranks); setUpdatedAt(Date.now()); flag('standings', false) })
      .catch(() => flag('standings', true))
    fetchDivisionSchedules().then((s) => { setSchedules(s); flag('schedules', false) }).catch(() => flag('schedules', true))
    fetchRosterStats().then((r) => { setRoster(r); flag('roster', false) }).catch(() => flag('roster', true))
    fetchLeagueLeaders().then(setLeaders).catch(() => {})
  }, [])

  useEffect(() => {
    initAnalytics()
    setupAutoResize()
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 120000)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const changeTab = (id) => { setTab(id); track('Tab', { tab: id }); window.scrollTo(0, 0) }

  const lastGame = schedules ? lastFinalGame(schedules) : null
  const milestones = roster ? milestoneWatch(roster, leaders) : []

  return (
    <div style={{ background: theme.paper, color: theme.ink, minHeight: '100vh' }}>
      <Masthead />
      <BrewersBanner />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0 0' }}>
          <BookmarkButton />
          <UpdatedStamp at={updatedAt} />
        </div>
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />

        {tab === 'season' && (
          <>
            <GameHero />
            <MatchupEdge roster={roster} />
            <Section kicker="Season pulse" title="Where things stand"><Pulse standings={standings} lastGame={lastGame} ranks={ranks} error={errors.standings} /></Section>
            {milestones.length > 0 && <Section kicker="On the verge" title="Milestone watch"><MilestoneWatch items={milestones} /></Section>}
            <Section kicker="NL Central" title="The standings"><Standings standings={standings} schedules={schedules} error={errors.standings} /></Section>
            <Section kicker="The division race" title="NL Central, day by day">
              <Suspense fallback={<Loading block />}><Race schedules={schedules} error={errors.schedules} /></Suspense>
            </Section>
          </>
        )}

        {tab === 'schedule' && (
          <>
            <Section kicker="Recent & upcoming" title="The schedule"><Schedule /></Section>
            <InjuryReport />
            <RosterMoves />
            {WPR_NEWS && <Coverage />}
            <SponsorBand />
            {WATCH_PARTY && <Section kicker="Where to watch" title="Catch the games this week"><WhereToWatch venue={WATCH_PARTY} /></Section>}
            <ThisDay />
          </>
        )}

        {tab === 'hitters' && (
          <>
            <Section kicker="At the plate" title="Batting leaders"><Players roster={roster} error={errors.roster} group="hitting" mlbLeaders={leaders} /></Section>
            <Section kicker="Off the bat" title="Home run tracker"><HomeRuns /></Section>
            <Section kicker="Putting the ball in play" title="Spray chart"><Spray /></Section>
            <Section kicker="Hot or not" title="Hitter form"><HotHitter roster={roster} /></Section>
          </>
        )}

        {tab === 'pitching' && (
          <>
            <Section kicker="The staff" title="Pitching leaders"><Players roster={roster} error={errors.roster} group="pitching" mlbLeaders={leaders} /></Section>
            <Section kicker="Pitch by pitch" title="Strikeout tracker"><Strikeouts /></Section>
            <Section kicker="On the mound" title="Pitch arsenal"><Arsenal /></Section>
            <Section kicker="How it unfolded" title="Game flow"><GameFlow /></Section>
          </>
        )}

        <footer style={{ borderTop: `1px solid ${theme.rule}`, padding: '22px 0 44px', fontFamily: theme.sans, fontSize: 11, color: theme.muted, lineHeight: 1.6 }}>
          Data via the MLB Stats API · refreshes live. Not affiliated with or endorsed by Major League Baseball or the Milwaukee Brewers.<br />
          {SPONSOR_DISCLAIMER && <>{SPONSOR_DISCLAIMER}<br /></>}
          Wausau Pilot &amp; Review · 715-301-5539
        </footer>
      </div>
    </div>
  )
}
