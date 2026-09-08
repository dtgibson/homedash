import type { ApiIssue } from '../src/shared/contracts.js'

export type IssueCode = ApiIssue['code']

export type FetchLike = typeof fetch

export interface ResolvedLocation {
  latitude: number
  longitude: number
  provenance: {
    kind: 'current' | 'last-known' | 'home'
    label: string
    capturedAt: string | null
  }
}
