import commander from 'commander'

import { parseDoubleShorts } from './double-short-options'

const program = new commander.Command()
  .storeOptionsAsProperties(false)
  .passCommandToAction(false)

const { parse } = program

const parseDoubles = parseDoubleShorts({
  w: 'watch',
})

program.parse = args => {
  parse.call(program, parseDoubles(args))
}

export default program
