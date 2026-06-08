import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { fetchThisDayGames, fetchDecisivePlay } from '../api.js'
import { rankThisDay } from '../games.js'
import { Loading } from './Status.jsx'

// First two sentences of a play-by-play description (the hit + the run scoring).
const trimPlay = (d) => d ? d.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.') : null

// "This day in Brewers history" — finds the most fun game the Brewers played on today's date
// across past seasons (1970 on) and surfaces the go-ahead hit for the featured one. Self-contained
// and fail-soft: the per-season fan-out only fires once the section nears the viewport.
export default function ThisDay() {
  const ref = useRef(null)
  const [armed, setArmed] = useState(false)
  const [items, setItems] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(false)

  // Arm the fetch when the section approaches the viewport. Attach the observer only after a beat,
  // so the still-loading (short) page doesn't report the section as visible at the very top.
  useEffect(() => {
    if (armed || !ref.current) return
    const el = ref.current
    let io
    const t = setTimeout(() => {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setArmed(true); io.disconnect() }
      }, { rootMargin: '300px' })
      io.observe(el)
    }, 1200)
    return () => { clearTimeout(t); if (io) io.disconnect() }
  }, [armed])

  useEffect(() => {
    if (!armed) return
    const now = new Date()
    fetchThisDayGames(now.getMonth() + 1, now.getDate(), 1970, now.getFullYear() - 1)
      .then((g) => setItems(rankThisDay(g)))
      .catch(() => setError(true))
  }, [armed])

  // Pull the go-ahead hit for the featured (won) game only.
  useEffect(() => {
    if (!items || !items.length) return
    const head = items[0]
    if (!head.won || !head.gamePk) return
    let alive = true
    fetchDecisivePlay(head.gamePk).then((d) => alive && setDetail(d)).catch(() => {})
    return () => { alive = false }
  }, [items])

  if (error) return null
  if (!items) return <div ref={ref}><Loading lines={2} /></div>
  if (!items.length) {
    return <div style={{ fontFamily: theme.sans, fontSize: 14, color: theme.muted }}>No Brewers games fell on today's date in seasons past.</div>
  }

  const top = items[0]
  // Runner-ups: prefer distinct categories so the list isn't all the same kind of game.
  const others = []
  const used = new Set([top.category])
  for (const it of items.slice(1)) {
    if (it.rank < 1 || used.has(it.category)) continue
    others.push(it); used.add(it.category)
    if (others.length === 3) break
  }
  for (const it of items.slice(1)) {
    if (others.length === 3) break
    if (it.rank >= 1 && !others.includes(it)) others.push(it)
  }

  const playLine = detail && (detail.description ? trimPlay(detail.description) : detail.batter && `${detail.batter} drove in the go-ahead run.`)

  return (
    <div>
      <div style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '18px 20px' }}>
        <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700 }}>
          On this day in {top.year} · {top.category}
        </div>
        <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, lineHeight: 1.25, marginTop: 6, maxWidth: 640 }}>
          {top.text}
        </div>
        {playLine && (
          <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 14, color: theme.muted, lineHeight: 1.45, marginTop: 8, maxWidth: 640 }}>
            {playLine}
          </div>
        )}
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
