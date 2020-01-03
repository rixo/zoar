import * as fs from 'fs'
import * as path from 'path'

import * as df from './defaults'

const { rcFile } = df

const s = x => JSON.stringify(x)

const rcFileTemplate = `export default {
  filePattern: ${s(df.defaultFilePattern)},

  watchPattern: ${s(df.defaultWatchPattern)},

  watchDirs: ${s(df.defaultWatchDirs)},

  // Patterns to always ignore when finding for file or watching.
  //
  // To ignore whole directories, use pattern like this: **/node_modules.
  //
  ignore: ${s(df.defaultIgnore)},
}
`
export const init = ({ cwd }, { force }) => {
  const file = path.resolve(cwd, rcFile)
  if (fs.existsSync(file)) {
    if (force) {
      // eslint-disable-next-line no-console
      console.info(`Overwrite existing file (option --force): ${file}`)
    } else {
      const err = new Error(
        `File already exists: ${file}.\nUse --force option to overwrite`
      )
      err.isUserError = true
      throw err
    }
  }
  fs.promises.writeFile(file, rcFileTemplate, 'utf8')
}
