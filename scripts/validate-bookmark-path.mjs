import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

function canonicalCandidate(candidate) {
  const suffix = []
  let existing = path.resolve(candidate)
  while (!existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) break
    suffix.unshift(path.basename(existing))
    existing = parent
  }
  return path.resolve(realpathSync(existing), ...suffix)
}

function isInside(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`)
}

export function validateBookmarkPath({ appDir, homeDir, unitDir, stateRoot, bookmarksFile }) {
  const resolvedFile = path.resolve(bookmarksFile)
  const resolvedParent = path.dirname(resolvedFile)
  const canonicalParent = canonicalCandidate(resolvedParent)
  const canonicalHome = realpathSync(homeDir)
  const canonicalApp = realpathSync(appDir)
  const canonicalUnit = canonicalCandidate(unitDir)
  const canonicalStateRoot = canonicalCandidate(stateRoot)
  const canonicalConfigRoot = canonicalCandidate(path.join(canonicalHome, '.config'))

  const canonicalSystemRoots = ['/etc', '/usr', '/bin', '/sbin', '/System', '/Library'].map(
    canonicalCandidate,
  )
  const canonicalBroadRoots = ['/var', '/run'].map(canonicalCandidate)

  const forbiddenParents = new Set(
    [
      path.parse(canonicalParent).root,
      canonicalHome,
      canonicalApp,
      canonicalUnit,
      path.dirname(canonicalUnit),
      canonicalConfigRoot,
      path.join(canonicalHome, '.local'),
      path.join(canonicalHome, '.local', 'share'),
      canonicalStateRoot,
      tmpdir(),
      ...canonicalBroadRoots,
    ].map(canonicalCandidate),
  )
  if (forbiddenParents.has(canonicalParent)) {
    throw new Error('BOOKMARKS_PATH parent is too broad or sensitive for service write access.')
  }

  const sensitiveTrees = [
    canonicalConfigRoot,
    path.join(canonicalHome, '.ssh'),
    canonicalUnit,
    path.join(canonicalApp, '.git'),
    path.join(canonicalApp, 'pipeline'),
    path.join(canonicalApp, 'scripts'),
    path.join(canonicalApp, 'server'),
    path.join(canonicalApp, 'src'),
    ...canonicalSystemRoots,
  ].map(canonicalCandidate)
  if (sensitiveTrees.some((root) => isInside(canonicalParent, root))) {
    throw new Error('BOOKMARKS_PATH cannot be inside a sensitive configuration directory.')
  }

  if (existsSync(resolvedFile)) {
    const fileStat = lstatSync(resolvedFile)
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new Error('BOOKMARKS_PATH must select a regular, non-symlink file.')
    }
    const fileName = path.basename(resolvedFile)
    const canonicalFile = path.join(canonicalParent, fileName)
    const legacyDefault = path.join(canonicalApp, 'config', 'bookmarks.json')
    const unrelatedEntries = readdirSync(resolvedParent).filter(
      (entry) =>
        entry !== fileName &&
        !(entry.startsWith(`.${fileName}.homedash-`) && entry.endsWith('.tmp')),
    )
    if (canonicalFile !== legacyDefault && unrelatedEntries.length > 0) {
      throw new Error('BOOKMARKS_PATH must use a dedicated directory without unrelated files.')
    }
    return
  }

  if (existsSync(resolvedParent) && readdirSync(resolvedParent).length > 0) {
    throw new Error('A new BOOKMARKS_PATH must use an empty dedicated directory.')
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [appDir, homeDir, unitDir, stateRoot, bookmarksFile] = process.argv.slice(2)
  if (![appDir, homeDir, unitDir, stateRoot, bookmarksFile].every(Boolean)) {
    process.stderr.write('bookmark path validation requires five path arguments.\n')
    process.exitCode = 2
  } else {
    try {
      validateBookmarkPath({ appDir, homeDir, unitDir, stateRoot, bookmarksFile })
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'BOOKMARKS_PATH is invalid.'}\n`,
      )
      process.exitCode = 1
    }
  }
}
