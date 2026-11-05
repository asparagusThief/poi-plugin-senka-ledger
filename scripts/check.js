'use strict'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
for (const name of ['index.js', ...fs.readdirSync('src').filter(n => n.endsWith('.js')).map(n => path.join('src', n))]) {
  execFileSync(process.execPath, ['--check', name], { stdio: 'inherit' })
}
