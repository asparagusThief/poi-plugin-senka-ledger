'use strict'

const { summarize } = require('./model')
const { formatTime } = require('./time')
// Spreadsheet applications interpret leading formula characters even inside CSV quotes.
function cell(value) {
  const text = String(value ?? '')
  return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'
}
function toCSV(state, month, zone) {
  const stats = summarize(state, month, zone)
  const rows = [['月份', month, '时区', zone], ['本月战果', stats.total.toFixed(4)], ['普通战果', stats.normal.toFixed(4)],
    ['EO 战果', stats.eo.toFixed(4)], ['任务战果', stats.quest.toFixed(4)], [],
    ['来源', '种类', '战果增量', '提督经验', '记录或发现时间', '区间起点', '区间终点', '海域', '时区']]
  const events = [...stats.days.flatMap(d => d.events), ...stats.unknown].sort((a, b) => a.at - b.at)
  for (const e of events) rows.push([e.source === 'local' ? '本地确认' : '未定位', e.kind, e.amount.toFixed(4), e.exp ?? '', formatTime(e.at, zone),
    e.from === undefined ? '' : formatTime(e.from, zone), e.to === undefined ? '' : formatTime(e.to, zone), e.source === 'local' ? e.label : '', zone])
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}
module.exports = { toCSV, cell }
