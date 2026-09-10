import { spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
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

function migrateManagedEnv(envPath: string) {
  return spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'scripts', 'migrate-managed-env.mjs'), envPath],
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

describe('installer private tide configuration', () => {
  it('creates optional placeholders and adds only missing tide keys on update', async () => {
    const installer = await readFile(
      path.join(process.cwd(), 'scripts', 'install-or-update.sh'),
      'utf8',
    )
    const bootstrap = await readFile(path.join(process.cwd(), 'scripts', 'bootstrap.sh'), 'utf8')

    expect(installer).toContain('TIDE_STATION_ID=${TIDE_STATION_ID:-}')
    expect(installer).toContain('TIDE_STATION_LABEL=${TIDE_STATION_LABEL:-Local tide}')
    expect(installer).toContain("grep -Eq '^[[:space:]]*TIDE_STATION_ID=' .env")
    expect(installer).toContain("grep -Eq '^[[:space:]]*TIDE_STATION_LABEL=' .env")
    expect(bootstrap).toContain('TIDE_STATION_ID="${TIDE_STATION_ID:-}"')
    expect(bootstrap).toContain('TIDE_STATION_LABEL="${TIDE_STATION_LABEL:-Local tide}"')
  })
})

describe('installer managed eBird radius migration', () => {
  it('updates only the exact prior default while preserving bytes and file mode', async () => {
    const envPath = path.join(root, '.env')
    await writeFile(envPath, 'FIRST=value\r\nEBIRD_RADIUS_KM=50\r\nLAST=kept\r\n')
    await chmod(envPath, 0o640)

    const result = migrateManagedEnv(envPath)

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('updated')
    expect(await readFile(envPath, 'utf8')).toBe(
      'FIRST=value\r\nEBIRD_RADIUS_KM=16\r\nLAST=kept\r\n',
    )
    expect((await stat(envPath)).mode & 0o777).toBe(0o640)
  })

  it.each([
    ['custom value', 'EBIRD_RADIUS_KM=23\n'],
    ['leading whitespace', ' EBIRD_RADIUS_KM=50\n'],
    ['assignment whitespace', 'EBIRD_RADIUS_KM =50\n'],
    ['inline comment', 'EBIRD_RADIUS_KM=50 # managed?\n'],
    ['duplicate exact keys', 'EBIRD_RADIUS_KM=50\nEBIRD_RADIUS_KM=50\n'],
    ['mixed duplicate keys', 'EBIRD_RADIUS_KM=50\n EBIRD_RADIUS_KM=23\n'],
    ['missing key', 'OTHER=value\n'],
  ])('preserves a %s environment file byte for byte', async (_case, source) => {
    const envPath = path.join(root, '.env')
    await writeFile(envPath, source)

    const result = migrateManagedEnv(envPath)

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('preserved')
    expect(await readFile(envPath, 'utf8')).toBe(source)
  })
})
