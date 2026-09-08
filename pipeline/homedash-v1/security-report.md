# Security Review — homedash v1

**Date:** 2026-09-08
**Feature:** homedash-v1
**Stack:** React + Vite frontend; Node.js + Fastify backend
**Checklist:** React + Vite; FastAPI checklist used for shared server concerns; OWASP Top 10 fallback for the unmapped Fastify backend
**Outcome:** PASSED WITH NOTES

---

## Summary

The browser, Fastify boundary, private host configuration, production bundle, dependency tree, and live tailnet listener were reviewed. No Critical, High, Medium, or Low security issues were found, and `npm audit` reported zero known vulnerabilities across production and development dependencies. One informational defense-in-depth note is recorded for future growth: the external-call endpoints rely on the private tailnet boundary, request validation, timeouts, caching, and in-flight deduplication rather than an application-level request limit.

---

## Findings

### External-call endpoints have no application-level rate limit

**Severity:** Informational
**Location:** `server/app.ts:54`, `server/app.ts:96`, `server/app.ts:122`
**Description:** Weather, eBird, and llmdash endpoints can initiate upstream work. The approved v1 deployment binds Fastify to loopback and exposes it through a tailnet-only Tailscale listener, so untrusted internet clients cannot reach these routes. Timeouts, caches, body limits, and in-flight request deduplication further constrain work, but there is no explicit per-client request ceiling inside Fastify.
**Remediation:** If homedash gains more users, expensive widgets, or any exposure beyond this private tailnet, add a reverse-proxy-aware rate limiter to the dynamic API routes and set source-specific limits.
**Status:** Accepted for the single-owner, tailnet-only v1 threat model

---

## Checks Performed

### React + Vite

| Check | Result |
| --- | --- |
| No API keys, tokens, or secrets in source | Pass — sensitive addresses and coordinates come from ignored host configuration |
| Client environment variables expose no secrets | Pass — the client uses no `VITE_` variables |
| `.env` and private bookmark configuration are ignored | Pass — verified with `git check-ignore` |
| Vite configuration contains no credentials | Pass |
| Browser requests use same-origin backend endpoints | Pass — no direct SnowRaven, llmdash, or Open-Meteo client calls |
| API errors are normalized before display | Pass — no stack traces or raw upstream bodies reach the browser |
| Authentication headers and token storage | Not applicable — access control is the tailnet listener; the app has no account or token flow |
| User-controlled HTML rendering | Pass — React escaping is used and no `dangerouslySetInnerHTML` exists |
| Bookmark URLs are safe for navigation | Pass — only validated HTTP and HTTPS URLs reach `href` |
| State-changing browser input is validated | Pass — Radix values and shared Zod contracts constrain accepted values |
| Known dependency vulnerabilities | Pass — `npm audit` found 0 vulnerabilities in 426 total dependencies |
| Direct dependencies are current and supported | Pass — production packages are current; the only `npm outdated` result was a non-production TypeScript major |
| Unused dependencies | Pass — every direct production package has a corresponding import or runtime role |
| Browser source maps absent from production | Pass — `dist` contains no source maps |
| Sensitive console logging absent | Pass — no client console logging exists |
| Development-only code absent from the browser bundle | Pass |

### Fastify and generic server checks

| Check | Result |
| --- | --- |
| Authentication and authorization | Not applicable — single-owner tailnet access is the approved trust boundary and the listener is confirmed tailnet-only |
| Database query injection | Not applicable — homedash has no database or query language |
| Shell, process, `eval`, or dynamic-code injection | Pass — no user input reaches shell execution or dynamic evaluation |
| Path traversal | Pass — the only configurable file path is trusted host configuration; requests cannot select a file path |
| XML external entities | Not applicable — no XML is accepted |
| Dependency versions and integrity | Pass — package lock records exact versions, registry URLs, and integrity hashes |
| Request-body validation | Pass — Zod validates location and time-zone payloads before upstream access |
| Query and path parameter validation | Not applicable — public application routes accept no user-selected path or query parameters |
| File upload validation | Not applicable — homedash accepts no uploads |
| Request-size limit | Pass — Fastify caps bodies at 32 KiB; a 40 KiB probe returned HTTP 413 |
| Generic exception handling | Pass — unexpected errors produce normalized 4xx/5xx responses without stack traces |
| Upstream and validation errors | Pass — errors expose only bounded, user-actionable messages |
| Debug mode | Pass — production starts compiled Node output with Fastify logging disabled |
| Secrets and private addresses in committed files | Pass — examples contain loopback placeholders only; real values remain ignored |
| Environment configuration validation | Pass — startup rejects invalid ports, URLs, coordinates, units, ranges, and incomplete coordinate pairs |
| Cross-origin access | Pass — no permissive CORS headers are emitted; an untrusted Origin probe received no access-control allowance |
| Security headers | Pass — CSP, frame denial, referrer policy, MIME sniffing protection, permissions policy, and same-origin resource policy are live |
| HTTPS exposure | Pass — Tailscale serves valid HTTPS on port 1910 and reports the listener as tailnet-only |
| External-call rate limiting | Finding — see informational note above |
| External-call resilience | Pass — 8-second upstream timeout, redirect rejection, caching, and in-flight deduplication are enforced |

### OWASP Top 10 fallback

| Check | Result |
| --- | --- |
| Broken access control | Pass within the approved model — Fastify is loopback-only and Tailscale owns authenticated network access |
| Cryptographic failures | Pass — homedash stores no credentials or sensitive server database; transport is Tailscale HTTPS |
| Injection | Pass — structured validation, React escaping, safe URL schemes, and no command/database execution |
| Insecure design | Pass — private upstreams remain behind a same-origin adapter and failures stay isolated |
| Security misconfiguration | Pass — production security headers and loopback binding are verified live |
| Vulnerable components | Pass — zero known vulnerabilities |
| Authentication failures | Not applicable — no application authentication flow exists |
| Software and data integrity | Pass — deterministic lockfile with package integrity metadata |
| Logging and monitoring failures | Not applicable for the single-process personal v1; responses do not leak diagnostics |
| Server-side request forgery | Pass — upstream origins come only from trusted host configuration, never request data, and redirects are rejected |

---

## Live Deployment Evidence

- Node listens only on `127.0.0.1:1910`; Tailscale owns the tailnet IP listeners.
- Tailscale reports the dedicated HTTPS listener on port `1910` as tailnet-only.
- The browser bundle contains no SnowRaven hostname, llmdash address, host coordinate, or environment variable name.
- The HTTPS response includes the approved CSP and security headers.
- Cross-origin probing produced no permissive CORS header.
- Browser source maps are not served. TypeScript server maps remain local and outside the static root.

## Convention Flags

- Keep Fastify bound to loopback and let Tailscale provide authenticated HTTPS exposure.
- Add application-level rate limiting before homedash becomes multi-user, publicly reachable, or substantially more expensive per refresh.
