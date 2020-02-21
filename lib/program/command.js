import commander from 'commander'

import { parseDoubleShorts } from './double-short-options'

const program = new commander.Command()
  .storeOptionsAsProperties(false)
  .passCommandToAction(false)

const { parse, opts } = program

const parseDoubles = parseDoubleShorts({
  w: 'watch',
})

program.parse = argv => parse.call(program, parseDoubles(argv))

program.opts = (...args) => {
  const defaults = Object.fromEntries(
    program.options.map(o => [o.attributeName(), o.defaultValue])
  )
  const options = opts.apply(program, args)
  return { ...defaults, ...options }
}

export default program
