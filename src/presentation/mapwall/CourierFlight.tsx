/**
 * Dotted courier route plus a small envelope. The layer does not block the map;
 * only the skip control takes a click. Reduced motion never mounts this.
 */
export function CourierFlight({
  d,
  boardWidth,
  boardHeight,
  onSkip,
}: {
  readonly id: string;
  readonly d: string;
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly onSkip: () => void;
}) {
  return (
    <div className="courier-layer">
      <svg className="courier-svg" viewBox={`0 0 ${boardWidth} ${boardHeight}`} aria-hidden="true">
        <path className="courier-line" d={d} />
      </svg>
      <span className="courier-letter" style={{ offsetPath: `path('${d}')` }} aria-hidden="true" />
      <button type="button" className="courier-skip" onClick={onSkip}>
        跳过
      </button>
    </div>
  );
}
