import { theme } from '../theme.js'
import { headshot } from '../config.js'

// Find players sitting just short of a round-number milestone, from the season roster stats we
// already have. Pure — returns up to 4 "on the verge" items, nearest milestone first, one per player.
export function milestoneWatch(roster) {
  const items = []
  const consider = (id, name, value, unit, step, maxNeed, plural) => {
    if (value == null || value < step) return
    const next = Math.floor(value / step) * step + step
    const need = next - value
    if (need > 0 && need <= maxNeed) {
      const u = plural && need !== 1 ? `${unit}s` : unit
      items.push({ id, name, need, text: `needs ${need} ${u} for ${next}` })
    }
  }
  roster.forEach((p) => {
    const person = p.person
    ;(person.stats || []).forEach((s) => {
      const st = s.splits?.[0]?.stat
      if (!st) return
      if (s.group.displayName === 'hitting' && st.atBats > 60) {
        consider(person.id, person.fullName, st.homeRuns, 'HR', 5, 2, false)
        consider(person.id, person.fullName, st.rbi, 'RBI', 25, 4, false)
        consider(person.id, person.fullName, st.hits, 'hit', 25, 4, true)
        consider(person.id, person.fullName, st.stolenBases, 'SB', 5, 2, false)
      }
      if (s.group.displayName === 'pitching' && parseFloat(st.inningsPitched) > 20) {
        consider(person.id, person.fullName, st.wins, 'win', 5, 1, true)
        consider(person.id, person.fullName, st.strikeOuts, 'K', 25, 5, false)
        consider(person.id, person.fullName, st.saves, 'save', 5, 2, true)
      }
    })
  })
  items.sort((a, b) => a.need - b.need)
  const seen = new Set()
  const out = []
  for (const it of items) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
    if (out.length === 4) break
  }
  return out
}

// "On the verge" cards — a daily-changing hook of players nearing milestones.
export default function MilestoneWatch({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {items.map((it) => (
        <span key={it.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '7px 12px', background: theme.wash }}>
          <img src={headshot(it.id)} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
          <span style={{ fontFamily: theme.sans, fontSize: 13, whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700, color: theme.ink }}>{it.name}</span> <span style={{ color: theme.muted }}>{it.text}</span>
          </span>
        </span>
      ))}
    </div>
  )
}
