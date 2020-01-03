import { test, focus } from '..'

test('skipped', t => {
  t.fail('should not run')
})

focus('focused', t => {
  t.ok(true)
})
