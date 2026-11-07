'use strict'

const { validInput } = require('./ledger')
const MAX_BACKUP_BYTES = 32 * 1024 * 1024
const MAX_RECORDS = 100000
const pause = () => new Promise(resolve => setImmediate(resolve))
const fail = (code, values) => Object.assign(new Error(code), { values })
const text = value => typeof value === 'string' && value.length <= 512
const optionalNumber = value => value === undefined || value === null || (Number.isSafeInteger(value) && value >= 0)

function normalizeRecord(record) {
  let valid = false
  try { valid = validInput(record) } catch (_) { /* Invalid nested values. */ }
  if (!valid || record.at > Date.now() + 86400000) throw fail('importInvalidRecord')
  const result = { v: 1, type: record.type, at: record.at }
  if (record.type === 'experience') {
    if (!text(record.label) || !optionalNumber(record.mapId) || !optionalNumber(record.node) ||
        (record.activity !== undefined && !['sortie', 'practice', 'expedition'].includes(record.activity)) ||
        (record.rank !== undefined && record.rank !== null && (typeof record.rank !== 'string' || record.rank.length > 16))) throw fail('importInvalidRecord')
    Object.assign(result, { exp: record.exp, gain: record.gain, label: record.label })
    for (const key of ['activity', 'mapId', 'node', 'rank']) if (record[key] !== undefined) result[key] = record[key]
  } else if (record.type === 'bonus') {
    if (!text(record.label) || !text(record.key)) throw fail('importInvalidRecord')
    Object.assign(result, { kind: record.kind, amount: record.amount, key: record.key, label: record.label, mapId: record.mapId, questId: record.questId })
  } else if (record.type === 'maps') {
    if (record.cleared.length > 9) throw fail('importInvalidRecord')
    result.cleared = [...new Set(record.cleared)].sort((a, b) => a - b)
  } else {
    result.period = record.period
    result.entries = record.entries.map(({ rank, score, self }) => ({ rank, score, self })).sort((a, b) => a.rank - b.rank)
  }
  return result
}
async function parseRecords(contents) {
  const lines = contents.split('\n'), records = []
  if (lines[lines.length - 1] === '') lines.pop()
  if (!lines.length || lines.length > MAX_RECORDS) throw fail('importRecordLimit')
  for (let i = 0; i < lines.length; i++) {
    try {
      if (lines[i].length > 8192) throw Error('record too large')
      records.push(normalizeRecord(JSON.parse(lines[i])))
    } catch (_) { throw fail('importInvalidLine', { line: i + 1 }) }
    if (i % 500 === 499) await pause()
  }
  return records
}
async function parseBackup(contents) {
  if (typeof contents !== 'string' || Buffer.byteLength(contents, 'utf8') > MAX_BACKUP_BYTES) throw fail('importTooLarge')
  let data
  try { data = JSON.parse(contents.replace(/^\uFEFF/, '')) } catch (_) { throw fail('importInvalidJSON') }
  if (!data || data.format !== 'poi-senka-ledger' || data.version !== 1 || typeof data.account !== 'string' || !/^\d{1,20}$/.test(data.account) || typeof data.journal !== 'string') throw fail('importInvalidBackup')
  return { account: data.account, records: await parseRecords(data.journal) }
}
function recordKey(record) {
  // Labels and optional display metadata do not make the same EXP observation new.
  if (record.type === 'experience') return JSON.stringify([record.type, record.at, record.exp, record.gain])
  return JSON.stringify(record)
}
async function mergeRecords(local, incoming) {
  const seen = new Set(), records = local.slice()
  for (let i = 0; i < local.length; i++) {
    seen.add(recordKey(local[i]))
    if (i % 500 === 499) await pause()
  }
  let added = 0
  for (let i = 0; i < incoming.length; i++) {
    const record = incoming[i], key = recordKey(record)
    if (!seen.has(key)) { records.push(record); seen.add(key); added++ }
    if (i % 500 === 499) await pause()
  }
  if (records.length > MAX_RECORDS) throw fail('importRecordLimit')
  records.sort((a, b) => a.at - b.at)
  return { records, added, skipped: incoming.length - added }
}
module.exports = { MAX_BACKUP_BYTES, parseBackup, parseRecords, mergeRecords, pause, fail }
