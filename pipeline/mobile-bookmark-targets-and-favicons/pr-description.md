## Mobile Bookmark Targets and Favicons

### What this does

Makes every mobile bookmark in Dawn and Dense a 48×48 CSS-pixel minimum target while preserving the host file's groups, names, destinations, and order. Each link now reserves a fixed decorative icon slot that progressively loads a conventional favicon through a bounded same-origin server resolver and otherwise keeps a neutral local fallback visible without delaying or changing navigation.

### How to test

1. Run `npm install`, then start the app with `npm run dev`.
2. Open `http://127.0.0.1:5173` at 360×800 and confirm all five normal bookmarks are visible in Dawn without document or bookmark-region scrolling.
3. Switch to Dense, then through System, Light, and Dark, and confirm the same bookmark names, groups, destinations, order, icon slots, and fallback behavior remain.
4. Inspect each mobile bookmark target and confirm it is at least 48×48 CSS pixels; tab through the links and confirm the 2px bright-gold outline, 3px offset, and unclipped focus clearance.
5. Confirm successful conventional favicons replace only the neutral glyph. Block or fail a favicon request and confirm the fallback remains while the complete text link still opens its configured destination in the same tab.
6. Request a current `GET /api/bookmarks/:bookmarkId/favicon` route and confirm a valid raster response uses private caching and `nosniff`; confirm malformed IDs, query strings, unsupported methods, removed IDs, invalid images, cross-origin redirects, and unavailable upstreams return empty non-redirecting `404` responses.
7. Run `npm test`, `npm run test:e2e`, and `npm run check`.

### Notes for reviewer

- The favicon resolver accepts only bounded, non-animated ICO, PNG, or JPEG data from the configured bookmark origin's `/favicon.ico`; it follows at most two same-origin redirects and never forwards browser or configured credentials.
- Positive and negative outcomes use a process-local 128-entry LRU, same-key requests coalesce, upstream work is capped at four requests, and one two-second deadline covers queueing through validation. Nothing is persisted and no bookmark or environment format changed.
- Favicon coverage intentionally yields to privacy and safety: sites without a valid conventional icon show the stable fallback. There is no third-party favicon service, webpage scraping, direct browser-origin request, or CSP expansion.

