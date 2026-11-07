'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Journal } = require('../src/storage')
const { parseBackup, MAX_BACKUP_BYTES } = require('../src/backup')
const { summarize } = require('../src/model')
const { errorText, translator } = require('../src/i18n')

const at = Date.parse('2026-11-04T20:00:00+09:00')
const first = { v: 1, type: 'experience', at, exp: 100000, gain: null, label: '母港' }
const battle = { ...first, at: at + 1000, exp: 101000, gain: 1000, label: '7-1 节点 4 · S 胜败', activity: 'sortie', mapId: 71, node: 4, rank: 'S' }
const port = { ...first, at: at + 2000, exp: 102000 }
const later = { ...battle, at: at + 3000, exp: 103000 }
const eo = { v: 1, type: 'bonus', at: at + 1500, kind: 'eo', amount: 75, key: 'eo:2026-11:15', label: '1-5 · EO 奖励', mapId: 15, questId: null }
const ranking = { v: 1, type: 'ranking', at: at + 2500, period: at - 3600000, entries: [{ rank: 250, score: 3200, self: true }] }
const encode = (records, account = '18176312') => JSON.stringify({ format: 'poi-senka-ledger', version: 1, account, journal: records.map(record => JSON.stringify(record)).join('\n') + '\n' })
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-import-'))
  const journal = new Journal(directory)
  t.after(() => {
    journal.close()
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-import-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return journal
}

test('imports the existing JSON export format, replays all record types and remains durable', async t => {
  const journal = fixture(t)
  const records = [first, battle, eo, port, ranking, { v: 1, type: 'maps', at: at + 2600, cleared: [15] }]
  const result = await journal.importBackup(encode(records))
  assert.equal(result.account, '18176312')
  assert.equal(result.added, 6)
  assert.equal(result.skipped, 0)
  assert.deepEqual(journal.list(), ['18176312'])
  const state = journal.load(result.account).state
  assert.equal(state.baseline.exp, port.exp)
  assert.equal(state.rankingHistory[0].entries[0].score, 3200)
  assert.equal(summarize(state, '2026-11').total, 75.7)
  assert.equal(summarize(state, '2026-11').unknownTotal, 0.7)
  assert.equal(fs.readdirSync(journal.directory).filter(name => name.endsWith('.bak')).length, 0)
  journal.close()
  const restarted = new Journal(journal.directory)
  try { assert.deepEqual(restarted.load(result.account).state, state) } finally { restarted.close() }
})

test('merges overlapping backups chronologically, retains newer local history and backs it up exactly', async t => {
  const journal = fixture(t)
  for (const record of [first, port, later]) journal.append('18176312', record)
  journal.append('456', { ...first, exp: 500000 })
  const entry = journal.load('18176312'), original = fs.readFileSync(entry.file)
  const other = fs.readFileSync(journal.load('456').file)
  const result = await journal.importBackup(encode([first, battle, eo, port, ranking]))
  assert.equal(result.added, 3)
  assert.equal(result.skipped, 2)
  const report = summarize(entry.state, '2026-11')
  assert.equal(report.normal, 1.4)
  assert.equal(report.eo, 75)
  assert.equal(report.unknownTotal, 0.7)
  assert.equal(entry.state.baseline.exp, later.exp)
  assert.deepEqual(fs.readFileSync(journal.load('456').file), other)
  const backups = fs.readdirSync(journal.directory).filter(name => name.endsWith('.bak'))
  assert.equal(backups.length, 1)
  assert.deepEqual(fs.readFileSync(path.join(journal.directory, backups[0])), original)
})

test('repeated imports, reordered JSON properties and duplicate source records do not grow history', async t => {
  const journal = fixture(t)
  await journal.importBackup(encode([first, battle, eo, port, ranking]))
  const entry = journal.load('18176312'), state = entry.state, original = fs.readFileSync(entry.file)
  const reordered = Object.fromEntries(Object.entries(battle).reverse())
  reordered.label = 'Same observation, translated label'
  const result = await journal.importBackup(encode([first, reordered, eo, port, ranking, battle]))
  assert.equal(result.added, 0)
  assert.equal(result.skipped, 6)
  assert.equal(entry.state, state)
  assert.deepEqual(fs.readFileSync(entry.file), original)
  assert.equal(fs.readdirSync(journal.directory).filter(name => name.endsWith('.bak')).length, 0)
})

test('invalid, unsupported, empty and oversized backups preserve local data byte for byte', async t => {
  const journal = fixture(t)
  journal.append('18176312', first)
  const entry = journal.load('18176312'), state = entry.state, original = fs.readFileSync(entry.file)
  const cases = ['{bad', 'null', encode([first], '../outside'), encode([first]).replace('"version":1', '"version":2'),
    JSON.stringify({ format: 'poi-senka-ledger', version: 1, account: '18176312', journal: '' }),
    encode([first, { ...ranking, entries: [null] }]), encode([first, { ...battle, at: Number.MAX_SAFE_INTEGER }]),
    encode([first, { ...battle, activity: { nested: true } }]), encode([first, { ...first, gain: -1 }]),
    ' '.repeat(MAX_BACKUP_BYTES + 1)]
  for (const value of cases) {
    await assert.rejects(journal.importBackup(value), /import/)
    assert.deepEqual(fs.readFileSync(entry.file), original)
    assert.equal(entry.state, state)
  }
  assert.equal(fs.readdirSync(journal.directory).length, 2)
})

test('write and replacement failures leave both the journal and replayed state unchanged', async t => {
  const journal = fixture(t)
  journal.append('18176312', first)
  const entry = journal.load('18176312'), original = fs.readFileSync(entry.file), state = entry.state
  const write = journal.writeImportFile.bind(journal)
  journal.writeImportFile = async (file, contents) => {
    if (file.endsWith('.bak')) throw Error('simulated disk full')
    return write(file, contents)
  }
  await assert.rejects(journal.importBackup(encode([first, battle])), /disk full/)
  assert.deepEqual(fs.readFileSync(entry.file), original)
  assert.equal(entry.state, state)
  journal.writeImportFile = write
  const mock = t.mock.method(fs, 'renameSync', () => { throw Error('simulated replacement failure') })
  await assert.rejects(journal.importBackup(encode([first, battle])), /replacement failure/)
  mock.mock.restore()
  assert.deepEqual(fs.readFileSync(entry.file), original)
  assert.equal(entry.state, state)
  assert.equal(fs.readdirSync(journal.directory).length, 2)
})

test('a live game response during import is included on retry rather than lost', async t => {
  const journal = fixture(t)
  journal.append('18176312', first)
  const write = journal.writeImportFile.bind(journal)
  let interrupted = false
  journal.writeImportFile = async (file, contents) => {
    await write(file, contents)
    if (!interrupted) { interrupted = true; journal.append('18176312', later) }
  }
  const result = await journal.importBackup(encode([first, battle, port]))
  assert.equal(result.added, 2)
  const state = journal.load('18176312').state
  assert.equal(state.baseline.exp, later.exp)
  assert.equal(summarize(state, '2026-11').normal, 1.4)
  assert.ok(fs.readFileSync(journal.load('18176312').file, 'utf8').includes(JSON.stringify(later)))
  assert.equal(fs.readdirSync(journal.directory).filter(name => name.endsWith('.bak')).length, 1)
})

test('continuous recording changes cancel safely; unloading and corrupt local data also block writes', async t => {
  const journal = fixture(t)
  journal.append('18176312', first)
  const write = journal.writeImportFile.bind(journal)
  let live = 0
  journal.writeImportFile = async (file, contents) => {
    await write(file, contents)
    journal.append('18176312', { ...port, at: at + 4000 + live++, exp: port.exp })
  }
  await assert.rejects(journal.importBackup(encode([first, battle])), /importChanged/)
  const entry = journal.load('18176312'), original = fs.readFileSync(entry.file)
  assert.equal(entry.state.events.filter(event => event.source === 'local').length, 0)
  journal.writeImportFile = async (file, contents) => { await write(file, contents); journal.close() }
  await assert.rejects(journal.importBackup(encode([first, battle])), /存储尚未初始化/)
  assert.deepEqual(fs.readFileSync(entry.file), original)
  assert.equal(fs.readdirSync(journal.directory).filter(name => /\.tmp$|\.bak$/.test(name)).length, 0)
  const corrupt = fixture(t)
  const badFile = path.join(corrupt.directory, '18176312.jsonl')
  fs.writeFileSync(badFile, JSON.stringify(first) + '\n{"v":1')
  const damaged = fs.readFileSync(badFile)
  await assert.rejects(corrupt.importBackup(encode([first, battle])), /暂停写入/)
  assert.deepEqual(fs.readFileSync(badFile), damaged)
})

test('large imports yield to the event loop and reject concurrent imports', async t => {
  const journal = fixture(t)
  const records = Array.from({ length: 5001 }, (_, i) => ({ ...battle, at: at + i * 1000, exp: 100000 + i * 1000 }))
  let ticks = 0
  const timer = setInterval(() => { ticks++ }, 0)
  t.after(() => clearInterval(timer))
  const pending = journal.importBackup(encode(records))
  await assert.rejects(journal.importBackup(encode([first])), /importBusy/)
  const result = await pending
  assert.equal(result.added, 5001)
  assert.ok(ticks > 2, 'import must allow other renderer work between batches')
  assert.equal(journal.load(result.account).state.baseline.exp, records.at(-1).exp)
})

test('accepts BOM, CRLF and older display metadata while localizing line validation failures', async () => {
  const text = '\uFEFF' + encode([first, battle]).replaceAll('\\n', '\\r\\n')
  assert.equal((await parseBackup(text)).records.length, 2)
  const error = await parseBackup(encode([first, { ...ranking, entries: [null] }])).catch(value => value)
  assert.equal(errorText(error, translator('zh-CN')), '备份中的第 2 笔记录无效，未更改本地数据。')
})
