## Mobile Bookmark Visibility and Favicons

### What this does

Refines the existing mobile bookmark source with targets at least 60 pixels wide at 360px: Dawn gives Places to go 65% of its utility rail while retaining visible groups and 48px height, and Dense uses a five-link 60×58 shelf. It also keeps transient status notices away from every interactive control and replaces the generic bookmark glyph with a deterministic name-derived mark. The favicon resolver can now accept one HTTPS icon-host redirect while pinning connections to public DNS results, preserving the browser’s same-origin route and every existing deadline, cache, concurrency, body, parser, and response boundary.

### How to test

1. Run `npm run check`.
2. Run `npm run test:e2e`.
3. At 360×800, inspect Dawn and Dense in System, Light, and Dark; confirm all five bookmarks are visible, each complete mark/name cell is at least 60px wide, and a refresh notice does not cover any control.
4. At 360×650 with more than five bookmarks, confirm the document remains fixed and only the bookmark-owned region scrolls vertically.
5. Exercise favicon success, safe HTTPS redirect, invalid image, timeout, and unavailable cases; confirm the browser requests only `/api/bookmarks/{id}/favicon`, successful bytes use their signature-normalized MIME, and every failure retains the name-derived mark and working link.

### Notes for reviewer

The host bookmark document remains authoritative and unchanged. Remote icons are still cosmetic and process-cached only. A redirected icon may use one different HTTPS origin, but only through an Undici dispatcher that rejects non-public, mixed public/private, loopback, link-local, private, documentation, multicast, and Tailscale-range address results and pins the actual connection through that checked lookup. A second redirect origin, credentials, a non-default port, HTTP downgrade, or disallowed address remains unavailable.

Dense uses `display: contents` for labelled group wrappers so host-ordered links can occupy equal shelf tracks while their `nav` semantics remain present. Dawn and desktop group headings remain visible and their order is unchanged.
