import * as fs from 'fs'
import * as path from 'path'
import * as child_process from 'child_process'
import * as Yargs from 'yargs'
import findUp from 'find-up'

import {
  rcFile,
  defaultIgnore,
  defaultWatchDirs,
  defaultWatchPattern,
} from './defaults'
import Log from './log'

const defaultWatch = {
  enabled: false,
  dirs: defaultWatchDirs,
  files: defaultWatchPattern,
}

const run = async args => {
  const {
    cwd,
    projectCwd,
    ignore,
    files,
    only = null,
    inspect = false,
    inspectBrk = false,
    watch: isWatch = false,
    zorax,
  } = args

  let cancelLast = null

  const launch = () =>
    new Promise((resolve, reject) => {
      if (cancelLast && !cancelLast()) {
        throw new Error('Staled test run')
      }
      const args = []
      const execArgv = []
      const env = {}
      const options = { execArgv, env }
      // --zorax
      if (zorax) {
        env.ZORAX = 1
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
        files,
        ignore,
        only: only || (isWatch && only !== false),
        cwd,
        projectCwd,
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

      child.on('exit', () => {
        resolve()
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

const toArray = x => (Array.isArray(x) ? x : [x])

const maybeGlobalPattern = v =>
  Array.isArray(v) ? v.filter(x => typeof x === 'string') : v

const pruneWatch = o => {
  const keys = ['dirs', 'files']
  for (const key of keys) {
    if (o[key] && o[key].length === 0) {
      delete o[key]
    }
  }
  return o
}

const doNormalizeWatch = v => {
  // console.log('coerce', v)
  const type = Array.isArray(v) ? 'array' : typeof v
  switch (type) {
    case 'boolean':
      return { enabled: v }
    case 'string':
      return { dirs: [v] }
    case 'array':
      return v.map(normalizeWatch).reduce(
        (result, { enabled, dirs, files }) => {
          if (enabled != null) {
            result.enabled = enabled
          }
          if (dirs && dirs.length > 0) {
            result.dirs.push(...dirs)
          }
          if (files && files.length > 0) {
            result.files.push(...files)
          }
          return result
        },
        { enabled: false, dirs: [], files: [] }
      )
    case 'object': {
      const { d, dir, dirs: vdirs, f, file, files: vfiles, ...rest } = v
      const dirs = [d, dir, vdirs].filter(Boolean).flat()
      const files = [f, file, vfiles].filter(Boolean).flat()
      return { ...rest, dirs, files }
    }
  }
  return {
    enabled: false,
    dirs: toArray(defaultWatchDirs),
    files: defaultWatchPattern,
  }
}

const normalizeWatch = (...args) => pruneWatch(doNormalizeWatch(...args))

const mergeRcConfig = argv => {
  // cwd
  if (!argv.cwd) argv.cwd = process.cwd()
  if (!argv.projectCwd) argv.projectCwd = argv.cwd
  // watch
  const { watch, rcWatch = {} } = argv
  const disabled = watch === false || (watch && watch.enabled === false)
  const enabled = !disabled && (watch || !!rcWatch.enabled)
  if (!enabled) {
    argv.watch = false
  } else {
    argv.watch = {
      ...defaultWatch,
      ...normalizeWatch(rcWatch),
      ...pruneWatch(watch),
    }
    if (!watch.dirs) {
      argv.watch.projectDirs = true
    }
    if (!watch.files) {
      argv.watch.projectFiles = true
    }
    delete argv.watch.enabled
  }
  // delete argv.rcWatch
  delete argv['rc-watch']
  delete argv['project-cwd']
  return {}
}

// Problem: paths need to be relative to .rc file when they come of .rc file,
// but they need to be relative to cwd when they come from the command line.
//
// Solution: basename patterns (i.e. with a slash in them + dynamic) are
// resolved relative to _project_ cwd (i.e. .rc file dir), while static and
// relative patterns are resolved from actual cwd.
//
const readConfig = () => {
  const rcPath = findUp.sync(rcFile)
  if (!rcPath) return
  const { files, watch, ignore, ...config } = require(rcPath)
  const projectCwd = config.projectCwd || path.dirname(rcPath)
  const result = { projectCwd, rcWatch: watch, ...config }
  if (files) {
    result.files = { pattern: files, global: true }
  }
  if (ignore) {
    result.ignore = { pattern: ignore, global: true }
  }
  return result
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
  .middleware([applyLogLevel, mergeRcConfig, runDump])
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
        .coerce({
          files: maybeGlobalPattern,
          ignore: maybeGlobalPattern,
        })
        // .options('not', {
        //   global: false,
        //   desc: 'Negated topic pattern',
        //   requiresArg: true,
        //   nargs: 1,
        // })
        // .options('files', {
        //   alias: 'f',
        //   global: false,
        //   desc: 'Glob pattern for test files',
        //   requiresArg: true,
        //   nargs: 1,
        // })
        .option('rcWatch', {
          global: false,
          hidden: true,
        })
        .option('watch', {
          alias: 'w',
          description: 'Run in watch mode',
          global: false,
          nargs: 0,
          coerce: normalizeWatch,
        })
        .option('ignore', {
          description: 'File pattern(s) to be ignored',
          alias: 'i',
          global: false,
          type: 'string',
          requiresArg: true,
          nargs: 1,
          default: defaultIgnore,
        })
        .option('zorax', {
          description: 'Run zorax tests',
          global: false,
          type: 'boolean',
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
        .group(['files', 'not', 'watch', 'only', 'ignore', 'cwd'], 'Options:')
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
    description: 'Base directory for resolving paths and patterns',
    default: process.cwd(),
  })
  .options('projectCwd', {
    hidden: true,
    description:
      'Base directory for resolving paths and patterns from .rc file',
  })
  // internal options
  .options('dump', {
    hidden: true,
    description: 'Dumps parsed config and exit',
    type: 'boolean',
  })
  // run
  .parse()
