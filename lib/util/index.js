import * as path from 'path'

export const nope = () => false

export const toPosixSlashes = str => str.replace(/\\/g, '/')

export const joinGlob = (...parts) => toPosixSlashes(path.posix.join(...parts))

export const fileMatcher = files =>
  files.length === 0 ? nope : x => files.includes(x)

export function UserError(...args) {
  const error = new Error(...args)
  error.isUserError = true
  return error
}

UserError.test = error => !!error.isUserError
