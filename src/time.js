'use strict'

const HOUR = 3600000
const DAY = 24 * HOUR
const OFFSETS = { 'Asia/Tokyo': 9, 'Asia/Shanghai': 8 }
function parts(at, zone = 'Asia/Tokyo') {
  if (!Number.isFinite(at) || !Object.hasOwn(OFFSETS, zone)) throw new Error('Invalid time or timezone')
  const date = new Date(at + OFFSETS[zone] * HOUR)
  return { day: date.toISOString().slice(0, 10), month: date.toISOString().slice(0, 7), hour: date.getUTCHours() }
}
function formatTime(at, zone = 'Asia/Tokyo') {
  return new Date(at + OFFSETS[zone] * HOUR).toISOString().slice(0, 19).replace('T', ' ')
}
function monthStart(at) {
  return Date.parse(parts(at).month + '-01T00:00:00+09:00')
}
function monthBounds(month, zone = 'Asia/Tokyo') {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month')
  const start = Date.parse(month + '-01T00:00:00Z') - OFFSETS[zone] * HOUR
  const date = new Date(start + OFFSETS[zone] * HOUR)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return [start, date.getTime() - OFFSETS[zone] * HOUR]
}
module.exports = { HOUR, DAY, parts, formatTime, monthStart, monthBounds }
