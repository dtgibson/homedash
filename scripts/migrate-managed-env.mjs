import { readFile, writeFile } from 'node:fs/promises'

const targetPath = process.argv[2]
if (!targetPath) throw new Error('An environment file path is required.')

const source = await readFile(targetPath, 'utf8')
const radiusLines = source.match(/^[\t ]*EBIRD_RADIUS_KM[\t ]*=.*$/gm) ?? []
const isManagedDefault =
  radiusLines.length === 1 && /^EBIRD_RADIUS_KM=50\r?$/.test(radiusLines[0] ?? '')

if (isManagedDefault) {
  await writeFile(targetPath, source.replace(/^EBIRD_RADIUS_KM=50(?=\r?$)/m, 'EBIRD_RADIUS_KM=16'))
  process.stdout.write('updated')
} else {
  process.stdout.write('preserved')
}
