'use strict'

const KEY = 'plugin.poi-plugin-senka-ledger'
const ZONES = ['Asia/Tokyo', 'Asia/Shanghai']
class Preferences {
  constructor(config) {
    this.config = config
    const zone = config?.get(`${KEY}.timezone`)
    this.zone = ZONES.includes(zone) ? zone : ZONES[0]
    this.accountNames = {}
    const names = config?.get(`${KEY}.accountNames`)
    if (names && typeof names === 'object' && !Array.isArray(names)) {
      for (const [account, name] of Object.entries(names)) {
        if (/^\d+$/.test(account) && typeof name === 'string' && name.trim()) this.accountNames[account] = name
      }
    }
  }
  setZone(zone) {
    if (!ZONES.includes(zone)) throw new Error('Invalid timezone')
    if (zone === this.zone) return
    this.config?.set(`${KEY}.timezone`, zone)
    this.zone = zone
  }
  rememberName(account, name) {
    if (!/^\d+$/.test(String(account)) || typeof name !== 'string' || !name.trim() || this.accountNames[account] === name) return false
    const names = { ...this.accountNames, [account]: name }
    // poi uses lodash.set: a numeric path component creates a sparse array.
    // Always replace the complete map so account IDs remain object keys.
    this.config?.set(`${KEY}.accountNames`, names)
    this.accountNames = names
    return true
  }
  snapshot() { return { zone: this.zone, accountNames: { ...this.accountNames } } }
}
function accountLabel(account, names = {}) {
  const name = names[account]
  if (!name) return account
  return Object.entries(names).some(([id, value]) => id !== account && value === name) ? `${name} (${account})` : name
}
module.exports = { Preferences, accountLabel }
