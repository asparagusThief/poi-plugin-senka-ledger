'use strict'

const { parts, formatTime, monthBounds, DAY } = require('./time')
const { months, summarize } = require('./model')
const { createLedger } = require('./ledger')
const style = `
.sl{font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;padding:18px;min-width:280px;--sl-line:rgba(140,155,170,.28);color:inherit;container-type:inline-size}
.sl *{box-sizing:border-box}.sl h2{font-size:22px;margin:0;font-weight:650}.sl h3{font-size:15px;margin:0;font-weight:600}.sl p{margin:6px 0}.sl .muted{opacity:.7}.sl .top,.sl .controls,.sl .navigation{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sl .top{justify-content:space-between}.sl .tag{color:#168777;background:rgba(40,178,153,.12);padding:3px 8px;border-radius:5px}.sl .controls{margin:16px 0}.sl select,.sl button{font:inherit;color:inherit;background:transparent;border:1px solid var(--sl-line);border-radius:5px;padding:5px 9px}.sl select option{color:#172d3b;background:#f6f9fb}.sl button{cursor:pointer}.sl button:disabled{opacity:.4;cursor:default}.sl button:focus-visible,.sl select:focus-visible{outline:2px solid #16a18a;outline-offset:2px}
.sl .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.sl .card{border:1px solid var(--sl-line);border-radius:8px;padding:12px;min-width:0}.sl .value{font-size:clamp(18px,4cqi,28px);font-variant-numeric:tabular-nums;font-weight:650;overflow-wrap:anywhere}.sl .accent{color:#159985}.sl .amber{color:#c68d26}.sl .error{border:1px solid #d56b6b;padding:10px;white-space:pre-wrap}.sl .scroll{overflow:auto;max-width:100%}.sl table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}.sl th,.sl td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--sl-line);white-space:nowrap}.sl th{font-size:12px;opacity:.75;font-weight:500}.sl .section{margin-top:24px}.sl .section-head{margin-bottom:12px}.sl .calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;min-width:0}.sl .weekday{text-align:center;opacity:.65;padding:3px 0 7px}.sl .tile{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;border:1px solid transparent;border-radius:8px;min-width:0;min-height:84px;gap:6px;text-align:center;transition:box-shadow .12s}.sl .tile:hover{box-shadow:inset 0 0 0 2px rgba(22,130,111,.5)}.sl .tile[aria-pressed="true"]{outline:2px solid #c68d26;outline-offset:1px}.sl .tile-label{font-size:18px;font-weight:600;line-height:1.3;white-space:nowrap}.sl .tile-value{font-size:clamp(10px,2.8cqi,23px);font-weight:650;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.sl .hours{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.sl .hours .tile{min-height:84px}.sl .legend{display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:10px;font-size:11px;opacity:.75}.sl .swatch{display:inline-block;width:14px;height:12px;border-radius:2px}.sl .empty{padding:20px 12px;text-align:center;opacity:.65}.sl .foot{font-size:11px;opacity:.5;text-align:right;margin-top:20px}
@container(max-width:520px){.sl .calendar{gap:4px}.sl .calendar .tile{padding:4px}.sl .cards{grid-template-columns:repeat(2,minmax(0,1fr))}.sl .hours{grid-template-columns:repeat(4,minmax(0,1fr))}.sl .tile{padding:6px}.sl .hours .tile-value{font-size:18px}}
`
const colors = ['rgba(130,150,160,.13)', '#c4e9d8', '#81cdb2', '#36aa8f', '#087e70']
const fmt = n => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tileNumber = n => n.toLocaleString('zh-CN', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })
function tileStyle(value, max) {
  const level = value <= 0 ? 0 : Math.min(4, 1 + Math.floor(value / (max || 1) * 3))
  return { background: colors[level], color: level === 4 ? '#fff' : level ? '#173e36' : 'inherit' }
}
function createPanel(React, service) {
  const h = React.createElement
  return function SenkaLedgerPanel() {
    const [snapshot, setSnapshot] = React.useState(service.snapshot())
    const [zone, setZone] = React.useState('Asia/Tokyo')
    const [month, setMonth] = React.useState(parts(Date.now()).month)
    const [day, setDay] = React.useState(null)
    const [viewAccount, setViewAccount] = React.useState('')
    const [slot, setSlot] = React.useState(null)
    const [exportError, setExportError] = React.useState('')
    React.useEffect(() => service.subscribe(setSnapshot), [])
    const account = viewAccount || snapshot.account || snapshot.accounts[0] || ''
    const entry = service.entry(account)
    const state = entry?.state || createLedger()
    const allMonths = [...new Set([parts(Date.now(), zone).month, month, ...months(state, zone)])].sort().reverse()
    const stats = summarize(state, month, zone)
    const selected = stats.days.find(d => d.day === day) || null
    const totals = selected || stats
    const prefix = selected ? '当日' : '本月'
    const maxDay = Math.max(0, ...stats.days.map(d => d.normal))
    const maxHour = selected ? Math.max(0, ...selected.slots) : 0
    const timeline = selected ? selected.events.filter(e => slot === null || parts(e.at, zone).hour === slot).slice().sort((a, b) => b.at - a.at || b.id - a.id) : []
    const [start] = monthBounds(month, zone)
    const selectedStart = selected ? start + (Number(selected.day.slice(-2)) - 1) * DAY : null
    const unknown = stats.unknown.filter(e => !selected || (e.from < selectedStart + DAY && e.to >= selectedStart)).slice().sort((a, b) => b.at - a.at)
    const offset = (new Date(month + '-01T00:00:00Z').getUTCDay() + 6) % 7
    const card = (label, value, accent = false) => h('div', { className: 'card', 'data-summary': label }, h('div', { className: 'muted' }, label), h('div', { className: `value${accent ? ' accent' : ''}` }, fmt(value)))
    const th = labels => h('thead', null, h('tr', null, ...labels.map(s => h('th', { key: s }, s))))
    const back = () => { setDay(null); setSlot(null) }
    const openDay = value => { setDay(value); setSlot(null) }
    const download = type => {
      try { service.export(account, month, zone, type); setExportError('') } catch (error) { setExportError(error.message) }
    }
    const legend = h('div', { className: 'legend', 'aria-hidden': true }, '少 ', ...colors.map(c => h('span', { key: c, className: 'swatch', style: { background: c } })), ' 多')
    return h('main', { className: 'sl', 'data-view': selected ? 'day' : 'month' }, h('style', null, style),
      h('div', { className: 'top' }, h('h2', null, '战果手账'), h('span', { className: 'tag' }, snapshot.error || entry?.error ? '存储异常' : snapshot.account ? '记录中' : '等待游戏数据')),
      (snapshot.error || entry?.error || exportError) && h('p', { role: 'alert', className: 'error' }, snapshot.error || entry?.error || exportError),
      h('div', { className: 'controls' },
        h('label', null, '账号 ', h('select', { 'aria-label': '账号', value: account, onChange: e => { setViewAccount(e.target.value); back() } },
          !account && h('option', { value: '' }, '等待游戏数据'), ...snapshot.accounts.map(id => h('option', { key: id, value: id }, id + (id === snapshot.account ? ' · 当前' : ''))))),
        h('label', null, '月份 ', h('select', { 'aria-label': '月份', value: month, onChange: e => { setMonth(e.target.value); back() } }, ...allMonths.map(m => h('option', { key: m }, m)))),
        h('label', null, '时间 ', h('select', { 'aria-label': '时区', value: zone, onChange: e => { setZone(e.target.value); setSlot(null) } }, h('option', { value: 'Asia/Tokyo' }, '日本 UTC+9'), h('option', { value: 'Asia/Shanghai' }, '中国 UTC+8'))),
        h('button', { disabled: !account, onClick: () => download('csv') }, '导出本月 CSV'),
        h('button', { disabled: !account, onClick: () => download('json') }, '备份全部 JSON')),
      selected && h('div', { className: 'top section-head navigation' },
        h('button', { onClick: back, 'aria-label': '返回月览' }, '← 返回月览'), h('h3', null, selected.day),
        h('div', { className: 'navigation' },
          h('button', { disabled: selected === stats.days[0], onClick: () => openDay(stats.days[stats.days.indexOf(selected) - 1].day) }, '前一天'),
          h('button', { disabled: selected === stats.days[stats.days.length - 1], onClick: () => openDay(stats.days[stats.days.indexOf(selected) + 1].day) }, '后一天'))),
      h('div', { className: 'cards' }, card(`${prefix}战果`, totals.total, true), card('普通战果', totals.normal), card('EO 战果', totals.eo), card('任务战果', totals.quest)),
      !selected ? h('section', { className: 'section', 'aria-label': '月度战果' },
        h('h3', { className: 'section-head' }, `${month} · 每日普通战果`),
        h('div', { className: 'scroll' }, h('div', { className: 'calendar', 'aria-label': '每日战果' },
          ...['一', '二', '三', '四', '五', '六', '日'].map(s => h('div', { key: s, className: 'weekday' }, s)),
          ...Array.from({ length: offset }, (_, i) => h('div', { key: `blank-${i}`, 'aria-hidden': true })),
          ...stats.days.map(d => h('button', { key: d.day, className: 'tile', 'data-day': d.day,
            'aria-label': `${d.day} 普通战果 ${tileNumber(d.normal)}`, style: tileStyle(d.normal, maxDay), onClick: () => openDay(d.day) },
            h('span', { className: 'tile-label' }, Number(d.day.slice(-2))), h('span', { className: 'tile-value' }, tileNumber(d.normal)))))), legend) :
        h('section', { className: 'section', 'aria-label': '当日战果' },
          h('h3', { className: 'section-head' }, '每小时普通战果'),
          h('div', { className: 'hours', 'aria-label': '每小时战果' }, ...selected.slots.map((value, hour) => h('button', { key: hour, className: 'tile', 'data-hour': hour,
            'aria-label': `${selected.day} ${hour}时 普通战果 ${tileNumber(value)}`, 'aria-pressed': slot === hour,
            style: tileStyle(value, maxHour), onClick: () => setSlot(slot === hour ? null : hour) },
            h('span', { className: 'tile-label' }, `${String(hour).padStart(2, '0')}:00`), h('span', { className: 'tile-value' }, tileNumber(value))))), legend,
          h('div', { className: 'top section section-head' }, h('h3', null, slot === null ? '当日明细' : `${String(slot).padStart(2, '0')}:00–${String(slot + 1).padStart(2, '0')}:00 · 明细`),
            slot !== null && h('button', { onClick: () => setSlot(null) }, '查看全天')),
          h('div', { className: 'scroll' }, h('table', { 'aria-label': '普通战果明细' }, th(['记录时间', '提督经验', '战果', '海域']),
            h('tbody', null, ...timeline.slice(0, 300).map(e => h('tr', { key: e.id }, h('td', null, formatTime(e.at, zone).slice(11)), h('td', null, e.exp.toLocaleString()), h('td', null, fmt(e.amount)), h('td', null, e.label))),
              !timeline.length && h('tr', null, h('td', { colSpan: 4, className: 'empty' }, '暂无记录'))))),
          timeline.length > 300 && h('p', { className: 'muted' }, `共 ${timeline.length} 笔 · 显示最新 300 笔`)),
      h('section', { className: 'section' }, h('h3', { className: 'section-head' }, '未在本地记录的增量'),
        h('div', { className: 'scroll' }, h('table', { 'aria-label': '未在本地记录的增量' }, th(['可能发生区间', '发现于', '战果']), h('tbody', null,
          ...unknown.slice(0, 200).map(e => h('tr', { key: e.id }, h('td', null, `${formatTime(e.from, zone)} → ${formatTime(e.to, zone)}`), h('td', null, formatTime(e.at, zone)), h('td', { className: 'amber' }, fmt(e.amount)))),
          !unknown.length && h('tr', null, h('td', { colSpan: 3, className: 'empty' }, '暂无记录'))))),
        unknown.length > 200 && h('p', { className: 'muted' }, `共 ${unknown.length} 笔 · 显示最新 200 笔`)),
      h('div', { className: 'foot' }, 'v0.1.2'))
  }
}
module.exports = { createPanel }
