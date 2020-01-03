import * as zora from 'zora'
import { reporter } from 'zora-node-reporter'

import { withAutoOnly } from './lib/only'

const { createHarness: createZoraHarness } = zora

// export { test, only, focus } from './lib/only'

const isOnlyEnabled = () => {
  if (typeof process !== 'undefined') {
    return !!process.env.ONLY
  } else if (typeof localStorage !== 'undefined') {
    return !!localStorage.ONLY
  } else {
    throw new Error('ONLY not supported in this environment')
  }
}

let hasCustomHarnesses = false
const defaultReporter = reporter

const autoStartListeners = []

const compose = (...fns) => initial => fns.reduceRight((x, f) => f(x), initial)

export const createHarness = ({ auto = true, only, ...opts } = {}) => {
  hasCustomHarnesses = true
  return compose(
    withDefaultReporter(),
    withAutoStart({ auto }),
    withAutoOnly(only),
    createZoraHarness
  )(opts)
}

const mixin = (parent, props) => Object.assign(Object.create(parent), props)

const withDefaultReporter = () => harness => {
  const report = (reporter = defaultReporter()) => harness.report(reporter)
  return mixin(harness, { report })
}

const withAutoStart = ({ auto = true } = {}) => harness => {
  if (!auto) {
    return harness
  }

  let autoStart = true

  const report = (reporter = defaultReporter()) => {
    autoStart = false
    return harness.report(reporter)
  }

  autoStartListeners.push(async () => {
    if (autoStart) {
      await report()
      // .then(() => {
      //   if (typeof process === 'undefined') return
      //   // if (harness.pass) {
      //   //   process.exit(0)
      //   // } else {
      //   //   process.exit(1)
      //   // }
      //   return o
      // })
    }
    return harness
  })

  return harness
}

const withDefaultAutoStart = ({ auto = true } = {}) => t => {
  if (!auto) {
    return t
  }

  let hasTests = false
  let alreadyRun = false

  const test = (...args) => {
    hasTests = true
    return t.test(...args)
  }

  const report = async (...args) => {
    alreadyRun = true
    return t.report(...args)
  }

  const harness = Object.assign(Object.create(t), { test, report })

  const maybeReport = async () => {
    if (alreadyRun) return
    // FIXME hasTests should probably be hasBeenUsed, including free
    // assertions, like t.ok(true) at the root level
    if (hasCustomHarnesses && !hasTests) return
    return report()
  }

  autoStartListeners.push(async () => {
    await maybeReport()
    return harness
  })

  return harness
}

const defaultTestHarness = withDefaultAutoStart()(
  createHarness({
    auto: false,
    only: {
      enabled: isOnlyEnabled(),
      auto: true,
      skip: false,
    },
  })
)

hasCustomHarnesses = false

const call = (...args) => fn => fn(...args)

const reduce = (reducer, initial) => values => values.reduce(reducer, initial)

const start = () => {
  const promises = autoStartListeners.map(call())
  Promise.all(promises)
    .then(reduce((pass, harness) => pass && harness.pass, true))
    .then(allPass => {})
  // if (autoStart) {
  //   defaultTestHarness.report(defaultReporter()).then(() => {
  //     if (typeof process === 'undefined') return
  //     if (defaultTestHarness.pass) {
  //       process.exit(0)
  //     } else {
  //       process.exit(1)
  //     }
  //   })
  // }
}

// on next tick start reporting
if (typeof window === 'undefined') {
  setTimeout(start, 0)
} else {
  window.addEventListener('load', start)
}

export const { test, only, focus } = defaultTestHarness

// export const { test, only, focus } = withOnly({
//   enabled: isOnlyEnabled(),
//   skip: false,
// })(zora)
