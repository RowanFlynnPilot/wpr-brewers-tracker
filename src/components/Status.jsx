import { theme } from '../theme.js'

export function Loading({ label }) {
  return <div style={{ fontFamily: theme.sans, color: theme.muted, fontSize: 14, padding: '16px 0' }}>{label}…</div>
}

export function ErrorState() {
  return (
    <div style={{ fontFamily: theme.sans, color: theme.red, fontSize: 14, padding: '16px 0' }}>
      Couldn't reach the MLB Stats API. It refreshes live, so try again in a moment.
    </div>
  )
}
