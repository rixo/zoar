import run from './pipe'
import Log from './log'

run().catch(err => {
  Log.error((err && err.stack) || err)
})
