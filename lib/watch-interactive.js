import Log from './log'

const completions = [
  '--inspect-brk',
  '--inspect',
  '--no-inspect-brk',
  '--no-inspect',
  '--watch-debounce',
  '--watch-filenames',
  'argv',
  'exit',
  'grep',
  'inspect-brk',
  'inspect',
  'list',
  'no-inspect',
  'options',
  'print',
  'quit',
  'restart',
  'watchDebounce',
  'watchFilenames',
]

const completionAliases = {
  rs: 'restart',
  opts: 'options',
  ls: 'list',
  b: 'inspect-brk',
  'b!': 'inspect-brk!',
  'no-b': 'no-inspect-brk',
}

export default ({ setOptions, run, options, dump }) => {
  const readline = require('readline')

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
    setOptions({ print: false, ls: false })
  }

  const exit = (code = 0, msg = '') => {
    // NOTE msg is intentionnaly an empty line if none provided to ensure
    // next user's shell prompt be print on a new line
    console.log(msg)
    process.exit(code)
  }

  const help = () => {
    prompt = false
    console.log(`Commands:
    [Enter], rs, restart  rerun
    [Escape], r, run      reset current script to run, and run

    h, help, ?            show help
    [^D], q, quit, exit   exit
  `)
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
      console.log('^C')
      rl.line = ''
      rl.prompt()
      return
    } else {
      exit(0, '^C')
    }
  })

  rl.on('line', line => {
    prompt = false

    const args = line.trim().split(/\s+/g)
    const cmd = args.shift()

    switch (cmd) {
      case '':
      case 'rs':
      case 'restart':
        run()
        break

      case 'l':
      case 'ls':
      case 'list':
      case '-l':
      case '--ls':
        setOptions({ ls: true, print: false })
        break

      case 'p':
      case 'print':
      case '--print':
      case '-p':
        setOptions({ print: true, printCompact: true, ls: false })
        break

      case 'r':
      case 'run':
        escape()
        break

      case 'q':
      case 'quit':
      case 'exit':
        exit(0)
        break

      case 'inspect':
      case '--inspect':
        setOptions({ inspect: true })
        break

      case 'no-inspect':
      case 'inspect!':
      case '--inspect!':
        setOptions({ inspect: false }, false)
        console.log('--no-inspect')
        break

      case 'b':
      case '-b':
      case 'inspect-brk':
      case '--inspect-brk':
        setOptions({ inspectBrk: true })
        break

      case 'b!':
      case 'inspect-brk!':
      case 'no-b':
      case 'no-inspect-brk':
      case '--no-inspect-brk':
        console.log('--no-inspect-brk')
        setOptions({ inspectBrk: false }, false)
        break

      case 'watchDebounce':
      case '--watch-debounce': {
        const [value] = args
        if (value != null) {
          options.watchDebounce = parseInt(value)
        }
        console.log(options.watchDebounce)
        break
      }

      case 'watchFilenames!':
      case '--watch-filenames!':
        options.watchFilenames = false
        console.log(options.watchFilenames)
        break

      case 'watchFilenames':
      case '--watch-filenames':
        options.watchFilenames = true
        console.log(options.watchFilenames)
        break

      case 'options':
      case 'opts':
      case 'o':
        Log.inspect(options)
        break

      case 'argv':
        Log.inspect(process.argv)
        break

      case 'w':
      case 'watch':
        dump()
        break

      case '?':
      case 'h':
      case 'help':
        help()
        break

      default: {
        let match
        if ((match = cmd.match(/^g(?:rep)?([!?])?\s*(?:\s+(.*))?$/))) {
          const [, mod, value] = match
          const neg = mod === '!'
          const ask = mod === '?'
          const defaultArray = x => (x ? (Array.isArray(x) ? x : [x]) : [])
          let grep = defaultArray(options.grep)
          if (value == null) {
            if (neg) {
              grep = []
            } else {
              // else: just display
              console.log(`grep: ${JSON.stringify(grep)}`)
              break
            }
          } else {
            if (neg) {
              grep = grep.filter(x => x !== value)
            } else {
              grep.push(value.trim())
            }
          }
          setOptions({ grep })
          break
        }

        // unknown
        console.log(`unknown: ${cmd}`)
      }
    }
  })
}
