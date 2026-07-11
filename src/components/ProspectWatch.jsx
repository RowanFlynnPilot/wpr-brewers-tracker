import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TOP_PROSPECTS, PROSPECT_CREDIT, headshot } from '../config.js'
import { fetchProspects } from '../api.js'
import Section from './Section.jsx'
import { openPlayerCard } from './PlayerCard.jsx'
import { Loading } from './Status.jsx'

// "Prospect watch" — the org's top prospects (curated list in config; see the note there about
// syncing with Baseball America) with LIVE minor-league data: current club + level, season line,
// and recent form computed from the game log. Tap a row for the full card (season grid + game
// log at their level). Fail-soft per row; the section hides entirely if nothing loads.

// Recent-form blurb from the last ~10 log entries. Hitters: avg/HR/RBI over the stretch.
// Pitchers: ERA + K over their last outings. Numbers only — the data writes the story.
function formLine(p) {
  const log = p.log || []
  if (!log.length) return null
  if (p.isPitcher) {
    const outings = log.slice(-5)
    let outs = 0, er = 0, k = 0
    outings.forEach((g) => {
      const ip = g.stat.inningsPitched || '0'
      const [full, frac] = ip.split('.')
      outs += (Number(full) || 0) * 3 + (Number(frac) || 0)
      er += g.stat.earnedRuns || 0
      k += g.stat.strikeOuts || 0
    })
    if (!outs) return null
    const era = ((er * 27) / outs).toFixed(2)
    const ip = `${Math.floor(outs / 3)}${outs % 3 ? '.' + (outs % 3) : ''}`
    return { text: `Last ${outings.length === 1 ? 'outing' : `${outings.length} outings`}: ${era} ERA, ${k} K over ${ip} IP`, hot: Number(era) <= 3 }
  }
  let ab = 0, h = 0, hr = 0, rbi = 0
  log.forEach((g) => { ab += g.stat.atBats || 0; h += g.stat.hits || 0; hr += g.stat.homeRuns || 0; rbi += g.stat.rbi || 0 })
  if (!ab) return null
  const avg = (h / ab).toFixed(3).replace(/^0/, '')
  return { text: `Last ${log.length === 1 ? 'game' : `${log.length} games`}: ${avg}${hr ? `, ${hr} HR` : ''}${rbi ? `, ${rbi} RBI` : ''}`, hot: h / ab >= 0.3 }
}

const seasonLine = (p) => {
  const s = p.season
  if (!s) return null
  return p.isPitcher
    ? `${s.era} ERA · ${s.wins}-${s.losses} · ${s.strikeOuts} K · ${s.inningsPitched} IP`
    : `${s.avg} AVG · ${s.homeRuns} HR · ${s.rbi} RBI · ${s.ops} OPS`
}

// Level chip: the majors get gold (the goal); everything else navy.
const LevelChip = ({ level }) => !level ? null : (
  <span style={{ fontFamily: theme.sans, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: '#fff', background: level === 'MLB' ? theme.gold : theme.navy, borderRadius: 3, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>{level}</span>
)

export default function ProspectWatch() {
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchProspects(TOP_PROSPECTS).then((r) => (r.length ? setRows(r) : setFailed(true))).catch(() => setFailed(true))
  }, [])

  if (failed) return null
  if (!rows) return <Section kicker="Down on the farm" title="Prospect watch"><Loading lines={4} /></Section>

  return (
    <Section kicker="Down on the farm" title="Prospect watch">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 620, lineHeight: 1.5 }}>
        The next wave of Brewers, and how they're swinging it right now — tap a player for their full line and game log.
      </p>
      <div>
        {rows.map((p, i) => {
          const form = formLine(p)
          return (
            <div key={p.id} role="button" tabIndex={0} className="hover-row"
              onClick={() => openPlayerCard(p.id, p.sportId)} onKeyDown={(e) => e.key === 'Enter' && openPlayerCard(p.id, p.sportId)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderTop: i ? `1px solid ${theme.rule}` : 'none', cursor: 'pointer' }}>
              <span style={{ fontFamily: theme.serif, fontSize: 18, color: p.rank <= 5 ? theme.gold : theme.muted, fontWeight: 700, width: 26, textAlign: 'right', flexShrink: 0 }}>{p.rank}</span>
              <img src={headshot(p.id)} alt="" width={38} height={38} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: theme.serif, fontSize: 15.5, fontWeight: p.rank <= 5 ? 700 : 400, color: theme.ink }}>{p.name}</span>
                  <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted }}>{p.posLive}{p.age ? ` · ${p.age}` : ''}</span>
                  <LevelChip level={p.level} />
                  <span style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.team}</span>
                </div>
                <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.ink, marginTop: 3 }}>
                  {seasonLine(p) || <span style={{ color: theme.muted }}>No {new Date().getFullYear()} stats yet at this level</span>}
                </div>
                {form && (
                  <div style={{ fontFamily: theme.sans, fontSize: 11.5, marginTop: 2, color: form.hot ? theme.navy : theme.muted, fontWeight: form.hot ? 700 : 400 }}>
                    {form.hot && <span style={{ color: theme.gold }}>▲ </span>}{form.text}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {PROSPECT_CREDIT && (
        <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>{PROSPECT_CREDIT}</div>
      )}
    </Section>
  )
}
