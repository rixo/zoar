import { createHarness as createZoraHarness } from 'zora'
import { withOnly } from '@/lib/only'

import { createHarness as createZoarHarness } from '..'

const blackHole = async stream => {
  // eslint-disable-next-line no-unused-vars
  for await (const message of stream) {
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const shouldRun = (t, msg = 'should run') => {
  t.ok(true, msg)
}

const shouldNotRun = (t, msg = 'should not run') => {
  t.fail(msg)
}

const runWithOnly = ({ test, only, focus }) => {
  let expectedSuccess = 0

  // track the number of expected run for assertions counting
  const track = {
    get shouldRun() {
      expectedSuccess++
      return shouldRun
    },
  }

  test("test don't run when only is enabled", shouldNotRun)

  only('2. only', t => {
    track.shouldRun(t)

    t.test('only > 1. test', shouldNotRun)

    t.only('only > 2. only', t => {
      track.shouldRun(t)
      t.test('only > only > test', shouldNotRun)
    })

    t.focus('only > 3. focus', track.shouldRun)

    t.test('only > 4. test', shouldNotRun)
  })

  focus('3. focus', t => {
    track.shouldRun(t)
    t.test('focus > 1. test', track.shouldRun)
    t.only('focus > 2. only', t => {
      track.shouldRun(t)
      t.test('focus > only > 1. test', shouldNotRun)
      t.only('focus > only > 2. only', track.shouldRun)
      t.test('focus > only > 3. test', shouldNotRun)
    })
    t.focus('focus > 3. focus', track.shouldRun)
    t.test('focus > 4. test', track.shouldRun)
  })

  test('4. test', shouldNotRun)

  only('5. only async', async t => {
    track.shouldRun(t)
    await t.test('only async > 1. test', async t => {
      shouldNotRun(t)
      await wait(5)
    })
    t.only('only async > 2. only', track.shouldRun)
  })

  test.focus('6. focus is also attached to root test function', track.shouldRun)

  test.only('7. focus is also attached to root test function', track.shouldRun)

  focus('8. only and focus are also attached to nested test function', t => {
    t.test.only('only is attached to nested test function', track.shouldRun)
    t.test.focus('focus is attached to nested test function', track.shouldRun)
  })

  return () => expectedSuccess
}

const runAutoNone = ({ test }) => {
  let expectedSuccess = 0

  // track the number of expected run for assertions counting
  const track = {
    get shouldRun() {
      expectedSuccess++
      return shouldRun
    },
  }

  test("test don't run when only is enabled", track.shouldRun)

  test('2. test', t => {
    track.shouldRun(t)

    t.test('test > 1. test', track.shouldRun)

    t.only('test > 2. only', t => {
      track.shouldRun(t)
      t.test('test > only > test (before)', shouldNotRun)
      t.only('test > only > only', track.shouldRun)
      t.test('test > only > test (after)', shouldNotRun)
    })

    t.focus('test > 3. focus', track.shouldRun)

    t.test('test > 4. test', track.shouldRun)
  })

  test('3. focus', t => {
    track.shouldRun(t)
    t.test('focus > 1. test', track.shouldRun)
    t.only('focus > 2. only', t => {
      track.shouldRun(t)
      t.test('focus > only > 1. test', shouldNotRun)
      t.only('focus > only > 2. only', track.shouldRun)
      t.test('focus > only > 3. test', shouldNotRun)
    })
    t.focus('focus > 3. focus', track.shouldRun)
    t.test('focus > 4. test', track.shouldRun)
  })

  test('4. test', track.shouldRun)

  test('5. test async', async t => {
    track.shouldRun(t)
    const { shouldRun } = track
    await t.test('test async > 1. test', async t => {
      shouldRun(t)
      await wait(5)
    })
    t.only('test async > 2. only', track.shouldRun)
  })

  return () => expectedSuccess
}

const onlys = [
  [
    'zora harness: enabled, !auto',
    withOnly({ enabled: true, auto: false, skip: false })(createZoraHarness()),
  ],
  [
    'zora harness: enabled, auto',
    withOnly({ enabled: true, auto: true, skip: false })(createZoraHarness()),
  ],
  [
    'zoar harness: enabled, auto',
    createZoarHarness({
      auto: false,
      only: { enabled: true, auto: true, skip: false },
    }),
  ],
].map(async ([title, harness]) => {
  const getExpectedSuccess = runWithOnly(harness)
  await harness.report(blackHole)
  const expectedSuccess = getExpectedSuccess()
  return meta => {
    meta.test(title, meta => {
      meta.equal(
        harness.successCount,
        expectedSuccess,
        `expects ${expectedSuccess} crumbs`
      )
      meta.equal(harness.failureCount, 0, 'there was no failures')
    })
  }
})

const noners = [
  [
    'zora harness: !enabled, auto',
    withOnly({ enabled: false, auto: true, skip: false })(createZoraHarness()),
  ],
  [
    'zoar harness: enabled, auto',
    createZoarHarness({
      auto: false,
      only: { enabled: true, auto: true, skip: false },
    }),
  ],
].map(async ([title, harness]) => {
  const getExpectedSuccess = runAutoNone(harness)
  if (harness.report) {
    await harness.report(blackHole)
  } else {
    await harness.report(blackHole)
  }
  const expectedSuccess = getExpectedSuccess()
  return meta => {
    meta.test(`no top level only: ${title}`, meta => {
      meta.equal(
        harness.successCount,
        expectedSuccess,
        `expects ${expectedSuccess} crumbs`
      )
      meta.equal(harness.failureCount, 0, 'there was no failures')
    })
  }
})

const unexpectedOnly = 'Unexpected only'

const throwers = [
  [
    'zora harness: !enabled, !auto',
    () => withOnly({ enabled: false, auto: false })(createZoraHarness()),
    true,
  ],
  [
    'zoar harness: !enabled, auto',
    () =>
      createZoarHarness({ auto: false, only: { enabled: false, auto: true } }),
    false,
  ],
].map(async ([title, createHarness, immediate]) => meta => {
  meta.test(title, async t => {
    t.test('throws on only at top level', t => {
      const o = createHarness()
      const only = () => o.only('', () => {})
      const report = () => o.report(blackHole)
      if (immediate) {
        t.throws(only, unexpectedOnly)
        report()
      } else {
        only()
        t.throws(report, unexpectedOnly)
      }
    })
    t.test('throws on focus at top level', t => {
      const o = createHarness()
      const focus = () => o.focus('', () => {})
      const report = () => o.report(blackHole)
      if (immediate) {
        t.throws(focus, unexpectedOnly)
        report()
      } else {
        focus()
        t.throws(report, unexpectedOnly)
      }
    })
    t.test('throws immediately on nested only', async () => {
      const o = createHarness()
      o.test('', o => {
        o.throws(() => {
          o.only('ok', () => {})
        })
      })
      await o.report(blackHole)
    })
    t.test('throws immediately on nested focus', async () => {
      const o = createHarness()
      o.test('', t => {
        t.throws(() => {
          t.focus('ok', () => {})
        })
      })
      await o.report(blackHole)
    })
  })
})

const promises = [...onlys, ...noners, ...throwers]

const call = (...args) => fn => fn(...args)

const meta = createZoarHarness({ auto: true })

meta.test('only', async t => {
  const results = await Promise.all(promises)
  results.forEach(call(t))
})

// meta.report().then(() => {
//   if (!meta.pass) {
//     process.exit(1)
//   }
// })
