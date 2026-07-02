import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchInjuries } from '../api.js'
import Section from './Section.jsx'
import { openPlayerCard } from './PlayerCard.jsx'

// "The trainer's room" — who's on the injured list right now, from the 40-man roster's status
// codes. Owns its Section chrome and is fully fail-soft: no injuries (or a failed fetch) renders
// nothing at all — a healthy roster shouldn't show an empty sick bay.
export default function InjuryReport() {
  const [players, setPlayers] = useState(null)

  useEffect(() => {
    fetchInjuries().then(setPlayers).catch(() => {})
  }, [])

  if (!players || !players.length) return null

  const badge = (label, code) => (
    <span style={{
      fontFamily: theme.sans, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: '#fff', background: code === 'D60' ? theme.red : theme.gold, borderRadius: 3, padding: '2px 6px', whiteSpace: 'nowrap',
    }}>{label}</span>
  )

  return (
    <Section kicker="The trainer's room" title="Injury report">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {players.map((p) => (
          <div key={p.id} role="button" tabIndex={0} onClick={() => openPlayerCard(p.id)} onKeyDown={(e) => e.key === 'Enter' && openPlayerCard(p.id)} className="card-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '9px 11px', background: '#fff', cursor: 'pointer' }}>
            <img src={headshot(p.id)} alt="" width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: theme.serif, fontSize: 14.5, color: theme.ink, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 2 }}>{p.pos}</div>
            </div>
            {badge(p.label, p.code)}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 12 }}>
        {players.length} on the injured list · sorted by soonest eligible return
      </div>
    </Section>
  )
}
