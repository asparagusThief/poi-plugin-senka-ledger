'use strict'

function paginate(records, requestedPage = 0, pageSize = 10) {
  const pages = Math.max(1, Math.ceil(records.length / pageSize))
  const page = Math.max(0, Math.min(pages - 1, Math.trunc(requestedPage) || 0))
  const offset = page * pageSize
  return { items: records.slice(offset, offset + pageSize), page, pages, count: records.length,
    start: records.length ? offset + 1 : 0, end: Math.min(records.length, offset + pageSize) }
}
function fitPageSize(dialog) {
  const row = dialog.querySelector('tbody tr')
  if (!row || row.querySelector('.empty')) return 10
  const fixed = [...dialog.querySelectorAll('.dialog-header,.dialog-toolbar,.dialog-footer,thead')].reduce((sum, el) => sum + el.getBoundingClientRect().height, 0)
  const rowHeight = Math.max(...[...dialog.querySelectorAll('tbody tr')].map(el => el.getBoundingClientRect().height))
  const body = dialog.querySelector('.dialog-body')
  const available = dialog.ownerDocument.defaultView.innerHeight - 24 - fixed - (body.offsetHeight - body.clientHeight) - 4
  return Math.max(1, Math.min(10, Math.floor(available / (rowHeight || 1))))
}
function bindWheelPaging(body, getPage, setPage) {
  if (!body) return () => {}
  let distance = 0, direction = 0, lastEvent = -Infinity, lastTurn = -Infinity
  const onWheel = event => {
    if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    const state = getPage()
    if (state.pages <= 1) return
    const step = Math.sign(event.deltaY)
    const canScroll = step > 0 ? body.scrollTop + body.clientHeight < body.scrollHeight - 2 : body.scrollTop > 1
    if (canScroll) { distance = 0; return }
    event.preventDefault()
    const time = event.timeStamp
    if (time - lastEvent > 200 || step !== direction) distance = 0
    lastEvent = time
    direction = step
    if (time - lastTurn < 300) return
    distance += Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? body.clientHeight : 1)
    if (distance < 60) return
    distance = 0
    const next = Math.max(0, Math.min(state.pages - 1, state.page + step))
    if (next !== state.page) { lastTurn = time; setPage(next) }
  }
  body.addEventListener('wheel', onWheel, { passive: false })
  return () => body.removeEventListener('wheel', onWheel)
}
module.exports = { paginate, fitPageSize, bindWheelPaging }
