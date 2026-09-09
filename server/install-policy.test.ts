import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

let root: string
let homeDir: string
let appDir: string
let unitDir: string
let stateRoot: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'homedash-install-policy-'))
  homeDir = path.join(root, 'home')
  appDir = path.join(homeDir, 'homedash')
  unitDir = path.join(homeDir, '.config', 'systemd', 'user')
  stateRoot = path.join(homeDir, '.local', 'state')
  await Promise.all([
    mkdir(path.join(appDir, '.git'), { recursive: true }),
    mkdir(unitDir, { recursive: true }),
    mkdir(path.join(homeDir, '.ssh'), { recursive: true }),
    mkdir(stateRoot, { recursive: true }),
  ])
})

function validate(bookmarksFile: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'scripts', 'validate-bookmark-path.mjs'),
      appDir,
      homeDir,
      unitDir,
      stateRoot,
      bookmarksFile,
    ],
    { encoding: 'utf8' },
  )
}

describe('installer bookmark path policy', () => {
  it('allows a new dedicated state directory and an existing safe configured file', async () => {
    const dedicated = validate(path.join(stateRoot, 'homedash', 'bookmarks', 'bookmarks.json'))
    expect(dedicated.status).toBe(0)

    const existingParent = path.join(appDir, 'config')
    const existingFile = path.join(existingParent, 'bookmarks.json')
    await mkdir(existingParent)
    await writeFile(existingFile, '[]')
    await writeFile(path.join(existingParent, 'bookmarks.example.json'), '[]')
    expect(validate(existingFile).status).toBe(0)
  })

  it.each([
    ['home', () => path.join(homeDir, 'bookmarks.json')],
    ['application root', () => path.join(appDir, 'bookmarks.json')],
    ['state root', () => path.join(stateRoot, 'bookmarks.json')],
    ['systemd units', () => path.join(unitDir, 'bookmarks.json')],
    [
      'nested user configuration',
      () => path.join(homeDir, '.config', 'private-app', 'bookmarks.json'),
    ],
    ['SSH configuration', () => path.join(homeDir, '.ssh', 'nested', 'bookmarks.json')],
    ['application metadata', () => path.join(appDir, '.git', 'state', 'bookmarks.json')],
    ['canonical system alias', () => path.join('/etc', 'homedash', 'bookmarks.json')],
  ])('rejects the broad or sensitive %s parent', (_name, candidate) => {
    const result = validate(candidate())
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/broad|sensitive/)
  })

  it('requires an empty dedicated parent before creating a new bookmark file', async () => {
    const parent = path.join(homeDir, 'mixed-state')
    await mkdir(parent)
    await writeFile(path.join(parent, 'valued-file'), 'keep')

    const result = validate(path.join(parent, 'bookmarks.json'))
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('empty dedicated directory')
  })

  it('rejects an existing custom bookmark file beside unrelated valued files', async () => {
    const parent = path.join(homeDir, 'mixed-existing')
    await mkdir(parent)
    const bookmarksFile = path.join(parent, 'bookmarks.json')
    await writeFile(bookmarksFile, '[]')
    await writeFile(path.join(parent, 'valued-file'), 'keep')

    const result = validate(bookmarksFile)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('without unrelated files')
  })
})
