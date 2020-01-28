import program from 'commander'
import findUp from 'find-up'
import * as path from 'path'
import { inspect } from 'util'

import Log from './log'
import { mergeInputs } from './find/find'
import { defaultConfig, rcFile } from './defaults'

import pkg from '../package.json'

const readConfig = async rcPath => {
  if (!rcPath) return
  const { default: config } = await import(rcPath)
  return {
    cwd: path.dirname(rcPath),
    ...config,
  }
}

const parseArgs = (files, { ignore, watch, cwd = process.cwd() }) => ({
  cwd,
  files,
  watch,
  ignore,
})

const parseConfig = async ({ cwd, config: configFile }) => {
  const rcPath = configFile
    ? path.resolve(cwd, configFile)
    : findUp.sync(rcFile)
  return readConfig(rcPath)
}

const parseInput = async (files, options, skipDefaults = false) => {
  const { cwd } = options
  const args = parseArgs(files, options)
  if (skipDefaults) {
    return mergeInputs(args)
  }
  const defaults = { cwd, ...defaultConfig }
  const rc = await parseConfig(options)
  return mergeInputs(defaults, rc, args)
}

const action = async (files, options) => {
  if (!options.cwd) {
    const cwd = process.cwd()
    options = { cwd, ...options }
  }
  const tty = process.env.isTTY
  const input = await parseInput(files, options, tty)
  const { init, print, watch, dump } = options
  // NOTE can be --watch --list
  if (dump) {
    const target = dump === 'options' ? { ...options } : input
    Log.log(inspect(target, { depth: null, colors: process.stdin.isTTY }))
  } else if (tty) {
    const { pipeAction } = await import('./pipe')
    return pipeAction(input, options)
  } else if (init) {
    const { init } = await import('./init')
    return init(options)
  } else if (watch) {
    const { watchAction } = await import('./zoar-watch')
    return watchAction(input, options)
  } else if (print) {
    const { listAction } = await import('./zoar-find')
    return listAction(input, options)
  } else {
    const { findAction } = await import('./zoar-find')
    return findAction(input, options)
  }
}

const multiple = (value, previous = []) => [...previous, value]

program
  .name('zoar')
  .description('run zora tests')
  .version(pkg.version)
  // targets
  .arguments('[files...]')
  .option('-i, --ignore [glob]', 'ignore pattern, can be repeated', multiple)
  // behaviour / ~commands
  .option(
    '-w, --watch [glob]',
    'enable watch mode and/or add watch pattern, can be repeated',
    multiple
  )
  .option('-p, --print', 'output list of test files instead of running them')
  // config
  .option('-c, --config <file>', '')
  // init
  .option('--init', 'create .zoarrc.js file')
  .option('--force', 'force overwritting of existing .zoarrc.js by --init')
  // debugging
  .option('--inspect', 'pass --inspect flag to node')
  .option('--inspect-brk', 'pass --inspect-brk to node')
  .option('--map', 'enable node source map support', false)
  .option('--no-map', 'disable node source map support')
  // advanced
  // .option('--esm', 'import test files with esm', true)
  .option('--no-esm', 'disable esm support for test files')
  // very advanced
  // .option('--cwd', 'force another working directory')
  .option(
    '--watch-filenames',
    'allow filenames as watch targets (disabled by default to protect against unintentionnal glob expension by shell)',
    false
  )
  // diagnostic
  .option('--dump [what=input]', 'dump config for debug')
  // action
  .action(action)
  .passCommandToAction(false)
  .parseAsync(process.argv)
  .catch(err => {
    // eslint-disable-next-line no-console
    console.error((err && err.stack) || err)
  })
