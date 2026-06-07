import { theme } from '../theme.js'

// Editorial section wrapper: kicker + headline, optional sponsor lockup. Single responsibility: layout chrome.
export default function Section({ kicker, title, sponsor, children }) {
  return (
    <section style={{ borderTop: `1px solid ${theme.rule}`, padding: '38px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700 }}>{kicker}</div>
          <h2 style={{ fontFamily: theme.serif, fontSize: 28, lineHeight: 1.1, margin: '6px 0 0', color: theme.ink, fontWeight: 600 }}>{title}</h2>
        </div>
        {sponsor && (
          <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, textAlign: 'right', border: `1px dashed ${theme.rule}`, padding: '8px 12px', borderRadius: 4 }}>
            <div style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 9 }}>Presented by</div>
            <div style={{ fontFamily: theme.serif, fontSize: 14, color: theme.ink, marginTop: 2 }}>{sponsor}</div>
          </div>
        )}
      </div>
      {children}
    </section>
  )
}
