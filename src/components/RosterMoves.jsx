import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { fetchTransactions } from '../api.js'
import Section from './Section.jsx'

const MAX_SHOWN = 8

// Trade deadline (MLB sets the exact hour each spring; July 31 is the traditional date).
// The countdown chip auto-appears within 45 days and disappears once it passes.
const DEADLINE = new Date('2026-07-31T17:00:00-05:00')

// "Front office" — the Brewers' recent roster moves, straight from the transactions feed.
// Reads like newsroom copy ("activated RHP Brandon Woodruff from the 15-day injured list").
// Owns its Section chrome; renders nothing when the window is quiet or the fetch fails.
export default function RosterMoves() {
  const [moves, setMoves] = useState(null)

  useEffect(() => {
    fetchTransactions(14).then(setMoves).catch(() => {})
  }, [])

  if (!moves || !moves.length) return null

  const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // Trim the redundant lead-in — every line starts with "Milwaukee Brewers ".
  const text = (t) => t.replace(/^Milwaukee Brewers /, '').replace(/^./, (c) => c.toUpperCase())

  const daysToDeadline = Math.ceil((DEADLINE - Date.now()) / 86400000)

  return (
    <Section kicker="Front office" title="Recent roster moves">
      {daysToDeadline > 0 && daysToDeadline <= 45 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: theme.navy, borderRadius: 14, padding: '4px 12px', marginBottom: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.gold }} />
          <span style={{ fontFamily: theme.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', textTransform: 'uppercase' }}>
            {daysToDeadline === 1 ? 'Trade deadline tomorrow' : `${daysToDeadline} days to the trade deadline`}
          </span>
        </div>
      )}
      <div>
        {moves.slice(0, MAX_SHOWN).map((m, i) => (
          <div key={m.id} style={{ display: 'flex', gap: 14, alignItems: 'baseline', padding: '8px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
            <span style={{ fontFamily: theme.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.gold, whiteSpace: 'nowrap', flexShrink: 0, width: 52 }}>{fmtDay(m.date)}</span>
            <span style={{ fontFamily: theme.sans, fontSize: 13, color: theme.ink, lineHeight: 1.45 }}>{text(m.text)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 10 }}>
        Last 14 days · via the MLB transactions wire
      </div>
    </Section>
  )
}
