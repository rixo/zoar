import relative from 'require-relative'
import * as path from 'path'

import Log from './log'
import { UserError } from './util'

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

const setupZorax = (harness, path, { only, grep, print, ...options }) => {
  if (!harness) return

  harness.auto(false)

  harness.options.only = !!only

  if (grep && grep.length) {
    if (harness.filter) {
      harness.filter(grep)
    } else {
      throw new UserError(
        '--grep option not supported by your harness (missing filter method)'
      )
    }
  }

  if (print) {
    if (harness.print) {
      const { printCompact: compact } = options
      harness.print({ compact })
    } else {
      throw new UserError(
        '--print option not supported by your harness (missing print method)'
      )
    }
  }

  if (harness.group) {
    harness.group(path)
  }
}

const resolveZoraxHarness = (options, req) => _path => {
  if (options.zorax) {
    const [file, name = ''] = options.zorax.split(':')
    const absolutePath = path.resolve(options.cwd, file)
    return req(absolutePath, name)
  } else {
    const zorax = resolveOptionalRelative('zorax', _path)
    if (!zorax) return
    return req(zorax, 'harness')
  }
}

const runFiles = async (files, options = {}) => {
  const { only, map } = options

  if (only) {
    // for zora?
    process.env.ONLY = true
  }

  const runTests = async () => {
    if (map) {
      require('source-map-support').install()
    }

    if (options.esm) {
      const esm = require('esm')
      const impørt = esm(module, { cache: false })

      const _resolveZoraxHarness = resolveZoraxHarness(
        options,
        async (file, name) => (await impørt(file))[name || 'default']
      )

      return Promise.all(
        files.map(async path => {
          const harness = await _resolveZoraxHarness(path)

          setupZorax(harness, path, options)

          const { default: customHarness } = await impørt(path)

          return customHarness || harness
        })
      )
    } else {
      const _resolveZoraxHarness = resolveZoraxHarness(
        options,
        (file, name) => {
          const m = require(file)
          if (!name) return m
          return m[name]
        }
      )

      return files.map(path => {
        const harness = _resolveZoraxHarness(path)

        setupZorax(harness, path, options)

        require(path)

        return harness
      })
    }
  }

  const harnesses = [...new Set(await runTests())].filter(Boolean)

  const reporter = await resolveReporter(options)

  const results = await Promise.all(
    harnesses.map(async harness => {
      await harness.report(reporter)
      const {
        pass,
        count,
        failureCount,
        length,
        skipCount,
        successCount,
      } = harness
      return {
        pass,
        count,
        failureCount,
        length,
        skipCount,
        successCount,
      }
    })
  )

  return results
}

process.on('message', m => {
  const { type, files, options } = m
  switch (type) {
    case 'start':
      return runFiles(files, options)
        .catch(err => {
          if (UserError.test(err)) {
            Log.error(err.message)
            process.exit(255)
          } else {
            Log.error((err && err.stack) || err)
            process.exit(1)
          }
        })
        .finally(() => {
          if (options.kill) {
            process.exit(options.killExitCode)
          }
        })
    default:
      throw new Error('Invalid message type: ' + type)
  }
})
