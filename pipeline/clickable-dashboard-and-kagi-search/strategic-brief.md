# Strategic Brief — Clickable Dashboard and Kagi Search

**Feature:** `clickable-dashboard-and-kagi-search`  
**Stage:** 1 — The Strategist  
**Date:** 2026-09-08

## What We’re Building

Turn homedash from a read-only morning scan into a useful launch surface without changing its character as a one-glance start page.

- Add a compact Kagi search field to the shared dashboard chrome. It receives focus when homedash first loads, and submitting non-empty text with Enter opens a normal Kagi results page.
- Make the eBird experience actionable: the month summary opens My eBird, and each nearby lifer, photo, or audio target opens that species’ eBird map page.
- Make the coding-runway source actionable by linking its llmdash identity to the llmdash dashboard on Hephaestus.
- Present eBird target distances and radius context in miles instead of kilometers while retaining the current upstream search radius and closest-first ordering.

Every action is available in both Dawn and Dense over the same normalized data. The feature must preserve the established desktop and mobile one-screen layouts for the normal five-target/five-bookmark payload.

## Why Now

Homedash already answers what deserves attention, but it stops one step before action. A useful target still requires manually opening eBird and finding the species map; coding runway still requires locating llmdash; and the page opened most often in the browser still lacks the search action that commonly begins a session. These are high-frequency, low-complexity seams in an otherwise complete start page.

Adding a small number of intentional destinations now increases daily utility without introducing another widget, another data source, or a management workflow. It is also the right moment to align distance copy with the owner’s preferred units before that presentation becomes more deeply established.

## The User Problem

The owner should be able to glance at homedash, decide what to do, and act immediately:

- Search the web by typing and pressing Enter, with no preliminary click.
- Move from monthly birding progress to My eBird.
- Move from an interesting nearby target to the relevant eBird species map.
- Move from quota headroom to the full llmdash dashboard running on Hephaestus.
- Read birding distances in familiar miles.

Today each of those journeys requires extra navigation or mental conversion. The desired improvement is speed, not more dashboard content.

## Success Criteria

- On a fresh page load, the Kagi query field is the active control; typing a query and pressing Enter performs a Kagi search using Kagi’s standard results URL.
- Blank or whitespace-only search submissions do not navigate.
- Search remains compact and usable with keyboard, touch, assistive technology, light/dark appearance, and both Dawn and Dense modes.
- My eBird is reachable from the eBird month-summary context in both presentations.
- Every rendered nearby target with a valid species code has a clearly discoverable, keyboard-operable link to its eBird species map in both presentations.
- The llmdash source identity links to the configured llmdash dashboard on Hephaestus in both presentations, while unavailable source data does not remove the navigation affordance.
- Links use ordinary same-tab navigation so browser history and standard modifier-key behavior remain predictable.
- All user-visible eBird distance values and radius copy are shown in miles with consistent, sensible rounding; source values, filtering, deduplication, and closest-first ordering are unchanged.
- No private destination, upstream hostname, credential, coordinate, or real bookmark is committed to client code or the public repository. Host-specific launch destinations are resolved from private server configuration through fixed, allowlisted actions rather than an arbitrary redirect facility.
- At 1440×900 and 360×800, the normal five-target/five-bookmark payload still has no document scrolling in Dawn or Dense. Smaller viewports and larger payloads retain the existing source-owned overflow behavior.
- Existing preferences, location behavior, refresh behavior, source isolation, loading/error/stale states, and bookmark ordering continue to work unchanged.

## Scope

