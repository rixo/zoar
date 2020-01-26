#!/usr/bin/env node

if (process.stdin.isTTY) {
  require('./dist/zoar.js')
} else {
  const esm = require('esm')
  esm(module)('./lib/pipe.run')
}
