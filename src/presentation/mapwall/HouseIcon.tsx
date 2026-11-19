/** Shared paper-map house, legible without the map's old roof/body fragments. */
export function HouseIcon() {
  return (
    <svg className="map-house-art" viewBox="0 0 44 44" aria-hidden="true">
      <path
        d="M7 20 22 7 37 20v19H7Z"
        fill="#fcf6e6"
        stroke="#69523b"
        strokeWidth="1.5"
      />
      <path
        d="M28 10V4h6v12"
        fill="#a76d4b"
        stroke="#69523b"
        strokeWidth="1.5"
      />
      <path
        d="M3 21 22 4 41 21l-3 4L22 11 6 25Z"
        fill="#47704f"
        stroke="#354f37"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M17 39V27q5-5 10 0v12"
        fill="#957253"
        stroke="#69523b"
        strokeWidth="1.3"
      />
      <path
        d="M10 25h5v7h-5Zm19 0h5v7h-5Z"
        fill="#edc769"
        stroke="#69523b"
        strokeWidth="1.2"
      />
      <path
        d="M5 40h34"
        stroke="#69523b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="33" r="1" fill="#f4e6c4" />
    </svg>
  );
}
