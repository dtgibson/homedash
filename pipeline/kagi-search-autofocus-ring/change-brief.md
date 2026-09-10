# Change Brief — Kagi Search Autofocus Ring

## What is changing
Keep the existing Kagi search field focused when Homedash first loads, but replace the input-level outline that overlaps the Kagi label and surrounding toolbar with a compact focus treatment contained by the search form.

## Why now
The current autofocus behavior is useful, but its focus-visible outline extends beyond the input and visually collides with nearby content.

## User-facing impact
The search field remains ready for immediate typing on load. Its active state becomes clear without drawing a large rectangle across the label or toolbar.

## Design pass
Needed. Refine the existing Kagi search form's focused state so it feels deliberate, remains visibly keyboard-focused, and stays inside the component's current bounds in Dawn and Dense views.

## Decisions touched
- Five-build Spool: actionable and immediate context. This preserves the keyboard-first Kagi search while refining its presentation.
- Single-screen dashboard: bounded one-glance layouts. The focus treatment must remain contained within the masthead at target desktop and mobile viewports.

## What done looks like
Kagi is focused once on initial load and accepts typing immediately. No input outline overlaps the Kagi label or adjacent toolbar content, while keyboard focus remains clearly visible in both appearances and both dashboard views.
