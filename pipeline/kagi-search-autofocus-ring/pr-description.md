## Kagi Search Autofocus Ring

### What this does
Keeps the existing Kagi query focused once when Homedash loads, while replacing its oversized offset outline with a contained two-pixel inset focus rule. The shared form border still changes to the established gold active color, so keyboard focus stays visible without covering the Kagi label or nearby toolbar content.

### How to test
1. Open Homedash and confirm the Kagi field is ready for typing immediately.
2. Check that the focused input has a gold lower-edge rule but no outline outside the search form.
3. Move focus to Settings and confirm Kagi does not reclaim it.
4. Repeat in Dawn and Dense, light and dark, at desktop and mobile widths.
5. Run the focused component and browser tests.

### Notes for reviewer
The autofocus logic is unchanged. The implementation is limited to the Kagi input's focus-visible CSS and a browser assertion that the field remains focused with an inset rather than offset treatment.
