# Runtime art

Derived with image generation from the user-approved references in `docs/prototypes/`. Local runtime assets, no remote image requests.

- `home-room.webp`: clean mature room plate; empty cork board and shelves, no embedded frog or travel photos.
- `home-quiet.webp`: matching unlit fireplace/lamp plate for the base stage.
- `home-settled.webp`: lit fireplace with unlit lamp for the middle stage.
- `frog-poses.webp`: transparent 3×3 atlas, three views and six expressive poses from the user's annotated sheet: front / profile / back, mushroom / open arms looking up / cardboard box, sleeping / walking / postcard. Equal square cells and consistent body scale; `home.css` aligns differing foot/prop baselines. The user subsequently requested a smaller frog: current standing height is about 40% of the chair, with mild depth scaling. Map and room share this character atlas. Clicking a resting frog cycles poses in place; walking, standing up, jumping down/up and settling use these key poses with transforms in `room-motion.css`.
- `luggage.webp`: transparent 3×1 atlas, small / standard / wardrobe travel trunks.
- `souvenirs.webp`: transparent 4×2 atlas: bookmark / marble tile / fan / spice pouch, stone / bronze figurine / indigo cloth / porcelain bowl. Generic city keepsakes use a decorative object; exact names and provenance come from the archive. Each atlas cell has its own visible-base compensation in `home.css`; four shelf heights use scene coordinates, with contact shadows and warm room shading. Empty slots remain visually empty.

Reference files remain unchanged. These are a first production adaptation, not pixel-identical manual cutouts. Scene objects are rendered from domain state above the plate; the background does not count as archive data. Empty-state lighting, live photos, postcard choices and map restoration remain code-driven.
