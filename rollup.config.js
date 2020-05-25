import * as path from 'path'
import * as fs from 'fs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import builtins from 'builtin-modules'
import shebang from 'rollup-plugin-add-shebang'

const makeExecutable = () => {
  const EXECUTABLE_MODE = 0o111
  let outputDir
  return {
    name: 'make-executable',
    outputOptions({ dir }) {
      outputDir = dir
    },
    writeBundle: bundle =>
      Promise.all(
        Object.entries(bundle)
          .filter(([, { isEntry }]) => isEntry)
          .map(([file]) => file)
          .map(file => path.resolve(outputDir, file))
          .map(async file => {
            const { mode } = await fs.promises.stat(file)
            const newMode = mode | EXECUTABLE_MODE
            await fs.promises.chmod(file, newMode)
          })
      ),
  }
}

export default {
  input: ['./lib/zoar.js', './lib/runner.js'],
  output: {
    format: 'cjs',
    dir: 'dist',
    sourcemap: true,
  },
  external: [
    ...builtins,
    // NOTE zorax needs to be external to share global state
    'zorax',
    'zora',
  ],
  plugins: [
    json(),
    resolve(),
    commonjs(),
    makeExecutable(),
    shebang({ include: 'dist/zoar.js' }),
  ],
}
