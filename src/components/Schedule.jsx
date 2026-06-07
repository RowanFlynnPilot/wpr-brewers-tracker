import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { fetchTeamSchedule } from '../api.js'
import { Loading, ErrorState } from './Status.jsx'

export default function Schedule() {
  const [games, setGames] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTeamSchedule().then(setGames).catch(() => setError(true))
  }, [])

  if (error) return <ErrorState />
  if (!games) return <Loading label="Pulling the schedule" />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
      {games.map(({ date, game }, i) => {
        const home = game.teams.home.team.id === TEAM_ID
        const opponent = (home ? game.teams.away.team : game.teams.home.team).name.replace('Milwaukee ', '')
        const final = game.status.detailedState === 'Final'
        const live = game.status.detailedState === 'In Progress'
        const myScore = game.teams[home ? 'home' : 'away'].score
        const oppScore = game.teams[home ? 'away' : 'home'].score
        const probable = game.teams[home ? 'home' : 'away'].probablePitcher?.fullName
        const won = final && myScore > oppScore
        const label = new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        return (
          <div key={i} style={{ border: `1px solid ${theme.rule}`, borderRadius: 6, padding: 12, background: live ? '#fff8e6' : theme.paper }}>
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: live ? theme.gold : theme.muted }}>
              {label}{live && ' \u2022 LIVE'}
            </div>
            <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink, marginTop: 5 }}>{home ? 'vs' : '@'} {opponent}</div>
            {final || live ? (
              <div style={{ fontFamily: theme.serif, fontSize: 20, marginTop: 3, color: won ? theme.navy : theme.ink }}>
                {won ? 'W' : final ? 'L' : ''} {myScore}{'\u2013'}{oppScore}
              </div>
            ) : (
              <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 5 }}>{probable ? `Prob: ${probable}` : 'Probable TBA'}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
