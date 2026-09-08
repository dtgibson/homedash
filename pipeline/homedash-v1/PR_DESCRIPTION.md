## homedash v1

### What this does

Homedash v1 is a private, responsive start page with two presentations over the same live data. Dawn and Dense both show location-aware weather and daylight, host-configured bookmarks, SnowRaven-backed eBird progress and nearby targets, and authoritative Claude/Codex headroom from llmdash.

Display mode and System/Light/Dark appearance are remembered independently by each browser. Dynamic sources load and fail independently, with source-specific freshness, retry, and last-good fallback behavior.

### How to test

1. Copy `.env.example` to `.env` and `config/bookmarks.example.json` to `config/bookmarks.json`.
2. Set the private home location and any SnowRaven or llmdash URL overrides in `.env`.
3. Run `npm install`, then `npm run build && npm start`.
4. Open `http://127.0.0.1:1910` on the host, or the configured Pi Tailscale address on port 1910 from another tailnet device.
5. Allow location access and confirm the location label, current weather, forecast, sunrise, and sunset update for the device.
6. Open Lifers, Photo, and Audio in the birding section. Confirm each list is closest-first and the month-to-date species count is compared with the same period last year.
7. Confirm Claude and Codex show the exact five-hour and weekly values supplied by llmdash, including reset times where available.
8. Switch between Dawn and Dense and between System, Light, and Dark. Reload the page and confirm both choices persist in that browser without changing a second browser's choices.
9. Edit the bookmark file, reload the page, and confirm valid entries appear in file order without rebuilding.
10. Use Location and Refresh to confirm each source can retry without a page reload or hiding successful widgets.

### Notes for reviewer

- Production is a single Node.js process. It binds to `127.0.0.1:1910` by default; set `HOMEDASH_HOST` to the Pi's Tailscale IPv4 address for direct tailnet access.
- SnowRaven is the adapter for current eBird records, personal life-list history, and Macaulay media history. Homedash does not keep a second birding database.
- Nearby lifer, photo, and audio targets are canonically deduplicated, sorted by numeric distance ascending, then by recency only for equal distances. Unknown distances come last, and the configured limit is applied after sorting.
- llmdash values are displayed as supplied. Missing values remain unavailable rather than being calculated locally.
- Browser geolocation requires a secure context away from localhost. For per-device current location over the tailnet, put the service behind Tailscale HTTPS; direct `http://<tailscale-ip>:1910` still supports the configured home fallback.
- Private coordinates, upstream addresses, and the real bookmark file remain untracked. The committed files contain examples only.
