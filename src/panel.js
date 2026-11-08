'use strict'

const { parts, formatTime, monthBounds, DAY } = require('./time')
const { months, summarize } = require('./model')
const { createLedger } = require('./ledger')
const { snapshot: rankingSnapshot, ANCHORS } = require('./ranking')
const { translator, normalize, errorText, battleText } = require('./i18n')
const { bindPanel, fitNumbers } = require('./layout')
const { createIcon } = require('./icon')
const { paginate, fitPageSize, bindWheelPaging } = require('./details')
const { accountLabel } = require('./preferences')
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
    const zone = status.zone || 'Asia/Tokyo'
    const [month, setMonth] = React.useState(parts(Date.now()).month)
    const [day, setDay] = React.useState(null)
    const [viewAccount, setViewAccount] = React.useState('')
    const [slot, setSlot] = React.useState(null)
    const [detailKind, setDetailKind] = React.useState(null)
    const [detailPage, setDetailPage] = React.useState(0)
    const [pageSize, setPageSize] = React.useState(10)
    const [exportError, setExportError] = React.useState('')
    const [importing, setImporting] = React.useState(false)
    const [importResult, setImportResult] = React.useState(null)
    const root = React.useRef(null)
    const dialog = React.useRef(null)
    const dataMenu = React.useRef(null)
    const fileInput = React.useRef(null)
    const pageState = React.useRef(null)
    const titleId = React.useId()
    const language = normalize(status.language)
    const t = translator(language)
    const formats = React.useMemo(() => ({
      score: new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      tile: new Intl.NumberFormat(language, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      integer: new Intl.NumberFormat(language)
    }), [language])
    const fmt = n => formats.score.format(n)
    const tileNumber = n => formats.tile.format(n)
    React.useEffect(() => service.subscribe(setStatus), [])
    React.useEffect(() => bindPanel(root.current), [])
    React.useEffect(() => {
      const document = root.current.ownerDocument
      const dismiss = event => {
        if (!dataMenu.current?.open) return
        if (event.type === 'keydown') {
          if (event.key !== 'Escape') return
          event.preventDefault()
          dataMenu.current.open = false
          dataMenu.current.querySelector('summary').focus()
        } else if (!dataMenu.current.contains(event.target)) dataMenu.current.open = false
      }
      document.addEventListener('pointerdown', dismiss)
      document.addEventListener('keydown', dismiss)
      return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
    }, [])
    React.useEffect(() => {
      const view = root.current?.ownerDocument.defaultView
      if (view?.isWindowMode) root.current.ownerDocument.title = t('Senka Ledger')
    }, [language])
    React.useEffect(() => {
      if (detailKind && !dialog.current.open) dialog.current.showModal()
      else if (!detailKind && dialog.current.open) dialog.current.close()
    }, [detailKind])
    React.useEffect(() => {
      dialog.current?.querySelector('.dialog-body')?.scrollTo(0, 0)
    }, [detailPage, detailKind, slot])
    const account = viewAccount || status.account || status.accounts[0] || ''
    const entry = service.entry(account)
    const state = entry?.state || createLedger()
    const currentMonth = parts(Date.now(), zone).month
    const allMonths = React.useMemo(() => [...new Set([currentMonth, month, ...months(state, zone)])].sort().reverse(), [state, status, zone, month, currentMonth])
    const stats = React.useMemo(() => summarize(state, month, zone), [state, status, month, zone])
    const selected = stats.days.find(d => d.day === day) || null
    const totals = selected || stats
    const ranks = React.useMemo(() => rankingSnapshot(state.rankingHistory, month), [state, status, month])
    const own = ranks.rows.find(row => row.self)
    const rankRows = [...new Set([...ANCHORS, ...(own ? [own.rank] : [])])].sort((a, b) => a - b)
    const maxDay = Math.max(0, ...stats.days.map(d => d.normal))
    const maxHour = selected ? Math.max(0, ...selected.slots) : 0
    const timeline = React.useMemo(() => selected ? selected.events.filter(e => slot === null || parts(e.at, zone).hour === slot).slice().sort((a, b) => b.at - a.at || b.id - a.id) : [], [selected, slot, zone])
    const [start] = monthBounds(month, zone)
    const selectedStart = selected ? start + (Number(selected.day.slice(-2)) - 1) * DAY : null
    const unknown = React.useMemo(() => stats.unknown.filter(e => selectedStart === null || (e.from < selectedStart + DAY && e.to >= selectedStart)).slice().sort((a, b) => b.at - a.at), [stats, selectedStart])
    const unknownTotal = unknown.reduce((sum, e) => sum + e.amount, 0)
    const page = paginate(detailKind === 'unknown' ? unknown : timeline, detailPage, pageSize)
    pageState.current = page
    React.useEffect(() => {
      if (!detailKind) return
      const element = dialog.current
      const view = element.ownerDocument.defaultView
      let frame = null
      const update = () => { frame = null; setPageSize(fitPageSize(element)) }
      const schedule = () => { if (frame === null) frame = view.requestAnimationFrame(update) }
      // Measuring the dialog in its own ResizeObserver can feed its new page
      // size back into layout. Recalculate only on opening or viewport resize.
      view.addEventListener('resize', schedule)
      update()
      return () => { if (frame !== null) view.cancelAnimationFrame(frame); view.removeEventListener('resize', schedule) }
    }, [detailKind, language])
    React.useEffect(() => {
      if (!detailKind) return
      return bindWheelPaging(dialog.current.querySelector('.dialog-body'), () => pageState.current, setDetailPage)
    }, [detailKind])
    const offset = (new Date(month + '-01T00:00:00Z').getUTCDay() + 6) % 7
    React.useEffect(() => {
      fitNumbers(root.current)
      const view = root.current.ownerDocument.defaultView
      let width = root.current.clientWidth, frame = null
      const observer = new view.ResizeObserver(entries => {
        const next = entries[0].contentRect.width
        if (Math.abs(next - width) < 1) return
        width = next
        if (frame === null) frame = view.requestAnimationFrame(() => { frame = null; fitNumbers(root.current) })
      })
      observer.observe(root.current)
      return () => { observer.disconnect(); if (frame !== null) view.cancelAnimationFrame(frame) }
    }, [month, day, zone, language, status, account])
    const card = (key, value, accent = false) => h('div', { className: 'card', 'data-summary': key }, h('div', { className: 'muted card-label' }, t(key)), h('div', { className: `value${accent ? ' accent' : ''}` }, fmt(value)))
    const th = labels => h('thead', null, h('tr', null, ...labels.map(key => h('th', { key }, t(key)))))
    const stamp = at => {
      const text = formatTime(at, zone)
      return h('time', { className: 'stamp', dateTime: new Date(at).toISOString() }, h('span', null, text.slice(0, 10)), h('span', null, text.slice(11)))
    }
    const closeDetails = () => setDetailKind(null)
    const back = () => { setDay(null); setSlot(null); closeDetails() }
    const openDay = value => { setDay(value); setSlot(null); closeDetails() }
    const openDetails = (kind, hour = null) => { setSlot(hour); setDetailPage(0); setDetailKind(kind) }
    const download = type => {
      dataMenu.current.open = false
      try { service.export(account, month, zone, type, language); setExportError('') } catch (error) { setExportError(error.message) }
    }
    const readJSON = async event => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file || importing) return
      setImporting(true); setImportResult(null); setExportError('')
      try {
        const result = await service.import(file)
        setViewAccount(result.account)
        if (result.latestAt !== null) setMonth(parts(result.latestAt, zone).month)
        back(); setImportResult(result)
      } catch (error) { setExportError(error) }
      finally { setImporting(false) }
    }
    const storageFailure = status.error || entry?.error
    const failure = storageFailure || exportError
    const changeText = value => value === null ? '—' : `${value > 0 ? '+' : ''}${fmt(value)}`
    const detailsTitle = detailKind === 'unknown' ? t('unknown') : `${selected?.day || month} · ${slot === null ? t('dayDetail') : t('hourDetail', { hour: `${String(slot).padStart(2, '0')}:00–${String(slot + 1).padStart(2, '0')}:00` })}`
    const rankingPanel = h('details', { className: 'ranking', 'aria-label': t('rankTitle') },
      h('summary', { className: 'rank-summary' }, h('h3', null, t('rankTitle')), h('span', { className: 'rank-own' },
        own ? `${t('rankSelf')} #${own.rank} · ${fmt(own.score)}` : t('rankPending'),
        own && h('span', { className: 'rank-change', title: t('rankChange'), 'data-ranking-change': 'self' }, ` Δ ${changeText(own.change)}`))),
      ranks.rows.length ? h('div', { className: 'scroll' }, h('table', { className: 'rank-table', 'data-table': 'ranking' },
        th(['rankNo', 'rankScore', 'rankChange', 'rankGap', 'rankReadAt']), h('tbody', null, ...rankRows.map(rank => {
          const row = ranks.rows.find(r => r.rank === rank)
          const gap = row && own ? row.score - own.score : null
          return h('tr', { key: rank, className: row?.self ? 'rank-own' : '' }, h('td', null, `#${rank}${row?.self ? ' · ' + t('rankSelf') : ''}`),
            h('td', null, row ? fmt(row.score) : '—'), h('td', { 'data-ranking-change': rank }, row ? changeText(row.change) : '—'),
            h('td', null, gap === null || row.self ? '—' : changeText(gap)), h('td', null, row ? stamp(row.at) : '—'))
        })))) : h('p', { className: 'muted empty' }, t('rankWaiting')))
    return h('div', { className: 'sl-shell', ref: root }, h('main', { className: 'sl', 'data-view': selected ? 'day' : 'month', lang: language }, h('style', null, style),
      h('div', { className: 'top' }, h('div', { className: 'brand' }, createIcon(React), h('h2', null, t('Senka Ledger'))), h('span', { className: 'tag' }, t(storageFailure ? 'storageError' : status.account ? 'recording' : 'waiting'))),
      failure && h('p', { role: 'alert', className: 'error' }, errorText(failure, t)),
      h('div', { className: 'workspace' },
        h('section', { className: 'activity-pane' },
          rankingPanel,
          selected ? h('div', { className: 'top section-head navigation' },
            h('button', { onClick: back, 'data-action': 'back' }, '← ' + t('back')), h('h3', null, selected.day),
            h('div', { className: 'navigation' }, h('button', { disabled: selected === stats.days[0], onClick: () => openDay(stats.days[stats.days.indexOf(selected) - 1].day) }, t('prevDay')),
              h('button', { disabled: selected === stats.days[stats.days.length - 1], onClick: () => openDay(stats.days[stats.days.indexOf(selected) + 1].day) }, t('nextDay')))) :
            h('h3', { className: 'section-head' }, `${month} · ${t('daily')}`),
          !selected ? h('div', { className: 'scroll' }, h('div', { className: 'calendar', 'aria-label': t('daily') },
            ...t('weekdays').map((s, i) => h('div', { key: i, className: 'weekday' }, s)),
            ...Array.from({ length: offset }, (_, i) => h('div', { key: `blank-${i}`, 'aria-hidden': true })),
            ...stats.days.map(d => h('button', { key: d.day, className: 'tile', 'data-day': d.day, title: `${d.day} · ${tileNumber(d.normal)}`,
              'aria-label': `${d.day} · ${t('normal')} ${tileNumber(d.normal)}`, style: tileStyle(d.normal, maxDay), onClick: () => openDay(d.day) },
              h('span', { className: 'tile-label' }, Number(d.day.slice(-2))), h('span', { className: 'tile-value' }, tileNumber(d.normal)))))) :
            h(React.Fragment, null, h('h3', { className: 'section-head' }, t('hourly')),
              h('div', { className: 'scroll' }, h('div', { className: 'hours', 'aria-label': t('hourly') }, ...selected.slots.map((value, hour) => h('button', { key: hour, className: 'tile', 'data-hour': hour,
                title: `${String(hour).padStart(2, '0')}:00 · ${tileNumber(value)}`, 'aria-label': `${selected.day} ${hour}:00 · ${tileNumber(value)}`, 'aria-pressed': slot === hour,
                style: tileStyle(value, maxHour), onClick: () => openDetails('normal', hour) },
                h('span', { className: 'tile-label' }, `${String(hour).padStart(2, '0')}:00`), h('span', { className: 'tile-value' }, tileNumber(value)))))),
              h('button', { className: 'detail-trigger', 'data-action': 'details', onClick: () => openDetails('normal') }, t('openDetails'), ' · ', t('recordCount', { count: selected.events.length })))),
        h('aside', { className: 'summary-pane' },
          h('div', { className: 'controls' },
            h('label', null, t('account'), h('select', { 'aria-label': t('account'), 'data-control': 'account', value: account, onChange: e => { setViewAccount(e.target.value); back() } },
              !account && h('option', { value: '' }, t('waiting')), ...status.accounts.map(id => h('option', { key: id, value: id, title: id }, accountLabel(id, status.accountNames) + (id === status.account ? ' · ' + t('current') : ''))))),
            h('label', null, t('month'), h('select', { 'aria-label': t('month'), 'data-control': 'month', value: month, onChange: e => { setMonth(e.target.value); back() } }, ...allMonths.map(m => h('option', { key: m }, m)))),
            h('label', null, t('timezone'), h('select', { 'aria-label': t('timezone'), 'data-control': 'zone', value: zone, onChange: e => {
              try { service.setZone(e.target.value); setExportError(''); setSlot(null); closeDetails() } catch (error) { setExportError(error.message) }
            } }, h('option', { value: 'Asia/Tokyo' }, t('japan')), h('option', { value: 'Asia/Shanghai' }, t('china')))),
            h('details', { className: 'data-menu', ref: dataMenu, 'data-menu': 'data' },
              h('summary', { 'data-action': 'data-menu' }, t('dataMenu'), h('span', { 'aria-hidden': true }, '▾')),
              h('div', { className: 'data-actions' },
                h('button', { 'data-action': 'export-csv', disabled: !account || importing, onClick: () => download('csv') }, t('exportCSV')),
                h('button', { 'data-action': 'export-json', disabled: !account || importing, onClick: () => download('json') }, t('backupJSON')),
                h('button', { 'data-action': 'import-json', disabled: importing, onClick: () => { dataMenu.current.open = false; fileInput.current.click() } }, t('importJSON')))),
            h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-hidden': true, tabIndex: -1, ref: fileInput, 'data-control': 'import-file', onChange: readJSON })),
          (importing || importResult) && h('p', { className: 'data-message', role: 'status' }, importing ? t('importing') : t('importComplete', { account: accountLabel(importResult.account, status.accountNames), added: importResult.added, skipped: importResult.skipped })),
          h('div', { className: 'cards' }, card(selected ? 'dayTotal' : 'monthTotal', totals.total, true), card('normal', totals.normal), card('eo', totals.eo), card('quest', totals.quest)),
          h('button', { className: 'unknown-trigger', 'data-action': 'unknown', onClick: () => openDetails('unknown') },
            h('span', { className: 'unknown-heading card-label' }, t('unknown')),
            h('span', { className: 'unknown-total', 'data-summary': 'unknownTotal' }, t('total'), ' ', h('strong', { className: 'amber value' }, fmt(unknownTotal))),
            h('span', { className: 'muted' }, t('recordCount', { count: unknown.length }))))),
      h('div', { className: 'foot' }, 'v0.2.9'),
      h('dialog', { ref: dialog, className: 'detail-dialog', 'aria-labelledby': titleId, 'data-dialog': 'details', onClose: closeDetails, onCancel: closeDetails,
        onClick: event => { const box = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) closeDetails() } },
        detailKind && h(React.Fragment, null,
          h('header', { className: 'dialog-header' }, h('h3', { id: titleId }, detailsTitle), h('button', { 'data-action': 'close-details', onClick: closeDetails }, t('close'))),
          h('div', { className: 'dialog-toolbar' }, h('span', null, t('recordRange', { start: page.start, end: page.end, count: page.count })),
            detailKind === 'normal' && slot !== null && h('button', { 'data-action': 'all', onClick: () => { setSlot(null); setDetailPage(0) } }, t('viewAll'))),
          h('div', { className: 'dialog-body' }, h('table', { className: detailKind === 'unknown' ? 'unknown-table' : 'details-table', 'data-table': detailKind === 'unknown' ? 'unknown' : 'details' },
            th(detailKind === 'unknown' ? ['interval', 'detected', 'senka'] : ['time', 'experience', 'senka', 'map']), h('tbody', null,
              ...page.items.map(e => detailKind === 'unknown' ? h('tr', { key: e.id }, h('td', null, stamp(e.from), '→', stamp(e.to)), h('td', null, stamp(e.at)), h('td', { className: 'amber' }, fmt(e.amount))) :
                h('tr', { key: e.id }, h('td', null, formatTime(e.at, zone).slice(11)), h('td', null, formats.integer.format(e.exp)), h('td', null, fmt(e.amount)), h('td', null, battleText(e, t)))),
              !page.items.length && h('tr', null, h('td', { colSpan: detailKind === 'unknown' ? 3 : 4, className: 'empty' }, t('empty')))))),
          h('footer', { className: 'dialog-footer' }, h('button', { 'data-action': 'previous-page', disabled: page.page === 0, onClick: () => setDetailPage(page.page - 1) }, t('previousPage')),
            h('span', null, t('page', { page: page.page + 1, pages: page.pages })), h('button', { 'data-action': 'next-page', disabled: page.page === page.pages - 1, onClick: () => setDetailPage(page.page + 1) }, t('nextPage')))))))
  }
}
module.exports = { createPanel }
