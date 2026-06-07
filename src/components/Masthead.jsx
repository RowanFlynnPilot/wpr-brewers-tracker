import { theme } from '../theme.js'
import { WPR_LOGO, WPR_TAGLINE } from '../config.js'

export default function Masthead() {
  return (
    <div style={{ borderBottom: `2px solid ${theme.ink}`, padding: '18px 20px 14px', textAlign: 'center' }}>
      <img src={WPR_LOGO} alt="Wausau Pilot & Review" style={{ height: 54, objectFit: 'contain' }} />
      <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: theme.muted, marginTop: 8 }}>{WPR_TAGLINE}</div>
    </div>
  )
}
