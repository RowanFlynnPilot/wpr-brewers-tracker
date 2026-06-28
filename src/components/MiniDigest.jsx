import { useEffect, useState, useCallback } from 'react'
import { theme } from '../theme.js'
import { TEAM_ID, DIVISION, SPONSORS, headshot } from '../config.js'
import { fetchDigestGames, fetchStandingsBundle, fetchPitcherSeason } from '../api.js'
import { track } from '../analytics.js'
import { destination } from '../embed.js'
import TeamLogo from './TeamLogo.jsx'

const REFRESH_MS = 120000

const lastName = (full) => (full ? full.split(' ').pop() : '')
// Broadcast notation for a probable: "Woodruff (8-2, 2.50)"; just the surname if no line yet.
const probLine = (full, stat) => (stat ? `${lastName(full)} (${stat.wins}-${stat.losses}, ${stat.era})` : lastName(full))

const Headshot = ({ id, size }) => (
  <img src={headshot(id)} alt="" width={size} height={size}
    style={{ borderRadius: '50%', objectFit: 'cover', background: theme.wash, flexShrink: 0 }}
    onError={(e) => { e.currentTarget.style.display = 'none' }} />
)

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// Newsletter "digest" mini: last final (score + winning/losing pitcher), next game (probables),
// and the NL Central standings — one at-a-glance card. The whole card is one link into the full
// tracker (target=_top navigates the hosting page, not the iframe). Self-contained, fail-soft:
// any section with no data simply doesn't render.
export default function MiniDigest() {
  const [games, setGames] = useState(null)        // { last, next }
  const [standings, setStandings] = useState(null)
  const [decision, setDecision] = useState(null)  // { win, loss } season lines for last game's W/L
  const [probables, setProbables] = useState(null) // { me, opp } season lines for next game

  const load = useCallback(() => {
    fetchDigestGames().then(setGames).catch(() => {})
    fetchStandingsBundle().then((b) => setStandings(b.standings)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const refresh = () => { if (!document.hidden) load() }
    const id = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh) }
  }, [load])

  const last = games?.last
  const next = games?.next
  const winId = last?.decisions?.winner?.id
  const lossId = last?.decisions?.loser?.id
  const nextPk = next?.gamePk

  // Pull season lines for the last game's W/L pitchers (records + ERA), keyed off their ids.
  useEffect(() => {
    setDecision(null)
    if (!winId || !lossId) return
    let alive = true
    Promise.all([fetchPitcherSeason(winId).catch(() => null), fetchPitcherSeason(lossId).catch(() => null)])
      .then(([win, loss]) => { if (alive) setDecision({ win, loss }) })
    return () => { alive = false }
  }, [winId, lossId])

  // Pull season lines for the next game's probables (Brewers' first).
  useEffect(() => {
    setProbables(null)
    if (!next) return
    const home = next.teams.home.team.id === TEAM_ID
    const me = next.teams[home ? 'home' : 'away'].probablePitcher
    const opp = next.teams[home ? 'away' : 'home'].probablePitcher
    if (!me || !opp) return
    let alive = true
    Promise.all([fetchPitcherSeason(me.id).catch(() => null), fetchPitcherSeason(opp.id).catch(() => null)])
      .then(([sm, so]) => { if (alive) setProbables({ me: sm, opp: so }) })
    return () => { alive = false }
  }, [nextPk]) // eslint-disable-line react-hooks/exhaustive-deps -- pk pins the matchup

  const card = {
    display: 'block', maxWidth: 420, margin: '0 auto', textDecoration: 'none', overflow: 'hidden',
    background: '#fff', border: `1px solid ${theme.rule}`, borderTop: `3px solid ${theme.gold}`,
    borderRadius: 8, fontFamily: theme.sans,
  }
  const band = (
    <div style={{ background: theme.navy, color: '#fff', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', padding: '5px 8px', textAlign: 'center' }}>
      Brewers digest
    </div>
  )
  const heading = (text) => (
    <div style={{ fontSize: 9, letterSpacing: '0.14em', fontWeight: 700, color: theme.gold, textTransform: 'uppercase', marginBottom: 6 }}>{text}</div>
  )
  const footer = (
    <div style={{ borderTop: `1px solid ${theme.rule}`, margin: '0 12px', padding: '7px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {SPONSORS.header ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700, color: theme.gold, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Presented by</span>
          {SPONSORS.header.logo
            ? <img src={SPONSORS.header.logo} alt={SPONSORS.header.name} style={{ height: 20, objectFit: 'contain', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            : <span style={{ fontSize: 8.5, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPONSORS.header.name}</span>}
        </span>
      ) : <span />}
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.navy, whiteSpace: 'nowrap' }}>Full tracker {'→'}</span>
    </div>
  )
  const linkProps = { href: destination(), target: '_top', onClick: () => track('Mini Click', { widget: 'digest' }) }
  const section = { padding: '11px 14px', borderTop: `1px solid ${theme.rule}` }

  // Nothing yet: a branded doorway rather than an empty box.
  if (!games && !standings) {
    return (
      <a {...linkProps} className="mini-card" style={card}>
        {band}
        <div style={{ padding: '18px 14px', fontFamily: theme.serif, fontSize: 16, color: theme.ink, textAlign: 'center' }}>The Brewers, by the numbers</div>
        {footer}
      </a>
    )
  }

  // ---- Last completed game ----
  let lastBlock = null
  if (last) {
    const homeWon = last.teams.home.score > last.teams.away.score
    const meHome = last.teams.home.team.id === TEAM_ID
    const me = last.teams[meHome ? 'home' : 'away']
    const opp = last.teams[meHome ? 'away' : 'home']
    const oppName = opp.team.teamName || opp.team.name.replace('Milwaukee ', '')
    const won = (meHome && homeWon) || (!meHome && !homeWon)
    const winTeam = homeWon ? last.teams.home.team : last.teams.away.team
    const lossTeam = homeWon ? last.teams.away.team : last.teams.home.team
    const d = last.decisions || {}

    const DecRow = ({ tag, color, pitcher, team, stat }) => !pitcher ? null : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, marginTop: 3 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ width: 15, height: 15, borderRadius: '50%', background: color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{tag}</span>
          <span style={{ color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lastName(pitcher.fullName)}
            <span style={{ color: theme.muted }}> · {team.abbreviation || team.teamName}</span>
          </span>
        </span>
        {stat && <span style={{ color: theme.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>{stat.wins}-{stat.losses}, {stat.era}</span>}
      </div>
    )

    lastBlock = (
      <div style={{ padding: '11px 14px' }}>
        {heading(`Last game · ${fmtDay(last.gameDate)}`)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo id={me.team.id} size={22} />
            <span style={{ fontFamily: theme.serif, fontSize: 14, fontWeight: won ? 700 : 400, color: won ? theme.navy : theme.ink }}>Brewers</span>
          </span>
          <span style={{ fontFamily: theme.serif, fontSize: 22, color: theme.ink, whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: won ? 700 : 400, color: won ? theme.navy : theme.ink }}>{me.score}</span>
            <span style={{ fontSize: 15, color: theme.muted }}> – </span>
            <span style={{ fontWeight: won ? 400 : 700 }}>{opp.score}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: theme.serif, fontSize: 14, color: theme.ink }}>{oppName}</span>
            <TeamLogo id={opp.team.id} size={22} />
          </span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: won ? theme.navy : theme.red, marginTop: 4 }}>
          {won ? 'BREWERS WIN' : 'BREWERS LOSE'}
        </div>
        <div style={{ marginTop: 6 }}>
          <DecRow tag="W" color={theme.navy} pitcher={d.winner} team={winTeam} stat={decision?.win} />
          <DecRow tag="L" color={theme.red} pitcher={d.loser} team={lossTeam} stat={decision?.loss} />
          {d.save && (
            <div style={{ fontSize: 10, color: theme.muted, marginTop: 3 }}>
              Save: {lastName(d.save.fullName)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Next game ----
  let nextBlock = null
  if (next) {
    const meHome = next.teams.home.team.id === TEAM_ID
    const me = next.teams[meHome ? 'home' : 'away']
    const opp = next.teams[meHome ? 'away' : 'home']
    const oppName = opp.team.teamName || opp.team.name.replace('Milwaukee ', '')
    const mp = me.probablePitcher
    const op = opp.probablePitcher
    nextBlock = (
      <div style={section}>
        {heading(`Next up · ${fmtDay(next.gameDate)} · ${fmtTime(next.gameDate)}`)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: theme.serif, fontSize: 14, color: theme.ink }}>
          <TeamLogo id={me.team.id} size={20} />
          <span style={{ fontWeight: 700, color: theme.navy }}>Brewers</span>
          <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.muted, fontFamily: theme.sans }}>{meHome ? 'vs' : 'at'}</span>
          <span>{oppName}</span>
          <TeamLogo id={opp.team.id} size={20} />
        </div>
        {mp && op ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11, color: theme.muted, marginTop: 6 }}>
            <Headshot id={mp.id} size={22} />
            <span>{probLine(mp.fullName, probables?.me)} <span style={{ color: theme.ink, fontWeight: 700 }}>vs</span> {probLine(op.fullName, probables?.opp)}</span>
            <Headshot id={op.id} size={22} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 10.5, color: theme.muted, marginTop: 5 }}>Probable pitchers TBD</div>
        )}
      </div>
    )
  }

  // ---- NL Central standings ----
  let standingsBlock = null
  if (standings) {
    const rows = [...standings].sort((a, b) => parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage))
    const th = { fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, fontWeight: 700, textAlign: 'right', padding: '3px 6px' }
    const td = { fontSize: 12, color: theme.ink, textAlign: 'right', padding: '4px 6px', borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap' }
    standingsBlock = (
      <div style={section}>
        {heading('NL Central')}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Team</th>
              <th style={th}>W</th><th style={th}>L</th><th style={th}>GB</th><th style={th}>Strk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const me = t.team.id === TEAM_ID
              const sc = t.streak?.streakCode || '—'
              return (
                <tr key={t.team.id} style={me ? { background: theme.wash } : undefined}>
                  <td style={{ ...td, textAlign: 'left' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: theme.serif, fontSize: 13.5, fontWeight: me ? 700 : 400, color: me ? theme.navy : theme.ink }}>
                      <TeamLogo id={t.team.id} size={17} />
                      {DIVISION[t.team.id] || t.team.name}
                    </span>
                  </td>
                  <td style={td}>{t.wins}</td>
                  <td style={td}>{t.losses}</td>
                  <td style={td}>{t.gamesBack === '-' ? '—' : t.gamesBack}</td>
                  <td style={{ ...td, color: sc[0] === 'W' ? theme.navy : sc[0] === 'L' ? theme.red : theme.muted, fontWeight: 700 }}>{sc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <a {...linkProps} className="mini-card" style={card}>
      {band}
      {lastBlock}
      {nextBlock}
      {standingsBlock}
      {footer}
    </a>
  )
}
