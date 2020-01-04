export default {
  // pattern(s) to find test files
  files: "*.spec.js",

  watch: {
    // set true to make watch the default mode of zoar command
    //
    // use --no-watch to escape this situation
    //
    enabled: false,

    // string or string[]
    dir: ".",

    // files in watch dir(s) must match this pattern(s) to be watched
    files: "*",
  },

  // patterns to always ignore when finding for file or watching
  //
  // to ignore whole directories, use patterns like this: **/node_modules
  //
  ignore: ["**/node_modules","**/.git"],

  // force resolution of paths relative to the .rc file directory (otherwise
  // it would be relative to the directory where you launch the zoar command)
  cwd: __dirname,
}
