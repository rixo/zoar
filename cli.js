#!/usr/bin/env node

const runner = process.stdin.isTTY ? './dist/zoar.js' : './dist/pipe.run.js'

require(runner)
