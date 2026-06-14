import { theme } from '../theme.js'
import { TEAM_ID } from '../config.js'
import { recentResults } from '../games.js'
import { useIsNarrow } from '../useIsNarrow.js'
import { Loading, ErrorState } from './Status.jsx'
import TeamLogo from './TeamLogo.jsx'

const th = { fontFamily: theme.sans, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.muted, textAlign: 'right', fontWeight: 700 }
const td = { fontFamily: theme.sans, fontSize: 14, color: theme.ink, textAlign: 'right', borderTop: `1px solid ${theme.rule}`, whiteSpace: 'nowrap' }
const last10 = (t) => { const s = (t.records?.splitRecords || []).find((x) => x.type === 'lastTen'); return s ? `${s.wins}-${s.losses}` : '—' }

// Tiny W/L sequence strip under the L10 record — the order of results, which the number alone
// can't show (navy = win, rule-gray = loss, oldest → newest).
function FormStrip({ results }) {
  if (!results.length) return null
  return (
    <span aria-hidden="true" style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', marginTop: 4 }}>
      {results.map((won, i) => (
        <span key={i} style={{ width: 5, height: 8, borderRadius: 1, background: won ? theme.navy : theme.rule }} />
      ))}
    </span>
  )
}

export default function Standings({ standings, schedules, error }) {
  const narrow = useIsNarrow()
  if (!standings) return error ? <ErrorState /> : <Loading />
  const rows = [...standings].sort((a, b) => parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage))

  // Drop the two most advanced columns on phones so the table fits without sideways scrolling.
  const thc = { ...th, padding: narrow ? '8px 5px' : '8px 10px' }
  const tdc = { ...td, padding: narrow ? '9px 5px' : '10px' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th scope="col" style={{ ...thc, textAlign: 'left' }}>Team</th>
            <th scope="col" style={thc}>W</th><th scope="col" style={thc}>L</th>
            {!narrow && <th scope="col" style={thc}>PCT</th>}
            <th scope="col" style={thc}>GB</th><th scope="col" style={thc}>L10</th><th scope="col" style={thc}>Streak</th>
            {!narrow && <th scope="col" style={thc}>Run diff</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const me = t.team.id === TEAM_ID
            const rd = t.runDifferential
            return (
              <tr key={t.team.id} className={me ? undefined : 'hover-row'} style={me ? { background: theme.wash } : undefined}>
                <td style={{ ...tdc, textAlign: 'left' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: narrow ? 7 : 9, fontFamily: theme.serif, fontSize: narrow ? 14 : 16, fontWeight: me ? 700 : 400, color: me ? theme.navy : theme.ink }}>
                    <TeamLogo id={t.team.id} size={narrow ? 18 : 22} />
                    {t.team.name}
                  </span>
                </td>
                <td style={tdc}>{t.wins}</td>
                <td style={tdc}>{t.losses}</td>
                {!narrow && <td style={tdc}>{t.winningPercentage}</td>}
                <td style={tdc}>{t.gamesBack === '-' ? '—' : t.gamesBack}</td>
                <td style={tdc}>
                  {last10(t)}
                  {schedules && <FormStrip results={recentResults(schedules, t.team.id)} />}
                </td>
                <td style={tdc}>{t.streak?.streakCode || '—'}</td>
                {!narrow && <td style={{ ...tdc, color: rd > 0 ? theme.navy : rd < 0 ? theme.red : theme.ink }}>{rd > 0 ? '+' : ''}{rd}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
