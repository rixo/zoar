import * as zora from 'zora'

const nooploop = () => nooploop

const getTest = t => t.test

const throws = msg => () => {
  throw new Error(msg)
}

export const withOnly = (options = {}) => t => {
  const { enabled: onlyEnabled = false, skip: useSkip = false } = options

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

  const makeOnly = test =>
    onlyEnabled
      ? (name, spec) => test(name, wrapSpec(spec, skip))
      : throws('Unexpected only: enable only, or remove the forgotten call')

  const makeFocus = test =>
    onlyEnabled
      ? (name, spec) => test(name, wrapSpec(spec, getTest))
      : throws('Unexpected focus: enable only, or remove the forgotten call')

  const rootTestWrapper = onlyEnabled
    ? nooploop
    : t => (name, spec) => t.test(name, spec)

  const only = makeOnly(t.test)

  const focus = makeFocus(t.test)

  const test = wrapTest(t, rootTestWrapper, only, focus)

  Object.assign(test, zora.test, t.test)

  return { test, only, focus }
}

const isOnlyEnabled = () => {
  if (typeof process !== 'undefined') {
    return !!process.env.ONLY
  } else if (typeof localStorage !== 'undefined') {
    return !!localStorage.ONLY
  } else {
    throw new Error('ONLY not supported in this environment')
  }
}

export const { test, only, focus } = withOnly({
  enabled: isOnlyEnabled(),
  skip: false,
})(zora)
