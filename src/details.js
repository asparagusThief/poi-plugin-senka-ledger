'use strict'

function paginate(records, requestedPage = 0, pageSize = 50) {
  const pages = Math.max(1, Math.ceil(records.length / pageSize))
  const page = Math.max(0, Math.min(pages - 1, Math.trunc(requestedPage) || 0))
  const offset = page * pageSize
  return { items: records.slice(offset, offset + pageSize), page, pages, count: records.length,
    start: records.length ? offset + 1 : 0, end: Math.min(records.length, offset + pageSize) }
}
module.exports = { paginate }
