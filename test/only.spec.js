import { createHarness as createZoraHarness, mochaTapLike } from 'zora'
import { withOnly } from '@/lib/only'

import { createHarness as createZopHarness } from '..'

const runTest = ({ test, only, focus }) => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

  let expectedSuccess = 0

  const shouldRun = (t, msg = 'should run') => {
    t.ok(true, msg)
  }

  const shouldNotRun = (t, msg = 'should not run') => {
    t.fail(msg)
  }

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

const promises = [
  [createZoraHarness(), withOnly({ enabled: true, skip: false, auto: false })],
  [createZopHarness({ only: { enabled: true, auto: true } })],
].map(async ([harness, only = () => harness]) => {
  const getExpectedSuccess = runTest(only(harness))
  await harness.report()
  const expectedSuccess = getExpectedSuccess()
  return { harness, expectedSuccess }
})

const noop = () => {}
const log = console.log
// console.log = noop
Promise.all(promises).then(results => {
  console.log('\n===== Assertion counting =====\n')
  console.log = log
  const meta = createZoraHarness()
  results.forEach(({ harness, expectedSuccess }) => {
    meta.is(
      harness.successCount,
      expectedSuccess,
      `expects ${expectedSuccess} crumbs`
    )
    meta.is(harness.failureCount, 0, 'there was no failures')
  })
  return meta.report(mochaTapLike)
})
