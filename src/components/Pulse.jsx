import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { Loading } from './Status.jsx'

const gamesBack = (lw, ll, w, l) => ((lw - w) + (l - ll)) / 2

// Receives shared standings from App (single fetch feeds Pulse + Standings).
export default function Pulse({ standings }) {
  if (!standings) return <Loading label="Reading the standings" />

  const me = standings.find((t) => t.team.id === TEAM_ID)
  const sorted = [...standings].sort((a, b) => parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage))
  const rank = sorted.findIndex((t) => t.team.id === TEAM_ID) + 1
  const lead = rank === 1 ? gamesBack(me.wins, me.losses, sorted[1].wins, sorted[1].losses) : -parseFloat(me.gamesBack)
  const l10 = (me.records?.splitRecords || []).find((s) => s.type === 'lastTen')

  const cell = (big, small) => (
    <div style={{ flex: '1 1 110px' }}>
      <div style={{ fontFamily: theme.serif, fontSize: 38, color: theme.ink, lineHeight: 1 }}>{big}</div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, marginTop: 6 }}>{small}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      {cell(`${me.wins}\u2013${me.losses}`, 'Record')}
      {cell(rank === 1 ? `+${lead}` : `${lead}`, rank === 1 ? 'Up in NL Central' : 'Games back')}
      {cell(`${me.runDifferential > 0 ? '+' : ''}${me.runDifferential}`, 'Run differential')}
      {cell(me.streak?.streakCode || '\u2014', 'Streak')}
      {cell(l10 ? `${l10.wins}\u2013${l10.losses}` : '\u2014', 'Last 10')}
    </div>
  )
}
