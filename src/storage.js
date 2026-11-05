'use strict'

const fs = require('fs')
const path = require('path')
const { createLedger, apply, validInput } = require('./ledger')

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
    const entry = { state: createLedger(), file: path.join(this.directory, account + '.jsonl'), error: null }
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
  }
  close() {
    if (this.lock !== undefined) {
      fs.closeSync(this.lock)
      this.lock = undefined
      fs.unlinkSync(this.lockPath)
    }
  }
}
module.exports = { Journal }
