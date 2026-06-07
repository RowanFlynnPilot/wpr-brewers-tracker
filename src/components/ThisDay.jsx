import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { fetchThisDayGames } from '../api.js'
import { rankThisDay } from '../games.js'
import { Loading } from './Status.jsx'

// "This day in Brewers history" — finds the most fun game the Brewers played on today's date
// across past seasons (1970 on). Self-contained and fail-soft: the fetch is deferred slightly so
// it never competes with the primary content, and the whole section hides itself if nothing loads.
export default function ThisDay() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const toYear = now.getFullYear() - 1
    const t = setTimeout(() => {
      fetchThisDayGames(month, day, 1970, toYear)
        .then((g) => setItems(rankThisDay(g)))
        .catch(() => setError(true))
    }, 900)
    return () => clearTimeout(t)
  }, [])

  if (error) return null
  if (!items) return <Loading lines={2} />
  if (!items.length) {
    return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No Brewers games fell on today's date in seasons past.</div>
  }

  const [top, ...rest] = items
  const others = rest.filter((x) => x.rank >= 1).slice(0, 3)

  return (
    <div>
      <div style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '18px 20px' }}>
        <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700 }}>
          On this day in {top.year}
        </div>
        <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, lineHeight: 1.25, marginTop: 6, maxWidth: 640 }}>
          {top.text}
        </div>
      </div>

      {others.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
          {others.map((o) => (
            <li key={o.year} style={{ fontFamily: theme.sans, fontSize: 13, color: theme.muted, padding: '5px 0', borderTop: `1px solid ${theme.rule}` }}>
              <span style={{ color: theme.ink, fontWeight: 700 }}>{o.year}</span> — {o.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
