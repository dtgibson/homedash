## homedash v1

### What this does

Homedash v1 is a private, responsive browser start page with Dawn and Dense presentations over the same live data. It combines location-aware weather and daylight, ordered host-configured bookmarks, SnowRaven-backed eBird targets and month-to-date progress, and authoritative Claude and Codex headroom from llmdash.

Display mode and System, Light, or Dark appearance are saved independently in each browser. Weather, bookmarks, eBird, and llmdash load and fail independently, preserving useful last-good data with explicit stale or partial states.

### How to test

1. Copy `.env.example` to `.env` and `config/bookmarks.example.json` to `config/bookmarks.json`.
2. Add private home coordinates and update the SnowRaven or llmdash URLs if those services are not running on the same host.
3. Run `npm install`, then `npm run build && npm start`.
4. Open `http://127.0.0.1:1910` on the host, or `http://<pi-tailscale-ip>:1910` from another device on the tailnet after setting `HOMEDASH_HOST` to the Pi's Tailscale IPv4 address.
5. Check current conditions, high and low, precipitation, sunrise, sunset, and the Current, Last known, or Home location label.
6. Check Lifers, Photo, and Audio. Each category must be closest-first, and the monthly distinct-species count must compare this month through today with the same dates last year.
7. Check that Claude and Codex show the five-hour and weekly percentages and reset times supplied by llmdash without filling in omitted values.
8. Switch between Dawn and Dense and between System, Light, and Dark. Reload and confirm the choices persist only in that browser.
9. Edit `config/bookmarks.json`, reload, and confirm valid bookmarks appear in file order without rebuilding.
10. Use Location and Refresh and confirm a failed source does not hide or block successful widgets.

### Notes for reviewer

- Production runs as one systemd-managed Node.js process on loopback port `1910`. The Pi installer adds a dedicated tailnet-only Tailscale HTTPS listener on the same port and preserves existing Serve routes.
- SnowRaven remains the adapter and source for eBird observations, personal history, and Macaulay media history. Homedash keeps no duplicate birding database.
- Lifer, photo, and audio targets are canonically deduplicated, sorted by numeric distance ascending, then by recency only when distances tie. Unknown distances come last, and the display limit is applied after sorting.
- llmdash values are displayed as supplied. Missing values remain unavailable rather than being derived.
- Remote browser geolocation generally requires HTTPS. Direct HTTP over the tailnet still works with an eligible last-known or configured home location; use Tailscale HTTPS for current location from each remote device.
- Precise coordinates, real bookmarks, and private upstream addresses stay in ignored host configuration and are never bundled into the browser.

### Convention Flags

- Keep private upstream URLs, coordinates, and bookmarks server-side; browser code calls same-origin normalized endpoints only.
- Give each dynamic widget its own endpoint, freshness policy, retry path, and last-good snapshot so failures stay isolated.
- Feed all display modes from one normalized dashboard state so presentation never changes values, freshness, or ordering.
- Store display and appearance preferences together under the versioned per-browser key `homedash.preferences.v1`.
- For nearby eBird targets, deduplicate before sorting, order known numeric distances ascending, use recency only as an equal-distance tie-breaker, put unknown distances last, and cap after sorting.
- Treat bookmark file order as display order; do not introduce a competing client-side store.
