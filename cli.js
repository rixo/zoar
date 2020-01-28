#!/usr/bin/env node

if (process.argv.includes('--map')) {
  // require('source-map-support').install()
}

require('./dist/zoar.js')
