import * as fs from 'fs'
import * as path from 'path'

import * as df from './defaults'
import Log from './log'

const { rcFile } = df

const s = x => JSON.stringify(x)

const rcFileTemplate = `export default {
  // pattern(s) to find test files
  files: ${s(df.defaultFilePattern)},

  watch: {
    // set true to make watch the default mode of zoar command
    //
    // use --no-watch to escape this situation
    //
    enabled: false,

    // string or string[]
    dir: ${s(df.defaultWatchDirs)},

    // files in watch dir(s) must match this pattern(s) to be watched
    files: ${s(df.defaultWatchPattern)},
  },

  // patterns to always ignore when finding for file or watching
  //
  // to ignore whole directories, use patterns like this: **/node_modules
  //
  ignore: ${s(df.defaultIgnore)},

  // force resolution of paths relative to the .rc file directory (otherwise
  // it would be relative to the directory where you launch the zoar command)
  cwd: __dirname,
}
`
export const init = ({ cwd, force }) => {
  const file = path.resolve(cwd, rcFile)
  if (fs.existsSync(file)) {
    if (force) {
      Log.info(`Overwriting existing file (option --force): ${file}`)
    } else {
      const err = new Error(
        `File already exists: ${file}.\nUse --force option to recreate`
      )
      err.isUserError = true
      throw err
    }
  }
  fs.promises.writeFile(file, rcFileTemplate, 'utf8')
}
