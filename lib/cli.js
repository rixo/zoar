import * as path from 'path'
import * as child_process from 'child_process'
import * as Yargs from 'yargs'

import { defaultFilePattern, defaultIgnore } from './defaults'
import Log from './log'

const cwd = process.cwd()

const run = async args => {
  const {
    ignore,
    patterns: filePatternArg,
    only = false,
    inspect = false,
    inspectBrk = false,
    watch: isWatch = false,
  } = args

  let cancelLast = null

  const launch = () => {
    if (cancelLast && !cancelLast()) {
      throw new Error('Staled test run')
    }

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

      cancelLast = () => {
        if (child.exitCode === null) {
          return child.kill()
        } else {
          return true
        }
      }
    }).finally(() => {
      cancelLast = null
    })
  }

  // allow initialisation of watch in parallel of first run (also, we want
  // to output the "Watching..." messages before result of tests...)
  let watchPromise

  if (isWatch) {
    const { watch } = await import('./watch')
    watchPromise = watch({ cwd, launch }, args)
  }

  await launch()

  if (watchPromise) {
    await watchPromise
  }
}

const init = async args => {
  const { init } = await import('./init')
  await init({ cwd }, args)
}

const onFail = (msg, err) => {
  if (msg) {
    Log.log(msg)
  }
  if (err) {
    if (err.isUserError) {
      Log.log(err.message)
    } else {
      Log.error((err && err.stack) || err)
      process.exit(1)
    }
  }
  process.exit(255)
}

const applyLogLevel = ({ verbose }) => {
  Log.setLevel(Log.LOG + verbose)
}

Yargs
  //
  .strict()
  .detectLocale(false)
  .parserConfiguration({
    'strip-aliased': true,
  })
  .wrap(Math.min(100, Yargs.terminalWidth()))
  .demandCommand(1, 1)
  .command({
    command: 'init',
    desc: 'Create .zoarrc.js',
    builder: yargs =>
      yargs
        .options('force', {
          desc: 'Will overwrite rc file if it already exists',
          alias: 'f',
          global: false,
          type: 'boolean',
        })
        .group(['force'], 'Options:')
        .group(['verbose', 'help', 'version'], 'Infos:'),
    handler: init,
  })
  .command({
    command: ['run [patterns...]', '$0'],
    desc: 'Run tests',
    handler: run,
    builder: yargs =>
      yargs
        .option('watch', {
          alias: 'w',
          description: 'Watch mode',
          global: false,
          nargs: 0,
        })
        .option('ignore', {
          description: 'File pattern(s) to be ignored',
          alias: 'i',
          global: false,
          type: 'string',
          requiresArg: true,
          default: defaultIgnore,
        })
        .option('only', {
          description: 'Allow only/focus in your tests',
          global: false,
          type: 'boolean',
        })
        .option('inspect', {
          description: 'Pass --inspect flag to node',
          global: false,
          type: 'boolean',
        })
        .option('inspect-brk', {
          description: 'Pass --inspect-brk flag to node',
          global: false,
          type: 'boolean',
        })
        .conflicts('inspect', 'inspect-brk')
        .group(['ignore', 'only'], 'Options:')
        .group(['inspect', 'inspect-brk'], 'Debug:')
        .group(['verbose', 'help', 'version'], 'Infos:'),
  })
  .options('verbose', {
    alias: 'v',
    desc: 'More logs',
    count: true,
  })
  .middleware(applyLogLevel)
  .alias({ help: 'h' })
  .fail(onFail)
  .parse()
