import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { fetchTeamSchedule } from '../api.js'
import { seriesSummary } from '../games.js'
import { Loading, ErrorState } from './Status.jsx'
import TeamLogo from './TeamLogo.jsx'
import PitcherLine from './PitcherLine.jsx'
import BoxScore from './BoxScore.jsx'
import CalendarButton from './CalendarButton.jsx'

export default function Schedule() {
  const [games, setGames] = useState(null)
  const [error, setError] = useState(false)
  const [openGame, setOpenGame] = useState(null) // { gamePk, label } for the box-score modal

  // Initial fetch + a gentle refresh so live scores on the cards stay current (the hero polls
  // faster on its own). Refresh failures keep the prior data rather than blanking the grid.
  useEffect(() => {
    fetchTeamSchedule().then(setGames).catch(() => setError(true))
    const id = setInterval(() => {
      if (!document.hidden) fetchTeamSchedule().then(setGames).catch(() => {})
    }, 120000)
    return () => clearInterval(id)
  }, [])

  if (error) return <ErrorState />
  if (!games) return <Loading />

  const series = seriesSummary(games)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 14.5, color: theme.muted }}>
          {series.join(' · ')}
        </div>
        <CalendarButton />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
        {games.map(({ date, game }, i) => {
        const home = game.teams.home.team.id === TEAM_ID
        const oppTeam = home ? game.teams.away.team : game.teams.home.team
        const opponent = oppTeam.name.replace('Milwaukee ', '')
        // abstractGameState, not detailedState: 'Live' covers delays/challenges/warmup and
        // 'Final' covers "Game Over"/"Completed Early", so cards never blank out mid-delay.
        const final = game.status.abstractGameState === 'Final'
        const live = game.status.abstractGameState === 'Live'
        const myScore = game.teams[home ? 'home' : 'away'].score
        const oppScore = game.teams[home ? 'away' : 'home'].score
        const probable = game.teams[home ? 'home' : 'away'].probablePitcher
        const won = final && myScore > oppScore
        const label = new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const openable = final || live
        const open = () => openable && setOpenGame({ gamePk: game.gamePk, label })
        return (
          <div
            key={i}
            className={`game-card${live ? ' is-live' : ''}${openable ? ' is-open' : ''}`}
            onClick={open}
            onKeyDown={(e) => { if (openable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open() } }}
            role={openable ? 'button' : undefined}
            tabIndex={openable ? 0 : undefined}
          >
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: live ? theme.gold : theme.muted }}>
              {label}{live && ' \u2022 LIVE'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <TeamLogo id={oppTeam.id} size={22} />
              <span style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink }}>{home ? 'vs' : '@'} {opponent}</span>
            </div>
            {final || live ? (
              <>
                <div style={{ fontFamily: theme.serif, fontSize: 20, marginTop: 3, color: won ? theme.navy : theme.ink }}>
                  {won ? 'W' : final ? 'L' : ''} {myScore}{'\u2013'}{oppScore}
                </div>
                <div style={{ fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.gold, marginTop: 6 }}>Box score {'\u2192'}</div>
              </>
            ) : probable ? (
              <PitcherLine personId={probable.id} fullName={probable.fullName} />
            ) : (
              <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 5 }}>Probable TBA</div>
            )}
          </div>
        )
        })}
      </div>
      {openGame && <BoxScore gamePk={openGame.gamePk} dateLabel={openGame.label} onClose={() => setOpenGame(null)} />}
    </>
  )
}
