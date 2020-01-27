// import { harness } from 'zorax'
import * as path from 'path'

import { runFiles } from './run'

const parseArgs = (args = process.argv.slice(1)) => ({
  esm: !args.includes('--no-esm'),
  only: args.includes('--only'),
})

export default async () => {
  const { harness } = await import('zorax')

  harness.auto(false)

  return new Promise((resolve, reject) => {
    const { stdin } = process

    let partial = ''

    const files = []

    const emit = file => {
      files.push(path.resolve(file))
    }

    const flush = () => {
      const options = parseArgs()
      runFiles(files, options)
        .then(resolve)
        .catch(reject)
    }

    const append = chunk => {
      const next = partial ? partial + chunk : chunk
      const split = next.split('\n')
      partial = split.pop()
      for (const file of split) {
        emit(file)
      }
    }

    stdin.on('readable', () => {
      const chunk = stdin.read()
      if (chunk !== null) {
        append(chunk.toString('utf8'))
      }
    })

    stdin.on('end', () => {
      if (partial) {
        emit(partial)
      }
      flush()
    })
  })
}
