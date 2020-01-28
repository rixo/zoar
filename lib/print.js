import find from './find'

const joinFilenames = (files, extraFiles) =>
  extraFiles ? [...new Set(files.concat(extraFiles))] : files

export const printAction = async ({ files, footer, filenames: extra }) => {
  const filenames = await find(files)
  for (const filename of joinFilenames(filenames, extra)) {
    process.stdout.write(filename + '\n')
  }
  if (footer) {
    process.stdout.write(footer)
  }
}
