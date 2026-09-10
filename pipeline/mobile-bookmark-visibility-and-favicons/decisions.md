# Decisions — Mobile Bookmark Visibility and Favicons

## Mobile bookmarks receive the width they need in each renderer

The established visual system remains unchanged on desktop. At the compact mobile breakpoint, Dawn changes its utility rail from a near-even split to 35/65 so the existing three bookmark groups produce targets at least 60px wide without displacing coding-runway data or breaking the one-glance budget. Dense uses its already-full-width row as a five-link shelf while keeping labelled navigation groups in the accessibility tree. This is a scoped Dense exception to the visible group-heading pattern because reachability and target separation are the trigger for the improvement.

## Remote icons remain optional; the fallback becomes specific

The server may safely recover more conventional favicon redirects, but a remote image remains cosmetic and untrusted. Every bookmark therefore receives a deterministic, two-letter monogram from its visible name in the existing fixed mark slot. This makes rejected and unavailable images intentionally distinct without inventing a new icon store or changing bookmark data.
