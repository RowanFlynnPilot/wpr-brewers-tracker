import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_NAMES, headshot, prospectHeadshot } from '../config.js'
import { fetchPlayerCard } from '../api.js'
import { track } from '../analytics.js'
import { Loading } from './Status.jsx'

// Tap-any-player modal. One host mounts in App; every roster surface (leader tables, milestones,
// matchup edge, injuries, bullpen) calls openPlayerCard(id) — a module-level hook so callers
// don't thread props through the tree. Card: bio, season line, L/R splits, last five games.
// Fail-soft: a failed fetch just closes the card.
// `sportId` lets Prospect Watch open cards for minor leaguers (game log + season at their level).
let listener = null
export function openPlayerCard(id, sportId = 1) {
  if (listener) listener(id, sportId)
}

const label = { fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6b6b', fontWeight: 700 }

function StatGrid({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
      {items.filter(([v]) => v != null && v !== '').map(([v, k]) => (
        <div key={k} style={{ flex: '1 1 70px', border: `1px solid ${theme.rule}`, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontFamily: theme.serif, fontSize: 20, color: theme.ink, lineHeight: 1 }}>{v}</div>
          <div style={{ ...label, fontFamily: theme.sans, marginTop: 5 }}>{k}</div>
        </div>
      ))}
    </div>
  )
}

export default function PlayerCardHost() {
  const [target, setTarget] = useState(null) // { id, sportId }
  const [card, setCard] = useState(null)
  const id = target?.id || null
  const setId = (v) => setTarget(v ? { id: v, sportId: target?.sportId || 1 } : null)

  useEffect(() => {
    listener = (pid, sportId) => { setTarget({ id: pid, sportId: sportId || 1 }); track('Player Card') }
    return () => { listener = null }
  }, [])

  useEffect(() => {
    setCard(null)
    if (!target) return
    let alive = true
    fetchPlayerCard(target.id, target.sportId).then((c) => { if (alive) setCard(c) }).catch(() => { if (alive) setTarget(null) })
    return () => { alive = false }
  }, [target])

  useEffect(() => {
    if (!id) return
    const onKey = (e) => { if (e.key === 'Escape') setId(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [id])

  if (!id) return null

  const p = card?.person
  const s = card?.season
  const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weekday = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
  const oppName = (g) => TEAM_NAMES[g.opponent?.id] || g.opponent?.teamName || g.opponent?.name || ''
  const hitLine = (st) => `${st.hits}-${st.atBats}${st.homeRuns ? `, ${st.homeRuns} HR` : ''}${st.rbi ? `, ${st.rbi} RBI` : ''}${st.stolenBases ? `, ${st.stolenBases} SB` : ''}`
  const pitLine = (st) => `${st.inningsPitched} IP, ${st.earnedRuns} ER, ${st.strikeOuts} K`
  // A game worth a second look gets the gold tick: multi-hit or a homer at the plate,
  // a zero-earned-run outing on the mound.
  const standout = (st) => (card?.isPitcher ? (st.earnedRuns === 0 && parseFloat(st.inningsPitched) >= 1) : ((st.hits || 0) >= 2 || (st.homeRuns || 0) >= 1))

  return (
    <div onClick={() => setId(null)} role="dialog" aria-modal="true" aria-label="Player card"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,40,75,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, borderTop: `4px solid ${theme.gold}`, maxWidth: 440, width: '100%', maxHeight: '86vh', overflowY: 'auto', padding: '20px 22px', fontFamily: theme.sans, position: 'relative' }}>
        <button onClick={() => setId(null)} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, cursor: 'pointer', background: 'transparent', border: 'none', fontSize: 22, color: theme.muted, lineHeight: 1 }}>×</button>

        {!card ? <Loading lines={3} /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src={target.sportId !== 1 ? prospectHeadshot(p.id) : headshot(p.id)} alt="" width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, lineHeight: 1.1 }}>{p.fullName}</div>
                <div style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>
                  {[p.primaryPosition?.abbreviation, p.primaryNumber && `#${p.primaryNumber}`, p.currentAge && `Age ${p.currentAge}`,
                    card.isPitcher ? p.pitchHand?.code && `Throws ${p.pitchHand.code}` : p.batSide?.code && `Bats ${p.batSide.code}`]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            {s && (card.isPitcher
              ? <StatGrid items={[[s.era, 'ERA'], [`${s.wins}-${s.losses}`, 'W-L'], [s.strikeOuts, 'K'], [s.inningsPitched, 'IP'], [s.saves > 0 ? s.saves : null, 'SV'], [s.whip, 'WHIP']]} />
              : <StatGrid items={[[s.avg, 'AVG'], [s.homeRuns, 'HR'], [s.rbi, 'RBI'], [s.ops, 'OPS'], [s.stolenBases > 0 ? s.stolenBases : null, 'SB']]} />)}

            {!card.isPitcher && card.splits && (card.splits.vl || card.splits.vr) && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: theme.ink, lineHeight: 1.7 }}>
                <div style={{ ...label, marginBottom: 2 }}>Splits</div>
                {card.splits.vl && <div>vs LHP: {card.splits.vl.avg} AVG · <strong>{card.splits.vl.ops} OPS</strong> · {card.splits.vl.homeRuns} HR</div>}
                {card.splits.vr && <div>vs RHP: {card.splits.vr.avg} AVG · <strong>{card.splits.vr.ops} OPS</strong> · {card.splits.vr.homeRuns} HR</div>}
              </div>
            )}

            {card.log.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...label, marginBottom: 6 }}>Last {card.log.length} games</div>
                {card.log.map((g, i) => {
                  const hot = standout(g.stat)
                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '9px 0', borderTop: i ? `1px solid ${theme.rule}` : 'none' }}>
                      <div style={{ width: 46, flexShrink: 0, textAlign: 'center', paddingTop: 1 }}>
                        <div style={{ color: theme.gold, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', lineHeight: 1.2 }}>{day(g.date)}</div>
                        <div style={{ color: theme.muted, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{weekday(g.date)}</div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, color: theme.ink, fontWeight: hot ? 700 : 400, lineHeight: 1.35 }}>
                          {hot && <span style={{ color: theme.gold, marginRight: 5 }}>▲</span>}
                          {card.isPitcher ? pitLine(g.stat) : hitLine(g.stat)}
                        </div>
                        <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 2, lineHeight: 1.4 }}>
                          {g.isHome ? 'vs' : 'at'} {oppName(g)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
