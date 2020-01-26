import * as zora from 'zora'

const nooploop = () => nooploop

const getTest = t => t.test

const throws = msg => () => {
  throw new Error(msg)
}

const maybeAssign = (disabled, target, props) => {
  if (disabled) {
    return props
  }
  return Object.assign(Object.create(target), props)
}

export const withOnly = (options = {}) => t => {
  const {
    enabled: onlyEnabled = false,
    skip: useSkip = false,
    auto = false,
    noWrap = false,
  } = options

  const allowOnly = onlyEnabled || auto

  const skip = useSkip ? t => t.skip.bind(t) : nooploop

  const wrapTest = (t, wrapper, only, focus) => {
    const test = (name, spec) => {
      const wrappedTest = wrapper(t)
      const wrappedSpec = wrapSpec(spec, wrapper)
      return wrappedTest(name, wrappedSpec)
    }
    test.only = only
    test.focus = focus
    return test
  }

  const wrapSpec = (spec, testWrapper) =>
    function zora_spec_fn(t) {
      const only = makeOnly(t.test)
      const focus = makeFocus(t.test)
      const test = wrapTest(t, testWrapper, only, focus)
      return spec(Object.assign(Object.create(t), { test, only, focus }))
    }

  const makeOnly = (test, enabled = allowOnly) =>
    enabled
      ? (name, spec) => test(name, wrapSpec(spec, skip))
      : throws('Unexpected only: enable only, or remove the forgotten call')

  const makeFocus = (test, enabled = allowOnly) =>
    enabled
      ? (name, spec) => test(name, wrapSpec(spec, getTest))
      : throws('Unexpected focus: enable only, or remove the forgotten call')

  const rootTestWrapper = onlyEnabled
    ? nooploop
    : t => (name, spec) => t.test(name, spec)

  const only = makeOnly(t.test, onlyEnabled)

  const focus = makeFocus(t.test, onlyEnabled)

  const test = wrapTest(t, rootTestWrapper, only, focus)

  Object.assign(test, zora.test, t.test)

  return maybeAssign(noWrap, t, { test, only, focus })
}

export const withAutoOnly = (options = {}) => {
  const {
    noWrap = false,
    enabled: onlyEnabled = false,
    auto = false,
    ...remainingOptions
  } = options

  if (!auto) {
    return t => ({
      ...withOnly(options)(t),
      report: t.report.bind(t),
    })
  }

  return harness => {
    const regs = []

    let hasOnly = false

    const wrapOnly = (method = 'only') => (...args) => {
      hasOnly = true
      regs.push(o => o[method](...args))
    }

    const only = wrapOnly()

    const focus = wrapOnly('focus')

    const test = (...args) => {
      regs.push(o => o.test(...args))
    }

    const report = reporter => {
      const opts = {
        ...remainingOptions,
        enabled: onlyEnabled && hasOnly,
        auto: onlyEnabled,
      }
      const o = withOnly(opts)(harness)
      regs.forEach(reg => reg(o))
      return harness.report(reporter)
    }

    Object.assign(test, harness.test, { only, focus })

    return maybeAssign(noWrap, harness, { test, only, focus, report })
  }
}
