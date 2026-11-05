'use strict'

const fs = require('fs')
const { execFileSync } = require('child_process')

if (!process.env.npm_execpath) throw new Error('Run this script with npm run pack:local')
fs.mkdirSync('dist', { recursive: true })
execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--cache', '.npm-cache', '--pack-destination', 'dist'], { stdio: 'inherit' })
