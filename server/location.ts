import type { AppConfig } from './config.js'
import { SourceError } from './errors.js'
import type { LocationSelector } from '../src/shared/contracts.js'
import type { ResolvedLocation } from './types.js'

export function resolveLocation(selector: LocationSelector, config: AppConfig): ResolvedLocation {
  if (selector.kind === 'home') {
    if (!config.home) {
      throw new SourceError(
        'missing-configuration',
        'No usable device location or home fallback is configured.',
        false,
        400,
      )
    }
    return {
      latitude: config.home.latitude,
      longitude: config.home.longitude,
      provenance: { kind: 'home', label: config.home.label, capturedAt: null },
    }
  }

  return {
    latitude: selector.latitude,
    longitude: selector.longitude,
    provenance: {
      kind: selector.kind,
      label: selector.kind === 'current' ? 'Current device location' : 'Last known location',
      capturedAt: selector.capturedAt,
    },
  }
}
