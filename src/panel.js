'use strict'

const { parts, formatTime, monthBounds, DAY } = require('./time')
const { months, summarize } = require('./model')
const { createLedger } = require('./ledger')
const { snapshot: rankingSnapshot, ANCHORS } = require('./ranking')
const { translator, normalize, errorText, battleText } = require('./i18n')
const { bindPanel, fitNumbers } = require('./layout')
const { createIcon } = require('./icon')
const style = require('./styles')

const colors = ['rgba(130,150,160,.13)', '#c4e9d8', '#81cdb2', '#36aa8f', '#087e70']
function tileStyle(value, max) {
  const level = value <= 0 ? 0 : Math.min(4, 1 + Math.floor(value / (max || 1) * 3))
  return { background: colors[level], color: level === 4 ? '#fff' : level ? '#173e36' : 'inherit' }
}
function createPanel(React, service) {
  const h = React.createElement
  return function SenkaLedgerPanel() {
    const [status, setStatus] = React.useState(service.snapshot())
    const [zone, setZone] = React.useState('Asia/Tokyo')
    const [month, setMonth] = React.useState(parts(Date.now()).month)
    const [day, setDay] = React.useState(null)
    const [viewAccount, setViewAccount] = React.useState('')
    const [slot, setSlot] = React.useState(null)
    const [exportError, setExportError] = React.useState('')
    const root = React.useRef(null)
    const language = normalize(status.language)
    const t = translator(language)
    const fmt = n => n.toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const tileNumber = n => n.toLocaleString(language, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    React.useEffect(() => service.subscribe(setStatus), [])
    React.useEffect(() => bindPanel(root.current), [])
    React.useEffect(() => {
      const view = root.current?.ownerDocument.defaultView
      if (view?.isWindowMode) root.current.ownerDocument.title = t('Senka Ledger')
    }, [language])
    const account = viewAccount || status.account || status.accounts[0] || ''
    const entry = service.entry(account)
    const state = entry?.state || createLedger()
    const allMonths = [...new Set([parts(Date.now(), zone).month, month, ...months(state, zone)])].sort().reverse()
    const stats = summarize(state, month, zone)
    const selected = stats.days.find(d => d.day === day) || null
    const totals = selected || stats
    const ranks = rankingSnapshot(state.rankingHistory, month)
    const own = ranks.rows.find(row => row.self)
    const rankRows = [...new Set([...ANCHORS, ...(own ? [own.rank] : [])])].sort((a, b) => a - b)
    const maxDay = Math.max(0, ...stats.days.map(d => d.normal))
    const maxHour = selected ? Math.max(0, ...selected.slots) : 0
    const timeline = selected ? selected.events.filter(e => slot === null || parts(e.at, zone).hour === slot).slice().sort((a, b) => b.at - a.at || b.id - a.id) : []
    const [start] = monthBounds(month, zone)
    const selectedStart = selected ? start + (Number(selected.day.slice(-2)) - 1) * DAY : null
    const unknown = stats.unknown.filter(e => !selected || (e.from < selectedStart + DAY && e.to >= selectedStart)).slice().sort((a, b) => b.at - a.at)
    const offset = (new Date(month + '-01T00:00:00Z').getUTCDay() + 6) % 7
    React.useEffect(() => {
      fitNumbers(root.current)
      const observer = new root.current.ownerDocument.defaultView.ResizeObserver(() => fitNumbers(root.current))
      observer.observe(root.current)
      return () => observer.disconnect()
    }, [month, day, zone, language, status, account])
    const card = (key, value, accent = false) => h('div', { className: 'card', 'data-summary': key }, h('div', { className: 'muted card-label' }, t(key)), h('div', { className: `value${accent ? ' accent' : ''}` }, fmt(value)))
    const th = labels => h('thead', null, h('tr', null, ...labels.map(key => h('th', { key }, t(key)))))
    const stamp = at => {
      const text = formatTime(at, zone)
      return h('time', { className: 'stamp', dateTime: new Date(at).toISOString() }, h('span', null, text.slice(0, 10)), h('span', null, text.slice(11)))
    }
    const back = () => { setDay(null); setSlot(null) }
    const openDay = value => { setDay(value); setSlot(null) }
    const download = type => {
      try { service.export(account, month, zone, type, language); setExportError('') } catch (error) { setExportError(error.message) }
    }
    const failure = status.error || entry?.error || exportError
    return h('div', { className: 'sl-shell', ref: root }, h('main', { className: 'sl', 'data-view': selected ? 'day' : 'month', lang: language }, h('style', null, style),
      h('div', { className: 'top' }, h('div', { className: 'brand' }, createIcon(React), h('h2', null, t('Senka Ledger'))), h('span', { className: 'tag' }, t(failure ? 'storageError' : status.account ? 'recording' : 'waiting'))),
      failure && h('p', { role: 'alert', className: 'error' }, errorText(failure, t)),
      h('div', { className: 'controls' },
        h('label', null, t('account'), h('select', { 'aria-label': t('account'), 'data-control': 'account', value: account, onChange: e => { setViewAccount(e.target.value); back() } },
          !account && h('option', { value: '' }, t('waiting')), ...status.accounts.map(id => h('option', { key: id, value: id }, id + (id === status.account ? ' · ' + t('current') : ''))))),
        h('label', null, t('month'), h('select', { 'aria-label': t('month'), 'data-control': 'month', value: month, onChange: e => { setMonth(e.target.value); back() } }, ...allMonths.map(m => h('option', { key: m }, m)))),
        h('label', null, t('timezone'), h('select', { 'aria-label': t('timezone'), 'data-control': 'zone', value: zone, onChange: e => { setZone(e.target.value); setSlot(null) } }, h('option', { value: 'Asia/Tokyo' }, t('japan')), h('option', { value: 'Asia/Shanghai' }, t('china')))),
        h('button', { disabled: !account, onClick: () => download('csv') }, t('exportCSV')),
        h('button', { disabled: !account, onClick: () => download('json') }, t('backupJSON'))),
      selected && h('div', { className: 'top section-head navigation' },
        h('button', { onClick: back, 'data-action': 'back' }, '← ' + t('back')), h('h3', null, selected.day),
        h('div', { className: 'navigation' },
          h('button', { disabled: selected === stats.days[0], onClick: () => openDay(stats.days[stats.days.indexOf(selected) - 1].day) }, t('prevDay')),
          h('button', { disabled: selected === stats.days[stats.days.length - 1], onClick: () => openDay(stats.days[stats.days.indexOf(selected) + 1].day) }, t('nextDay')))),
      h('div', { className: 'cards' }, card(selected ? 'dayTotal' : 'monthTotal', totals.total, true), card('normal', totals.normal), card('eo', totals.eo), card('quest', totals.quest)),
      h('details', { className: 'section ranking', 'aria-label': t('rankTitle') }, h('summary', { className: 'rank-summary' }, h('h3', null, t('rankTitle')), h('span', { className: 'rank-own' }, own ? `${t('rankSelf')} #${own.rank} · ${fmt(own.score)}` : t('rankPending'))),
        ranks.rows.length ? h(React.Fragment, null,
          h('div', { className: 'rank-meta' }, h('span', { className: 'rank-own' }, own ? `${t('rankSelf')} #${own.rank} · ${fmt(own.score)}` : `${t('official')} · ${t('rankPending')}`)),
          h('div', { className: 'scroll' }, h('table', { className: 'rank-table', 'data-table': 'ranking' }, th(['rankNo', 'rankScore', 'rankGap', 'rankReadAt']), h('tbody', null, ...rankRows.map(rank => {
            const row = ranks.rows.find(r => r.rank === rank)
            const gap = row && own ? row.score - own.score : null
            return h('tr', { key: rank, className: row?.self ? 'rank-own' : '' }, h('td', null, `#${rank}${row?.self ? ' · ' + t('rankSelf') : ''}`), h('td', null, row ? fmt(row.score) : '—'), h('td', null, gap === null || row.self ? '—' : `${gap > 0 ? '+' : ''}${fmt(gap)}`), h('td', null, row ? stamp(row.at) : '—'))
          }))))) : h('p', { className: 'muted empty' }, t('rankWaiting'))),
      !selected ? h('section', { className: 'section' },
        h('h3', { className: 'section-head' }, `${month} · ${t('daily')}`),
        h('div', { className: 'scroll' }, h('div', { className: 'calendar', 'aria-label': t('daily') },
          ...t('weekdays').map((s, i) => h('div', { key: i, className: 'weekday' }, s)),
          ...Array.from({ length: offset }, (_, i) => h('div', { key: `blank-${i}`, 'aria-hidden': true })),
          ...stats.days.map(d => h('button', { key: d.day, className: 'tile', 'data-day': d.day, title: `${d.day} · ${tileNumber(d.normal)}`,
            'aria-label': `${d.day} · ${t('normal')} ${tileNumber(d.normal)}`, style: tileStyle(d.normal, maxDay), onClick: () => openDay(d.day) },
            h('span', { className: 'tile-label' }, Number(d.day.slice(-2))), h('span', { className: 'tile-value' }, tileNumber(d.normal))))))) :
        h('section', { className: 'section' }, h('h3', { className: 'section-head' }, t('hourly')),
          h('div', { className: 'hours', 'aria-label': t('hourly') }, ...selected.slots.map((value, hour) => h('button', { key: hour, className: 'tile', 'data-hour': hour,
            title: `${String(hour).padStart(2, '0')}:00 · ${tileNumber(value)}`, 'aria-label': `${selected.day} ${hour}:00 · ${tileNumber(value)}`, 'aria-pressed': slot === hour,
            style: tileStyle(value, maxHour), onClick: () => setSlot(slot === hour ? null : hour) },
            h('span', { className: 'tile-label' }, `${String(hour).padStart(2, '0')}:00`), h('span', { className: 'tile-value' }, tileNumber(value))))),
          h('div', { className: 'top section section-head' }, h('h3', null, slot === null ? t('dayDetail') : t('hourDetail', { hour: `${String(slot).padStart(2, '0')}:00–${String(slot + 1).padStart(2, '0')}:00` })),
            slot !== null && h('button', { onClick: () => setSlot(null), 'data-action': 'all' }, t('viewAll'))),
          h('div', { className: 'scroll' }, h('table', { className: 'details-table', 'data-table': 'details', 'aria-label': t('dayDetail') }, th(['time', 'experience', 'senka', 'map']),
            h('tbody', null, ...timeline.slice(0, 300).map(e => h('tr', { key: e.id }, h('td', null, formatTime(e.at, zone).slice(11)), h('td', null, e.exp.toLocaleString(language)), h('td', null, fmt(e.amount)), h('td', null, battleText(e, t)))),
              !timeline.length && h('tr', null, h('td', { colSpan: 4, className: 'empty' }, t('empty')))))),
          timeline.length > 300 && h('p', { className: 'muted' }, t('shown', { count: timeline.length, limit: 300 }))),
      h('section', { className: 'section' }, h('h3', { className: 'section-head' }, t('unknown')),
        h('div', { className: 'scroll' }, h('table', { className: 'unknown-table', 'data-table': 'unknown', 'aria-label': t('unknown') }, th(['interval', 'detected', 'senka']), h('tbody', null,
          ...unknown.slice(0, 200).map(e => h('tr', { key: e.id }, h('td', null, stamp(e.from), '→', stamp(e.to)), h('td', null, stamp(e.at)), h('td', { className: 'amber' }, fmt(e.amount)))),
          !unknown.length && h('tr', null, h('td', { colSpan: 3, className: 'empty' }, t('empty')))))),
        unknown.length > 200 && h('p', { className: 'muted' }, t('shown', { count: unknown.length, limit: 200 }))),
      h('div', { className: 'foot' }, 'v0.2.0')))
  }
}
module.exports = { createPanel }
