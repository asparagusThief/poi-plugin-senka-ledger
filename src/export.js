'use strict'

const { summarize } = require('./model')
const { formatTime } = require('./time')
const { translator, battleText } = require('./i18n')
// Spreadsheet applications interpret leading formula characters even inside CSV quotes.
function cell(value) {
  const text = String(value ?? '')
  return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'
}
function toCSV(state, month, zone, language = 'zh-CN') {
  const t = translator(language)
  const stats = summarize(state, month, zone)
  const rows = [[t('month'), month, t('timezone'), zone], [t('monthTotal'), stats.total.toFixed(4)], [t('normal'), stats.normal.toFixed(4)],
    [t('eo'), stats.eo.toFixed(4)], [t('quest'), stats.quest.toFixed(4)], [],
    ['source', 'kind', 'senka', 'experience', 'csvTime', 'from', 'to', 'map', 'timezone'].map(key => t(key))]
  const events = [...stats.days.flatMap(d => d.events), ...stats.unknown].sort((a, b) => a.at - b.at)
  for (const e of events) rows.push([t(e.source === 'local' ? 'local' : 'unlocated'), t('normalKind'), e.amount.toFixed(4), e.exp ?? '', formatTime(e.at, zone),
    e.from === undefined ? '' : formatTime(e.from, zone), e.to === undefined ? '' : formatTime(e.to, zone), e.source === 'local' ? battleText(e, t) : '', zone])
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}
module.exports = { toCSV, cell }
