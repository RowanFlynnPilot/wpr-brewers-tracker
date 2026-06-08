import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { theme } from '../theme.js'
import { DIVISION, TEAM_COLORS, TEAM_ID } from '../config.js'
import { Loading } from './Status.jsx'

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
        if (g.status.detailedState !== 'Final') return
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

  return [...dateSet].sort().map((date) => {
    const recs = Object.keys(DIVISION).map((id) => ({ id: Number(id), ...recordAsOf(Number(id), date) }))
    const leader = recs.reduce((a, b) => (b.w / ((b.w + b.l) || 1) > a.w / ((a.w + a.l) || 1) ? b : a))
    const row = { date: date.slice(5) }
    recs.forEach((r) => { row[r.id] = gamesBack(leader.w, leader.l, r.w, r.l) })
    return row
  }).filter((_, i, arr) => i % 4 === 0 || i === arr.length - 1) // thin for smoother lines; always keep the latest
}

export default function Race({ schedules }) {
  if (!schedules) return <Loading block />
  const data = buildSeries(schedules)

  return (
    <>
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        Games back of the division lead across the season. The line riding the top holds first place; a line dropping is a team losing ground.
      </p>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={theme.rule} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="date" tick={{ fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} interval={Math.ceil(data.length / 8)} stroke={theme.rule} />
            <YAxis reversed tick={{ fontFamily: theme.sans, fontSize: 10, fill: theme.muted }} stroke={theme.rule} />
            <ReferenceLine y={0} stroke={theme.ink} strokeWidth={1} />
            <Tooltip contentStyle={{ fontFamily: theme.sans, fontSize: 12, border: `1px solid ${theme.rule}`, background: theme.paper }} formatter={(v, n) => [v === 0 ? 'leads' : `${v} GB`, DIVISION[n]]} />
            <Legend verticalAlign="bottom" iconType="plain" wrapperStyle={{ fontFamily: theme.sans, fontSize: 11, paddingTop: 8 }} />
            {/* Draw rivals first (muted), then the Brewers on top (bold navy). */}
            {Object.keys(DIVISION)
              .sort((a, b) => (Number(a) === TEAM_ID ? 1 : 0) - (Number(b) === TEAM_ID ? 1 : 0))
              .map((id) => {
                const isMe = Number(id) === TEAM_ID
                return (
                  <Line key={id} type="monotone" dataKey={id} name={DIVISION[id]} stroke={TEAM_COLORS[id]} strokeWidth={isMe ? 3 : 1.5} strokeOpacity={isMe ? 1 : 0.55} dot={false} isAnimationActive={false} />
                )
              })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
