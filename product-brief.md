# Product Brief — homedash

## What This Is
A personal browser start page. One glance, first thing in the morning: today's
weather, your bookmarks, where your eBird year stands, and how much AI coding
headroom llmdash says you have left.

It ships **two display modes over the same data** — a rich mode and a text mode —
with a switcher between them, so each device can settle on the one that suits it.

## The Problem
The default new-tab page is a search box and a grid of thumbnails you didn't
choose. The things actually worth knowing at the start of a session live in four
different places: a weather app, eBird, llmdash on :8787, and a bookmarks bar
that has long since stopped being scannable.

## Who It's For
You. Single user, your own machine, opened dozens of times a day across a laptop,
a phone, and whatever else is on the tailnet.

## Founding Decisions
- **Two display modes, one data source.** Both modes render the same four
  widgets; neither is a subset of the other's data.
  - **Rich mode** ("Dawn") — warm dark ground, editorial serif for the human
    parts, mono for every figure, one gold accent. A sun arc tracks the real
    day. Green for eBird, terracotta/blue for Claude/Codex, matching llmdash's
    own dark theme.
  - **Text mode** ("Dense") — no cards. One scanning column of
    hairline-separated rows, everything visible at once. Closest in spirit to a
    terminal, and to llmdash itself.
- **The mode is per device, and it sticks.** Switching on the laptop must not
  change what the phone shows.
- **Four widgets:** weather, bookmarks, eBird stats, llmdash stats.
- **llmdash is a data source, not a dependency to rebuild.** It already serves
  `/api/state`, `/api/hosts`, `/api/trends`, `/api/cost-analysis`,
  `/api/codex-insights` on :8787. Read those; do not re-derive quota numbers.
- Personal, single-user. The tailnet is the access boundary — no login, not
  exposed to the public internet.
- Mobile-friendly: this gets opened on a phone as much as a laptop.

## Open — for Stage 1 to settle
These change the shape of the build and are deliberately not pre-answered here:

1. **Delivery.** A local server you set as your homepage / new-tab URL (the
   llmdash pattern: node + Tailscale + launchagent), or a browser extension that
   overrides the new-tab page? The former matches everything else you run; the
   latter is the only way to truly own the new-tab slot in most browsers.
2. **Weather source.** Which provider, and does it need a key?
3. **eBird.** Which stats, and from where — the eBird API (needs a key; check
   whether snowraven already has one wired) or your own data? "Notable nearby"
   should come from eBird's own notable/rare-bird endpoint rather than a
   hand-kept list.
4. **Mode persistence mechanism.** Per-device localStorage, a URL the device
   bookmarks (`/?mode=text`), or a server-side per-device setting. Only the last
   survives a cleared browser.
5. **Bookmarks.** Config file, or editable in the page?
6. **Deployment.** Follow llmdash's launchagent + `~/homedash` checkout pattern,
   or something lighter?
7. **Text mode's ground** — dark or light. Drawn both ways; see design-notes.

## Out of Scope (v1)
- Multi-user, sharing, accounts.
- Public internet exposure.
- Re-implementing anything llmdash already computes.
- A third display mode. Two is the decision; a "quiet/minimal" direction was
  explored and dropped (see `design/AltQuiet.dc.html`).
- Light/dark as a *third* switcher, unless the text-mode ground question below
  forces it.

## Design Reference
`design/browser-start-page.html` — the design canvas, also published at
https://claude.ai/code/artifact/50008524-97ca-4007-a11e-1aaf45b432d6

| File | Role |
|---|---|
| `design/Main.dc.html` | **Rich mode** ("Dawn"), 1440x900 |
| `design/DenseDark.dc.html` | **Text mode**, dark ground, 820x620 |
| `design/DenseLight.dc.html` | **Text mode**, light ground, 820x620 |
| `design/AltQuiet.dc.html` | Dropped third direction, kept for the record |
| `design/design-notes.md` | What was fixed, what is still a build concern |

Text mode is drawn twice on purpose: dark and light are the same markup with two
palettes, and picking one is the last open design decision (see design-notes).

Every number in the mockups is sample data, and the weather location was
inferred from this machine's timezone. Nothing in them is a real reading.
