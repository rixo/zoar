import * as path from 'path'
import pm from 'picomatch'
import CheapWatch from 'cheap-watch'

import relativeMatcher from './find/relative-matcher'
import { fileMatcher, joinGlob, nope, toPosixSlashes } from './util'
import Debug from './debug'
import { actionRunner } from './action'

const debug = Debug('zoar:watch')

const relativeGlob = (...base) => glob =>
  toPosixSlashes(path.posix.join(...base, glob))

const relativeTo = base => name => path.relative(base, name)

const relativePatternTo = dir => pattern => {
  const { base, glob } = pm.scan(pattern)
  const relative = joinGlob(path.relative(dir, base), glob)
  return relative.startsWith('../**') ? relative.substr(3) : relative
}

export const mergeTargets = args => {
  const { filenames, patterns, ignorePatterns } = relativeMatcher(args, true)

  const targetsByDir = {}

  const getTarget = dir => {
    if (!targetsByDir[dir]) {
      targetsByDir[dir] = {
        deep: false,
        dir,
        filenames: [],
        globs: [],
        deepGlobs: [],
      }
    }
    return targetsByDir[dir]
  }

  if (filenames && filenames.length > 0) {
    for (const filename of filenames) {
      const dir = path.dirname(filename)
      getTarget(dir).filenames.push(filename)
    }
  }

  if (patterns && patterns.length > 0) {
    for (const pattern of patterns) {
      const { base, glob } = pm.scan(pattern)
      const isDeep = glob.includes('**')
      const target = getTarget(base)
      const dest = target[isDeep ? 'deepGlobs' : 'globs']
      dest.push(glob)
      if (isDeep) {
        target.deep = true
      }
    }
  }

  // merge
  const deepTargets = []
  let shallowTargets = Object.values(targetsByDir)
  shallowTargets = shallowTargets.filter(target => {
    if (target.deep) {
      deepTargets.push(target)
      return false
    } else {
      return true
    }
  })
  shallowTargets = shallowTargets.filter(target => {
    const { dir } = target
    const parent = deepTargets.find(({ dir: parentDir }) =>
      dir.startsWith(parentDir)
    )
    if (parent) {
      parent.filenames.push(...target.filenames)
      const relation = path.relative(parent.dir, dir)
      const relative = relativeGlob(relation)
      parent.globs.push(...target.globs.map(relative))
      parent.deepGlobs.push(...target.deepGlobs.map(relative))
      return false
    }
    return true
  })

  const formatTarget = ({ filenames, globs, deepGlobs, ...target }) => ({
    ...target,
    filenames: filenames.map(relativeTo(target.dir)),
    globs: [...deepGlobs, ...globs],
    ignore: ignorePatterns
      .map(relativePatternTo(target.dir))
      .filter(s => !s.startsWith('..')),
  })

  const targets = [...deepTargets, ...shallowTargets].map(formatTarget)

  return targets
}

const compileTarget = ({ dir, deep, filenames, globs, ignore }) => {
  const isFileMatch = fileMatcher(filenames)
  const isGlobMatch = pm(globs)

  const isIgnored = pm(ignore)

  const isMatch = x => !isIgnored(x) && (isFileMatch(x) || isGlobMatch(x))

  const isDirMatch = deep ? x => !isIgnored(x) : nope

  return { dir, isMatch, isDirMatch }
}

export const watchAction = async ({ watch, files }, options) => {
  const { watchDebounce = 20, watchFilenames = false } = options

  let timeout = null

  const doRun = actionRunner({ files }, options)

  const run = () => {
    timeout = null
    return doRun().catch(err => {
      // eslint-disable-next-line no-console
      console.error((err && err.stack) || err)
    })
  }

  const schedule = () => {
    clearTimeout(timeout)
    timeout = setTimeout(run, watchDebounce)
  }

  const onChange = ({ path }) => {
    debug('changed', path)
    schedule()
  }

  await run()

  const targets = mergeTargets(watch)

  // protected against unintentional expension of:
  //
  //     zoar *.spec.js
  //
  // into:
  //
  //     zoar a.spec.js b.spec.js etc
  //
  // the problem is especially nasty in a case like the following, where the
  // command doesn't do what it seems to do at all:
  //
  //     zoar -w *.spec.js
  //
  if (!watchFilenames) {
    const hasFilenames = ({ filenames }) => filenames.length > 0
    if (targets.some(hasFilenames)) {
      throw new Error(
        'You must pass flag --watch-filenames to allow filenames as watch targets' +
          ' (this is to protect against unintentional glob expension in your shell)'
      )
    }
  }

  {
    let files

    await Promise.all(
      targets.map(compileTarget).map(async ({ dir, isMatch, isDirMatch }) => {
        const watch = new CheapWatch({
          watch: true,
          dir,
          filter: ({ path: p, stats }) =>
            stats.isDirectory() ? isDirMatch(p) : isMatch(p),
        })
        await watch.init()
        if (debug.enabled) {
          files = [...watch.paths.keys()]
        }
        watch.on('+', onChange)
        watch.on('-', onChange)
      })
    )

    debug('watching', files)
  }
}
