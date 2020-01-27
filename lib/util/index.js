import * as path from 'path'

export const nope = () => false

export const toPosixSlashes = str => str.replace(/\\/g, '/')

export const joinGlob = (...parts) => toPosixSlashes(path.posix.join(...parts))

export const fileMatcher = files =>
  files.length === 0 ? nope : x => files.includes(x)
