# Photo location and real-basemap QA candidate

Historical photo candidate through `5612278`. For the subsequent independent provider and live-rendering increment, see [native-basemap-increment.md](native-basemap-increment.md).

This test branch contains project code and generated synthetic images only. It does not merge to main, publish a website, change repository/Site access, or upload personal photos.

## Scope

- One photo per location-review row, explicit suggestion-only batch selection, readable filenames/actions, map picking starting near the photo's own suggestion, and cancellation returning to the list.
- Preserve the exact chosen coordinates and original photo ID; prefer the just-located photo when confirming its pending group.
- Connect the full wall's overlays to a replaceable MapLibre geographic basemap through shared Web Mercator conversion, retaining photo, POI, waypoint, frog, postcard and home logic. Default production style is the official OpenFreeMap Liberty instance. Failure returns visibly to the offline illustrated map without saving or moving a photo.
- The older Leaflet/OSM Standard picker experiment is development-only and opt-in, never a formal production default.

## Automated verification

The `browser-acceptance.yml` workflow performs unit tests, browser-test type checking, production build, and Playwright tests. It has read-only repository permissions and no deployment/push steps. Browser sandboxing remains enabled. Screenshots and failure traces contain only generated test material.

The browser matrix is 1280×800 desktop, 1280×600 short, and 400×780 narrow CSS pixels. It exercises real browser UI, image decoding and IndexedDB with fresh test contexts:

1. Suggested Kyoto location, long filename, one row, nonzero list scroll cancellation, exact map point, custom name, save/confirm, actual photo and refresh.
2. Previously archived no-GPS photo without a suggestion, city search, drag without saving, deliberate selection, save/reopen/refresh, original ID and another archived photo unchanged.
3. POI label selection continuing the current photo picker, one Escape cancelling, and a normal POI click opening details. The Wikipedia-shaped response is mocked; this is not live POI-service acceptance.
4. A mocked unavailable basemap provider returning to the offline view while retaining controls.

Actual-photo assertions compare rendered marker/lightbox bytes to the photo's saved thumbnail with SHA-256, sample its distinctive synthetic pixel color, and repeat after reload. A pin or placeholder alone does not pass.

The deterministic matrix uses the offline map and intercepts external requests. It does **not** establish live real-map rendering, public provider connectivity, Chinese labels, streets/boundaries, or rendered-photo alignment. Geometry tests compare shared conversion with MapLibre's projection API; SDK mocks are separate from browser evidence. Narrow CSS viewport tests are not real-phone or multi-touch tests.

## Evidence status

Candidate `f6494d3a0f162f4cd75c2f1132170f631896a4d6` passed all 185 unit tests, production build, browser type checking and all 12 browser cases in [Actions run 44774917315](https://github.com/raeqi/travel-frog/actions/runs/44774917315). The browser ran with sandboxing enabled on the supported CI runner. Screenshots include the generated photo in the actual map/memory flow, not a provider-page placeholder.

The browser matrix verifies the deterministic offline photo flow, mocked POI interactions, and fallback. It does **not** verify external provider success or real streets. A diagnostic attachment now records WebGL2 capability and intercepted provider responses separately; every pushed candidate must pass its own run.

The workflow uploads screenshots/traces and HTML test reports for seven days. Read the Actions run's actual conclusion and individual browser cases; retain failures for diagnosis. No external-service screenshot is used as proof that the edited app works.

## Live-map boundary

[OpenFreeMap's quick start](https://openfreemap.org/quick_start/) documents the public Liberty style and Vite worker setup. An earlier local style request returned 403; no proxy or authentication bypass was attempted. Its [terms](https://openfreemap.org/tos/) restrict automated data collection, so CI does not collect public tile-service data. Live connectivity/rendering must be checked separately in a human-controlled browser.

The independent provider adapter accepts an explicitly configured HTTPS style, or a raster URL with attribution. Standard OSM public tile hosts are rejected as production raster configuration. No paid service, new account or key was created. No other endpoint is silently substituted.

After a working interactive preview is available, inspect actual world/city/street detail and label languages, then repeat the synthetic photo/POI/waypoint/frog-follow/home-return flows with the live renderer. Check attribution visibility and narrow layouts. WebGL, live POI completeness, China access, global Chinese labeling, and device performance remain unaccepted until actually observed.

## Run locally on a supported browser environment

```sh
npm ci
npm test
npm run typecheck:browser
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

If browser sandboxing or WebGL is unavailable, preserve the error; do not disable protections to make a check appear passed. The push trigger is restricted to this isolated QA branch. No main merge or Site update is part of the run.
