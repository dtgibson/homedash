# Strategic Brief — homedash v1

## What We’re Building

A personal, mobile-friendly browser start page with two complete display modes over one shared data layer:

- **Dawn** — rich, visual, and editorial.
- **Dense** — sparse, compact, and fast to scan.

Both modes show the same four widgets: weather, bookmarks, eBird, and llmdash. The app runs locally on a personal machine or Pi and can be reached from other devices over the tailnet.

## Why Now

The information needed at the start of a session is scattered across several apps and services. Building the complete shared foundation now avoids duplicating data work later and makes the display-mode choice meaningful from the first usable release.

## The User Problem

The user wants one glanceable page that answers four morning questions:

- What is the weather and daylight picture where this device is?
- Which saved destinations matter today?
- Which nearby birds are worthwhile targets, and how is this month comparing with last year?
- How much Claude and Codex headroom remains?

It must work equally well on a laptop or phone while remembering how each device prefers to present it.

## Success Criteria

- The same app can run on the user’s machine or Pi and is reachable from other devices over Tailscale.
- Dawn and Dense both render all four widgets from the same underlying data.
- Each device independently remembers its Dawn/Dense choice.
- Each device independently remembers System, Light, or Dark appearance, defaulting to System.
- Weather and sunrise/sunset reflect the device’s current location when permission is available.
- Weather remains useful when geolocation is unavailable by using a locally cached last-known location, then a configured home fallback.
- eBird shows top nearby lifers, photo targets, and audio targets, plus the current month’s species count compared with the same month last year.
- Bookmarks load from one host-side configuration shared by every device.
- llmdash clearly shows Claude and Codex 5-hour and weekly headroom, reset times, freshness, and error states.
- The page remains readable and useful on both phone and desktop.

## Scope

- A locally runnable web application suitable for deployment on a personal machine or Pi.
- Tailnet access without public internet exposure.
- Responsive Dawn and Dense presentations sharing one data model.
- Per-device layout and appearance preferences stored in the browser.
- Browser geolocation on launch, local last-known-location caching, and a configured home fallback.
- Key-free weather, forecast, sunrise, and sunset data through Open-Meteo.
- Live eBird-backed nearby lifer, photo-target, audio-target, and month-over-month comparison data.
- A host-side bookmarks configuration file and read-only bookmarks widget.
- Read-only consumption of llmdash’s existing APIs for Claude and Codex limit data.
- Honest loading, stale, unavailable, permission-denied, and source-error states.
- The clearest visual treatment for llmdash data in each mode, chosen during design.

## Out of Scope

- A browser extension or native new-tab override.
- Public hosting, accounts, multi-user support, or an additional login layer.
- In-page bookmark creation, editing, deletion, or reordering.
- Server-synced display or appearance preferences.
- Reimplementing llmdash quota calculations.
- A third display mode.
- Alerts, notifications, long-term analytics, or additional widgets.
- Manual duplicate stores for eBird lifer, photo, or audio status.

## Key Decisions

- Build the whole v1 now: both display modes and all four widgets.
- Keep Dawn/Dense layout separate from System/Light/Dark appearance; both settings persist per device.
- Default appearance to the device’s system setting.
- Use browser location per device rather than one server location.
- Cache the last successful location locally and retain a configured home location as the final fallback.
- Treat eBird as the live source of truth for personal birding status and comparisons.
- Keep bookmarks in a shared host-side configuration for v1.
- Treat llmdash as an authoritative data source and display its existing results without deriving quota values again.
- Package one web app that works locally and can be hosted unchanged on the Pi behind Tailscale.
