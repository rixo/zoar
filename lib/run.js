import glob from 'fast-glob'
import * as path from 'path'
import arg from 'arg'

const defaultFilePattern = '**/*.spec.js'

const argSpecs = {
  '--ignore': [String],
  '--watch-dir': [String],
  '--watch-pattern': [String],
  '--watch': Boolean,
  // '--help': Boolean,
  '--only': Boolean,
  // '--no-esm': Boolean,
  // '--reporter': String,
  // '-o': '--only',
  // '-r': '--reporter',
  '-w': '--watch-dir',
}

const argOptions = {
  permissive: false,
  argv: process.argv.slice(2),
}

// export default async function run({ cwd = process.cwd() } = {}) {
export default async function run({ filePattern, ignore, only, cwd } = {}) {
  // const {
  //   _: filePatternArg,
  //   '--ignore': ignore = [
  //     '**/node_modules',
  //     // '**/node_modules/**',
  //     '**/.*',
  //     // '**/.*/**',
  //   ],
  //   '--only': only = false,
  //   // ['--no-esm']: noESM = false,
  //   // ['--reporter']: reporter = 'default',
  //   // ['--help']: help,
  // } = arg(argSpecs, argOptions)

  const files = await glob(filePattern, { ignore })

  if (only) {
    process.env.ONLY = true
  }

  const runTests = async () => {
    return Promise.all(
      files
        .map(file => path.resolve(cwd, file))
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
          console.error((err && err.stack) || err)
          process.exit(255)
        })
        .then(() => {
          process.send({ type: 'done' })
        })
    default:
      throw new Error('Invalid message type: ' + type)
  }
})
