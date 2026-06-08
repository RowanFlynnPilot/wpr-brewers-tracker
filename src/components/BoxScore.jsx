import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { fetchGameBox } from '../api.js'
import { ErrorState } from './Status.jsx'

const cellR = { padding: '5px 7px', textAlign: 'right', borderTop: `1px solid ${theme.rule}`, fontFamily: theme.sans, fontSize: 12, color: theme.ink, whiteSpace: 'nowrap' }
const cellL = { ...cellR, textAlign: 'left' }
const head = { padding: '5px 7px', textAlign: 'right', fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700 }
const headL = { ...head, textAlign: 'left' }
const SIDES = ['away', 'home']

// Box-score modal for a completed (or in-progress) game. Fetches its own feed; fail-soft.
export default function BoxScore({ gamePk, dateLabel, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    fetchGameBox(gamePk).then((d) => alive && setData(d)).catch(() => alive && setError(true))
    return () => { alive = false }
  }, [gamePk])

  // Esc to close + lock background scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const line = data?.line
  const box = data?.box
  const teamName = (side) => box.teams[side].team.name

  const Linescore = () => {
    const innings = line.innings || []
    return (
      <div style={{ overflowX: 'auto', marginBottom: 22 }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={headL}>Team</th>
              {innings.map((i) => <th key={i.num} style={head}>{i.num}</th>)}
              <th style={{ ...head, color: theme.ink }}>R</th><th style={head}>H</th><th style={head}>E</th>
            </tr>
          </thead>
          <tbody>
            {SIDES.map((side) => {
              const tot = line.teams[side]
              const win = line.teams[side].runs > line.teams[side === 'home' ? 'away' : 'home'].runs
              return (
                <tr key={side}>
                  <td style={{ ...cellL, fontFamily: theme.serif, fontSize: 15, fontWeight: win ? 700 : 400, color: win ? theme.navy : theme.ink }}>{teamName(side)}</td>
                  {innings.map((i) => <td key={i.num} style={cellR}>{i[side]?.runs ?? ''}</td>)}
                  <td style={{ ...cellR, fontWeight: 700 }}>{tot.runs}</td><td style={cellR}>{tot.hits}</td><td style={cellR}>{tot.errors}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const sectionLabel = (text) => (
    <div style={{ fontFamily: theme.sans, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700, margin: '4px 0 8px' }}>{text}</div>
  )

  const Batting = ({ side }) => {
    const t = box.teams[side]
    const rows = t.batters.map((id) => t.players['ID' + id]).filter((p) => p?.stats?.batting && (p.stats.batting.atBats > 0 || p.stats.batting.baseOnBalls > 0))
    return (
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 8 }}>
        <thead>
          <tr><th style={headL}>Batter</th><th style={head}>AB</th><th style={head}>R</th><th style={head}>H</th><th style={head}>RBI</th><th style={head}>BB</th><th style={head}>K</th><th style={head}>AVG</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const s = p.stats.batting
            return (
              <tr key={p.person.id}>
                <td style={cellL}>{p.person.fullName} <span style={{ color: theme.muted, fontSize: 10 }}>{p.position?.abbreviation}</span></td>
                <td style={cellR}>{s.atBats}</td><td style={cellR}>{s.runs}</td><td style={cellR}>{s.hits}</td><td style={cellR}>{s.rbi}</td><td style={cellR}>{s.baseOnBalls}</td><td style={cellR}>{s.strikeOuts}</td>
                <td style={{ ...cellR, color: theme.muted }}>{p.seasonStats?.batting?.avg ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const Pitching = ({ side }) => {
    const t = box.teams[side]
    const rows = t.pitchers.map((id) => t.players['ID' + id]).filter((p) => p?.stats?.pitching)
    return (
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 18 }}>
        <thead>
          <tr><th style={headL}>Pitcher</th><th style={head}>IP</th><th style={head}>H</th><th style={head}>R</th><th style={head}>ER</th><th style={head}>BB</th><th style={head}>K</th><th style={head}>ERA</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const s = p.stats.pitching
            return (
              <tr key={p.person.id}>
                <td style={cellL}>{p.person.fullName}</td>
                <td style={cellR}>{s.inningsPitched}</td><td style={cellR}>{s.hits}</td><td style={cellR}>{s.runs}</td><td style={cellR}>{s.earnedRuns}</td><td style={cellR}>{s.baseOnBalls}</td><td style={cellR}>{s.strikeOuts}</td>
                <td style={{ ...cellR, color: theme.muted }}>{p.seasonStats?.pitching?.era ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Box score"
      style={{ position: 'fixed', inset: 0, background: 'rgba(18,40,75,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 14px', zIndex: 1000, overflowY: 'auto' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: theme.paper, borderRadius: 10, maxWidth: 700, width: '100%', margin: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: theme.navy, color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.gold, fontWeight: 700 }}>Box score{dateLabel ? ` · ${dateLabel}` : ''}</div>
            <div style={{ fontFamily: theme.serif, fontSize: 20, marginTop: 3 }}>
              {box ? `${teamName('away')} ${line.teams.away.runs}, ${teamName('home')} ${line.teams.home.runs}` : 'Loading…'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px 24px' }}>
          {error ? <ErrorState /> : !data ? (
            <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />
          ) : (
            <>
              <Linescore />
              {SIDES.map((side) => (
                <div key={side}>
                  {sectionLabel(teamName(side))}
                  <Batting side={side} />
                  <Pitching side={side} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
