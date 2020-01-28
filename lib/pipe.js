import * as path from 'path'

import { actionRunner } from './watch-action'

import Log from './log'

const readStdin = onFiles =>
  new Promise((resolve, reject) => {
    const { stdin } = process

    let partial = ''

    let files = []

    const emit = file => {
      if (file === '') {
        flush().catch(reject)
        files = []
      } else {
        files.push(path.resolve(file))
      }
    }

    const flush = () =>
      Promise.resolve(onFiles(files)).catch(err => {
        Log.error((err && err.stack) || err)
      })

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
        .then(resolve)
        .catch(reject)
    })
  })

export const pipeAction = async (input, options) => {
  if (options.watch) {
    throw new Error('Cannot watch while reading from stdin')
  }
  const runFiles = actionRunner(input, options)
  await readStdin(runFiles)
}
