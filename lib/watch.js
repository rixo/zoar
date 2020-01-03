import * as path from 'path'
import CheapWatch from 'cheap-watch'
import micromatch from 'micromatch'

import { defaultWatchPattern, defaultWatchDirs } from './defaults'

export async function watch(
  { launch, cwd },
  { '--watch-dir': watchDirs, '--watch-pattern': watchPattern, ignore }
) {
  const dirsArg = watchDirs || defaultWatchDirs
  const dirs = dirsArg.map(dir => path.resolve(cwd, dir))

  const matchIgnorePattern = micromatch.matcher(ignore, { basename: true })
  const useWatchPattern = watchPattern || defaultWatchPattern
  const absWatchPattern = path.resolve(cwd, useWatchPattern)
  const matchWatchPattern = micromatch.matcher(absWatchPattern, {
    basename: true,
  })

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

  const watches = dirs.map(dir => new CheapWatch({ dir, filter: filter(dir) }))

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
    for (const [path, stats] of watch.paths) {
      console.log(path)
    }
    watch.on('+', onChange)
    watch.on('-', onChange)
  })

  // await trigger()
  await Promise.all(watchInits)
}
