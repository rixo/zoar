import * as child_process from 'child_process'
import * as path from 'path'

const forkRunner = (options, exit) => {
  let cancelLast

  return files =>
    new Promise((_resolve, _reject) => {
      if (cancelLast && !cancelLast()) {
        throw new Error('Staled test run')
      }

      let resolved = false

      const resolver = fn => data => {
        resolved = true
        return fn(data)
      }

      const resolve = resolver(_resolve)
      const reject = resolver(_reject)

      const { inspect, inspectBrk } = options
      const modulePath = path.resolve(__dirname, 'runner.js')
      const args = []
      const execArgv = []
      const env = {}
      const forkOptions = { execArgv, env }

      // --inspect --inspect-brk
      if (inspectBrk) {
        execArgv.push('--inspect-brk')
      } else if (inspect) {
        execArgv.push('--inspect')
      }

      const child = child_process.fork(modulePath, args, forkOptions)

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

      child.on('exit', () => {
        if (!resolved) {
          // child exited prematurely (done message not received)
          if (exit) {
            process.exit(child.exitCode)
          } else {
            resolve()
          }
        }
      })

      cancelLast = () => {
        cancelLast = null
        if (child.exitCode === null) {
          return child.kill()
        } else {
          return true
        }
      }
    }).finally(() => {
      cancelLast = null
    })
}

const createForkRun = (input, options, exit) => {
  const forkRun = forkRunner(options, exit)

  return async extraFiles => {
    const { default: find } = await import('./find')
    const files = await find(input.files, options)
    const allFiles = extraFiles
      ? [...new Set([...files, ...extraFiles])]
      : files
    return forkRun(allFiles)
  }
}

export const actionRunner = ({
  input: { files },
  options,
  footer = '\n',
  exit = false,
}) => {
  const { print } = options
  return print
    ? async filenames => {
        const { printAction } = await import('./print')
        return printAction({ files, footer, filenames }, options)
      }
    : createForkRun({ files }, options, exit)
}
