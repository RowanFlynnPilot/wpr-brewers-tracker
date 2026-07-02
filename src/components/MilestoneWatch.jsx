import { theme } from '../theme.js'
import { headshot } from '../config.js'

const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const CAT_LABEL = { homeRuns: 'home runs', runsBattedIn: 'RBI', hits: 'hits', stolenBases: 'steals', wins: 'wins', strikeouts: 'strikeouts', saves: 'saves' }

// Find players sitting just short of a round-number milestone, from the season roster stats we
// already have. Each item carries a detail line (current production) and, when `leaders` is
// supplied, a league-context note (e.g. "tied for the MLB lead in wins"). Pure — returns up to 4
// "on the verge" items, nearest milestone first, one per player.
export function milestoneWatch(roster, leaders = null) {
  // League rank phrase for a player in a category, or '' if not among the leaders.
  const note = (cat, id) => {
    const e = leaders?.[cat]?.[id]
    if (!e) return ''
    const label = CAT_LABEL[cat]
    if (e.rank === 1) return e.tied ? `tied for the MLB lead in ${label}` : `leads MLB in ${label}`
    if (e.rank <= 5) return `${ord(e.rank)} in MLB in ${label}`
    return ''
  }
  const items = []
  const add = (id, name, value, unit, step, maxNeed, plural, cat, detail) => {
    if (value == null || value < step) return
    const next = Math.floor(value / step) * step + step
    const need = next - value
    if (need > 0 && need <= maxNeed) {
      const u = plural && need !== 1 ? `${unit}s` : unit
      items.push({ id, name, need, value, next, text: `needs ${need} ${u} for ${next}`, detail, note: note(cat, id) })
    }
  }
  roster.forEach((p) => {
    const person = p.person
    ;(person.stats || []).forEach((s) => {
      const st = s.splits?.[0]?.stat
      if (!st) return
      if (s.group.displayName === 'hitting' && st.atBats > 60) {
        add(person.id, person.fullName, st.homeRuns, 'HR', 5, 2, false, 'homeRuns', `${st.homeRuns} home runs`)
        add(person.id, person.fullName, st.rbi, 'RBI', 25, 4, false, 'runsBattedIn', `${st.rbi} RBI`)
        add(person.id, person.fullName, st.hits, 'hit', 25, 4, true, 'hits', `${st.hits} hits`)
        add(person.id, person.fullName, st.stolenBases, 'SB', 5, 2, false, 'stolenBases', `${st.stolenBases} steals`)
      }
      if (s.group.displayName === 'pitching' && parseFloat(st.inningsPitched) > 20) {
        const reliever = (st.gamesStarted || 0) <= 3 && (st.gamesPlayed || 0) >= 10
        add(person.id, person.fullName, st.wins, 'win', 5, 1, true, 'wins', `${st.wins}–${st.losses}${reliever ? ' out of the bullpen' : ''}`)
        add(person.id, person.fullName, st.strikeOuts, 'K', 25, 5, false, 'strikeouts', `${st.strikeOuts} strikeouts`)
        add(person.id, person.fullName, st.saves, 'save', 5, 2, true, 'saves', `${st.saves} saves`)
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

// "On the verge" cards — a daily-changing hook of players nearing milestones, each with a
// production detail line, a progress bar toward the round number, and (when available) a
// league-context note. With exactly 4 cards the min width rises so desktop lays out 2×2
// instead of 3 + 1 orphan.
export default function MilestoneWatch({ items }) {
  const min = items.length === 4 ? 300 : 260
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 11, border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 6, padding: '11px 13px', background: theme.wash }}>
          <img src={headshot(it.id)} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: theme.serif, fontSize: 15, fontWeight: 700, color: theme.ink, lineHeight: 1.15 }}>{it.name}</div>
            <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.muted, marginTop: 1 }}>{it.text}</div>
            {it.detail && (
              <div style={{ fontFamily: theme.sans, fontSize: 11.5, marginTop: 3, lineHeight: 1.35 }}>
                <span style={{ color: theme.ink }}>{it.detail}</span>
                {it.note && <span style={{ color: theme.navy, fontWeight: 700 }}> · {it.note}</span>}
              </div>
            )}
            {it.next > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: theme.rule, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (it.value / it.next) * 100)}%`, height: '100%', background: theme.gold }} />
                </div>
                <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, color: theme.muted, whiteSpace: 'nowrap' }}>{it.value}/{it.next}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
