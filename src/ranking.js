'use strict'

const { HOUR, parts } = require('./time')
const ROW_FACTORS = [8931, 1201, 1156, 5061, 4569, 4732, 3779, 4568, 5695, 4619, 4912, 5669, 6586]
const ANCHORS = [1, 5, 20, 100, 500]
const RANKING_PATH = '/kcsapi/api_req_ranking/mxltvkpyuklh'
function period(at) {
  const shifted = new Date(at + 9 * HOUR)
  const hour = shifted.getUTCHours()
  shifted.setUTCHours(hour < 3 ? -9 : hour < 15 ? 3 : 15, 0, 0, 0)
  return shifted.getTime() - 9 * HOUR
}
function createRankingReader() { return { period: null, rows: new Map() } }
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a }
function readRanking(reader, body, at, nickname, account) {
  if (!Array.isArray(body.api_list)) return null
  const slot = period(at)
  if (reader.period !== slot) { reader.period = slot; reader.rows.clear() }
  for (const item of body.api_list) {
    const rank = Number(item.api_mxltvkpyuklh)
    const encoded = Number(item.api_wuhnhojjxmke)
    if (!Number.isSafeInteger(rank) || rank <= 0 || !Number.isSafeInteger(encoded) || encoded <= 0) continue
    const divisor = ROW_FACTORS[rank % 13]
    if (encoded % divisor !== 0) return null
    reader.rows.set(rank, { rank, value: encoded / divisor, nickname: item.api_mtjmdcwtvhdr,
      member: item.api_member_id === undefined ? null : String(item.api_member_id), at })
  }
  const rows = [...reader.rows.values()]
  if (rows.length < 5 || new Set(rows.map(r => r.value)).size < 3) return null
  const common = rows.map(r => r.value).reduce(gcd)
  let key = Math.min(99, common)
  while (key > 0 && common % key !== 0) key--
  if (key < 10) return null
  const byId = rows.filter(r => r.member === account)
  const matches = byId.length ? byId : rows.filter(r => r.member === null && nickname && r.nickname === nickname)
  const own = matches.length === 1 ? matches[0].rank : null
  const entries = []
  for (const row of rows) {
    const score = row.value / key - 91
    if (!Number.isSafeInteger(score) || score < 0 || score > 100000000) return null
    if (ANCHORS.includes(row.rank) || row.rank === own) entries.push({ rank: row.rank, score, self: row.rank === own, at: row.at })
  }
  if (!entries.length) return null
  return { v: 1, type: 'ranking', at, period: slot, entries: entries.sort((a, b) => a.rank - b.rank) }
}
function snapshot(history, month) {
  const rows = new Map()
  let lastAt = null
  for (const record of history || []) {
    if (parts(record.period).month !== month) continue
    if (lastAt !== null && record.at < lastAt) continue
    if (record.entries.some(e => e.self)) for (const old of rows.values()) old.self = false
    for (const entry of record.entries) rows.set(entry.rank, { ...entry, at: entry.at ?? record.at, period: record.period })
    lastAt = record.at
  }
  return { rows: [...rows.values()].filter(e => e.self || ANCHORS.includes(e.rank)).sort((a, b) => a.rank - b.rank), at: lastAt }
}
module.exports = { ROW_FACTORS, ANCHORS, RANKING_PATH, period, createRankingReader, readRanking, snapshot }
