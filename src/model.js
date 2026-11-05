'use strict'

const { parts, monthBounds } = require('./time')
function months(state, zone) {
  const result = new Set()
  for (const e of state.events) {
    if (e.source === 'unknown' && e.kind !== 'normal') continue
    result.add(parts(e.at, zone).month)
    if (e.source === 'unknown') {
      let cursor = e.from
      while (parts(cursor, zone).month < parts(e.to, zone).month) {
        result.add(parts(cursor, zone).month)
        cursor = monthBounds(parts(cursor, zone).month, zone)[1]
      }
    }
  }
  return [...result].sort().reverse()
}
function summarize(state, month, zone = 'Asia/Tokyo', minutes = 60) {
  const [start, end] = monthBounds(month, zone)
  const count = Math.round((end - start) / 86400000)
  const columns = 1440 / minutes
  const days = Array.from({ length: count }, (_, i) => ({ day: `${month}-${String(i + 1).padStart(2, '0')}`, total: 0, normal: 0, eo: 0, quest: 0, slots: Array(columns).fill(0), events: [] }))
  const unknown = []
  let total = 0, normal = 0, eo = 0, quest = 0
  for (const e of state.events) {
    if (e.source === 'unknown') {
      if (e.kind === 'normal' && e.from < end && e.to >= start) unknown.push({ ...e, withinMonth: e.from >= start && e.to < end })
      continue
    }
    if (e.source !== 'local' || e.at < start || e.at >= end) continue
    const p = parts(e.at, zone)
    const day = days[Number(p.day.slice(-2)) - 1]
    if (e.kind === 'normal') {
      const minute = new Date(e.at + (zone === 'Asia/Shanghai' ? 8 : 9) * 3600000).getUTCMinutes()
      day.slots[Math.floor((p.hour * 60 + minute) / minutes)] += e.amount
      day.events.push(e)
    }
    day.total += e.amount
    day[e.kind] += e.amount
    total += e.amount
    if (e.kind === 'normal') normal += e.amount
    if (e.kind === 'eo') eo += e.amount
    if (e.kind === 'quest') quest += e.amount
  }
  return { days, total, normal, eo, quest, unknown,
    unknownWithinMonth: unknown.filter(e => e.withinMonth).reduce((s, e) => s + e.amount, 0),
    unknownAcrossMonths: unknown.filter(e => !e.withinMonth).reduce((s, e) => s + e.amount, 0) }
}
module.exports = { months, summarize }
