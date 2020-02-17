import Log from './log'

const ucFirst = string => string.slice(0, 1).toUpperCase() + string.slice(1)

const defaultArray = x => (x ? (Array.isArray(x) ? x : [x]) : [])

const not = value => x => x !== value

const notIn = values => x => !values.includes(x)

const includes = targets => x => targets.includes(x)

const camelCase = (string, first = false) => {
  const parts = string.split('-').filter(Boolean)
  if (!first) {
    const i = parts.shift()
    return i + parts.map(ucFirst).join('')
  }
  return parts.map(ucFirst).join('')
}

const camelCaseAndNeg = (flag, { neg = true, camel = true } = {}) =>
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

const filterHandler = (short, long, prop) => ({
  test: includes(
    [short, `-${short}`, long, `--${long}`].flatMap(x => [
      x,
      x + '?',
      x + '!',
      x + '!!',
    ])
  ),

  alias: [long, `--${long}`, `-${short}`], // for autocomplete

  run: ({ setOptions, options, initialOptions, logValue }, cmd, args) => {
    // case: ask?
    const ask = cmd.slice(-1) === '?'
    if (ask) {
      logValue(options[prop])
      return
    }

    const getItems = () => {
      // case: reset!!
      const reset = cmd.slice(-2) === '!!'
      if (reset) {
        return initialOptions[prop]
      }

      let items = defaultArray(options[prop])

      // case: rm!
      const rm = cmd.slice(-1) === '!'
      if (rm) {
        if (args.length === 0) {
          return []
        }
        return items.filter(notIn(args))
      }

      // case: empty (ask)
      if (args.length === 0) {
        logValue(items)
        return
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

    if (items) {
      setOptions({ [prop]: items }, true)
    }
  },
})

const parseHandlerReg = /^\s*(?:-([^-][^\s,]*))?\s*(?:,?\s*(?:--(\S+)))?(?:\s*\[\s*(?:(\w+)(?::(\w+))?)\.{3}\s*\])?\s*$/

const parseCmdHandler = cmd => {
  if (typeof cmd !== 'string') return cmd
  const match = parseHandlerReg.exec(cmd)
  if (!match) return cmd
  const [, short, long, arg, prop = arg] = match
  if (arg) {
    return filterHandler(short, long, prop)
  }
  return boolHandler('--' + long)
}

const handlers = [
  '--json',
  '--tap',
  '--indent',

  '--inspect-brk',
  '--inspect',
  '--print-compact',

  '-f, --filter [globs:filter...]',
  '-g, --grep [patterns:grep...]',

  '--pipe [commands:pipe...]', // TODO should be <commands:pipe...>

  {
    test: cmd => cmd[0] === '+' || cmd[0] === '-',
    run: ({ options, setOptions }, cmd, args) => {
      const value = [cmd, ...args].join(' ').trim()
      const neg = value.slice(-1) === '!'
      let grep = defaultArray(options.grep)
      if (neg) {
        const pattern = value.slice(0, -1)
        grep = grep.filter(x => x !== pattern)
      } else {
        const pattern = value.slice(1)
        grep = grep.filter(x => x !== '+' + pattern && x !== '-' + pattern)
        if (!grep.includes(value)) {
          grep.push(value)
        }
      }
      setOptions({ grep }, true)
    },
  },
].map(parseCmdHandler)

const switches = [
  ['run', 'print', 'ls'],
  ['json', 'tap'],
  ['inspect', 'inspect-brk'],
]

const switchMap = switches.reduce((map, props) => {
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
}, {})

const completions = [
  ...new Set(
    [
      ...handlers.map(({ negs, alias }) =>
        negs && alias ? [...negs, ...alias] : negs || alias || []
      ),

      'restart',

      'run',
      'list',
      'print',

      'grep',

      camelCaseAndNeg('--watch-debounce'),

      'argv',
      'options',
      'watch',

      'quit',
      'exit',
    ].flat()
  ),
]
  // remove cmd!
  .filter(x => x.slice(-1) !== '!')

const completionAliases = {
  rs: 'restart',
  opts: 'options',
  ls: 'list',
  b: 'inspect-brk',
  'b!': 'inspect-brk!',
  'no-b': 'no-inspect-brk',
  pc: '--print-compact',
  npc: '--no-print-compact',
  wd: '--watch-debounce',
}

const helpText = `Commands:
  [Enter], rs, restart  rerun
  [Escape], r, run      reset current script to run, and run

  h, help, ?            show help
  [^D], q, quit, exit   exit
`

export default _api => {
  const { setOptions: _setOptions, initialOptions, run, options, dump } = _api
  const readline = require('readline')

  const log = Log.log
  const logError = Log.error
  const logValue = Log.inspect

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

  const api = { ..._api, setOptions, log, logValue }

  const completer = partial => {
    const alias = completionAliases[partial]
    if (alias) {
      rl.line = ''
      return [[alias], '']
    }
    return [completions.filter(x => x.startsWith(partial)), partial]
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  })

  let prompt = false

  {
    const { prompt: up } = rl
    rl.prompt = (...args) => {
      prompt = true
      return up.apply(rl, args)
    }
  }

  const escape = () => {
    prompt = false
    setOptions(
      {
        print: !!initialOptions.print,
        ls: !!initialOptions.ls,
        json: !!initialOptions.json,
        tap: !!initialOptions.tap,
        indent: !!initialOptions.indent,
        pipe: initialOptions.pipe,
      },
      true
    )
  }

  const exit = (code = 0, msg = '') => {
    // NOTE msg is intentionnaly an empty line if none provided to ensure
    // next user's shell prompt be print on a new line
    log(msg)
    process.exit(code)
  }

  const help = () => {
    prompt = false
    log(helpText)
  }

  process.stdin.on('keypress', (chunk, key) => {
    if (key.name === 'escape') {
      escape()
      return
    }
    if (key && key.name === 'd' && key.ctrl) {
      exit(0, '^D')
      return
    }
    if (key.name === 'return') {
      return
    }
    if (!prompt) {
      const preserveCursor = true
      rl.prompt(preserveCursor)
    }
  })

  rl.on('SIGINT', () => {
    if (rl.line) {
      log('^C')
      rl.line = ''
      rl.prompt()
      return
    } else {
      exit(0, '^C')
    }
  })

  const handle = (cmd, args) =>
    handlers.some(handler => {
      if (handlerMatches(cmd, args, handler)) {
        runHandler(cmd, args, handler, api)
        return true
      }
    })

  rl.on('line', line => {
    prompt = false

    line = line.trim()
    const args = line.split(/\s+/g)
    const cmd = args.shift()

    if (handle(cmd, args, line)) {
      return
    }

    switch (cmd) {
      case '':
      case 'rs':
      case 'restart':
        run()
        break

      case 'x':
      case 'clear':
        rl.output.write('\u001B[2J\u001B[0;0f')
        break

      case 'r':
      case 'run':
        setOptions({ run: true }, true)
        break

      case 'l':
      case 'ls':
      case 'list':
      case '-l':
      case '--ls':
        setOptions({ ls: true }, true)
        break

      case 'p':
      case 'print':
      case '--print':
      case '-p':
        setOptions({ print: true }, true)
        break

      case 'q':
      case 'quit':
      case 'exit':
        exit(0)
        break

      case 'w':
      case 'watch':
        dump()
        break

      case 'watchDebounce':
      case '--watch-debounce': {
        const [value] = args
        if (value != null) {
          options.watchDebounce = parseInt(value)
        }
        log(options.watchDebounce)
        break
      }

      case 'options':
      case 'opts':
      case 'o':
        Log.inspect(options)
        break

      case 'argv':
        Log.inspect(process.argv.slice(2))
        break

      case '?':
      case 'h':
      case 'help':
        help()
        break

      default:
        logError(`unknown: ${cmd}`)
    }
  })
}
