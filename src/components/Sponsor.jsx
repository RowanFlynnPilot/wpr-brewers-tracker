import { theme } from '../theme.js'
import { SPONSOR_INQUIRY } from '../config.js'
import { track } from '../analytics.js'

// Sponsor lockup. One responsibility: render a paid sponsor, or an "available" upsell card.
// `variant` adapts the chrome to the dark navy banner vs. a light editorial section.
// `slot` labels the placement (banner/hero/race/leaders) for per-slot click reporting.
export default function Sponsor({ sponsor, variant = 'light', compact = false, slot }) {
  const dark = variant === 'dark'
  const labelColor = dark ? '#cdd6e3' : theme.muted
  const nameColor = dark ? '#fff' : theme.ink
  const border = dark ? 'rgba(255,255,255,0.4)' : theme.rule

  const linkProps = sponsor?.url
    ? {
        href: sponsor.url,
        target: '_blank',
        rel: 'noopener noreferrer sponsored',
        onClick: () => track('Sponsor Click', { sponsor: sponsor.name, slot: slot || 'unknown' }),
      }
    : {}

  // Compact credit — a one-line "Presented by NAME" link, no logo card. For tight placements
  // (e.g. the hero) where a full lockup already appears elsewhere on the page.
  if (compact && sponsor) {
    const Tag = sponsor.url ? 'a' : 'span'
    return (
      <Tag {...linkProps} style={{ textDecoration: 'none', fontFamily: theme.sans, fontSize: 11, color: labelColor }}>
        <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>Presented by </span>
        <span style={{ fontFamily: theme.serif, fontSize: 13, color: nameColor }}>{sponsor.name}</span>
      </Tag>
    )
  }

  const label = (text, size = 9) => (
    <div style={{ fontFamily: theme.sans, fontSize: size, letterSpacing: '0.12em', textTransform: 'uppercase', color: labelColor }}>
      {text}
    </div>
  )

  // Open slot — a tasteful upsell rather than an empty hole.
  if (!sponsor) {
    return (
      <div style={{ textAlign: 'right', border: `1px dashed ${border}`, borderRadius: 4, padding: '8px 12px' }}>
        {label('Sponsorship available')}
        <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 13, color: nameColor, marginTop: 3 }}>
          Reach Wisconsin sports fans
        </div>
        <div style={{ fontFamily: theme.sans, fontSize: 10, color: labelColor, marginTop: 2 }}>{SPONSOR_INQUIRY}</div>
      </div>
    )
  }

  const Box = sponsor.url ? 'a' : 'div'

  return (
    <Box
      {...linkProps}
      style={{
        display: 'inline-block', textAlign: 'right', textDecoration: 'none',
        border: `1px solid ${border}`, borderRadius: 4, padding: '8px 12px', maxWidth: 240,
      }}
    >
      {label('Presented by')}
      {sponsor.logo ? (
        // White card behind the logo so a solid-background mark reads cleanly on navy or paper.
        <span style={{ display: 'inline-block', background: '#fff', borderRadius: 3, padding: '5px 7px', marginTop: 4 }}>
          <img src={sponsor.logo} alt={sponsor.name} style={{ display: 'block', height: 30, objectFit: 'contain' }} />
        </span>
      ) : (
        <div style={{ fontFamily: theme.serif, fontSize: 15, color: nameColor, marginTop: 2 }}>{sponsor.name}</div>
      )}
      {sponsor.tagline && (
        <div style={{ fontFamily: theme.sans, fontSize: 10, color: labelColor, marginTop: 5, lineHeight: 1.4 }}>{sponsor.tagline}</div>
      )}
    </Box>
  )
}
