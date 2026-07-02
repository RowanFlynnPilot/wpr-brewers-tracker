import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { Loading, ErrorState } from './Status.jsx'
import { openPlayerCard } from './PlayerCard.jsx'

const th = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.muted, textAlign: 'right', padding: '6px 8px', fontWeight: 700 }
const td = { fontFamily: theme.sans, fontSize: 13, color: theme.ink, textAlign: 'right', padding: '8px', borderTop: `1px solid ${theme.rule}` }

// League-context chip for a leader row: the player's best top-5 MLB rank across the categories
// already pulled for Milestone Watch (shared fetchLeagueLeaders — no extra API call).
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const CAT_SHORT = { homeRuns: 'HR', runsBattedIn: 'RBI', hits: 'hits', stolenBases: 'SB', wins: 'wins', strikeouts: 'K', saves: 'saves' }
function bestRankNote(mlbLeaders, id) {
  if (!mlbLeaders) return null
  let best = null
  Object.entries(mlbLeaders).forEach(([cat, byId]) => {
    const e = byId[id]
    if (e && e.rank <= 5 && (!best || e.rank < best.rank)) best = { ...e, cat }
  })
  if (!best) return null
  const label = CAT_SHORT[best.cat]
  if (best.rank === 1) return best.tied ? `T-1st in MLB · ${label}` : `Leads MLB · ${label}`
  return `${ord(best.rank)} in MLB · ${label}`
}

// "Player to watch" — the OPS leader and the ERA leader, surfaced as a spotlight above the tables.
function Spotlight({ hitter, pitcher }) {
  const Item = ({ p, role, line }) => !p ? null : (
    <div role="button" tabIndex={0} onClick={() => openPlayerCard(p.id)} onKeyDown={(e) => e.key === 'Enter' && openPlayerCard(p.id)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 240px', cursor: 'pointer' }}>
      <img src={headshot(p.id)} alt="" width={54} height={54} style={{ borderRadius: '50%', background: theme.wash, objectFit: 'cover', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700 }}>{role}</div>
        <div style={{ fontFamily: theme.serif, fontSize: 18, color: theme.ink }}>{p.name}</div>
        <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 1 }}>{line}</div>
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, padding: '16px 18px', marginBottom: 26, background: theme.wash }}>
      <Item p={hitter} role="Bat to watch" line={hitter && `${hitter.avg} AVG · ${hitter.hr} HR · ${hitter.rbi} RBI · ${hitter.ops} OPS`} />
      <Item p={pitcher} role="Arm to watch" line={pitcher && `${pitcher.era} ERA · ${pitcher.w} W · ${pitcher.so} K`} />
    </div>
  )
}

function LeaderTable({ title, rows, columns, mlbLeaders }) {
  return (
    <div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.gold, marginBottom: 10, fontWeight: 700 }}>{title}</div>
      <table>
        <thead>
          <tr>
            <th scope="col" style={{ ...th, textAlign: 'left' }}>Player</th>
            {columns.map((c) => <th scope="col" key={c.key} style={th}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const note = bestRankNote(mlbLeaders, r.id)
            return (
              <tr key={r.id} className="hover-row" onClick={() => openPlayerCard(r.id)} style={{ cursor: 'pointer' }}>
                <td style={{ ...td, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={headshot(r.id)} alt="" width={28} height={28} style={{ borderRadius: '50%', background: theme.wash, objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: theme.serif, fontSize: 15 }}>{r.name}</span>
                      {note && <span style={{ display: 'block', fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: theme.gold, marginTop: 1, whiteSpace: 'nowrap' }}>{note}</span>}
                    </span>
                  </div>
                </td>
                {columns.map((c) => <td key={c.key} style={td}>{r[c.key]}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Build leader lists from the hydrated roster. Min playing-time gates keep cup-of-coffee lines out.
function buildLeaders(roster) {
  const hitters = []
  const pitchers = []
  roster.forEach((p) => {
    const person = p.person
    ;(person.stats || []).forEach((s) => {
      const stat = s.splits?.[0]?.stat
      if (!stat) return
      if (s.group.displayName === 'hitting' && stat.atBats > 30) {
        hitters.push({ id: person.id, name: person.fullName, avg: stat.avg, hr: stat.homeRuns, rbi: stat.rbi, ops: stat.ops, _ops: parseFloat(stat.ops) })
      }
      if (s.group.displayName === 'pitching' && stat.inningsPitched && parseFloat(stat.inningsPitched) > 10) {
        pitchers.push({ id: person.id, name: person.fullName, era: stat.era, w: stat.wins, so: stat.strikeOuts, sv: stat.saves, _era: parseFloat(stat.era) })
      }
    })
  })
  hitters.sort((a, b) => b._ops - a._ops)
  pitchers.sort((a, b) => a._era - b._era)
  return { hitters: hitters.slice(0, 8), pitchers: pitchers.slice(0, 8) }
}

// `group` selects which side to show: 'hitting' (batting spotlight + table), 'pitching'
// (pitching spotlight + table), or undefined for both. Lets the leaders live in their tab.
// `mlbLeaders` is the shared fetchLeagueLeaders map — rows in the MLB top 5 get a rank chip.
export default function Players({ roster, error, group, mlbLeaders }) {
  if (!roster) return error ? <ErrorState /> : <Loading />
  const leaders = buildLeaders(roster)
  const showHit = group !== 'pitching'
  const showPit = group !== 'hitting'

  return (
    <div>
      <Spotlight hitter={showHit ? leaders.hitters[0] : null} pitcher={showPit ? leaders.pitchers[0] : null} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 36 }}>
        {showHit && <LeaderTable title="Batting leaders · by OPS" rows={leaders.hitters} mlbLeaders={mlbLeaders} columns={[{ key: 'avg', label: 'AVG' }, { key: 'hr', label: 'HR' }, { key: 'rbi', label: 'RBI' }, { key: 'ops', label: 'OPS' }]} />}
        {showPit && <LeaderTable title="Pitching leaders · by ERA" rows={leaders.pitchers} mlbLeaders={mlbLeaders} columns={[{ key: 'era', label: 'ERA' }, { key: 'w', label: 'W' }, { key: 'so', label: 'SO' }, { key: 'sv', label: 'SV' }]} />}
      </div>
    </div>
  )
}
