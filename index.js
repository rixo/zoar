import { createHarness as createZoraHarness } from 'zora'
import { mochaTapLike } from 'zora'
import * as zora from 'zora'
import { reporter } from 'zora-node-reporter'

import { withAutoOnly } from './lib/only'

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
let defaultReporter = reporter

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

autoStart = true

const start = () => {
  if (autoStart) {
    defaultTestHarness.report(defaultReporter())
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
