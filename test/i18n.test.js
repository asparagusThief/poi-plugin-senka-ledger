'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { resources, translator, normalize, errorText, battleText } = require('../src/i18n')
const manifest = require('../package.json')
const { definition } = require('../src/icon')
test('all five languages have complete keys and matching interpolation variables', () => {
  const english = resources['en-US']
  for (const [language, data] of Object.entries(resources)) {
    assert.deepEqual(Object.keys(data).sort(), Object.keys(english).sort(), language)
    for (const key of Object.keys(english)) {
      assert.deepEqual(String(data[key]).match(/\{\{\w+\}\}/g), String(english[key]).match(/\{\{\w+\}\}/g), language + ':' + key)
    }
    assert.equal(data.weekdays.length, 7)
  }
})
test('follows locale variants, translates legacy details, errors and all displayed counts', () => {
  assert.equal(normalize('zh-Hant'), 'zh-TW')
  assert.equal(normalize('ja'), 'ja-JP')
  assert.equal(normalize('fr-FR'), 'en-US')
  const t = translator('en-US')
  assert.equal(battleText({ label: '7-1 节点 4 · S 胜败' }, t), '7-1 · Node 4 · S')
  assert.equal(t('shown', { count: 350, limit: 300 }), '350 records · latest 300 shown')
  assert.equal(errorText('另一个 poi 实例正在记录战果，请关闭另一实例', t), resources['en-US'].locked)
  assert.equal(errorText('记录第 4 行异常：末行写入未完成。已保留原文件并暂停写入。', t), t('corrupt', { line: 4 }))
})
test('poi active header uses the package-name ID and an original registered icon', () => {
  assert.equal(manifest.poiPlugin.id, manifest.name)
  assert.deepEqual(manifest.poiPlugin.icon, [definition.prefix, definition.iconName])
  assert.match(manifest.description, /^A local senka ledger/)
  assert.equal(manifest.poiPlugin.description, manifest.description)
  assert.equal(resources['zh-CN'][manifest.poiPlugin.name], '战果手账')
})
