import pm from 'picomatch'
import * as path from 'path'

import { nope, fileMatcher, toPosixSlashes } from '../util'

const resolveGlob = (...parts) => toPosixSlashes(path.posix.resolve(...parts))

// (defaultCwd, string|{cwd, pattern})=> { cwd, pattern }
const resolveCwd = (cwd, pattern) =>
  pattern && pattern.pattern
    ? { pattern: pattern.pattern, cwd: pattern.cwd || cwd }
    : { cwd, pattern }

const relativePatternMatcher = (cwd, patternArg, split = true) => {
  // if (!patternArg) {
  //   return split ? { isMatch: nope, isFileMatch: nope } : nope
  // }

  const negatedFilenames = []
  const filenames = []
  const negatedPatterns = []
  const patterns = []

  if (patternArg) {
    const resolvePattern = (pattern, _cwd) => {
      const { isGlob, negated, base, glob } = pm.scan(pattern)
      // NOTE we can't join pattern cause it might be !negated
      const absolutePattern = resolveGlob(_cwd, base, glob)
      const target = isGlob //
        ? negated
          ? negatedPatterns
          : patterns
        : negated
        ? negatedFilenames
        : filenames
      target.push(absolutePattern)
    }

    // resolves { pattern: [], cwd }
    const resolve = inputPattern => {
      const { cwd: _cwd, pattern: _pattern } = resolveCwd(cwd, inputPattern)
      if (Array.isArray(_pattern)) {
        for (const pattern of _pattern) {
          resolvePattern(pattern, _cwd)
        }
      } else {
        resolvePattern(_pattern, _cwd)
      }
    }

    // resolves [{ pattern: [], cwd }, ...]
    if (Array.isArray(patternArg)) {
      patternArg.forEach(resolve)
    } else {
      resolve(patternArg)
    }
  }

  const isFileIgnored = negatedFilenames.length
    ? fileMatcher(negatedFilenames)
    : nope

  const isGlobIgnored = negatedPatterns.length ? pm(negatedPatterns) : nope

  const isGlobMatch = patterns.length ? pm(patterns) : nope

  const isIgnored = x => isFileIgnored(x) || isGlobIgnored(x)

  const isMatch = x => !isIgnored(x) && isGlobMatch(x)

  const isFileMatch = filenames.length ? fileMatcher(filenames) : nope

  const isAnyMatch = x => isFileMatch(x) || isMatch(x)

  return split
    ? {
        isMatch,
        isIgnored,
        isFileMatch,
        filenames,
        negatedFilenames,
        patterns,
        negatedPatterns,
        isAnyMatch,
      }
    : isAnyMatch
}

const relativeMatcher = ({ cwd, pattern, ignore } = {}, split = false) => {
  if (!pattern) return nope

  // const ig = splitFilenames(cwd, ignore)

  // const ignoreMatcher = filenameOverGlobMatcher(cwd, ignore)
  // const { isMatch: isIgnored, isFileMatch: isFileIgnored } = ignoreMatcher
  const {
    isAnyMatch: isIgnored,
    patterns: ignorePatterns,
    negatedPatterns: ignoreNegatedPatterns,
    filenames: ignoreFilenames,
    negatedFilenames: ignoreNegatedFilenames,
  } = relativePatternMatcher(cwd, ignore)

  const {
    isMatch,
    isFileMatch,
    isIgnored: isNegated,
    filenames,
    patterns,
    negatedPatterns,
  } = relativePatternMatcher(cwd, pattern)
  // const { filenames, isMatch, isGlob} = relativePatternMatcher(cwd, pattern)

  const _isMatch = x =>
    // !isFileIgnored(x) && (isFileMatch(x) || (!isIgnored(x) && isMatch(x)))
    isFileMatch(x) || (!isIgnored(x) && isMatch(x))

  if (split) {
    return {
      filenames,
      patterns,
      isFileMatch,
      isIgnored: x => isNegated(x) || isIgnored(x),
      ignorePatterns: [
        ...ignoreFilenames,
        ...ignoreNegatedFilenames,
        ...ignorePatterns,
        ...ignoreNegatedPatterns,
        ...negatedPatterns,
      ],
    }
  } else {
    return _isMatch
  }
}
// const relativeMatcher = ({ cwd, pattern, ignore } = {}) => {
//   if (!pattern) return nope
//
//   // const ignoreMatcher = filenameOverGlobMatcher(cwd, ignore)
//   // const { isMatch: isIgnored, isFileMatch: isFileIgnored } = ignoreMatcher
//   const isIgnored = relativePatternMatcher(cwd, ignore, false)
//
//   const { isMatch, isFileMatch } = relativePatternMatcher(cwd, pattern)
//
//   return x =>
//     // !isFileIgnored(x) && (isFileMatch(x) || (!isIgnored(x) && isMatch(x)))
//     isFileMatch(x) || (!isIgnored(x) && isMatch(x))
// }

export default relativeMatcher
