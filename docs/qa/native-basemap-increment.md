# Native basemap acceptance increment

Baseline: `561227886d1af393a756219bd88c35b59f47f897`; its photo-flow acceptance is preserved. This increment stays on the isolated QA branch. No main merge, PR12 change, Site deployment, account creation, paid host or audience change.

## Concrete difference investigated

World Travel Map PR60's initial run `44767435980` obtained WebGL2 but failed later application interactions. Its use of the full Chromium binary and explicit CI SwANGLE driver is useful evidence, not proof that its product was complete. No globe, travel dataset or product implementation was copied.

The new Playwright configuration selects the documented full Chromium channel and, only under the dedicated CI flag, `--use-gl=angle --use-angle=swiftshader` as an OpenGL ES driver. Chromium sandboxing remains enabled. Unsafe fallback flags are excluded; no executor/browser sandbox policy, permissions, kernel setting, CORS rule or access restrictions are altered. [Chromium's driver documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md) distinguishes this driver from the unsafe WebGL fallback. CPU software graphics are not hardware-GPU or real-phone acceptance.

## Independent geographic source

MapLibre 6.19 and the existing flat wall camera/overlays remain. An independently downloaded, SHA-256-checked official VersaTiles 9.1.0 style/sprite package is bundled with its MIT/CC0 notices and visible OSM/VersaTiles attribution. The optional beta land-cover source is omitted. This replaces the default provider; it does not retry or proxy the earlier blocked OpenFreeMap service. Custom HTTPS provider configuration remains available; standard OSM public raster tiles remain excluded as a formal default.

[VersaTiles' public rules](https://docs.versatiles.org/guides/use_tiles_versatiles_org) permit normal use with caching and rate-limit handling. Its public demonstration service has no SLA; this is not a production-hosting guarantee. No bulk tile archive, subscription or personal-photo upload was created. A single local z0 tile returned 200; that is metadata/data evidence only, not browser acceptance.

## Evidence required by the new live test

The existing 185 unit tests and 12 deterministic browser cases still run first. The separate desktop/narrow live cases use real vector tiles and glyphs and fail if only an offline outline or blank canvas appears. Only the POI response and imported images are synthetic.

- Record actual WebGL version/renderer, real service response statuses and the exact current MapLibre frame, including center/zoom, roads, labels, borders and sample names.
- Inspect/capture world geography, regional borders/labels, and street-level Kyoto geography. Current-frame center/zoom readiness avoids treating a stale idle event as a newly loaded view.
- Import the GPS synthetic anchor and no-GPS magenta image; select a precise point on the real map, rename without snapping, save and confirm; compare the photo's actual DOM marker position against MapLibre projection from the current native frame.
- Compare marker/lightbox bytes with that photo ID's saved thumbnail; refresh and require the same record, position and real-map alignment. The earlier archived anchor stays unchanged.
- Check a loaded POI label opens details, then drag the native map and retain photo data.

Native diagnostics contain only public geographic view information, not photo bytes or filenames. Captured screenshots contain synthetic photos. The live test does not intercept the tile/font host or weaken assertions when graphics/network requests fail. No automatic cross-provider retry is implemented. A 429 or unavailable provider is failure evidence, not a pass.

At preparation time, unit tests passed and two live cases were collected; actual runtime result must come from this candidate's Actions run and screenshots. No real streets or rendered alignment is claimed until that run is examined. Mainland-China connectivity, globally Chinese labels, touch hardware, device GPU performance and production service capacity remain outside this CI acceptance.

## First live attempt and concrete fix

[Run 44778402196](https://github.com/raeqi/travel-frog/actions/runs/44778402196), commit `31a2f723d0221f85230714adc23bdb94062fb8d4`, retained all 185 unit tests and 12 photo browser cases passing. Both live cases failed at their initial native-frame gate; this is not a rendering pass. The artifact records WebGL 2.0 with ANGLE/SwiftShader, sandbox enabled, local style HTTP200 and no tile requests.

The pinned sprite path was root-relative. The installed MapLibre 6.19 sprite loader explicitly requires an absolute URL and throws before loading sprites. The follow-up resolves named/string sprite URLs against the real style URL using its supported style transform. Regression checks cover hosting subdirectories, unchanged external URLs and styles without sprites. It does not weaken the live-feature assertions or change the browser security settings. The next candidate still requires its own actual CI result.

[Run 44779730340](https://github.com/raeqi/travel-frog/actions/runs/44779730340), commit `f44522679fad986d4e0b884789ed0d0709cbe443`, passed 187 unit tests, build/type checks and all 12 photo cases, but hit the job timeout while downloading an additional 61 MB font package. Its live tests never started and artifact upload was skipped. Playwright's completed dependency step already installed WQY Chinese and IPA Japanese fonts. The next increment removes the redundant download, records `fc-match` for both languages, and caps the live step at eight minutes so diagnostics can still upload. Regional acceptance targets native zoom 3 across viewport widths rather than a fixed count of zoom clicks; border and label assertions remain mandatory.

[Run 44782439205](https://github.com/raeqi/travel-frog/actions/runs/44782439205), commit `23aed230107140acced2af5f9227901fcddc7423`, reached the live tests and retained the 12 photo cases. Real tiles/glyphs returned HTTP200 and WebGL2 was present, but actual screenshots were blank: the SDK's equally specific map class overrode the adapter's absolute positioning, leaving a zero-height container. The desktop photo alignment assertion failed by 406 pixels; the narrow zoom button was intercepted by the frog card. This is not a rendered-map pass. The next increment explicitly sizes the adapter with stronger class specificity, requires a positive/current-sized native frame, reserves a separate mobile zoom strip, and places zoom controls above the photo picker while selecting. No forced clicks or relaxed alignment assertions are used.

[Run 44783595612](https://github.com/raeqi/travel-frog/actions/runs/44783595612), commit `2b13db67f056a4fd1036dea17f83aeb5b3ae4bc4`, passed 188 units and the 12 photo cases. Inspected desktop and narrow screenshots actually show Kyoto roads, buildings, local names and the green imported photo aligned with its native geographic center (under 2 px). Desktop regional borders/names also rendered, and precise point selection on real streets passed. The full live cases still failed: legacy paper bounds shifted the narrow world center during toolbar zoom; separately importing and confirming two same-day fixtures correctly triggered the existing overlapping-trip protection. The follow-up bounds geographic centers in Mercator coordinates and uses a documented next-day synthetic EXIF variant for the separate batch. Existing same-day fixtures, overlap protection and photo flows remain unchanged. Full save/refresh/POI/drag acceptance is still required; this partial run is not a full pass. Labels observed in Kyoto are Japanese; regional rendered labels include Latin/native names, so globally Chinese labels are not claimed.
