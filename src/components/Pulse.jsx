import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { Loading } from './Status.jsx'

const gamesBack = (lw, ll, w, l) => ((lw - w) + (l - ll)) / 2

// Receives shared standings from App (single fetch feeds Pulse + Standings); lastGame is derived
// from the division schedules in App.
export default function Pulse({ standings, lastGame }) {
  if (!standings) return <Loading />

  const me = standings.find((t) => t.team.id === TEAM_ID)
  const sorted = [...standings].sort((a, b) => parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage))
  const rank = sorted.findIndex((t) => t.team.id === TEAM_ID) + 1
  const lead = rank === 1 ? gamesBack(me.wins, me.losses, sorted[1].wins, sorted[1].losses) : -parseFloat(me.gamesBack)
  const split = (type) => (me.records?.splitRecords || []).find((s) => s.type === type)
  const l10 = split('lastTen')
  const home = split('home')
  const away = split('away')

  // MLB hands us the Pythagorean (run-differential) expected record directly — to date and full-season pace.
  const xRecs = me.records?.expectedRecords || []
  const xToDate = xRecs.find((r) => r.type === 'xWinLoss')
  const xSeason = xRecs.find((r) => r.type === 'xWinLossSeason')
  const luck = xToDate ? me.wins - xToDate.wins : 0 // + means outplaying run differential, - means unlucky
  const w = (n) => `${n} ${n === 1 ? 'win' : 'wins'}`
  const note =
    xToDate &&
    (luck < 0
      ? `Run differential points to a ${xToDate.wins}–${xToDate.losses} club — ${w(-luck)} better than their actual mark, so they've had a little bad luck.`
      : luck > 0
      ? `They're ${w(luck)} ahead of what run differential predicts (${xToDate.wins}–${xToDate.losses}) — outperforming the underlying numbers.`
      : `Their record matches run differential to the win (${xToDate.wins}–${xToDate.losses}).`) +
      (xSeason ? ` At this rate they're on a ${xSeason.wins}-win pace.` : '')

  const cell = (big, small) => (
    <div style={{ flex: '1 1 110px' }}>
      <div style={{ fontFamily: theme.serif, fontSize: 38, color: theme.ink, lineHeight: 1 }}>{big}</div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, marginTop: 6 }}>{small}</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {cell(`${me.wins}\u2013${me.losses}`, 'Record')}
        {cell(rank === 1 ? `+${lead}` : `${lead}`, rank === 1 ? 'Up in NL Central' : 'Games back')}
        {cell(`${me.runDifferential > 0 ? '+' : ''}${me.runDifferential}`, 'Run differential')}
        {cell(me.streak?.streakCode || '\u2014', 'Streak')}
        {cell(l10 ? `${l10.wins}\u2013${l10.losses}` : '\u2014', 'Last 10')}
        {home && cell(`${home.wins}\u2013${home.losses}`, 'Home')}
        {away && cell(`${away.wins}\u2013${away.losses}`, 'Away')}
        {xToDate && cell(`${xToDate.wins}\u2013${xToDate.losses}`, 'Expected (xW\u2013L)')}
        {rank === 1 && me.magicNumber && me.magicNumber !== '-' && cell(`${me.magicNumber}`, 'Magic number')}
      </div>
      {lastGame && (
        <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 18 }}>
          <span style={{ fontWeight: 700, color: lastGame.won ? theme.navy : theme.red }}>{lastGame.won ? 'W' : 'L'}</span>
          {' '}Latest: {lastGame.won ? 'beat' : 'lost to'} {lastGame.oppName} {lastGame.me}{'\u2013'}{lastGame.opp} {lastGame.home ? 'at home' : 'on the road'}.
        </div>
      )}
      {note && <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 10, lineHeight: 1.55, maxWidth: 620 }}>{note}</div>}
    </div>
  )
}
