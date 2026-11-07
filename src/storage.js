'use strict'

const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { createLedger, apply, validInput } = require('./ledger')
const { MAX_BACKUP_BYTES, parseBackup, parseRecords, mergeRecords, pause, fail } = require('./backup')

class Journal {
  constructor(directory) {
    this.directory = directory
    fs.mkdirSync(directory, { recursive: true })
    this.accounts = new Map()
    this.lockPath = path.join(directory, '.writer-lock')
    // An advisory, process-scoped lock prevents two poi main windows from writing.
    try { this.lock = fs.openSync(this.lockPath, 'wx'); fs.writeFileSync(this.lock, String(process.pid)) }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      const pid = Number(fs.readFileSync(this.lockPath, 'utf8'))
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('存储锁无效，请检查 .writer-lock')
      try { process.kill(pid, 0) } catch (probe) {
        if (probe.code === 'ESRCH') {
          fs.unlinkSync(this.lockPath)
          this.lock = fs.openSync(this.lockPath, 'wx')
          fs.writeFileSync(this.lock, String(process.pid))
        } else throw probe
      }
      if (this.lock === undefined) throw new Error('另一个 poi 实例正在记录战果，请关闭另一实例')
    }
  }
  list() {
    return fs.readdirSync(this.directory).filter(n => /^\d+\.jsonl$/.test(n)).map(n => n.slice(0, -6)).sort()
  }
  load(account) {
    if (!/^\d+$/.test(account)) throw new Error('Invalid account')
    if (this.accounts.has(account)) return this.accounts.get(account)
    const entry = { state: createLedger(), file: path.join(this.directory, account + '.jsonl'), error: null, revision: 0 }
    let contents = ''
    try { contents = fs.readFileSync(entry.file, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
    const lines = contents.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (i === lines.length - 1 && lines[i] === '') break
      try {
        if (i === lines.length - 1) throw new Error('末行写入未完成')
        const input = JSON.parse(lines[i])
        if (!validInput(input)) throw new Error('格式不兼容')
        apply(entry.state, input)
      } catch (error) {
        entry.error = `记录第 ${i + 1} 行异常：${error.message}。已保留原文件并暂停写入。`
        break
      }
    }
    this.accounts.set(account, entry)
    return entry
  }
  append(account, input) {
    if (this.closed) throw new Error('存储尚未初始化')
    if (!validInput(input)) throw new Error('Invalid ledger record')
    const entry = this.load(account)
    if (entry.error) throw new Error(entry.error)
    const fd = fs.openSync(entry.file, 'a')
    try {
      fs.writeFileSync(fd, JSON.stringify(input) + '\n', 'utf8')
      fs.fsyncSync(fd)
    } catch (error) {
      entry.error = `保存失败，已暂停写入：${error.message}`
      throw error
    } finally { fs.closeSync(fd) }
    apply(entry.state, input)
    entry.revision++
  }
  async importBackup(contents) {
    if (this.importing) throw fail('importBusy')
    if (this.closed) throw new Error('存储尚未初始化')
    this.importing = true
    try {
      const backup = await parseBackup(contents)
      const entry = this.load(backup.account)
      if (entry.error) throw new Error(entry.error)
      // Recording continues while files are read and the history is rebuilt.
      // If a new response arrives, retry with that response included.
      for (let attempt = 0; attempt < 3; attempt++) {
        const revision = entry.revision
        let original = ''
        try {
          if ((await fs.promises.stat(entry.file)).size > MAX_BACKUP_BYTES) throw fail('importTooLarge')
          original = await fs.promises.readFile(entry.file, 'utf8')
        } catch (error) { if (error.code !== 'ENOENT') throw error }
        const local = original ? await parseRecords(original) : []
        const merged = await mergeRecords(local, backup.records)
        const state = createLedger(), lines = []
        for (let i = 0; i < merged.records.length; i++) {
          const record = merged.records[i]
          apply(state, record)
          lines.push(JSON.stringify(record))
          if (i % 500 === 499) await pause()
        }
        const data = lines.join('\n') + '\n'
        if (Buffer.byteLength(data, 'utf8') > MAX_BACKUP_BYTES) throw fail('importTooLarge')
        if (this.closed) throw new Error('存储尚未初始化')
        if (entry.error) throw new Error(entry.error)
        if (entry.revision !== revision) continue
        const result = { account: backup.account, added: merged.added, skipped: merged.skipped, latestAt: merged.records.at(-1).at }
        if (!merged.added) return result
        const suffix = Date.now() + '-' + randomUUID()
        const temporary = entry.file + '.import-' + suffix + '.tmp'
        const previous = original ? entry.file + '.before-import-' + suffix + '.bak' : null
        let committed = false
        try {
          await this.writeImportFile(temporary, data)
          if (previous) await this.writeImportFile(previous, original)
          if (this.closed) throw new Error('存储尚未初始化')
          if (entry.error) throw new Error(entry.error)
          if (entry.revision !== revision) continue
          // No await between the revision check and replacement: a live append
          // can never be lost between these two operations.
          fs.renameSync(temporary, entry.file)
          committed = true
          entry.state = state
          entry.revision++
          return result
        } finally {
          await fs.promises.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
          if (!committed && previous) await fs.promises.unlink(previous).catch(error => { if (error.code !== 'ENOENT') throw error })
        }
      }
      throw fail('importChanged')
    } finally { this.importing = false }
  }
  async writeImportFile(file, contents) {
    const handle = await fs.promises.open(file, 'wx')
    try { await handle.writeFile(contents, 'utf8'); await handle.sync() } finally { await handle.close() }
  }
  close() {
    this.closed = true
    if (this.lock !== undefined) {
      fs.closeSync(this.lock)
      this.lock = undefined
      fs.unlinkSync(this.lockPath)
    }
  }
}
module.exports = { Journal }
