import Log from './log'
import relative from 'require-relative'

const resolveOptionalRelative = (...args) => {
  try {
    return relative.resolve(...args)
  } catch (err) {
    return null
  }
}

const resolveReporter = async ({ json, tap, indent }) => {
  if (json) {
    const { logReporter } = await import('./reporter-log')
    return logReporter()
  }

  const isTTY =
    typeof process !== 'undefined' && process.stdout && process.stdout.isTTY
  if (isTTY && !tap) {
    const { reporter } = await import('zora-node-reporter')
    return reporter()
  }

  if (indent) {
    const { indentedTapReporter } = await import('zora-tap-reporter')
    return indentedTapReporter()
  } else {
    const { tapReporter } = await import('zora-tap-reporter')
    return tapReporter()
  }
}

const runFiles = async (files, options = {}) => {
  const { only, map } = options

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
    if (map) {
      require('source-map-support').install()
    }

    // if (enableEsm) {
    //   const esm = require('esm')
    //   const impørt = esm(module)
    //
    //   return Promise.all(
    //     files.map(async path => {
    //       const zorax = resolveOptionalRelative('zorax', path)
    //       const harness = zorax && (await impørt(zorax)).harness
    //
    //       setupZorax(harness, path)
    //
    //       const { default: customHarness } = await impørt(path)
    //
    //       return customHarness || harness
    //     })
    //   )
    // } else {
    return files.map(path => {
      delete require.cache[path]

      const zorax = resolveOptionalRelative('zorax', path)
      const harness = zorax && require(zorax).harness

      setupZorax(harness, path)

      require(path)

      return harness
    })
    // }
  }

  const harnesses = [...new Set(await runTests())].filter(Boolean)

  const reporter = await resolveReporter(options)

  harnesses.forEach(harness => {
    harness.report(reporter)
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
