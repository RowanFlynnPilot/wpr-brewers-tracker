import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { theme } from '../theme.js'
import { DIVISION, TEAM_COLORS, TEAM_ABBR, TEAM_ID, teamLogo } from '../config.js'
import { Loading, ErrorState } from './Status.jsx'

const gamesBack = (lw, ll, w, l) => ((lw - w) + (l - ll)) / 2

// Derives games-back-of-leader for each division team across the season, client-side, from schedules.
function buildSeries(teams) {
  const dateSet = new Set()
  const cumulative = {}
  teams.forEach(({ id, dates }) => {
    let w = 0, l = 0
    const series = []
    dates.forEach((day) => {
      day.games.forEach((g) => {
        // Regular-season finals only — exclude spring training ('S') and exhibition ('E') games,
        // which would otherwise inflate records and skew games-back vs the official standings.
        if (g.status.detailedState !== 'Final' || g.gameType !== 'R') return
        const home = g.teams.home.team.id === id
        const me = home ? g.teams.home : g.teams.away
        const opp = home ? g.teams.away : g.teams.home
        if (me.score == null || opp.score == null) return
        if (me.score > opp.score) w++; else l++
      })
      series.push({ date: day.date, w, l })
      dateSet.add(day.date)
    })
    cumulative[id] = series
  })

  const recordAsOf = (id, date) => {
    let last = { w: 0, l: 0 }
    for (const point of cumulative[id]) {
      if (point.date <= date) last = point
      else break
    }
    return last
  }

  const rows = [...dateSet].sort().map((date) => {
    const recs = Object.keys(DIVISION).map((id) => ({ id: Number(id), ...recordAsOf(Number(id), date) }))
    if (!recs.some((r) => r.w + r.l > 0)) return null // skip dates before any regular-season game
    const leader = recs.reduce((a, b) => (b.w / ((b.w + b.l) || 1) > a.w / ((a.w + a.l) || 1) ? b : a))
    const row = { date: date.slice(5) }
    recs.forEach((r) => { row[r.id] = gamesBack(leader.w, leader.l, r.w, r.l) })
    return row
  }).filter(Boolean)
  return rows.filter((_, i, arr) => i % 4 === 0 || i === arr.length - 1) // thin for smoother lines; always keep the latest
}

export default function Race({ schedules, error }) {
  if (!schedules) return error ? <ErrorState /> : <Loading block />
  const data = buildSeries(schedules)

  // Direct labels at each line's right edge (logo + GB) replace the old bottom legend — the
  // chart reads at a glance without eye travel. Label rows are nudged apart in (estimated)
  // pixel space so teams bunched together don't overlap: greedy top-down pass, 17px apart.
  const last = data[data.length - 1] || {}
  const maxGB = Math.max(1, ...data.flatMap((r) => Object.keys(DIVISION).map((id) => r[id] ?? 0)))
  const pxPerGB = 260 / maxGB // inner plot height ≈ 300 - top margin - x-axis
  const dyById = {}
  let prevY = -Infinity
  Object.keys(DIVISION)
    .map((id) => ({ id, gb: last[id] ?? 0 }))
    .sort((a, b) => a.gb - b.gb)
    .forEach(({ id, gb }) => {
      const y = gb * pxPerGB
      const ly = Math.max(y, prevY + 17)
      dyById[id] = ly - y
      prevY = ly
    })
  const endLabel = (id, isMe) => (props) => {
    const { x, y, index, value } = props
    if (index !== data.length - 1) return null
    const dy = dyById[id] || 0
    return (
      <g key={`end-${id}`}>
        <circle cx={x} cy={y} r={isMe ? 4 : 2.5} fill={TEAM_COLORS[id]} />
        <image href={teamLogo(id)} x={x + 7} y={y + dy - 8} width={16} height={16} />
        <text x={x + 27} y={y + dy + 4} fontSize={11} fontFamily={theme.sans} fontWeight={isMe ? 700 : 400} fill={isMe ? theme.navy : theme.muted}>
          {value === 0 ? 'leads' : value}
        </text>
      </g>
    )
  }

  return (
    <>
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        Games back of the division lead across the season. The line riding the top holds first place; a line dropping is a team losing ground.
      </p>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 62, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={theme.rule} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="date" tick={{ fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} interval={Math.ceil(data.length / 8)} stroke={theme.rule} />
            <YAxis reversed tick={{ fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} stroke={theme.rule} />
            <ReferenceLine y={0} stroke={theme.ink} strokeWidth={1} />
            <Tooltip contentStyle={{ fontFamily: theme.sans, fontSize: 12, border: `1px solid ${theme.rule}`, background: theme.paper }} formatter={(v, n, item) => [v === 0 ? 'leads' : `${v} GB`, TEAM_ABBR[item?.dataKey] || n]} />
            {/* Draw rivals first (muted), then the Brewers on top (bold navy). */}
            {Object.keys(DIVISION)
              .sort((a, b) => (Number(a) === TEAM_ID ? 1 : 0) - (Number(b) === TEAM_ID ? 1 : 0))
              .map((id) => {
                const isMe = Number(id) === TEAM_ID
                return (
                  <Line key={id} type="monotone" dataKey={id} name={DIVISION[id]} stroke={TEAM_COLORS[id]} strokeWidth={isMe ? 3 : 1.5} strokeOpacity={isMe ? 1 : 0.55} dot={false} isAnimationActive={false} label={endLabel(id, isMe)} />
                )
              })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
