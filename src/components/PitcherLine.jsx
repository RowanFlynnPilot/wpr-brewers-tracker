import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { headshot } from '../config.js'
import { fetchPitcherSeason } from '../api.js'

// Probable-pitcher line: headshot + name + season stat line (ERA · W-L · K).
// Self-contained — fetches its own season stats; the stat line just doesn't render if unavailable.
export default function PitcherLine({ personId, fullName, label = 'Prob', size = 26 }) {
  const [stat, setStat] = useState(null)

  useEffect(() => {
    if (!personId) return
    let alive = true
    fetchPitcherSeason(personId).then((s) => alive && setStat(s)).catch(() => {})
    return () => { alive = false }
  }, [personId])

  const line = stat ? `${stat.era} ERA · ${stat.wins}-${stat.losses} · ${stat.strikeOuts} K` : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
      {personId && (
        <img
          src={headshot(personId)}
          alt=""
          width={size}
          height={size}
          style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: theme.sans, fontSize: 12, color: theme.ink }}>{label}: {fullName}</div>
        {line && <div style={{ fontFamily: theme.sans, fontSize: 11, color: theme.muted, marginTop: 1 }}>{line}</div>}
      </div>
    </div>
  )
}
