import CheapWatch from 'cheap-watch'
// import arg from 'arg'
// import glob from 'fast-glob'
import micromatch from 'micromatch'
import * as path from 'path'
import * as child_process from 'child_process'
import * as yargs from 'yargs'

// import run from './run'

// const NAME = 'zoar'

const defaultFilePattern = '**/*.spec.js'
const defaultWatchPattern = '{src,lib,test}/**/*.js'
const defaultWatchDirs = ['.']
const defaultIgnore = [
  '**/node_modules',
  // '**/node_modules/**',
  '**/.*',
  // '**/.*/**',
]

const parseArgs = () => {
  return (
    yargs
      .detectLocale(false)
      // .demandCommand(1, 1)
      .command({
        command: ['run [patterns...]', '$0'],
        desc: false,
        // handler: run,
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
      .parse()
  )
  // const argSpecs = {
  //   '--ignore': [String],
  //   '--watch-dir': [String],
  //   '--watch-pattern': [String],
  //   '--watch': Boolean,
  //   // '--help': Boolean,
  //   '--only': Boolean,
  //   // '--no-esm': Boolean,
  //   // '--reporter': String,
  //   // '-o': '--only',
  //   // '-r': '--reporter',
  //   '-w': '--watch-dir',
  // }
  //
  // const argOptions = {
  //   permissive: false,
  //   argv: process.argv.slice(2),
  // }
  //
  // return arg(argSpecs, argOptions)
  // return yargs.parse()
}

const runCli = async () => {
  const cwd = process.cwd()

  const args = parseArgs()

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

  // async function run() {
  //   const filePattern =
  //     filePatternArg.length > 0 ? filePatternArg : defaultFilePattern
  //
  //   const files = await glob(filePattern, { ignore })
  //
  //   if (only) {
  //     process.env.ONLY = true
  //   }
  //
  //   const runTests = async () => {
  //     return Promise.all(
  //       files
  //         .map(file => path.resolve(cwd, file))
  //         .map(path => {
  //           delete require.cache[path]
  //           return require(path)
  //         })
  //     )
  //   }
  //
  //   await runTests()
  // }

  const launch = () => {
    const filePattern =
      filePatternArg && filePatternArg.length > 0
        ? filePatternArg
        : defaultFilePattern
    // console.log(filePattern)
    // process.exit()
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

          default:
            throw new Error('Invalid message type: ' + type)
        }
      })
      // console.log()
      // process.exit()
      // child.stdout.pipe(process.stdout, { end: false })
      // process.stdin.resume()
    })
  }

  function run() {
    setTimeout(() => launch())
    // const {
    //   ignore,
    //   patterns: filePattern,
    //   cwd,
    //   only,
    //   inspect,
    //   inspectBrk,
    // } = argv
    // setTimeout(() => {
    //   launch({ ignore, patterns: filePattern, cwd, only }).catch(err => {
    //     console.error((err && err.stack) || err)
    //     process.exit(255)
    //   })
    // })
  }

  function watch() {
    setTimeout(doWatch)
  }

  async function doWatch() {
    const dirsArg = watchDirs || defaultWatchDirs
    const dirs = dirsArg.map(dir => path.resolve(cwd, dir))

    const matchIgnorePattern = micromatch.matcher(ignore)
    const useWatchPattern = watchPattern || defaultWatchPattern
    const absWatchPattern = path.resolve(cwd, useWatchPattern)
    const matchWatchPattern = micromatch.matcher(absWatchPattern)

    const filter = dir => {
      return ({ path: p, stats }) => {
        const fullPath = path.resolve(cwd, dir, p)
        // console.log(basename, fullPath, matchWatchPattern(fullPath))
        return (
          (stats.isDirectory() && !matchIgnorePattern(fullPath)) ||
          matchWatchPattern(fullPath)
        )
      }
    }

    const watches = dirs.map(
      dir => new CheapWatch({ dir, filter: filter(dir) })
    )

    const runAgain = false
    const lastRun = null

    // const launch = new Promise((resolve, reject) => {
    //   const args = []
    //   const options = {}
    //   const modulePath = path.resolve(__dirname, 'run.cjs')
    //   const child = child_process.fork(modulePath, args, options)
    //   child.stdout.pipe(process.stdout, { end: false })
    //   process.stdin.resume()
    // })

    let running = false

    const trigger = () =>
      launch()
        .catch(err => {
          console.error((err && err.stack) || err)
          process.exit(-1)
        })
        .finally(() => {
          running = false
        })

    let scheduleId = null

    const schedule = (timeout = 20) => {
      clearTimeout(scheduleId)
      scheduleId = setTimeout(trigger, timeout)
    }

    const onChange = ({ path }) => {
      console.log(path)
      schedule()
    }

    const watchInits = watches.map(async watch => {
      await watch.init()
      // for (const [path, stats] of watch.paths) {
      //   console.log(path)
      // }
      watch.on('+', onChange)
      watch.on('-', onChange)
    })

    // await trigger()
    await Promise.all(watchInits)
  }

  await launch()

  if (isWatch) {
    await doWatch()
  }
  // if (isWatch) {
  //   return watch()
  // } else {
  //   return run({
  //     defaultFilePattern,
  //     filePattern,
  //     ignore,
  //     only,
  //     cwd,
  //   })
  // }
}

runCli().catch(err => {
  console.error((err && err.stack) || err)
  process.exit(255)
})
