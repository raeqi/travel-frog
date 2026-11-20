# Primary map actions — 2026-11-20

Base: main `283aa934` / Site version 20. This change reorganizes UI entry points only; no archive schema, photo storage, coordinate inference, routing, or journey service changes.

## Behavior

- The photo drawer and top action are called **管理照片**. The entry shows a nonzero badge and an accessible `N 张照片待补位置` label; opening it goes straight to missing locations when needed. The same full reminder is visible and actionable in the drawer. Zero produces no reminder. The corner tray is removed.
- **蛙蛙目的地** is part of the frog status/action card. Its entries remain candidate directions, independent of visited-photo footprints and wishes. Only **添加目的地** begins a temporary map-picking state, with explicit instructions and **取消选点**. Dragging and canceling do not save. A selected point still supports candidate save and next direction. Photo location picking stays independent.
- **镜头跟随** has a pressed state and visible explanatory status. It moves the camera only. Dragging the map exits following.
- **搜索地点** contains archive search, offline city-name suggestions, and an explicit nearby real-place query. Offline cities are labeled as suggestions, not visits. Existing archives retain their original navigation. Cities, wish destinations, and real-place details can open a frog destination draft.
- Real POI pins stay available after closing search. Clicking a name opens its source-backed detail directly, without a map mode toggle. Queries remain explicit, source-specific and network-dependent, with the original privacy disclosure.

## Actual Chromium QA on the original public Site

Only additive demo and existing synthetic JPEG/HEIC records were used. No personal photos were selected, edited, or included in deployment artifacts. Initial archive: 15 footprint groups, 4 unlocated demo photos, 6 frog candidate destinations. A named synthetic candidate was added during this test, increasing the last count to 7.

1. **Photos:** Management entry opened the selected `补位置 4` tab and the visible `4 张照片待补位置` reminder. A sample photo entered map picking, an actual map click created a name/pin confirmation, and Cancel returned to the same four-photo list without saving. The new rail is absent during photo picking. Repeated on narrow layout after its correction.
2. **Map direction:** Explicit Add opened instructions and Cancel. Actual map drag produced no draft. Cancel left 6 candidates. Another actual map click created a name-first draft, saved as `界面精简测试点` (Chad), then set as next direction. After refresh the list still contained 7 and the journey panel explicitly showed the saved next direction. Footprint count stayed 15 and pending-location count stayed 4.
3. **Search:** Typing 巴黎 produced offline city suggestions and existing archive matches. Its destination action opened a Paris draft; Cancel did not save. Narrow search for 金泽 also found the offline city.
4. **Real POI:** Located the existing Eiffel Tower test point, then used Search → Nearby real places → Query current area. The real Wikipedia request returned **50** entries. Closed Search and actually clicked the map pin `地点：艾菲爾鐵塔`; the detail opened in one click with coordinates **48.85822, 2.29450**, English source name Eiffel Tower and source URL `https://en.wikipedia.org/?curid=9232`. Its Add action opened a correctly named destination draft, then Cancel preserved the candidate count. This was an actual online response, not a browser-injected fixture.
5. **Camera:** Follow changed its label and pressed state; manual map dragging changed it back to off. A paused frog's displayed latitude stayed exactly `40.515059514589495` across the initial follow/drag test. Repeated follow/drag on narrow layout. Continue/pause changed their visible controls in the short window.

| CSS viewport | Layout and interaction evidence |
| --- | --- |
| 1181×757 desktop | Default action grouping; footprint and destination list toggles; independent list scrolling; real POI interaction; photo picking and cancel; explicit direction save and next. |
| 1181×445 short | Footprint expand/collapse/reopen and scroll to end: 897px maximum, last wish bottom179 < frog card top203. Destination body remained scrollable (65px viewport) above the action row; a saved last entry's Rename opened and canceled correctly. Frog continue/pause remained clickable. |
| 400×606 narrow | All main-action, list-toggle and frog-button center hit tests resolved to their own buttons. Footprint expand/collapse/reopen and last wish bottom≈307 < frog card top≈332.4. Destination list has its own 154.4px scrolling viewport above controls. Temporary selection cancel, photo picking/cancel, name search and camera follow/drag worked. |

The first candidate exposed the pre-existing 520px photo drawer extending beyond a 400px screen. The corrected drawer uses the viewport width, wraps file names and keeps its button visible. Corrected drawer bounds were left≈12/right≈388, width376; search has the same bounds and two equal-width source tabs. Screenshots were captured through the real browser. Narrow layout uses a native desktop Chromium window at 125% browser zoom, not phone hardware or multi-touch.

## Automated checks and limits

- **167 tests in 28 files passed**, including existing photo decode/location/persistence and journey tests. New checks cover zero/nonzero photo attention, explicit-only destination selection, offline search-to-destination, and real-place pins reopening detail after the search panel is closed.
- Production TypeScript/Vite build passed. Lint has no errors and 10 existing warnings. Existing large-chunk build warning remains.
- Managed preview relay 4173 timed out again; `sites-preview status` reported stopped. No replacement server or browser security workaround was used. Browser QA ran on the original Site candidates 21 and corrected22.
- External Overpass availability, mobile hardware/multi-touch, room WebGL and a new photo import/HEIC decoding session were not retested for this entry-point change. Network fixtures are used only in automated component tests, separately from the actual Wikipedia browser check.
- No GitHub CI checks were reported/configured for the PR; the checks above ran in the execution environment. GitHub remains private and the Site audience remains public, unchanged.
