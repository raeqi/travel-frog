# Map postcard stamps and footprint provenance

Base: main `e38de97b5da1469aa001c09194e14c17e35d2334`. This independent change is for a draft PR only: no merge, Sites publication, audience change, photo migration or basemap-service changes.

- Map cards become small postmarks with a complete 44×44 CSS-pixel button. Placement and DOM dimensions share the same constant; hover does not enlarge the collision box. Accessible names retain destination and state. Full note text appears only in the opened dialog.
- Placement also avoids individual photo targets, saved destinations and real-place label bounds. Existing photo piles, other stamps and the frog remain obstacles. Labels use the new stamp bounds.
- Detail photos prefer explicit same-city visits across all trips, then other photos with the identical resolved city key. Wrong-city photos cannot enter through a mixed trip/visit list. Photo IDs and thumbnail references are deduplicated before display limits.
- Only actual loaded personal thumbnails are eligible. Demo illustrations, missing references, the unavailable-picture placeholder and image decode errors are omitted. Availability is checked before taking up to four images, allowing a later usable photo to fill a failed slot. Text-only letters have no image container.
- Photos are labelled as the user's same-city footprints, not pictures mailed by the frog. Notes, postal dates and keep/decline transitions retain their existing source data. The home wall entry is unchanged.
- The opened letter fits the viewport, scrolls if needed, and has explicit close/focus/keyboard behavior. Its readable sizing is independent of the old scaled miniature card.

Local validation at preparation: 205 unit/component tests, browser type checking and production build passed. Relevant tests cover another city's first four pictures, the first matching trip being empty, visit priority, ID/reference deduplication, later available pictures, demo exclusion, null/missing/broken images, all visible states, exact collision bounds, and keep/close controls.

`e2e/postcard-stamps.spec.ts` adds one actual browser flow per desktop/short/narrow project using an imported synthetic GPS image plus an isolated postcard fixture. It checks the 44px target and no photo overlap, actual drag followed by opening, full note and same-photo SHA256, viewport bounds, keep persistence, and a missing-blob text-only reopening. These browser cases must be executed before claiming them passed; the CI run/artifacts are authoritative. No real user photos are used.

First CI [44889060561](https://github.com/raeqi/travel-frog/actions/runs/44889060561) preserved all 205 units and 12 prior photo cases, but the three new stamp cases failed their strict 44px check: scaling the whole arrival button reduced its real target to about 31–33px, including under a less-specific reduced-motion rule. The follow-up animates only the inner SVG, leaving the target/collision box at 44px throughout, and matches the reduced-motion selector specificity. The size assertion remains unchanged; later browser steps still require execution.
