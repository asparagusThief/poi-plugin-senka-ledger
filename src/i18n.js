'use strict'

const resources = {
  'en-US': require('../i18n/en-US.json'), 'zh-CN': require('../i18n/zh-CN.json'),
  'zh-TW': require('../i18n/zh-TW.json'), 'ja-JP': require('../i18n/ja-JP.json'), 'ko-KR': require('../i18n/ko-KR.json')
}
const namespace = 'poi-plugin-senka-ledger'
function normalize(language = 'en-US') {
  const value = language.toLowerCase().replace('_', '-')
  if (/^zh-(tw|hk|hant)/.test(value)) return 'zh-TW'
  if (value.startsWith('zh')) return 'zh-CN'
  if (value.startsWith('ja')) return 'ja-JP'
  if (value.startsWith('ko')) return 'ko-KR'
  return 'en-US'
}
function translator(language) {
  const data = resources[normalize(language)]
  return (key, values = {}) => {
    const value = data[key] ?? resources['en-US'][key] ?? key
    return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? '')) : value
  }
}
function errorText(error, t) {
  const message = error?.message || String(error || '')
  if (message.startsWith('import')) return t(message, error?.values)
  if (message.startsWith('存储锁无效')) return t('invalidLock')
  if (message.startsWith('另一个 poi')) return t('locked')
  if (message === 'Invalid account') return t('invalidAccount')
  if (message === '存储尚未初始化') return t('storageNotReady')
  const corrupt = message.match(/^记录第 (\d+) 行异常：/)
  if (corrupt) return t('corrupt', { line: corrupt[1] })
  if (message.startsWith('保存失败，已暂停写入：')) return t('saveFailed', { message: message.split('：').slice(1).join('：') })
  return message
}
function battleText(event, t) {
  if (event.activity === 'expedition') return t('expedition')
  if (event.activity === 'practice') return t('practice') + (event.rank ? ' · ' + event.rank : '')
  const legacy = event.label?.match(/^(\d+-\d+|海域未知)(?: 节点 (\d+))? · ([A-Z?]+) 胜败$/)
  const map = event.mapId != null ? `${Math.floor(event.mapId / 10)}-${event.mapId % 10}` : legacy?.[1] !== '海域未知' && legacy?.[1] || t('unknownMap')
  const node = event.node ?? legacy?.[2]
  const rank = event.rank || legacy?.[3]
  return `${map}${node != null ? ' · ' + t('node', { node }) : ''}${rank ? ' · ' + rank : ''}`
}
function bonusText(event, t) {
  if (event.kind === 'eo') {
    const map = event.mapId == null ? t('unknownMap') : `${Math.floor(event.mapId / 10)}-${event.mapId % 10}`
    return `${map} · ${t('eoKind')}`
  }
  return `${t('questKind')}${event.questId == null ? '' : ' #' + event.questId}`
}
module.exports = { resources, namespace, normalize, translator, errorText, battleText, bonusText }
