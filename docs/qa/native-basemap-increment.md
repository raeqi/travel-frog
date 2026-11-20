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
