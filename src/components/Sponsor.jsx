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
      <Tag {...linkProps} className={sponsor.url ? 'link-hover' : undefined} style={{ textDecoration: 'none', fontFamily: theme.sans, fontSize: 11, color: labelColor }}>
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

  // Full lockup — a white card that pops on the navy banner (and reads cleanly on paper), with a
  // gold top-accent, a prominent logo, and a click cue. The logo art is on white, so a white card
  // frames it naturally.
  const Box = sponsor.url ? 'a' : 'div'

  return (
    <Box
      {...linkProps}
      className={sponsor.url ? 'link-hover' : undefined}
      style={{
        display: 'inline-block', textAlign: 'left', textDecoration: 'none',
        background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
        borderRadius: 8, padding: '12px 16px 13px', maxWidth: 300,
        boxShadow: dark ? '0 6px 20px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ fontFamily: theme.sans, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700 }}>Presented by</div>
      {sponsor.logo ? (
        <img src={sponsor.logo} alt={sponsor.name} style={{ display: 'block', height: 50, objectFit: 'contain', margin: '8px 0 2px' }} />
      ) : (
        <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink, margin: '6px 0 2px' }}>{sponsor.name}</div>
      )}
      {sponsor.tagline && (
        <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 4, lineHeight: 1.4 }}>{sponsor.tagline}</div>
      )}
      {sponsor.url && (
        <div style={{ fontFamily: theme.sans, fontSize: 11.5, fontWeight: 700, color: theme.navy, marginTop: 9 }}>
          Plan your visit <span aria-hidden="true">→</span>
        </div>
      )}
    </Box>
  )
}
