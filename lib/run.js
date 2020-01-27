import Log from './log'
import find from './find'

const esm = require('esm')
const impørt = esm(module)

// - zorax must be external, or state is split
// - zorax uses ES imports
const { harness } = impørt('zorax')

harness.auto(false)

export const runFiles = async (files, { only, esm: enableEsm } = {}) => {
  if (only) {
    process.env.ONLY = true
  }

  const runTests = async () => {
    if (enableEsm) {
      return Promise.all(
        files.map(path => {
          if (harness.group) {
            harness.describe(path)
          }
          return impørt(path)
        })
      )
    } else {
      return Promise.all(
        files.map(path => {
          delete require.cache[path]

          if (harness.group) {
            harness.group(path)
          }

          return require(path)
        })
      )
    }
  }

  await runTests()

  harness.report()
}

export const runAction = async (input, options) => {
  const files = await find(input.files)
  return runFiles(files, options)
}

process.on('message', m => {
  const { type, input, options } = m
  switch (type) {
    case 'start':
      return runAction(input, options)
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
