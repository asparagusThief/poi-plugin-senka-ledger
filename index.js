'use strict'

const React = require('react')
const fs = require('fs')
const path = require('path')
const { Journal } = require('./src/storage')
const { createAdapter, decode } = require('./src/adapter')
const { createPanel } = require('./src/panel')
const { toCSV } = require('./src/export')
let journal = null
let adapter = createAdapter()
let error = null
let directory = ''
let loaded = false
const subscribers = new Set()
const snapshot = () => ({ account: adapter.account, accounts: [...new Set([...(journal ? journal.list() : []), ...(adapter.account ? [adapter.account] : [])])], error, directory })
const emit = () => { const value = snapshot(); for (const callback of subscribers) callback(value) }
function onResponse(event) {
  try {
    const previousAccount = adapter.account
    const result = decode(adapter, event.detail)
    if (result) for (const input of result.records) journal.append(result.account, input)
    if (result?.records.length || adapter.account !== previousAccount) emit()
  } catch (e) { error = e.message; emit() }
}
exports.pluginDidLoad = function pluginDidLoad() {
  if (loaded) return
  const { APPDATA_PATH, isMain } = require('views/env')
  if (isMain === false) return
  loaded = true
  directory = path.join(APPDATA_PATH, 'senka-ledger')
  try {
    journal = new Journal(directory)
    window.addEventListener('game.response', onResponse)
    window.addEventListener('beforeunload', exports.pluginWillUnload)
  } catch (e) { error = e.message }
  emit()
}
exports.pluginWillUnload = function pluginWillUnload() {
  window.removeEventListener('game.response', onResponse)
  window.removeEventListener('beforeunload', exports.pluginWillUnload)
  if (journal) journal.close()
  journal = null
  adapter = createAdapter()
  error = null
  loaded = false
}
const service = {
  snapshot,
  subscribe(callback) {
    subscribers.add(callback)
    exports.pluginDidLoad()
    callback(snapshot())
    return () => subscribers.delete(callback)
  },
  entry(account) {
    if (!journal || !account) return null
    try { return journal.load(account) } catch (e) { return { error: e.message } }
  },
  export(account, month, zone, type) {
    if (!journal) throw new Error('存储尚未初始化')
    const entry = journal.load(account)
    const data = type === 'json' ? JSON.stringify({ format: 'poi-senka-ledger', version: 1, account, journal: fs.readFileSync(entry.file, 'utf8') }, null, 2) : toCSV(entry.state, month, zone)
    const blob = new Blob([data], { type: type === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `senka-${account}-${type === 'json' ? 'all' : month}.${type}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}
exports.reactClass = createPanel(React, service)
