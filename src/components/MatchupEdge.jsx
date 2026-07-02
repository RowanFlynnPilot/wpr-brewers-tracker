import { useEffect, useState } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, headshot } from '../config.js'
import { fetchFeaturedGame, fetchPitcherHand, fetchHitterSplits } from '../api.js'
import Section from './Section.jsx'

// "The platoon edge" — ahead of an upcoming game, which Brewers bats hit the opposing probable's
// side best this season. Needs the probable's throwing hand (one people call) + season L/R splits
// for the top bats (cached per hitter). Renders only pre-game with a known opposing probable;
// fail-soft everywhere — any miss and the section simply doesn't exist.
export default function MatchupEdge({ roster }) {
  const [game, setGame] = useState(null)
  const [hand, setHand] = useState(null)
  const [rows, setRows] = useState(null)

  useEffect(() => {
    fetchFeaturedGame().then(setGame).catch(() => {})
  }, [])

  const upcoming = game?.status?.abstractGameState === 'Preview'
  const home = game ? game.teams.home.team.id === TEAM_ID : true
  const oppProb = upcoming ? game.teams[home ? 'away' : 'home'].probablePitcher : null
  const oppProbId = oppProb?.id

  useEffect(() => {
    setHand(null)
    if (!oppProbId) return
    let alive = true
    fetchPitcherHand(oppProbId).then((h) => { if (alive) setHand(h) }).catch(() => {})
    return () => { alive = false }
  }, [oppProbId])

  useEffect(() => {
    setRows(null)
    if (!hand || !roster) return
    // Top season bats (same playing-time gate as the leader tables), splits fetched in parallel.
    const bats = []
    roster.forEach((p) => {
      ;(p.person.stats || []).forEach((s) => {
        const st = s.splits?.[0]?.stat
        if (s.group.displayName === 'hitting' && st && st.atBats > 60) {
          bats.push({ id: p.person.id, name: p.person.fullName, _ops: parseFloat(st.ops) || 0 })
        }
      })
    })
    bats.sort((a, b) => b._ops - a._ops)
    const top = bats.slice(0, 8)
    let alive = true
    Promise.all(top.map((b) => fetchHitterSplits(b.id).catch(() => null))).then((splits) => {
      if (!alive) return
      const key = hand === 'L' ? 'vl' : 'vr'
      const out = top
        .map((b, i) => ({ ...b, split: splits[i]?.[key] }))
        .filter((b) => b.split && b.split.atBats >= 25)
        .sort((a, b) => (parseFloat(b.split.ops) || 0) - (parseFloat(a.split.ops) || 0))
        .slice(0, 4)
      setRows(out)
    })
    return () => { alive = false }
  }, [hand, roster])

  if (!upcoming || !oppProb || !hand || !rows || rows.length < 2) return null

  const handWord = hand === 'L' ? 'left' : 'right'
  const sideLabel = hand === 'L' ? 'LHP' : 'RHP'
  const pitcherLast = oppProb.fullName.split(' ').pop()

  return (
    <Section kicker="Today's matchup" title="The platoon edge">
      <p style={{ fontFamily: theme.serif, fontSize: 16, color: theme.muted, margin: '0 0 16px', maxWidth: 600, lineHeight: 1.5 }}>
        {pitcherLast} throws {handWord}-handed. The Brewers bats that have punished {handWord}ies this season:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${rows.length === 4 ? 300 : 250}px, 1fr))`, gap: 10 }}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${i === 0 ? theme.gold : theme.rule}`, borderRadius: 6, padding: '10px 13px', background: i === 0 ? theme.wash : '#fff' }}>
            <img src={headshot(r.id)} alt="" width={38} height={38} style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: theme.serif, fontSize: 14.5, fontWeight: i === 0 ? 700 : 400, color: theme.ink, lineHeight: 1.15 }}>{r.name}</div>
              <div style={{ fontFamily: theme.sans, fontSize: 11.5, color: theme.muted, marginTop: 2 }}>
                {r.split.avg} AVG · <span style={{ color: theme.navy, fontWeight: 700 }}>{r.split.ops} OPS</span> · {r.split.homeRuns} HR vs {sideLabel}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
