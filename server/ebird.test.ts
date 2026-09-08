import { describe, expect, it } from 'vitest'
import {
  classifyTargetCategories,
  dedupeSortTargets,
  monthComparison,
  type SortableTarget,
} from './ebird'

const target = (
  speciesCode: string,
  distanceKm: number | null,
  observedAt: string,
  commonName = speciesCode,
): SortableTarget => ({
  speciesCode,
  commonName,
  distanceKm,
  observedAt,
  locality: `${commonName} marsh`,
})

describe('closest-first eBird targets', () => {
  const observations = [
    target('far', 18, '2026-09-07T10:00:00.000Z'),
    target('near', 1.2, '2026-09-05T10:00:00.000Z'),
    target('same-old', 4, '2026-09-01T10:00:00.000Z'),
    target('same-new', 4, '2026-09-07T10:00:00.000Z'),
    target('unknown-new', null, '2026-09-07T12:00:00.000Z'),
    target('duplicate', 9, '2026-09-07T12:00:00.000Z'),
    target('duplicate', 2.5, '2026-09-01T12:00:00.000Z'),
  ]

  it('deduplicates canonical species, prioritizes numeric distance, ties by recency, and puts unknown last', () => {
    const result = dedupeSortTargets(observations)
    expect(result.map((item) => item.speciesCode)).toEqual([
      'near',
      'duplicate',
      'same-new',
      'same-old',
      'far',
      'unknown-new',
    ])
    expect(result.find((item) => item.speciesCode === 'duplicate')?.distanceKm).toBe(2.5)
  })

  it.each(['lifer', 'photo', 'audio'] as const)(
    'sorts and only then applies the five-item cap for %s targets',
    (category) => {
      const profile = {
        seen: new Set<string>(),
        photo: new Set<string>(),
        audio: new Set<string>(),
        mediaAvailable: true,
      }
      const result = classifyTargetCategories(observations, profile, 5)[category]
      expect(result.map((item) => item.speciesCode)).toEqual([
        'near',
        'duplicate',
        'same-new',
        'same-old',
        'far',
      ])
      expect(result).toHaveLength(5)
    },
  )

  it('classifies each category from authoritative history sets without cross-category leakage', () => {
    const result = classifyTargetCategories(
      [target('a', 1, '2026-09-07T00:00:00.000Z'), target('b', 2, '2026-09-07T00:00:00.000Z')],
      {
        seen: new Set(['a']),
        photo: new Set(['b']),
        audio: new Set(),
        mediaAvailable: true,
      },
      5,
    )
    expect(result.lifer.map((item) => item.speciesCode)).toEqual(['b'])
    expect(result.photo.map((item) => item.speciesCode)).toEqual(['a'])
    expect(result.audio.map((item) => item.speciesCode)).toEqual(['a', 'b'])
  })
})

describe('month-to-date comparison', () => {
  it('counts distinct canonical species over equivalent partial periods', () => {
    const observations = [
      { speciesCode: 'a', date: '2026-09-01' },
      { speciesCode: 'a', date: '2026-09-02' },
      { speciesCode: 'b', date: '2026-09-07' },
      { speciesCode: 'late', date: '2026-09-08' },
      { speciesCode: 'a', date: '2025-09-01' },
      { speciesCode: 'old-late', date: '2025-09-08' },
    ]
    expect(
      monthComparison(observations, 'America/Los_Angeles', new Date('2026-09-07T18:00:00Z')),
    ).toMatchObject({
      throughDay: 7,
      currentCount: 2,
      previousCount: 1,
      difference: 1,
    })
  })
})
