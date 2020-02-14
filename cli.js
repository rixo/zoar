#!/usr/bin/env node

const hasMap = process.argv
  .slice(2)
  .some(arg => arg === '--map' || /^-[a-z]*m[a-z]*$/.test(arg))

if (hasMap) {
  require('source-map-support').install()
}

require('./dist/zoar.js')
