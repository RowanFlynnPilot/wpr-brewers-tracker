import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { fetchNextHomestand } from '../api.js'
import Section from './Section.jsx'
import TeamLogo from './TeamLogo.jsx'

// "Plan your trip" — the next homestand with each game's promotions (giveaways, theme nights)
// from the schedule's promotions hydrate. A natural drive-to-the-ballpark surface (and a natural
// sponsor slot later). Owns its Section; renders nothing between homestands or on failure.
export default function HomestandGuide() {
  const [games, setGames] = useState(null)

  useEffect(() => {
    fetchNextHomestand().then(setGames).catch(() => {})
  }, [])

  if (!games || !games.length) return null

  const day = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const first = games[0], last = games[games.length - 1]
  const venue = first.venue?.name || 'American Family Field'
  const range = first.gameDate === last.gameDate ? day(first.gameDate) : `${day(first.gameDate)} – ${day(last.gameDate)}`

  return (
    <Section kicker="At the ballpark" title="The next homestand">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        {games.length} game{games.length === 1 ? '' : 's'} at {venue} · {range}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {games.map((g, i) => {
          const opp = g.teams.away.team
          const promos = (g.promotions || []).map((p) => p.name).filter(Boolean)
          return (
            <div key={g.gamePk} style={{ display: 'flex', gap: 14, alignItems: 'baseline', padding: '9px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.gold, width: 86, flexShrink: 0 }}>{day(g.gameDate)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 150, flexShrink: 0 }}>
                <TeamLogo id={opp.id} size={17} />
                <span style={{ fontFamily: theme.serif, fontSize: 14.5, color: theme.ink }}>vs {opp.teamName || opp.name}</span>
              </span>
              <span style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, width: 66, flexShrink: 0 }}>{time(g.gameDate)}</span>
              {promos.length > 0 && (
                <span style={{ fontFamily: theme.sans, fontSize: 12, color: theme.ink, flex: '1 1 200px', lineHeight: 1.5 }}>
                  {promos.map((p, j) => (
                    <span key={j}>
                      {j > 0 && <span style={{ color: theme.muted }}> · </span>}
                      <span style={{ color: /bobblehead|giveaway|card|jersey|hat|shirt/i.test(p) ? theme.navy : theme.ink, fontWeight: /bobblehead|giveaway/i.test(p) ? 700 : 400 }}>{p}</span>
                    </span>
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 10 }}>
        Promotions via MLB · check the Brewers' site for details and ticket availability
      </div>
    </Section>
  )
}
