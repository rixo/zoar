import find from './find'
import { runFiles } from './runner'

const joinFilenames = (files, extraFiles) =>
  extraFiles ? [...new Set(files.concat(extraFiles))] : files

export const listAction = async ({ files, footer, filenames: extra }) => {
  const filenames = await find(files)
  for (const filename of joinFilenames(filenames, extra)) {
    process.stdout.write(filename + '\n')
  }
  if (footer) {
    process.stdout.write(footer)
  }
}

export const findAction = async (input, options) => {
  const files = await find(input.files)
  return runFiles(files, options)
}
