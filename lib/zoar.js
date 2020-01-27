import program from 'commander'
import findUp from 'find-up'
import * as path from 'path'
import { inspect } from 'util'

import Log from './log'
import { mergeInputs } from './find/find'
import { rcFile } from './defaults'

import pkg from '../package.json'

const readConfig = async () => {
  const rcPath = findUp.sync(rcFile)
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

const action = async (files, options) => {
  const rc = await readConfig()
  const input = mergeInputs(rc, parseArgs(files, options))
  const { init, print, watch, dump } = options
  // NOTE can be --watch --list
  if (dump) {
    Log.log(inspect(input, { depth: null, colors: process.stdin.isTTY }))
  } else if (init) {
    const { init } = await import('./init')
    return init({
      cwd: process.cwd(),
      ...options,
    })
  } else if (watch) {
    const { watchAction } = await import('./zoar-watch')
    return watchAction(input, options)
  } else if (print) {
    const { listAction } = await import('./zoar-find')
    return listAction(input, options)
  } else {
    const { runAction } = await import('./run')
    return runAction(input, options)
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
  .option('--init', 'create .zoarrc.js file')
  .option('--force', 'force overwritting of existing .zoarrc.js by --init')
  // debugging
  .option('--inspect', 'pass --inspect flag to node')
  .option('--inspect-brk', 'pass --inspect-brk to node')
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
  .option('--dump', 'dump config for debug')
  // action
  .action(action)
  .parseAsync(process.argv)
  .catch(err => {
    // eslint-disable-next-line no-console
    console.error((err && err.stack) || err)
  })
