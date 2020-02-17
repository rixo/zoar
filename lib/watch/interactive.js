const ucFirst = string => string.slice(0, 1).toUpperCase() + string.slice(1)

const defaultArray = x => (x ? (Array.isArray(x) ? x : [x]) : [])

const not = value => x => x !== value

const includes = targets => x => targets.includes(x)

export const camelCaseAndNeg = (flag, { neg = true, camel = true } = {}) =>
  [
    flag,
    neg && flag.replace(/^--/, '--no-'),
    camel && camelCase(flag),
    camel && neg && 'no' + camelCase(flag, true),
  ].filter(Boolean)

const commandNegs = (cmd, alias) => [
  cmd.replace(/^--/, '--no-'),
  'no' + camelCase(cmd, true),
  ...alias.map(alias => alias + '!'),
]

const camelCase = (string, first = false) => {
  const parts = string.split('-').filter(Boolean)
  if (!first) {
    const i = parts.shift()
    return i + parts.map(ucFirst).join('')
  }
  return parts.map(ucFirst).join('')
}

const boolHandler = (cmd, { opt = camelCase(cmd) } = {}) => {
  const alias = [cmd, camelCase(cmd)]
  const negs = commandNegs(cmd, alias)
  const resets = alias.map(alias => alias + '!!')
  const asks = alias.map(alias => alias + '?')
  alias.push(...resets, ...asks)
  const run = ({ setOptions, initialOptions, options, logValue }, cmd) => {
    // case: ask?
    if (asks.includes(cmd)) {
      logValue(options[opt] || false)
      return
    }
    const value = resets.includes(cmd) // case: reset!!
      ? initialOptions[opt]
      : negs && negs.includes(cmd) // case: neg!
      ? false
      : true
    setOptions({ [opt]: value }, true)
  }
  return { cmd, alias, negs, run }
}

const filterHandler = ({
  short,
  long,
  prop = long,
  options: { single = false } = {},
}) => ({
  test: includes(
    [short, short && `-${short}`, long, long && `--${long}`]
      .filter(Boolean)
      .flatMap(x => [x, x + '?', x + '!', x + '!!'])
      .concat([short && `${short}--`, long && `${long}--`].filter(Boolean))
  ),

  alias: [long, long && `--${long}`, short && `-${short}`].filter(Boolean), // for autocomplete

  run: ({ setOptions, options, initialOptions, logValue }, cmd, args) => {
    // case: ask?
    const ask = cmd.slice(-1) === '?'
    if (ask) {
      logValue(options[prop])
      return
    }

    const getItems = () => {
      // case: rm!
      const reset = cmd.slice(-2) === '!!'
      const rm = !reset && cmd.slice(-1) === '!'
      const pop = cmd.slice(-2) === '--'

      // case: empty (ask)
      if (args.length === 0) {
        if (rm) return []
        if (reset) return initialOptions[prop]
        if (pop) return defaultArray(options[prop]).slice(0, -1)
        logValue(options[prop])
        return null
      }

      let items = rm
        ? []
        : reset
        ? defaultArray(initialOptions[prop])
        : defaultArray(options[prop])

      // case: pop--
      if (pop) {
        items = items.slice(0, -1)
      }

      // option: single value
      if (single) {
        const arg = args.join(' ')
        return [...items, arg]
      }

      for (const arg of args) {
        const mod = arg.slice(-1)
        if (mod === '!') {
          const pattern = arg.slice(0, -1)
          items = items.filter(not(pattern))
        } else {
          if (!items.includes(arg)) {
            items.push(arg)
          }
        }
      }

      return items
    }

    const items = getItems()

    if (items !== null) {
      setOptions({ [prop]: items }, true)
    }
  },
})

const parseHandlerReg = /^\s*(?:-([^-][^\s,]*))?\s*(?:,?\s*(?:--(\S+)))?(?:\s*\[\s*(?:(\w+))(\.{3})\s*\])?\s*$/

const parseCmdHandler = cmd => {
  let options = {}
  if (Array.isArray(cmd)) {
    ;[cmd, options] = cmd
  }

  if (typeof cmd !== 'string') return cmd

  const match = parseHandlerReg.exec(cmd)

  if (!match) return cmd

  const [, short, long, arg, ellipsis] = match
  if (arg) {
    return filterHandler({
      short,
      long,
      options,
      multiple: ellipsis === '...',
    })
  }

  return boolHandler('--' + long)
}

const reduceSwitchMap = (map, props) => {
  for (const prop of props) {
    if (!map[prop]) {
      map[prop] = []
    }
    for (const p of props) {
      if (p !== prop && !map[prop].includes(p)) {
        map[prop].push(p)
      }
    }
  }
  return map
}

const handlerMatches = (cmd, args, handler) =>
  handler.test
    ? handler.test(cmd, args)
    : handler.cmd === cmd ||
      (handler.alias && handler.alias.includes(cmd)) ||
      (handler.negs && handler.negs.includes(cmd))

const runHandler = (cmd, args, handler, _api) => {
  if (handler.run) {
    handler.run(_api, cmd, args)
  }
}

export default (specs, { switches }) => {
  const handlers = specs.map(parseCmdHandler)

  const completions = handlers.map(({ negs, alias }) =>
    negs && alias ? [...negs, ...alias] : negs || alias || []
  )

  const switchMap = switches.reduce(reduceSwitchMap, {})

  const handler = _api => {
    const { setOptions: _setOptions } = _api

    const setOptions = (opts, ...rest) => {
      const newOpts = {}
      for (const [opt, value] of Object.entries(opts)) {
        newOpts[opt] = value
        // pop off antagonists (members of same switch)
        if (value && switchMap[opt]) {
          for (const antagonist of switchMap[opt]) {
            newOpts[antagonist] = false
          }
        }
      }
      return _setOptions(newOpts, ...rest)
    }

    const api = { ..._api, setOptions }

    const handle = (cmd, args) =>
      handlers.some(handler => {
        if (handlerMatches(cmd, args, handler)) {
          runHandler(cmd, args, handler, api)
          return true
        }
      })

    return { handle, setOptions }
  }

  return { completions, handler }
}
