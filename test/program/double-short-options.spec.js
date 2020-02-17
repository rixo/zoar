import { test } from '@@'

import { parseDoubleShorts } from '@/lib/program/double-short-options'

const macro = (t, input, expected, doublables) => {
  const parse = parseDoubleShorts(doublables)
  const actual = parse(input)
  t.eq(actual, expected)
}

macro.title = (title, input, expected) =>
  title || `${input.join(' ')} => ${expected.join(' ')}`

test('empty returns empty', macro, [], [])

test(macro, ['--foo', '-lmww'], ['--foo', '-lmww'], [])

test(macro, ['--foo', '-lmww'], ['--foo', '-lm', '--watch'], { w: 'watch' })

test(macro, ['--foo', '-lwwm'], ['--foo', '-lwwm'], { w: 'watch' })
