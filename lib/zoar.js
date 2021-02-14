import findUp from 'find-up'
import * as path from 'path'

import Log from './log'
import { mergeInputs } from './find/find'
import { rcFile, defaultConfig } from './defaults'
import { UserError, filterDumpOptions, parseEnv } from './util'
import * as fsp from './util/fsp'
import program from './program/command'

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

const merge = (...sources) => {
  const result = { ...sources.shift() }
  for (const source of sources) {
    if (!source) continue
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined || result[key] === undefined) {
        result[key] = value
      }
    }
  }
  return result
}

const mapCliOptions = ({ W, watch, ...options }) => ({
  ...options,
  watch: watch || W || false,
})

const parseInput = async (files, cliOptions, skipDefaults = false) => {
  const options = mapCliOptions(cliOptions)
  const { cwd } = options
  const args = parseArgs(files, options)
  if (skipDefaults) {
    return {
      options: { ...program.defaults, ...options },
      input: mergeInputs(args),
    }
  }
  const rc = await parseConfig(options)
  const defaults = merge(program.defaults, { cwd, ...defaultConfig }, rc)
  return {
    options: merge(defaults, options),
    input: mergeInputs(defaults, args),
  }
}

const isPipedIn = async () => {
  try {
    const stats = await fsp.fstat(0)
    return stats.isFIFO()
  } catch (err) {
    // crash with this error in some cases, on Windows
    // https://github.com/nodejs/node/issues/19831
    if (err && err.code === 'EISDIR') {
      return false
    }
    throw err
  }
}

const action = async (files, cliOptions) => {
  if (!cliOptions.cwd) {
    const cwd = process.cwd()
    cliOptions = { cwd, ...cliOptions }
  }
  const pipedIn = await isPipedIn()
  const { input, options } = await parseInput(files, cliOptions, pipedIn)
  if (options.only == null) {
    options.only = !!options.watch
  }
  const { init, watch, dump: dumpArg, options: opts } = options
  let result = null
  const dump = dumpArg || (opts && 'options')
  if (dump && (dump === true || dump === 'options' || dump === 'input')) {
    const target = dump === 'options' ? filterDumpOptions(options) : input
    Log.inspect(target)
  } else if (pipedIn) {
    const { pipeAction } = await import('./pipe')
    result = await pipeAction(input, options)
  } else if (init) {
    const { init } = await import('./init')
    return init(options)
  } else if (watch) {
    const { watchAction } = await import('./watch')
    return watchAction(input, options)
  } else {
    const { actionRunner } = await import('./action')
    const runAction = actionRunner({
      input,
      options,
      footer: false,
      // if child process exits before returning result, exit with same code as
      // child process
      exit: true,
    })
    result = await runAction()
  }
  if (result && !result.pass) {
    process.exit(1)
  }
}

const multiple = (value, previous = []) => [...previous, value]

const parseEnvArg = (input, previous = {}) => {
  if (!input) {
    throw new Error(`Invalid --env: ${input} (expected: NAME=value)`)
  }
  const [name, value] = parseEnv(input)
  return { ...previous, [name]: value }
}

const enumMap = (option, spec) => {
  const values = spec.split('|')
  return value => {
    const valid = values.includes(value)
    if (!valid) {
      Log.error(
        `Invalid value received for option ${option}: ${value}. (accepts ${spec})`
      )
      process.exit(254)
    }
    return value
  }
}

program
  .name('zoar')
  .description('Run zorax tests')
  .version(pkg.version)
  // targets
  .arguments('[files...]')
  .option(
    '-i, --ignore <glob>',
    'ignore pattern, can be repeated',
    ['**/node_modules', '**/.git'],
    multiple
  )
  // behaviour / ~commands
  .option('-w', 'enable watch mode')
  .option(
    '-ww, --watch [glob]',
    'enable watch mode and/or add watch pattern, can be repeated',
    multiple
  )
  .option('--no-interactive', 'disable interactive cli (during watch)')
  .option('-l, --ls', 'output list of test files instead of running them')
  .option('-p, --print', 'output test titles instead of running them')
  .option('--no-print-compact', "don't use compact formatting for print")
  .option(
    '--pipe <cmd...>',
    'pipe output to other command(s)\nNOTE: --pipe takes precedence over ' +
      'more specific flags (like --pipe.ls)',
    multiple
  )
  // useful for .rc
  .option(
    '--pipe.run <cmd...>',
    'pipe run output to other command(s)',
    multiple
  )
  .option('--pipe.ls <cmd...>', 'pipe ls output to other command(s)', multiple)
  .option(
    '--pipe.print <cmd...>',
    'pipe print output to other command(s)',
    multiple
  )
  .option(
    '--pipe.print <cmd...>',
    'pipe print output to other command(s)',
    multiple
  )
  // pipes: only useful in interactive
  .option('--no-pipes', 'skip pipes (only useful in watch interactive cli)')
  // filters
  .option('-f, --filter <pattern>', 'filter test files', multiple)
  .option(
    '-g, --grep <pattern>',
    'filter main tests by title, can be repeated',
    multiple
  )
  // env
  .option('-e, --env <assignment>', 'set env variable KEY=VALUE', parseEnvArg)
  // config
  .option('-c, --config <file>', 'speficy location of zoar config file')
  // reporter
  .option('--json', 'raw JSON reporter')
  .option('--tap', 'outputs TAP')
  .option('--indent', 'indent TAP output', true)
  .option('--no-indent', "don't indent TAP output")
  // init
  .option('--init', 'create .zoarrc.js file')
  .option('--force', 'force overwritting of existing .zoarrc.js by --init')
  // debugging
  .option('--only', 'enable only mode (default: true if watch mode)')
  .option('--no-only', 'disable only mode')
  .option('--inspect', 'pass --inspect flag to node')
  .option('-b, --inspect-brk', 'pass --inspect-brk to node')
  .option('-m, --map', 'enable node source map support')
  .option('--no-map', 'disable node source map support')
  // advanced
  .option('-z, --zorax <file>', 'use custom zorax harness')
  .option('--esm', 'enable esm support for test files', true)
  .option('--no-esm', 'disable esm support for test files')
  .option('--watch-debounce <delay>', 'watch debounce delay', 20)
  .option(
    '--no-persist-history',
    'prevent writing history to ~/.zoar_repl_history'
  )
  .option(
    '--exit [code]',
    'exit the test process after after tests completion',
    false
  )
  // very advanced
  // .option('--cwd', 'force another working directory')
  .option(
    '--watch-filenames',
    'allow filenames as watch targets (beware of unintentionnal glob ' +
      'expansion in shell!)',
    false
  )
  // diagnostic
  .option(
    '--dump [what=config]',
    'dump config or slice of state for debug (what: input|options|watch)',
    enumMap('--dump', 'input|options|watch')
  )
  .option('--opts, --options', 'dump options for debug')

// run
program
  .action(action)
  .parseAsync(process.argv)
  .catch(err => {
    if (UserError.test(err)) {
      Log.error(err.message)
      process.exit(255)
    } else {
      Log.error((err && err.stack) || err)
    }
  })
