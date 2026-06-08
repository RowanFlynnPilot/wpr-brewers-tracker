import { useEffect, useRef, useState } from 'react'
import { theme } from '../theme.js'
import { fetchThisDayGames, fetchDecisivePlay } from '../api.js'
import { rankThisDay, winningHitSentence } from '../games.js'
import { Loading } from './Status.jsx'

// "This day in Brewers history" — a single highlight: the most fun game the Brewers played on
// today's date across past seasons (1970 on), with the go-ahead hit. Self-contained and fail-soft;
// the per-season fan-out only fires once the section nears the viewport.
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
  const hit = top.won ? winningHitSentence(detail) : null
  const recordClause = top.record ? `, ${top.won ? 'improving to' : 'dropping to'} ${top.record.wins}–${top.record.losses}` : ''

  return (
    <div style={{ border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`, borderRadius: 8, background: theme.wash, padding: '20px 22px' }}>
      <div style={{ fontFamily: theme.serif, fontSize: 21, color: theme.ink, lineHeight: 1.4, maxWidth: 660 }}>
        On this day in {top.year}, {top.text}{recordClause}.
      </div>
      {hit && (
        <div style={{ fontFamily: theme.serif, fontStyle: 'italic', fontSize: 15, color: theme.muted, lineHeight: 1.5, marginTop: 8, maxWidth: 660 }}>
          {hit}
        </div>
      )}
    </div>
  )
}
