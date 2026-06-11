import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading, ErrorState } from './Status.jsx'

const DASH = '–'
const gamesBack = (lw, ll, w, l) => ((lw - w) + (l - ll)) / 2
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

// Receives shared standings from App (single fetch feeds Pulse + Standings); lastGame is derived
// from the division schedules in App. Layout: a tight marquee row, a compact secondary strip,
// then a short narrative.
export default function Pulse({ standings, lastGame, ranks, error }) {
  const narrow = useIsNarrow()
  if (!standings) return error ? <ErrorState /> : <Loading />

  const me = standings.find((t) => t.team.id === TEAM_ID)
  const sorted = [...standings].sort((a, b) => parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage))
  const rank = sorted.findIndex((t) => t.team.id === TEAM_ID) + 1
  // Leading: margin over second place. Trailing: deficit shown as a plain magnitude (the label
  // already says "Games back" — a minus sign would read as a double negative). '-' (tied) → NaN → dash.
  const lead = rank === 1 ? gamesBack(me.wins, me.losses, sorted[1].wins, sorted[1].losses) : parseFloat(me.gamesBack)
  const split = (type) => (me.records?.splitRecords || []).find((s) => s.type === type)
  const l10 = split('lastTen')
  const home = split('home')
  const away = split('away')
  const rec = (r) => `${r.wins}${DASH}${r.losses}`

  // MLB hands us the Pythagorean (run-differential) expected record directly — to date and full-season pace.
  const xRecs = me.records?.expectedRecords || []
  const xToDate = xRecs.find((r) => r.type === 'xWinLoss')
  const xSeason = xRecs.find((r) => r.type === 'xWinLossSeason')
  const luck = xToDate ? me.wins - xToDate.wins : 0 // + means outplaying run differential, - means unlucky
  const w = (n) => `${n} ${n === 1 ? 'win' : 'wins'}`
  const note =
    xToDate &&
    (luck < 0
      ? `Run differential points to a ${rec(xToDate)} club — ${w(-luck)} better than their actual mark, so they've had a little bad luck.`
      : luck > 0
      ? `They're ${w(luck)} ahead of what run differential predicts (${rec(xToDate)}) — outperforming the underlying numbers.`
      : `Their record matches run differential to the win (${rec(xToDate)}).`) +
      (xSeason ? ` At this rate they're on a ${xSeason.wins}-win pace.` : '')

  // Marquee stats — boxed stat tiles. Run diff / streak / lead are color-coded (navy good, red bad).
  const cell = (value, label, color = theme.ink) => (
    <div style={{ flex: '1 1 120px', minWidth: 104, border: `1px solid ${theme.rule}`, borderRadius: 8, padding: narrow ? '12px 13px' : '14px 16px' }}>
      <div style={{ fontFamily: theme.serif, fontSize: narrow ? 28 : 34, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: theme.sans, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, marginTop: 8 }}>{label}</div>
    </div>
  )
  const rd = me.runDifferential
  const rdColor = rd > 0 ? theme.navy : rd < 0 ? theme.red : theme.ink
  const sc = me.streak?.streakCode || ''
  const streakColor = sc[0] === 'W' ? theme.navy : sc[0] === 'L' ? theme.red : theme.ink
  const leadColor = rank === 1 ? theme.navy : theme.ink

  // Secondary stats — a compact strip below the marquee numbers.
  const minis = []
  if (home) minis.push([rec(home), 'Home'])
  if (away) minis.push([rec(away), 'Away'])
  if (rank === 1 && me.magicNumber && me.magicNumber !== '-') minis.push([`${me.magicNumber}`, 'Magic number'])
  if (ranks) minis.push([ord(ranks.runsScored.rank), 'In NL runs scored'])
  if (ranks) minis.push([ord(ranks.runsAllowed.rank), 'In runs allowed'])

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {cell(rec(me), 'Record')}
        {cell(rank === 1 ? `+${lead}` : Number.isFinite(lead) ? `${lead}` : DASH, rank === 1 ? 'NL Central lead' : 'Games back', leadColor)}
        {cell(`${rd > 0 ? '+' : ''}${rd}`, 'Run diff', rdColor)}
        {cell(me.streak?.streakCode || DASH, 'Streak', streakColor)}
        {cell(l10 ? rec(l10) : DASH, 'Last 10')}
      </div>

      {minis.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>
          {minis.map(([v, k]) => (
            <span key={k} style={{ display: 'inline-flex', borderRadius: 5, overflow: 'hidden', border: `1px solid ${theme.navy}`, fontFamily: theme.sans, fontSize: 12, whiteSpace: 'nowrap' }}>
              <span style={{ background: theme.navy, color: '#fff', fontWeight: 700, padding: '3px 9px' }}>{v}</span>
              <span style={{ background: '#fff', color: theme.ink, padding: '3px 9px' }}>{k}</span>
            </span>
          ))}
        </div>
      )}

      {lastGame && (
        <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 14 }}>
          <span style={{ fontWeight: 700, color: lastGame.won ? theme.navy : theme.red }}>{lastGame.won ? 'W' : 'L'}</span>
          {' '}Latest: {lastGame.won ? 'beat' : 'lost to'} {lastGame.oppName} {lastGame.me}{DASH}{lastGame.opp} {lastGame.home ? 'at home' : 'on the road'}.
        </div>
      )}

      {note && <div style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, marginTop: 8, lineHeight: 1.55, maxWidth: 620 }}>{note}</div>}
    </div>
  )
}
