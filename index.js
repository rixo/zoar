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

let autoStart = true
const defaultReporter = reporter

export const createHarness = ({ only, ...opts } = {}) => {
  autoStart = false
  const harness = createZoraHarness(opts)
  const o = withAutoOnly(only)(harness)
  const report = (reporter = defaultReporter()) => o.report(reporter)
  return Object.assign(Object.create(harness), o, { report })
}

const defaultTestHarness = createHarness({
  only: {
    enabled: isOnlyEnabled(),
    auto: true,
    skip: false,
  },
})

// createHarness sets it to false
autoStart = true

const start = async () => {
  if (autoStart) {
    defaultTestHarness.report(defaultReporter()).then(() => {
      if (typeof process === 'undefined') return
      if (defaultTestHarness.pass) {
        process.exit(0)
      } else {
        process.exit(1)
      }
    })
  }
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
