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

describe('eBird radius configuration', () => {
  it('defaults standard installations to the ten-mile-equivalent radius', () => {
    expect(loadConfig({}).ebirdRadiusKm).toBe(16)
  })

  it('keeps a valid custom host radius authoritative', () => {
    expect(loadConfig({ EBIRD_RADIUS_KM: '23' }).ebirdRadiusKm).toBe(23)
  })
})

describe('private tide station configuration', () => {
  it('uses automatic selection for a missing station and defaults a fixed station label', () => {
    expect(loadConfig({}).tide).toEqual({ mode: 'automatic' })
    expect(loadConfig({ TIDE_STATION_LABEL: 'ignored\nwithout an override' }).tide).toEqual({
      mode: 'automatic',
    })
    expect(loadConfig({ TIDE_STATION_ID: ' 9414290 ' }).tide).toEqual({
      mode: 'fixed',
      stationId: '9414290',
      stationLabel: 'Local tide',
    })
  })

  it('accepts a trimmed private station label without changing the station ID', () => {
    expect(
      loadConfig({ TIDE_STATION_ID: '9414290', TIDE_STATION_LABEL: ' Alameda ' }).tide,
    ).toEqual({
      mode: 'fixed',
      stationId: '9414290',
      stationLabel: 'Alameda',
    })
  })

  it.each([
    [{ TIDE_STATION_ID: '../9414290' }, 'invalid-station'],
    [{ TIDE_STATION_ID: '9414290', TIDE_STATION_LABEL: 'unsafe\nlabel' }, 'invalid-label'],
    [{ TIDE_STATION_ID: '9414290', TIDE_STATION_LABEL: 'x'.repeat(101) }, 'invalid-label'],
  ])('isolates invalid tide settings as unavailable: %j', (source, reason) => {
    expect(loadConfig(source).tide).toEqual({ mode: 'unavailable', reason })
  })
})
