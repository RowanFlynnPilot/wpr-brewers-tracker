import { useEffect, useState } from 'react'
import { theme } from './theme.js'
import { SPONSORS, SPONSOR_DISCLAIMER } from './config.js'
import { fetchDivisionStandings } from './api.js'
import Masthead from './components/Masthead.jsx'
import BrewersBanner from './components/BrewersBanner.jsx'
import GameHero from './components/GameHero.jsx'
import Section from './components/Section.jsx'
import Pulse from './components/Pulse.jsx'
import Standings from './components/Standings.jsx'
import Race from './components/Race.jsx'
import Schedule from './components/Schedule.jsx'
import Players from './components/Players.jsx'

export default function App() {
  // Standings are fetched once and shared by Pulse + Standings; other modules fetch their own feeds.
  const [standings, setStandings] = useState(null)

  useEffect(() => {
    fetchDivisionStandings().then(setStandings).catch(() => setStandings(null))
  }, [])

  return (
    <div style={{ background: theme.paper, color: theme.ink, minHeight: '100vh' }}>
      <Masthead />
      <BrewersBanner />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
        <GameHero />
        <Section kicker="Season pulse" title="Where things stand"><Pulse standings={standings} /></Section>
        <Section kicker="NL Central" title="The standings"><Standings standings={standings} /></Section>
        <Section kicker="The division race" title="NL Central, day by day" sponsor={SPONSORS.race}><Race /></Section>
        <Section kicker="Recent & upcoming" title="The schedule"><Schedule /></Section>
        <Section kicker="At the plate & on the mound" title="Team leaders" sponsor={SPONSORS.leaders}><Players /></Section>

        <footer style={{ borderTop: `1px solid ${theme.rule}`, padding: '22px 0 44px', fontFamily: theme.sans, fontSize: 11, color: theme.muted, lineHeight: 1.6 }}>
          Data via the MLB Stats API · refreshes live. Not affiliated with or endorsed by Major League Baseball or the Milwaukee Brewers.<br />
          {SPONSOR_DISCLAIMER && <>{SPONSOR_DISCLAIMER}<br /></>}
          Wausau Pilot &amp; Review · 602 Ruder St., Wausau WI 54403 · 715-301-5539
        </footer>
      </div>
    </div>
  )
}
