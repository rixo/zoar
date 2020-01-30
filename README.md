# Zoar

> Very opinionated test runner for Zorax / Zora

## Features

- find (test files)
- run (test files)
- watch

## Principles

- tests are programs (meaning: harness is auto run by default)


## Examples

~~~bash
# see all options
zoar --help

# create a template .zoarrc.js file with default values
zoar --init

# run with all defaults (from config files or factory)
zoar

# run specific tests
#
# => files from cli replace files from config file
#
# /!\ glob patterns must be quoted or your shell (e.g. bash) might resolves the
#     files instead of passing the glob
#
zoar test/foo.spec.js 'test/bar/*.spec.js'

# ignore some files (used both by find & watch)
#
# => ignores from cli are _added_ tot ignore from config
#
# => ignore patterns starting with ** match all dirs, even parents of cwd
#
zoar --ignore '**/node_modules'

# unignore target
zoar --ignore '!node_modules/lib-im-hackin'

# alternative ignore with negated patterns
zoar '**/*.spec.js' '!.git'

# run & watch
zoar --watch

# ... with an extra watch target (in addition to those in config)
zoar --watch '../other-dep-im-workin-on/**'

# print list of test files instead of running them
zoar --print

# can be combined
zoar --print --watch
~~~

### Exit codes

~~~bash
zoar passing.spec.js
echo $?
> 0

zoar failing.spec.js
echo $?
> 1
~~~

### ES modules support

via [esm](https://github.com/standard-things/esm#readme)

~~~bash
zoar
~~~

### Debugging

~~~bash
# pass inspect flags to the node process that runs the tests
zoar --inspect
zoar --inspect-brk
~~~

#### Node source map support

via [source-map-support](https://github.com/evanw/node-source-map-support)

~~~bash
# enable source map support
zoar --map
~~~

### Pipes

~~~bash
# zoar accepts test files through stdin
ls **/*.spec.js | zoar

# find tests files, then run them
zoar --print | zoar

# find tests files, and run them on each change
#
# => print watch writes an empty line as separator between runs
# => when reading from stdin (pipe), zoar takes empty lines as run command
#
zoar --print --watch | zoar

# piping out automatically disable TTY reporter
zoar | less
~~~

### Debugging Zoar (usage)

~~~bash
zoar --debug
zoar --debug=config # default
zoar --debug=options
zoar --debug=targets # watch targets
~~~
