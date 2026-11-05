'use strict'

// Original notebook, bookmark and tally design; shared by the SVG and poi icon.
const iconPath = 'M16 4H48A8 8 0 0 1 56 12V52A8 8 0 0 1 48 60H16A8 8 0 0 1 8 52V12A8 8 0 0 1 16 4ZM18 10A4 4 0 0 0 14 14V50A4 4 0 0 0 18 54H46A4 4 0 0 0 50 50V14A4 4 0 0 0 46 10H18ZM34 4H44V26L39 22L34 26V4ZM21 30H43V34H21ZM21 40H25V47H21ZM29 38H33V47H29ZM37 36H41V47H37Z'
const definition = { prefix: 'fas', iconName: 'senka-ledger', icon: [64, 64, [], 'e620', iconPath] }
function register(library) { library.add(definition) }
function createIcon(React, props = {}) {
  return React.createElement('svg', { viewBox: '0 0 64 64', fill: 'currentColor', 'aria-hidden': true, ...props }, React.createElement('path', { d: iconPath, fillRule: 'nonzero' }))
}
module.exports = { iconPath, definition, register, createIcon }
