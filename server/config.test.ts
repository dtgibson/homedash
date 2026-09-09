import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

describe('bookmark document origin configuration', () => {
  it('uses only exact configured canonical origins', () => {
    expect(
      loadConfig({
        HOMEDASH_PORT: '1910',
        HOMEDASH_ALLOWED_ORIGINS:
          'http://127.0.0.1:1910,https://home.example.ts.net:1910,http://127.0.0.1:1910',
      }).bookmarkDocumentOrigins,
    ).toEqual(['http://127.0.0.1:1910', 'https://home.example.ts.net:1910'])
  })

  it.each([
    'https://home.example.ts.net:1910/',
    'https://home.example.ts.net:1910/path',
    'http://home.example.ts.net:1910',
    'https://user@home.example.ts.net:1910',
    'https://home.example.ts.net:1910,',
  ])('rejects a non-canonical or unsafe configured origin: %s', (origin) => {
    expect(() => loadConfig({ HOMEDASH_ALLOWED_ORIGINS: origin })).toThrow(
      /HOMEDASH_ALLOWED_ORIGINS/,
    )
  })
})
