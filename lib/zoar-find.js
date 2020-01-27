import find from './find'

export const listAction = async ({ files, footer }) => {
  const filenames = await find(files)
  for (const filename of filenames) {
    process.stdout.write(filename + '\n')
  }
  if (footer) {
    process.stdout.write(footer)
  }
}
