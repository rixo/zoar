import * as path from 'path'
import CheapWatch from 'cheap-watch'
import micromatch from 'micromatch'

import { defaultWatchPattern, defaultWatchDirs, matchOptions } from './defaults'
import Log from './log'
import Debug from './debug'

const debug = Debug('zoar:watch')

const toArray = x => (Array.isArray(x) ? x : [x])

const parseWatchArg = arg => {
  const type = typeof arg
  const result = {
    dirs: toArray(defaultWatchDirs),
    files: defaultWatchPattern,
  }
  switch (type) {
    case 'boolean':
      break
    case 'string':
      result.dirs = [arg]
      break
    case 'array':
      result.dirs = arg
      break
    case 'object': {
      const dirKeys = ['dirs', 'dir', 'd']
      const fileKeys = ['files', 'file', 'f']
      const ignoredKeys = ['enabled']
      const dirs = []
      const files = []
      for (const [k, v] of Object.entries(arg)) {
        if (dirKeys.includes(k)) {
          dirs.push(v)
        } else if (fileKeys.includes(k)) {
          files.push(v)
        } else if (!ignoredKeys.includes(k)) {
          const err = new Error(`Unknown argument: --watch.${k}`)
          err.isUserError = true
          throw err
        }
      }
      if (dirs.length > 0) {
        result.dirs = dirs
      }
      if (files.length > 0) {
        result.files = files
      }
      break
    }
  }
  return result
}

export async function runWatch({ launch, cwd }, args) {
  const { ignore } = args
  const { dirs: watchDirs, files: pattern } = parseWatchArg(args.watch)

  const dirs = watchDirs.map(dir => path.resolve(cwd, dir))

  if (Log.isVerbose()) {
    dirs.forEach(dir => {
      Log.info('Watching directory', dir)
    })
  }

  const matchIgnorePattern = micromatch.matcher(ignore, matchOptions)

  const matchWatchPattern = micromatch.matcher(pattern, matchOptions)

  const filter = dir => {
    return ({ path: p, stats }) => {
      const fullPath = path.resolve(cwd, dir, p)
      if (stats.isDirectory()) {
        return !matchIgnorePattern(fullPath)
      } else {
        return matchWatchPattern(fullPath)
      }
    }
  }

  const watches = dirs.map(dir => new CheapWatch({ dir, filter: filter(dir) }))

  const trigger = () =>
    launch().catch(err => {
      Log.error((err && err.stack) || err)
      process.exit(-1)
    })

  let scheduleId = null

  const schedule = (timeout = 20) => {
    clearTimeout(scheduleId)
    scheduleId = setTimeout(trigger, timeout)
  }

  const onChange = ({ path }) => {
    debug('changed', path)
    schedule()
  }

  const watchInits = watches.map(async watch => {
    await watch.init()
    if (debug.enabled) {
      debug('watching', [...watch.paths.keys()])
    }
    watch.on('+', onChange)
    watch.on('-', onChange)
  })

  await Promise.all(watchInits)
}
