import Log from './log'
import relative from 'require-relative'

const resolveOptionalRelative = (...args) => {
  try {
    return relative.resolve(...args)
  } catch (err) {
    return null
  }
}

export const runFiles = async (files, { only, esm: enableEsm } = {}) => {
  if (only) {
    process.env.ONLY = true
  }

  const setupZorax = (harness, path) => {
    if (harness) {
      harness.auto(false)
      if (harness.group) {
        harness.describe(path)
      }
    }
  }

  const runTests = async () => {
    if (enableEsm) {
      const esm = require('esm')
      const impørt = esm(module)

      return Promise.all(
        files.map(async path => {
          const zorax = resolveOptionalRelative('zorax', path)
          const harness = zorax && (await impørt(zorax)).harness

          setupZorax(harness, path)

          const { default: customHarness } = await impørt(path)

          return customHarness || harness
        })
      )
    } else {
      return Promise.all(
        files.map(path => {
          delete require.cache[path]

          const zorax = resolveOptionalRelative('zorax', path)
          const harness = zorax && require(zorax).harness

          setupZorax(harness, path)

          require(path)

          return harness
        })
      )
    }
  }

  const harnesses = [...new Set(await runTests())].filter(Boolean)

  harnesses.forEach(harness => {
    harness.report()
  })
}

process.on('message', m => {
  const { type, files, options } = m
  switch (type) {
    case 'start':
      return runFiles(files, options)
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
