import * as child_process from 'child_process'
import * as path from 'path'

const forkRunner = options => {
  let cancelLast

  return files =>
    new Promise((resolve, reject) => {
      if (cancelLast && !cancelLast()) {
        throw new Error('Staled test run')
      }

      const { inspect, inspectBrk } = options
      const modulePath = path.resolve(__dirname, 'runner.js')
      const args = []
      const execArgv = []
      const env = {}
      const forkOptions = { execArgv, env }
      // --zorax
      // if (zorax) {
      //   env.ZORAX = 1
      // }
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
        const { type } = m
        switch (type) {
          case 'done':
            child.disconnect()
            resolve(m)
            break

          case 'error':
            child.disconnect()
            reject(new Error(m.error))
            break

          default:
            throw new Error('Invalid message type: ' + type)
        }
      })

      child.on('exit', () => {
        resolve()
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

const createForkRun = (input, options) => {
  const forkRun = forkRunner(options)

  return async extraFiles => {
    const { default: find } = await import('./find')
    const files = await find(input.files, options)
    const allFiles = extraFiles
      ? [...new Set([...files, ...extraFiles])]
      : files
    return forkRun(allFiles)
  }
}

export const actionRunner = ({ files }, options) => {
  const { print } = options
  return print
    ? async filenames => {
        const { printAction } = await import('./print')
        return printAction({ files, footer: '\n', filenames })
      }
    : createForkRun({ files }, options)
}
