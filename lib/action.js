import { spawn, fork } from 'child_process'
import * as path from 'path'

const forkRunner = (_options, exit) => {
  let cancelLast

  return (files, options = _options) =>
    new Promise((_resolve, _reject) => {
      if (cancelLast && !cancelLast()) {
        throw new Error('Staled test run')
      }

      const { inspect, inspectBrk, pipe: pipes } = options

      let resolved = false

      const resolver = fn => data => {
        resolved = true
        return fn(data)
      }

      const resolve = resolver(_resolve)
      const reject = resolver(_reject)

      const modulePath = path.resolve(__dirname, 'runner.js')
      const args = []
      const execArgv = []
      const env = {}
      const forkOptions = { execArgv, env }

      if (pipes && pipes.length > 0) {
        forkOptions.stdio = ['ipc', 'pipe', 'inherit']
      }

      // --inspect --inspect-brk
      if (inspectBrk) {
        execArgv.push('--inspect-brk')
      } else if (inspect) {
        execArgv.push('--inspect')
      }

      const child = fork(modulePath, args, forkOptions)

      const children = [child]
      let last = child

      // --pipe
      if (pipes) {
        pipes.forEach((pipe, i) => {
          const [cmd, ...args] = pipe.split(/\s+/g)
          const isLast = i === pipes.length - 1
          last = spawn(cmd, args, {
            stdio: [last.stdout, isLast ? 'inherit' : 'pipe', 'inherit'],
          })
          children.push(last)
        })
      }

      child.send({
        type: 'start',
        files,
        options,
      })

      child.on('message', m => {
        const { type, ...data } = m
        switch (type) {
          case 'done': {
            child.disconnect()
            resolve(data)
            break
          }

          case 'error':
            child.disconnect()
            reject(new Error(m.error))
            break

          default:
            throw new Error('Invalid message type: ' + type)
        }
      })

      last.on('exit', () => {
        if (!resolved) {
          // child exited prematurely (done message not received)
          if (exit) {
            process.exit(last.exitCode)
          } else {
            resolve()
          }
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
