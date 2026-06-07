import { theme } from '../theme.js'
import { USE_TEAM_LOGO, TEAM_LOGO, SPONSORS } from '../config.js'
import { useIsNarrow } from '../useIsNarrow.js'
import Sponsor from './Sponsor.jsx'

export default function BrewersBanner() {
  const narrow = useIsNarrow()
  return (
    <div style={{ background: theme.navy, color: '#fff', padding: narrow ? '20px 16px' : '26px 20px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {USE_TEAM_LOGO && (
            <img src={TEAM_LOGO} alt="Milwaukee Brewers" width={56} height={56} style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
          )}
          <div>
            <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.gold }}>Wisconsin Sports</div>
            <h1 style={{ fontFamily: theme.serif, fontSize: narrow ? 27 : 36, lineHeight: 1.02, margin: '4px 0 0', fontWeight: 600 }}>The Brewers, by the numbers</h1>
            <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 16, color: '#cdd6e3', marginTop: 4 }}>The shape of Milwaukee's season, updated live.</div>
          </div>
        </div>
        <Sponsor sponsor={SPONSORS.header} variant="dark" slot="banner" />
      </div>
    </div>
  )
}
