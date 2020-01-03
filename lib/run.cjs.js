const { default: run } = require('esm')(module)('./run')

module.exports = run
// run().catch(err => {
//   console.error((err && err.stack) || err)
//   process.exit(255)
// })
