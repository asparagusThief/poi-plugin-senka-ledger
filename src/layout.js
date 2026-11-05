'use strict'

function bindPanel(root) {
  if (!root) return () => {}
  const view = root.ownerDocument.defaultView
  const host = root.closest('.poi-app-tabpane') || root.parentElement
  const update = () => {
    const top = root.getBoundingClientRect().top
    const bottom = host?.getBoundingClientRect().bottom || view.innerHeight
    const height = Math.max(0, Math.floor(Math.min(bottom, view.innerHeight) - top))
    if (root.style.height !== height + 'px') root.style.height = height + 'px'
  }
  const resize = new view.ResizeObserver(update)
  if (host) resize.observe(host)
  view.addEventListener('resize', update)
  update()
  return () => { resize.disconnect(); view.removeEventListener('resize', update) }
}
function fitNumbers(root) {
  if (!root) return
  const view = root.ownerDocument.defaultView
  const calendar = root.querySelector('.calendar')
  if (calendar) {
    const context = root.ownerDocument.createElement('canvas').getContext('2d')
    const gap = parseFloat(view.getComputedStyle(calendar).columnGap) || 0
    let required = 280
    for (const el of calendar.querySelectorAll('.tile-value')) {
      const tile = view.getComputedStyle(el.parentElement)
      context.font = '650 12px ' + view.getComputedStyle(el).fontFamily
      const cell = context.measureText(el.textContent).width + parseFloat(tile.paddingLeft) + parseFloat(tile.paddingRight) + 2
      required = Math.max(required, cell * 7 + gap * 6)
    }
    calendar.style.minWidth = Math.ceil(required) + 'px'
  }
  for (const el of root.querySelectorAll('.tile-value')) {
    el.style.fontSize = ''
    let size = parseFloat(view.getComputedStyle(el).fontSize)
    while (size > 8 && el.scrollWidth > el.clientWidth + 1) { size--; el.style.fontSize = size + 'px' }
  }
}
module.exports = { bindPanel, fitNumbers }
