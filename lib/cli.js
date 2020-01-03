import * as path from 'path'
import * as child_process from 'child_process'
import * as Yargs from 'yargs'

import { defaultFilePattern, defaultIgnore } from './defaults'

const cwd = process.cwd()

const run = async args => {
  const {
    // _: filePatternArg,
    // '--ignore': ignore = [
    //   '**/node_modules',
    //   // '**/node_modules/**',
    //   '**/.*',
    //   // '**/.*/**',
    // ],
    '--watch-dir': watchDirs,
    '--watch-pattern': watchPattern,
    // '--watch': isWatch = !!watchDirs,
    // '--only': only = false,
    // ['--no-esm']: noESM = false,
    // ['--reporter']: reporter = 'default',
    // ['--help']: help,

    ignore,
    patterns: filePatternArg,
    // cwd,
    only = false,
    inspect = false,
    inspectBrk = false,
    watch: isWatch = false,
  } = args

  const launch = () => {
    const filePattern =
      filePatternArg && filePatternArg.length > 0
        ? filePatternArg
        : defaultFilePattern
    return new Promise((resolve, reject) => {
      const args = []
      const execArgv = []
      const options = {
        execArgv: [],
      }
      // --inspect --inspect-brk
      if (inspect) {
        execArgv.push('--inspect')
      } else if (inspectBrk) {
        execArgv.push('--inspect-brk')
      }
      const modulePath = path.resolve(__dirname, 'run.cjs')
      const child = child_process.fork(modulePath, args, options)
      child.send({ type: 'start', filePattern, ignore, only, cwd })
      child.on('message', m => {
        const { type } = m
        switch (type) {
          case 'done':
            child.disconnect()
            resolve(m)
            break

          case 'error':
            child.disconnect()
            reject(new Error(m.error))
            break

          default:
            throw new Error('Invalid message type: ' + type)
        }
      })
    })
  }

  await launch()

  if (isWatch) {
    const { watch } = await import('./watch')
    await watch({ cwd, launch }, args)
  }
}

const init = async () => {
  const { init } = await import('./init')
  await init({ cwd })
}

Yargs.detectLocale(false) // xx
  .demandCommand(1, 1)
  .command({
    command: 'init',
    desc: 'Create .zoarrc.js',
    handler: init,
  })
  .command({
    command: ['run [patterns...]', '$0'],
    desc: false,
    handler: run,
    builder: yargs => yargs.conflicts('inspect', 'inspect-brk'),
  })
  // .command({
  //   command: ['watch [patterns...]', '--watch'],
  //   desc: 'Watch FS and run tests on change',
  //   handler: watch,
  // })
  .option('watch', {
    description: 'Watch mode',
    global: true,
    type: 'boolean',
  })
  .option('ignore', {
    description: 'File pattern(s) to be ignored',
    alias: 'i',
    global: true,
    type: 'string',
    requiresArg: true,
    default: defaultIgnore,
  })
  .option('only', {
    description: 'Allow only/focus in your tests',
    global: true,
    type: 'boolean',
  })
  .option('inspect', {
    description: 'Pass --inspect flag to node',
    global: true,
    type: 'boolean',
  })
  .option('inspect-brk', {
    description: 'Pass --inspect-brk flag to node',
    global: true,
    type: 'boolean',
  })
  .group(['ignore', 'only'], 'Options:')
  .group(['inspect', 'inspect-brk'], 'Debug:')
  .group(['help', 'version'], 'Infos:')
  .alias({ help: 'h', version: 'v' })
  // .onFinishCommand(result => {})
  .fail((msg, err) => {
    if (msg) {
      // eslint-disable-next-line no-console
      console.log(msg)
    }
    if (err) {
      // eslint-disable-next-line no-console
      console.error((err && err.stack) || err)
      process.exit(1)
    }
    process.exit(255)
  })
  .parse()
