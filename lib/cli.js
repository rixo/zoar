import * as fs from 'fs'
import * as path from 'path'
import * as child_process from 'child_process'
import * as Yargs from 'yargs'
import findUp from 'find-up'

import { rcFile, defaultFilePattern, defaultIgnore } from './defaults'
import Log from './log'

const run = async args => {
  const {
    cwd,
    ignore,
    files: filePatternArg,
    only = null,
    inspect = false,
    inspectBrk = false,
    watch: isWatch = false,
  } = args

  let cancelLast = null

  const filePattern =
    filePatternArg && filePatternArg.length > 0
      ? filePatternArg
      : defaultFilePattern

  const launch = () =>
    new Promise((resolve, reject) => {
      if (cancelLast && !cancelLast()) {
        throw new Error('Staled test run')
      }
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
      child.send({
        type: 'start',
        filePattern,
        ignore,
        only: only || (isWatch && only !== false),
        cwd,
      })
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

  // allow initialisation of watch in parallel of first run (also, we want
  // to output the "Watching..." messages before result of tests...)
  const inits = []

  if (isWatch) {
    inits.push(async () => {
      const { runWatch } = await import('./watch')
      return runWatch({ cwd, launch }, args)
    })
  }

  inits.push(launch)

  await Promise.all(inits.map(fn => fn()))
}

const init = async args => {
  const { init } = await import('./init')
  await init(args)
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

const runDump = args => {
  if (args.dump) {
    Log.log(JSON.stringify(args, false, 2))
    process.exit()
  }
}

const mergeWatchDefaults = argv => {
  const { watch, watchDefaults = {} } = argv
  const isWatch = watch || (watch !== false && watchDefaults.enabled !== false)
  if (!isWatch) {
    argv.watch = false
  } else {
    argv.watch = { ...watchDefaults, ...watch }
    delete argv.watch.enabled
  }
  // delete argv.watchDefaults
  delete argv['watch-defaults']
  return {}
}

const readConfig = () => {
  const configPath = findUp.sync(rcFile)
  if (!configPath) return
  const { watch, ...config } = require(configPath).default
  return { watchDefaults: watch, ...config }
}

const config = readConfig()

const epilogue = fs.readFileSync(
  path.resolve(__dirname, 'epilogue.txt'),
  'utf8'
)

Yargs
  // config
  .config(config)
  //
  .strict()
  .detectLocale(false)
  .parserConfiguration({
    'strip-aliased': true,
  })
  .wrap(Math.min(100, Yargs.terminalWidth()))
  .alias({ help: 'h' })
  // behaviour
  .middleware([applyLogLevel, mergeWatchDefaults, runDump])
  .fail(onFail)
  .demandCommand(1, 1)
  // help
  .epilogue(epilogue)
  // commands
  .command({
    command: 'init [target]',
    desc: 'Create .zoarrc.js',
    builder: yargs =>
      yargs
        .strict(false)
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
    command: ['run [files...]', '$0'],
    desc: 'Run tests',
    handler: run,
    builder: yargs =>
      yargs
        .option('watchDefaults', {
          global: false,
          hidden: true,
        })
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
        .group(['watch', 'only', 'ignore', 'cwd'], 'Options:')
        .group(['inspect', 'inspect-brk'], 'Debug:')
        .group(['verbose', 'help', 'version'], 'Infos:'),
  })
  // options
  .options('verbose', {
    alias: 'v',
    desc: 'More logs',
    count: true,
  })
  .options('cwd', {
    hidden: true,
    description: 'Base working directory for resolving paths and patterns',
    default: process.cwd(),
  })
  // internal options
  .options('dump', {
    hidden: true,
    description: 'Dumps parsed config and exit',
  })
  // run
  .parse()
