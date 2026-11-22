All four images are synthetic test data generated in this task (180×120, solid colored center, yellow corner and filename label). No user photographs or private filenames are included.

- `kyoto-anchor.jpg`: green center RGB(40,190,75), real GPS EXIF 35.0116 / 135.7681, 2024-05-02 12:00 +09:00.
- `kyoto-no-gps.jpg`: magenta center RGB(230,30,180), same day 12:05 +09:00, no GPS. Expected Kyoto suggestion from the anchor; location must still be confirmed by the user.
- `no-suggestion.jpg`: blue center RGB(15,75,220), 2021-01-02 12:00 +09:00, no GPS. Too distant in time for an anchor suggestion.
- `kyoto-next-day-no-gps.jpg`: derived from the magenta synthetic image by changing only its EXIF date from May 2 to May 3. The live test imports this as a separate batch after archiving the anchor; it still receives the nearby-in-time Kyoto suggestion without violating the domain's same-day trip overlap rule. Existing same-day photo fixtures/cases are unchanged.

Browser tests rename one file to a long synthetic filename and add unique trailing JPEG bytes to separate extra test rows without changing decoded pixels. Metadata classification is independently checked in `src/application/browser-fixtures.test.ts`. JPEG recompression permits a small RGB tolerance, while rendered thumbnail equality uses exact SHA-256.
