import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { Loading } from './Status.jsx'

const th = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, textAlign: 'right', padding: '8px 10px', fontWeight: 700 }
const td = { fontFamily: theme.sans, fontSize: 14, color: theme.ink, textAlign: 'right', padding: '10px', borderTop: `1px solid ${theme.rule}` }
const last10 = (t) => { const s = (t.records?.splitRecords || []).find((x) => x.type === 'lastTen'); return s ? `${s.wins}-${s.losses}` : '\u2014' }

export default function Standings({ standings }) {
  if (!standings) return <Loading label="Building the standings" />
  const rows = [...standings].sort((a, b) => parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Team</th>
            <th style={th}>W</th><th style={th}>L</th><th style={th}>PCT</th>
            <th style={th}>GB</th><th style={th}>L10</th><th style={th}>Strk</th><th style={th}>RunDiff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const me = t.team.id === TEAM_ID
            const rd = t.runDifferential
            return (
              <tr key={t.team.id} style={{ background: me ? theme.wash : 'transparent' }}>
                <td style={{ ...td, textAlign: 'left', fontFamily: theme.serif, fontSize: 16, fontWeight: me ? 700 : 400, color: me ? theme.navy : theme.ink }}>{t.team.name}</td>
                <td style={td}>{t.wins}</td>
                <td style={td}>{t.losses}</td>
                <td style={td}>{t.winningPercentage}</td>
                <td style={td}>{t.gamesBack === '-' ? '\u2014' : t.gamesBack}</td>
                <td style={td}>{last10(t)}</td>
                <td style={td}>{t.streak?.streakCode || '\u2014'}</td>
                <td style={{ ...td, color: rd > 0 ? theme.navy : rd < 0 ? theme.red : theme.ink }}>{rd > 0 ? '+' : ''}{rd}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
