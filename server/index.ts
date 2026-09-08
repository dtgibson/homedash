import 'dotenv/config'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = await buildApp({ config })

try {
  await app.listen({ host: config.host, port: config.port })
  process.stdout.write(`homedash listening on http://${config.host}:${config.port}\n`)
} catch (error) {
  process.stderr.write(
    `homedash could not start: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  )
  process.exitCode = 1
}
