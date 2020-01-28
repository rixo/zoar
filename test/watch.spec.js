import { describe, test } from 'zorax'

import { mergeTargets } from '@/lib/zoar-watch'

const byDir = ({ dir: { length: a } }, { dir: { length: b } }) => a - b

describe(__filename)

describe('mergeTargets', () => {
  test('merges targets into their deep watching parents', t => {
    // throw new Error('shit')
    const input = {
      cwd: '/app',
      pattern: [
        'README.md',
        'src/foo.spec.js',
        'test/**/*.spec.js',
        'test/foo.js',
        'test/bar/*.test.js',
      ],
    }
    const expected = [
      {
        dir: '/app',
        deep: false,
        filenames: ['README.md'],
        globs: [],
        ignore: [],
      },
      {
        dir: '/app/src',
        deep: false,
        filenames: ['foo.spec.js'],
        globs: [],
        ignore: [],
      },
      {
        dir: '/app/test',
        deep: true,
        filenames: ['foo.js'],
        globs: ['**/*.spec.js', 'bar/*.test.js'],
        ignore: [],
      },
    ]
    const actual = mergeTargets(input)
    t.eq(actual.sort(byDir), expected)
  })

  test('ignore', t => {
    const input = {
      cwd: '/app',
      pattern: ['test/**/*.spec.js', 'test/foo.js', 'test/bar/*.test.js'],
      ignore: ['test/node_modules/**'],
    }
    const expected = [
      {
        dir: '/app/test',
        deep: true,
        filenames: ['foo.js'],
        globs: ['**/*.spec.js', 'bar/*.test.js'],
        ignore: ['node_modules/**'],
      },
    ]
    const actual = mergeTargets(input)
    t.eq(actual.sort(byDir), expected)
  })

  test('outside ignore', t => {
    const input = {
      cwd: '/app',
      pattern: ['test/**/*.spec.js', 'test/foo.js', 'test/bar/*.test.js'],
      ignore: ['node_modules/**', 'test/nm'],
    }
    const expected = [
      {
        dir: '/app/test',
        deep: true,
        filenames: ['foo.js'],
        globs: ['**/*.spec.js', 'bar/*.test.js'],
        ignore: ['nm'],
      },
    ]
    const actual = mergeTargets(input)
    t.eq(actual.sort(byDir), expected)
  })
})
