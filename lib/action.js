import { fork } from 'child_process'
import npmRun from 'npm-run'
import * as path from 'path'

const ensureArray = x => (x ? (Array.isArray(x) ? x : [x]) : [])

const forkRunner = (_options, exit) => {
  let cancelLast

  return (files, options = _options) =>
    new Promise((resolve, reject) => {
      if (cancelLast && !cancelLast()) {
        throw new Error('Staled test run')
      }

      const handleError = err => {
        cancelLast && cancelLast()
        reject(err)
      }

      const { inspect, inspectBrk, pipes: pipesEnabled } = options
      const pipes = pipesEnabled && ensureArray(options.pipe)

      const modulePath = path.resolve(__dirname, 'runner.js')
      const args = []
      const execArgv = []
      const env = {}
      const forkOptions = {
        execArgv,
        env,
        stdio: ['ipc', 'inherit', 'inherit'],
      }

      if (pipes && pipes.length > 0) {
        forkOptions.stdio[1] = 'pipe'
      }

      // --inspect --inspect-brk
      if (inspectBrk) {
        execArgv.push('--inspect-brk')
      } else if (inspect) {
        execArgv.push('--inspect')
      }

      const entry = fork(modulePath, args, forkOptions)

      entry.on('error', handleError)

      const children = [entry]
      let last = entry

      // --pipe
      if (pipes) {
        pipes.forEach((pipe, i) => {
          const [cmd, ...args] = pipe.split(/\s+/g)

          const isLast = i === pipes.length - 1
          const stdio = [last.stdout, isLast ? 'inherit' : 'pipe', 'inherit']

          last = npmRun.spawn(cmd, args, { stdio })

          last.on('error', handleError)

          children.push(last)
        })
      }

      entry.send({
        type: 'start',
        files,
        options,
      })

      last.on('exit', () => {
        if (exit) {
          process.exit(last.exitCode)
        } else {
          resolve()
        }
      })

      cancelLast = () => {
        cancelLast = null
        return children.every(child =>
          child.exitCode === null ? child.kill() : true
        )
      }
    }).finally(() => {
      cancelLast = null
    })
}

const createForkRun = (input, options, exit) => {
  const forkRun = forkRunner(options, exit)

  return async (extraFiles, opts = options) => {
    const { default: find } = await import('./find')
    const files = await find(input.files, opts)
    const allFiles = extraFiles
      ? [...new Set([...files, ...extraFiles])]
      : files
    return forkRun(allFiles, opts)
  }
}

export const actionRunner = ({
  input: { files },
  options,
  footer = '\n',
  exit = false,
}) => {
  const { ls } = options
  return ls
    ? async (filenames, opts = options) => {
        const { printAction } = await import('./print')
        return printAction({ files, footer, filenames }, opts)
      }
    : createForkRun({ files }, options, exit)
}
