import glob from 'fast-glob'
import * as path from 'path'

import Log from './log'
import { defaultFilePattern } from './defaults'

const toArray = x => (Array.isArray(x) ? x : [x])

const baseNameRe = /[\\/]/

const dynamicRe = /[*?]|^!|\[.*\]|\(.*\|.*\)|[@!*?+]\(.*\)|{.*(?:,|\.\.).*}/

const isDynamicPattern = x => dynamicRe.test(x)

const isBaseName = x => !baseNameRe.test(x) && isDynamicPattern(x)

const splitBaseNamePatterns = patterns => {
  const bns = []
  const paths = []
  toArray(patterns).forEach(pattern => {
    if (isBaseName(pattern)) {
      bns.push(pattern)
    } else {
      paths.push(pattern)
    }
  })
  return [bns.length > 0 ? bns : null, paths.length > 0 ? paths : null]
}

export default async function run(args = {}) {
  const { ignore: ignoreArg, only, cwd: localCwd, projectCwd } = args

  const ignore =
    ignoreArg && ignoreArg.global
      ? // ? toArray(ignoreArg.pattern).map(x => path.resolve(projectCwd, x))
        ignoreArg.pattern
      : ignoreArg

  // console.log(ignore)
  // process.exit()

  let filePatternArg = args.files
  let cwd = localCwd

  if (args.files && args.files.global) {
    cwd = projectCwd
    filePatternArg = args.files.pattern
  }

  const filePattern =
    filePatternArg && filePatternArg.length > 0
      ? filePatternArg
      : defaultFilePattern

  const [bns, paths] = splitBaseNamePatterns(filePattern)

  const bnsFiles =
    bns &&
    (await glob(bns, {
      cwd: projectCwd,
      ignore,
      baseNameMatch: true,
      absolute: true,
    }))

  const pathsFiles =
    paths && (await glob(paths, { cwd, ignore, absolute: true }))

  let files

  if (bnsFiles && bnsFiles.length > 0) {
    if (pathsFiles && pathsFiles.length > 0) {
      files = [...new Set([...bnsFiles, ...pathsFiles])]
    } else {
      files = bnsFiles
    }
  } else if (pathsFiles && pathsFiles.length > 0) {
    files = pathsFiles
  } else {
    files = []
  }

  if (only) {
    process.env.ONLY = true
  }

  const runTests = async () => {
    return Promise.all(
      files
        // .map(file => path.resolve(cwd, file))
        .map(path => {
          delete require.cache[path]
          return require(path)
        })
    )
  }

  await runTests()
}

process.on('message', m => {
  const { type, ...options } = m
  switch (type) {
    case 'start':
      return run(options)
        .catch(err => {
          Log.error((err && err.stack) || err)
          process.exit(255)
        })
        .then(() => {
          process.send({ type: 'done' })
        })
    default:
      throw new Error('Invalid message type: ' + type)
  }
})
