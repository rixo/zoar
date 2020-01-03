import { test, focus } from '..'

test('autostart', t => {
  t.ok(true)

  t.test('has only', t => {
    t.ok(typeof t.only === 'function')
  })

  t.test('has focus', t => {
    t.ok(typeof t.only === 'function')
  })
})
