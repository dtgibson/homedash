## Convention Flags

- Keep private upstream URLs, coordinates, and bookmarks on the server. Browser code talks only to same-origin normalized endpoints.
- Give every dynamic widget its own endpoint, loading/error/freshness state, retry path, and browser last-good snapshot so one failing source never hides the rest of the page.
- Feed every presentation from the same normalized dashboard state. A new display mode may change layout, but never source values, freshness, or ordering.
- Store view and appearance preferences together under the versioned per-browser key `homedash.preferences.v1`.
- For nearby eBird targets, canonically deduplicate species before sorting. Sort known numeric distances ascending, use newest observation only to break equal-distance ties, put unknown distances last, and apply the result limit after sorting.
- Keep bookmark order host-owned: the order in `config/bookmarks.json` is the display order after reload, with no client-side editor or competing store.
