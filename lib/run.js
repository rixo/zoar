import glob from 'fast-glob'
import * as path from 'path'

import Log from './log'

export default async function run({ filePattern, ignore, only, cwd } = {}) {
  const files = await glob(filePattern, { ignore, baseNameMatch: true, cwd })

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