- One compact Kagi GET-search form in shared application chrome, visible in both display modes.
- Initial-load focus behavior, an explicit accessible label, a compact visible search treatment, native Enter submission, and a non-empty-query guard.
- A My eBird navigation affordance attached to the monthly eBird context.
- Species-map links generated from the canonical `speciesCode` already present on each eBird target.
- A llmdash navigation affordance whose Hephaestus destination is host-configured independently from the private llmdash data-source URL.
- Fixed same-origin launch endpoints or equivalent server-owned destination resolution for host-specific links, with destination validation and no open-redirect input.
- A single shared kilometer-to-mile presentation formatter used by Dawn and Dense for target distances and radius context.
- Responsive composition adjustments needed to fit the search field and new link treatments inside the established viewport budgets.
- Automated coverage for navigation destinations, search submission and initial focus, miles formatting, keyboard/accessibility semantics, both display modes, and desktop/mobile viewport fit.
- Private deployment configuration and example/documentation updates for the llmdash launch destination, without checking in the real Hephaestus URL.

## Out of Scope

- Search suggestions, autocomplete, search history, recent queries, alternate engines, or a search-engine picker.
- Proxying Kagi results, storing search queries, adding analytics, or making background requests to Kagi before submission.
- Embedding eBird or llmdash inside homedash.
- Editing eBird observations, lists, targets, or media from homedash.
- Changing the eBird observation radius, time window, qualification rules, deduplication, result limits, or ordering.
- Converting server-side eBird/SnowRaven contracts and configuration from kilometers to miles.
- Making weather wind-speed units configurable or changing any non-eBird units.
- Exposing or hard-coding the private SnowRaven URL, llmdash data-source URL, Hephaestus hostname, credentials, coordinates, or bookmark values in repository or client configuration.
- Adding a new dashboard widget, a third presentation mode, accounts, or public-internet access.
- Redesigning the established Dawn/Dense visual systems or relaxing the one-screen responsive contract.

## Key Decisions

- **This is an actionability feature, not a content expansion.** Search and links shorten existing journeys; they do not add a fifth data widget or change the dashboard’s information hierarchy.
- **Kagi is a direct, deliberate submission.** Use a standard GET navigation only after the owner submits. Do not fetch suggestions, preconnect for telemetry, retain the query, or send any query while the owner is merely typing.
- **Search focus is intentional.** The field receives focus on the initial document load because search is a primary start-page action. Dashboard interactions and data refreshes must not repeatedly steal focus back from the current control.
- **Outbound actions have parity.** Dawn and Dense may style links differently, but they expose the same destinations, labels, focus behavior, and availability.
- **Use the canonical species code.** Target map destinations derive from the existing eBird `speciesCode`, not the common name or locality, so names and punctuation cannot produce ambiguous links.
- **Miles are a display boundary.** Keep kilometers authoritative in the normalized source contract and convert only at presentation time. This avoids altering which targets qualify or how they sort while ensuring every displayed birding distance uses one unit.
- **Separate fetch and launch destinations.** The private llmdash upstream remains a server-to-server data source. The llmdash dashboard destination is a distinct private host setting, and the client invokes only a fixed launch action. My eBird and eBird map routes follow the same constrained pattern where server ownership protects private configuration.
- **The one-screen contract is a release condition.** The search field adapts to narrow layouts and may become visually tighter, but it cannot push the normal dashboard payload into document scrolling or hide existing controls or values.
- **Native links stay native.** Use semantic anchors and same-tab navigation. This preserves expected history, copy-link, context-menu, and modifier-key behavior while keeping keyboard and assistive-technology support straightforward.

## Product Risks and Guardrails

- **Mobile autofocus can summon the software keyboard.** Honor the requested initial focus, then verify that the resulting mobile state remains usable and does not create horizontal overflow or trap the owner away from the dashboard.
- **Extra chrome can break a carefully bounded layout.** Allocate the search field within the shared toolbar budget and test the complete normal payload, not an empty or abbreviated fixture.
- **Redirect helpers can become security liabilities.** Only named, validated destinations are allowed; no route may accept a caller-supplied absolute URL.
- **Unit conversion can imply changed search coverage.** Keep radius semantics unchanged and use consistent copy/rounding so the mile display is clearly a representation of the existing source result.
- **Link styling can consume scarce row height.** Prefer making existing text actionable over adding button rows or explanatory copy.
