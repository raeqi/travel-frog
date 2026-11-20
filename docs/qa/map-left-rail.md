# Map left controls and list regression — 2026-11-20

Base: `f983af99` (photo map location release). No data schema, import, photo bytes, coordinates, or access policy changes.

## Reproduction on the original live version 17

At 1180×757 CSS pixels, `.waypoint-tools` began at (42,100), above the list's toggle at (40,100). Reading `elementFromPoint` at the toggle center returned the **旅行清单** button. An actual click on the list toggle opened the travel waypoint panel and left the footprint list expanded. The fixed bottom frog card also overlapped the list's bottom range. Country/region CSS additionally hid the old floating reopen button.

## Change

Map operations, the footprint/wish list, and frog controls share a bounded flex column. The list toggle remains outside its independently scrolling body, with a visible label and native keyboard focus. Wishes scroll with footprints, rather than occupying a separate bottom overlay. Travel waypoints and footprints collapse each other when opened. At ≤600px the rail reserves the existing journey status chip's bottom strip; a first browser candidate exposed that extra collision and it was corrected before merge.

## Real browser checks on the original public Site

Used additive demo records plus the existing synthetic JPEG/HEIC QA archive: 15 footprint rows, six wishes, six travel waypoints. No personal photos were used or removed.

| CSS viewport | Actual checks |
| --- | --- |
| 1180×757 (also 1181×757 after restore) | Toggle hit target is the toggle itself; expand/collapse/reopen; wheel scrolling and keyboard scroll to end; last wish bottom 550 < frog controls top 576. Continue/pause and follow/unfollow responded. |
| 1180×445 | Expand/collapse/reopen; independent scroll to end (856px maximum); last wish bottom 266 < controls top 290. Travel waypoint panel scrolls independently and leaves the collapsed footprint toggle accessible. Continue produced the visible “暂停漫游” button, then was paused again. |
| 400×606 | Expand/collapse/reopen; scroll to end (765.6 of 766px); last wish bottom 351.8 < controls top 377.2. Controls bottom 451.6 < status chip top 475. Native center hit tests returned each intended frog button. Continue/pause and follow/unfollow changed the visible state. |

The narrow test used a real Chromium window and 125% browser zoom, **not phone hardware or multi-touch**. Native window resizing was used for small height.

Additional regression: travel map selection created a draft with a name and pin, and Cancel left the six saved waypoints unchanged. An existing unlocated demo photo entered map picking; the new rail was absent, the name-first confirmation rendered after choosing a point, and Cancel returned to the same “补位置 4” tab without saving. Selecting the existing Paris 2020 footprint displayed its actual photo pins and coordinates. Collapse/reopen remained available in city view. Existing synthetic photo thumbnails remained visible in the list. Full import/HEIC decoding was not repeated for this layout-only change; the complete automated suite including those paths passed.

## Checks and limits

- 164 tests in 27 files passed; production TypeScript/Vite build passed.
- Lint: no errors; 10 existing warnings. Existing large-chunk build warning remains.
- No GitHub CI checks are configured/reported for the PR; checks above ran locally.
- Managed preview relay port 4173 still timed out. Actual browser QA used the existing public Site (candidate versions 18 and corrected 19), not local HTTP or asset hashes as a substitute.
- Mobile device hardware, multi-touch, WebGL, and external POI service availability were outside this focused layout regression.
