# Strategic Brief — Moon Phase Near Sunrise and Sunset

## What We're Building

Add the current moon phase as quiet, accessible context beside homedash's existing sunrise, sunset, and daylight treatment. Dawn and Dense will present the same familiar phase name and equivalent meaning without adding a fifth widget or displacing the dashboard's primary morning information.

## Why Now

Homedash already gathers the day's weather and sun timing into the place the owner checks first. The moon phase is a small, naturally related piece of day context that makes the existing daylight treatment feel more complete without introducing a new workflow or another upstream dependency.

This earns a build slot only as a restrained extension of the current weather/daylight presentation. It must preserve the one-glance character, source honesty, and compact viewport budgets that make the start page useful.

## The User Problem

The owner can see when the sun rises and sets but cannot answer the adjacent question of what phase the moon is in without leaving homedash. They need a recognizable current-phase label at the same glance, not a detailed astronomy panel or a precision reading.

The answer must remain understandable without relying on a moon shape alone and must not imply that moonrise, moonset, visibility, illumination, or exact astronomical timing is being reported.

## Success Criteria

- Dawn and Dense both show the same current moon-phase meaning near their existing sunrise, sunset, or daylight presentation.
- The phase is expressed with a familiar qualitative name, such as “waxing crescent” or “full moon”; any visual mark is supplementary and hidden from assistive technology when it would duplicate that text.
- A screen-reader user can discover the phase in the same logical weather/daylight context without having to interpret an unlabeled icon or glyph.
- The phase is derived for the current display time with enough fidelity for a coarse phase name, while the interface avoids exact percentages, dates, countdowns, or other claims the calculation does not support.
- The moon treatment remains quiet relative to current conditions, sunrise, and sunset and does not create a new card, row, source badge, loading state, error state, or refresh control.
- The normal five-target/five-bookmark payload still fits without document scrolling in Dawn and Dense at the approved 1440×900 and 360×800 viewports; existing bounded source-region overflow behavior remains intact elsewhere.
- Weather location provenance, Open-Meteo attribution, four-source visibility counts, cached snapshots, manual refresh, independent failure handling, preferences, and the bundled launch/search actions continue to behave as before.
- No new private configuration, credential, location disclosure, or unnecessary network request is introduced.

## Scope

- A coarse, named current lunar phase using a conventional small set of phases: new moon, waxing crescent, first quarter, waxing gibbous, full moon, waning gibbous, last quarter, and waning crescent.
- A compact placement beside the existing sun/daylight treatment in Dawn and alongside sunrise, sunset, and daylight copy in Dense.
- Equivalent content and accessible semantics in both display modes and across System, Light, and Dark appearances.
- A deterministic time-based phase calculation that does not require a new upstream service, presented as qualitative context rather than ephemeris-grade data.
- Recalculation as part of ordinary page display and existing dashboard refresh behavior, with no independent lunar-source lifecycle.
- Responsive styling and focused automated coverage for phase boundaries, readable labeling, mode parity, accessibility, and approved desktop/mobile viewport fit.

## Out of Scope

- Illumination percentage, lunar age, exact phase angle, distance, azimuth, altitude, or visibility predictions.
- Moonrise, moonset, transit times, or changes to sunrise, sunset, daylight duration, or the sun-arc calculation.
- Lunar calendars, phase history, future-phase forecasts, event dates, countdowns, charts, or astronomy dashboards.
- Astrology, zodiac content, horoscopes, or interpretive moon guidance.
- Notifications, alerts, reminders, calendar integration, or background polling for lunar events.
- New settings, user-selected lunar detail levels, hemisphere controls, location controls, or a third display mode.
- A fifth widget or dashboard source, a separate cache/snapshot, an additional refresh button, or changes to the existing four-source progress model.
- A new astronomy API or other external data source unless later technical evidence proves a deterministic coarse calculation cannot meet this brief.
- Redesigning the Dawn or Dense visual systems, changing existing source provenance, or relaxing the no-document-scroll contract.

## Key Decisions

- **This is contextual enrichment, not a new data product.** The moon phase belongs with sunrise, sunset, and daylight because it answers an adjacent glance-level question; it does not justify another widget or management surface.
- **“Current phase” means a coarse named phase.** Use the conventional eight-phase vocabulary and do not expose illumination, phase angle, boundary timestamps, or language that suggests observatory precision.
- **Text carries the meaning.** A visual moon treatment may support quick recognition, but the phase name is authoritative and must remain available to sighted and screen-reader users.
- **Do not borrow weather provenance.** A deterministic time-based calculation needs no new upstream source and must not be described as Open-Meteo data or as a location-derived weather reading.
- **No separate failure or refresh path.** The phase should be available whenever the page can compute the current time, must not block weather/daylight rendering, and must not alter existing cache, stale-data, retry, or four-source progress behavior.
- **Both modes keep content parity.** Dawn may integrate the phase visually near the sun arc while Dense may express it as compact text, but both expose the same phase name and accessibility semantics.
- **Placement must earn its pixels.** Prefer integrating the phase into existing daylight space over adding height; the established 1440×900 and 360×800 one-screen layouts remain release conditions.
- **Existing work is protected.** The addition must leave location fallbacks, source isolation, per-device preferences, and the previously bundled launch links and Kagi search interactions unchanged.
