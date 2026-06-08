import { useState } from 'react'
import { theme } from '../theme.js'
import { fetchUpcomingSchedule } from '../api.js'
import { buildICS } from '../ics.js'

// "Add upcoming games to calendar" — fetches the rest of the season on click and downloads a .ics
// the reader can import into their calendar (a stickiness hook: their calendar reminds them on game day).
export default function CalendarButton() {
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const games = await fetchUpcomingSchedule()
      const ics = buildICS(games, new Date().toISOString())
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'brewers-schedule.ics'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      /* fail-soft: nothing downloads */
    }
    setBusy(false)
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="link-hover"
      style={{
        cursor: busy ? 'default' : 'pointer',
        fontFamily: theme.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        color: theme.navy, background: '#fff',
        border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.gold}`,
        borderRadius: 6, padding: '7px 12px',
      }}
    >
      {busy ? 'Preparing…' : '+ Add games to calendar'}
    </button>
  )
}
