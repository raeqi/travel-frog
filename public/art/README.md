# Runtime art

Derived with image generation from the user-approved references in `docs/prototypes/`. Local runtime assets, no remote image requests.

- `home-room.webp`: clean mature room plate; empty cork board and shelves, no embedded frog or travel photos.
- `home-quiet.webp`: matching unlit fireplace/lamp plate for the base stage.
- `home-settled.webp`: lit fireplace with unlit lamp for the middle stage.
- `frog-poses.webp`: transparent 3×2 atlas, front standing / sitting / looking up, reading / walking / sleeping. Equal square cells; implemented in `home.css`.
- `luggage.webp`: transparent 3×1 atlas, small / standard / wardrobe travel trunks.
- `souvenirs.webp`: transparent 4×2 atlas: bookmark / marble tile / fan / spice pouch, stone / bronze figurine / indigo cloth / porcelain bowl. Generic city keepsakes use a decorative object; exact names and provenance come from the archive.

Reference files remain unchanged. These are a first production adaptation, not pixel-identical manual cutouts. Scene objects are rendered from domain state above the plate; the background does not count as archive data. Empty-state lighting, live photos, postcard choices and map restoration remain code-driven.
