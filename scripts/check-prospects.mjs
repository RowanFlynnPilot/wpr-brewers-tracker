// Monthly drift check: is TOP_PROSPECTS still in sync with MLB Pipeline's Brewers list?
//
// Pipeline's backing endpoint (data-graph.mlb.com/graphql) is not CORS-open, so the widget
// can't read it live — the config list is hand-synced instead. This script runs on a schedule
// in CI, compares the two, and prints a markdown report. Exit codes: 0 = in sync,
// 3 = drift detected (the workflow opens/refreshes a GitHub issue with the report),
// anything else = the check itself failed (API shape changed, network, …).
//
// It NEVER writes site data — notification only, per the architecture (see CLAUDE.md).
import { TOP_PROSPECTS, SEASON } from '../src/config.js'

const res = await fetch('https://data-graph.mlb.com/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ getPlayerRankingsFromSelection(slug: "sel-pr-${SEASON}-brewers", limit: ${TOP_PROSPECTS.length}) { rank playerEntity { position player { id nameFirstLast } } } }`,
  }),
})
if (!res.ok) throw new Error(`data-graph responded ${res.status}`)
const rows = (await res.json()).data?.getPlayerRankingsFromSelection || []
if (rows.length < 10) throw new Error(`unexpectedly short list (${rows.length}) — the API shape may have changed`)

const live = rows.map((r) => ({
  rank: r.rank,
  id: r.playerEntity?.player?.id,
  name: r.playerEntity?.player?.nameFirstLast || '?',
  pos: r.playerEntity?.position || '',
}))
if (live.some((l) => !l.id)) throw new Error('missing player ids in the response — the API shape may have changed')

const inSync =
  live.length === TOP_PROSPECTS.length &&
  live.every((l, i) => l.id === TOP_PROSPECTS[i].id && l.rank === TOP_PROSPECTS[i].rank)

if (inSync) {
  console.log(`In sync — all ${live.length} prospects match MLB Pipeline's current order.`)
  process.exit(0)
}

// Drift report (markdown — becomes the GitHub issue body).
const byId = new Map(TOP_PROSPECTS.map((p) => [p.id, p]))
const liveIds = new Set(live.map((l) => l.id))
const entered = live.filter((l) => !byId.has(l.id))
const dropped = TOP_PROSPECTS.filter((p) => !liveIds.has(p.id))
const moved = live.filter((l) => byId.has(l.id) && byId.get(l.id).rank !== l.rank)

console.log(`MLB Pipeline has re-ranked the Brewers prospects — the Farm tab's list is out of date.\n`)
if (entered.length) console.log(`**New to the list:** ${entered.map((p) => `${p.name} (#${p.rank})`).join(', ')}\n`)
if (dropped.length) console.log(`**Dropped:** ${dropped.map((p) => p.name).join(', ')}\n`)
if (moved.length) console.log(`**Moved:** ${moved.map((l) => `${l.name} ${byId.get(l.id).rank}→${l.rank}`).join(', ')}\n`)
console.log(`**Paste-ready \`TOP_PROSPECTS\` for \`src/config.js\`** (or just ask Claude to re-sync):\n`)
console.log('```js')
live.forEach((p) => console.log(`  { rank: ${p.rank}, id: ${p.id}, name: '${p.name.replace(/'/g, "\\'")}', pos: '${p.pos}' },`))
console.log('```')
console.log(`\nRemember to update the "as of" date in the config comment.`)
process.exit(3)
