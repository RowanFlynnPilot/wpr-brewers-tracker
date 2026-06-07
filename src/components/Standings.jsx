import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { Loading } from './Status.jsx'
import TeamLogo from './TeamLogo.jsx'

const th = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, textAlign: 'right', padding: '8px 10px', fontWeight: 700 }
const td = { fontFamily: theme.sans, fontSize: 14, color: theme.ink, textAlign: 'right', padding: '10px', borderTop: `1px solid ${theme.rule}` }
const last10 = (t) => { const s = (t.records?.splitRecords || []).find((x) => x.type === 'lastTen'); return s ? `${s.wins}-${s.losses}` : '\u2014' }

// Last-10 form: tall navy bar for a win, short light bar for a loss (oldest \u2192 newest).
function Spark({ results }) {
  if (!results || !results.length) return <span style={{ color: theme.muted }}>{'\u2014'}</span>
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
      {results.map((w, i) => (
        <span key={i} title={w ? 'W' : 'L'} style={{ width: 4, height: w ? 13 : 6, borderRadius: 1, background: w ? theme.navy : theme.rule }} />
      ))}
    </span>
  )
}

export default function Standings({ standings, form }) {
  if (!standings) return <Loading />
  const rows = [...standings].sort((a, b) => parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Team</th>
            <th style={th}>W</th><th style={th}>L</th><th style={th}>PCT</th>
            <th style={th}>GB</th><th style={th}>L10</th><th style={th}>Strk</th><th style={th}>Form</th><th style={th}>RunDiff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const me = t.team.id === TEAM_ID
            const rd = t.runDifferential
            return (
              <tr key={t.team.id} style={{ background: me ? theme.wash : 'transparent' }}>
                <td style={{ ...td, textAlign: 'left' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: theme.serif, fontSize: 16, fontWeight: me ? 700 : 400, color: me ? theme.navy : theme.ink }}>
                    <TeamLogo id={t.team.id} size={22} />
                    {t.team.name}
                  </span>
                </td>
                <td style={td}>{t.wins}</td>
                <td style={td}>{t.losses}</td>
                <td style={td}>{t.winningPercentage}</td>
                <td style={td}>{t.gamesBack === '-' ? '\u2014' : t.gamesBack}</td>
                <td style={td}>{last10(t)}</td>
                <td style={td}>{t.streak?.streakCode || '\u2014'}</td>
                <td style={td}><Spark results={form?.[t.team.id]} /></td>
                <td style={{ ...td, color: rd > 0 ? theme.navy : rd < 0 ? theme.red : theme.ink }}>{rd > 0 ? '+' : ''}{rd}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
