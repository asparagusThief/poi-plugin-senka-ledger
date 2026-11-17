'use strict'

// Captured clearitemget samples: api_type 18 is ranking points and api_count
// is the point value itself; api_item is null. No item-ID mapping is needed.
// https://kcrdb.hitomaru.dev/quests?state=0,1&sort=api_no&extend=clearItems
function integer(value) {
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}
function questReward(body) {
  if (!body || !Array.isArray(body.api_bounus)) return null
  if (body.api_result !== undefined && integer(body.api_result) !== 1) return null
  let amount = 0
  for (const entry of body.api_bounus) {
    if (entry === null) continue
    if (typeof entry !== 'object' || Array.isArray(entry)) return null
    const type = integer(entry.api_type)
    if (type === null) return null
    if (type !== 18) continue
    const reward = integer(entry.api_count)
    // Save a total only if every ranking-point item has a valid value.
    if (reward === null || reward === 0 || !Number.isSafeInteger(amount + reward)) return null
    amount += reward
  }
  return amount > 0 ? amount : null
}
module.exports = { questReward }
