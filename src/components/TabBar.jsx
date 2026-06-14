import { theme } from '../theme.js'

// Section navigation for the tracker. A horizontal strip of tabs (scrolls on narrow screens);
// the active tab gets a gold underline. Single responsibility: render the tabs + report clicks.
export default function TabBar({ tabs, active, onChange }) {
  return (
    <div role="tablist" aria-label="Sections" style={{ display: 'flex', gap: 4, overflowX: 'auto', borderBottom: `1px solid ${theme.rule}`, margin: '4px 0 22px' }}>
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            style={{
              flexShrink: 0, cursor: 'pointer', background: 'transparent', border: 'none',
              padding: '9px 14px', marginBottom: -1,
              fontFamily: theme.sans, fontSize: 13.5, fontWeight: on ? 700 : 400, letterSpacing: '0.02em',
              color: on ? theme.navy : theme.muted,
              borderBottom: `3px solid ${on ? theme.gold : 'transparent'}`,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
