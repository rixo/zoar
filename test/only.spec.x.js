import { createHarness as createZoraHarness, mochaTapLike } from 'zora'
import { withOnly, withAutoOnly } from '@/lib/only'
import { reporter } from 'zora-node-reporter'

import { createHarness as createZopHarness } from '..'

const blackHole = async stream => {
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

const runAutoNone = ({ test, only, focus }) => {
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

const normalize = ([title, harness, only = () => harness]) => [
  title,
  harness,
  only,
]

const onlys = [
  [
    'zora harness: enabled, !auto',
    createZoraHarness(),
    withOnly({ enabled: true, auto: false, skip: false }),
  ],
  [
    'zora harness: enabled, auto',
    createZoraHarness(),
    withOnly({ enabled: true, auto: true, skip: false }),
  ],
  [
    'zop harness: enabled, auto',
    createZopHarness({ only: { enabled: true, auto: true, skip: false } }),
  ],
]
  .map(normalize)
  .map(async ([title, harness, only]) => {
    const getExpectedSuccess = runWithOnly(only(harness))
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
    createZoraHarness(),
    withOnly({ enabled: false, auto: true, skip: false }),
  ],
  [
    'zop harness: enabled, auto',
    createZopHarness({ only: { enabled: true, auto: true, skip: false } }),
  ],
]
  .map(normalize)
  .map(async ([title, harness, only]) => {
    const o = only(harness)
    const getExpectedSuccess = runAutoNone(o)
    if (o.report) {
      await o.report(blackHole)
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

const throwers = [
  [
    'zora harness: !enabled, !auto',
    () => withOnly({ enabled: false, auto: false })(createZoraHarness()),
    true,
  ],
  [
    'zop harness: !enabled, auto',
    () => createZopHarness({ only: { enabled: false, auto: true } }),
    false,
  ],
].map(async ([title, createHarness, immediate]) => meta => {
  meta.test('zop harness: !enabled, auto', async t => {
    const createHarness = () =>
      createZopHarness({ only: { enabled: false, auto: true } })
    t.test('throws on only at top level', t => {
      const o = createHarness()
      o.only('', () => {})
      t.throws(() => o.report(blackHole))
    })
    t.test('throws on focus at top level', t => {
      const o = createHarness()
      o.focus('', () => {})
      t.throws(() => o.report(blackHole))
    })
    t.test('throws immediately on nested only', async t => {
      const o = createHarness()
      o.test('', t => {
        t.throws(() => {
          t.only('ok', () => {})
        })
      })
      await o.report(blackHole)
    })
    t.test('throws immediately on nested focus', async t => {
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

const meta = createZoraHarness()

meta.test('only', async t => {
  const results = await Promise.all(promises)
  results.forEach(call(t))
})

meta.report(reporter()).then(() => {
  if (!meta.pass) {
    process.exit(1)
  }
})
