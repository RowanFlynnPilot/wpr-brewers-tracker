import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, headshot } from '../config.js'
import { fetchSeasonFinals, fetchFinalBoxscore } from '../api.js'
import Section from './Section.jsx'

// "Who's fresh tonight" — bullpen workload from the last two games' box scores. Each active
// reliever is tagged fresh / worked last game / back-to-back, with pitch counts. Game-based, not
// calendar-based, so off days read honestly ("last game" rather than "yesterday"). Fail-soft:
// owns its Section and renders nothing if the data doesn't come together.
export default function BullpenCheck({ roster }) {
  const [usage, setUsage] = useState(null) // { dates: [d0, d1], byId: { personId: { [date]: pitches } } }

  useEffect(() => {
    let alive = true
    fetchSeasonFinals().then(async (finals) => {
      const dates = [...new Set(finals.map((f) => f.date))].slice(0, 2) // newest first; covers doubleheaders
      const games = finals.filter((f) => dates.includes(f.date))
      const boxes = await Promise.all(games.map((g) => fetchFinalBoxscore(g.gamePk).catch(() => null)))
      if (!alive) return
      const byId = {}
      boxes.forEach((box, i) => {
        if (!box) return
        const side = box.teams.home.team.id === TEAM_ID ? box.teams.home : box.teams.away
        Object.values(side.players).forEach((p) => {
          const pit = p.stats?.pitching
          if (!pit || !Object.keys(pit).length) return
          const pitches = pit.pitchesThrown ?? pit.numberOfPitches
          if (pitches == null) return
          byId[p.person.id] = { ...byId[p.person.id], [games[i].date]: pitches }
        })
      })
      setUsage({ dates, byId })
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!usage || !roster || usage.dates.length < 2) return null

  // The pen: active-roster relievers (same heuristic as Milestone Watch), tagged by recent work.
  const pen = []
  roster.forEach((p) => {
    ;(p.person.stats || []).forEach((s) => {
      const st = s.splits?.[0]?.stat
      if (s.group.displayName !== 'pitching' || !st) return
      if ((st.gamesStarted || 0) > 3 || (st.gamesPlayed || 0) < 8) return
      const u = usage.byId[p.person.id] || {}
      const lastP = u[usage.dates[0]]
      const priorP = u[usage.dates[1]]
      const status = lastP != null && priorP != null ? 'b2b' : lastP != null ? 'worked' : 'fresh'
      pen.push({ id: p.person.id, name: p.person.fullName, era: st.era, _era: parseFloat(st.era) || 99, status, lastP, priorP })
    })
  })
  if (pen.length < 3) return null
  const order = { fresh: 0, worked: 1, b2b: 2 }
  pen.sort((a, b) => order[a.status] - order[b.status] || a._era - b._era)

  const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // Chips stay short so names never truncate — the detail line carries the pitch counts.
  const CHIP = {
    fresh: { text: 'Fresh', bg: theme.navy },
    worked: { text: 'Worked', bg: theme.gold },
    b2b: { text: 'B2B', bg: theme.red },
  }
  const detail = (r) =>
    r.status === 'b2b' ? `${r.priorP} + ${r.lastP} pitches, last two games`
    : r.status === 'worked' ? `${r.lastP} pitch${r.lastP === 1 ? '' : 'es'} last game`
    : `${r.era} ERA`

  return (
    <Section kicker="The bullpen" title="Who's fresh tonight">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
        {pen.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '9px 12px', background: r.status === 'fresh' ? '#fff' : theme.wash }}>
            <img src={headshot(r.id)} alt="" width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: theme.serif, fontSize: 14.5, color: theme.ink, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 2 }}>{detail(r)}</div>
            </div>
            <span style={{ fontFamily: theme.sans, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: CHIP[r.status].bg, borderRadius: 3, padding: '2px 6px', whiteSpace: 'nowrap' }}>{CHIP[r.status].text}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        Workload from the last two games ({fmtDay(usage.dates[1])} &amp; {fmtDay(usage.dates[0])}) · fresh = didn't pitch in either
      </div>
    </Section>
  )
}
