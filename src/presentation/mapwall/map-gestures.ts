import {panMercator} from './mercator-camera';
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { viewRect, type Camera, type Metrics } from "./geometry";

export const maxMapZoom = (mode: "world" | "city" | "region", live=false) =>
  mode === "world" ? (live?400000:12000) : mode === "city" ? 24 : 60;

const limit = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export function boundCamera(
  camera: Camera,
  metrics: Metrics,
  maxZoom: number,
): Camera {
  const zoom = limit(camera.zoom, 0.8, maxZoom);
  const { viewW, viewH } = viewRect({ ...camera, zoom }, metrics);
  // Allow a 20% viewport gutter so the full-world view still responds to a drag.
  const halfX = Math.min(500, viewW * 0.3),
    halfY = Math.min(320, viewH * 0.3);
  return {
    zoom,
    cx: limit(camera.cx, halfX, 1000 - halfX),
    cy: limit(camera.cy, halfY, 640 - halfY),
  };
}
export function panCamera(
  camera: Camera,
  dx: number,
  dy: number,
  metrics: Metrics,
  maxZoom: number,
): Camera {
  if(metrics.mercatorMode)return panMercator(camera,dx,dy,metrics,metrics.mercatorMode);
  const k = 1000 / camera.zoom / Math.max(1, metrics.sheetW);
  return boundCamera(
    { ...camera, cx: camera.cx - dx * k, cy: camera.cy - dy * k },
    metrics,
    maxZoom,
  );
}
export function zoomCamera(
  camera: Camera,
  factor: number,
  x: number,
  y: number,
  metrics: Metrics,
  maxZoom: number,
): Camera {
  const zoom = limit(camera.zoom * factor, 0.8, maxZoom);
  if(metrics.mercatorMode){
    const dx=x-metrics.offX-metrics.sheetW/2,dy=y-metrics.offY-metrics.sheetH/2;
    // Move the old anchor to the center, then move it back at the new scale.
    const anchor=panMercator(camera,-dx,-dy,metrics,metrics.mercatorMode);
    return panMercator({...anchor,zoom},dx,dy,metrics,metrics.mercatorMode);
  }
  const oldK = 1000 / camera.zoom / Math.max(1, metrics.sheetW);
  const newK = 1000 / zoom / Math.max(1, metrics.sheetW);
  const dx = x - metrics.offX - metrics.sheetW / 2,
    dy = y - metrics.offY - metrics.sheetH / 2;
  return boundCamera(
    {
      zoom,
      cx: camera.cx + dx * (oldK - newK),
      cy: camera.cy + dy * (oldK - newK),
    },
    metrics,
    maxZoom,
  );
}

/** One render per animation frame; capture only after threshold so taps keep their normal targets. */
export function useMapGestures(
  board: RefObject<HTMLDivElement | null>,
  camera: Camera,
  metrics: Metrics,
  maxZoom: number,
  onCamera: (camera: Camera) => void,
) {
  const latest = useRef({ camera, metrics, maxZoom, onCamera });
  useLayoutEffect(() => {
    latest.current = { camera, metrics, maxZoom, onCamera };
  });
  useEffect(() => {
    const node = board.current;
    if (!node) return;
    const points = new Map<number, { x: number; y: number }>();
    let origin = { x: 0, y: 0 },
      previous = origin,
      moved = false,
      suppressUntil = 0;
    let velocity = { x: 0, y: 0 },
      lastTime = 0,
      frame = 0,
      pending: Camera | null = null;
    let inertia = 0,
      pinchDistance = 0,
      lastMove = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      cancelAnimationFrame(inertia);
      inertia = 0;
    };
    const emit = (next: Camera) => {
      latest.current.camera = next;
      pending = next;
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (pending) latest.current.onCamera(pending);
          pending = null;
        });
    };
    const pos = (event: PointerEvent) => {
      const r = node.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    };
    const down = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        (event.target as Element).closest(
          "[data-map-controls],input,textarea,select,a",
        )
      )
        return;
      stop();
      points.set(event.pointerId, pos(event));
      if (points.size === 1) {
        // Ignore the drag's trailing click, but accept a fresh deliberate press.
        suppressUntil = 0;
        origin = previous = pos(event);
        moved = false;
        velocity = { x: 0, y: 0 };
        lastTime = lastMove = performance.now();
      } else {
        moved = true;
        pinchDistance = 0;
        suppressUntil = performance.now() + 500;
      }
    };
    const move = (event: PointerEvent) => {
      if (!points.has(event.pointerId)) return;
      const p = pos(event);
      points.set(event.pointerId, p);
      const now = performance.now(),
        state = latest.current;
      if (points.size > 1) {
        const [a, b] = [...points.values()];
        if (!a || !b) return;
        const distance = Math.hypot(b.x - a.x, b.y - a.y),
          middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinchDistance > 0) {
          const zoomed = zoomCamera(
            state.camera,
            distance / pinchDistance,
            middle.x,
            middle.y,
            state.metrics,
            state.maxZoom,
          );
          emit(
            panCamera(
              zoomed,
              middle.x - previous.x,
              middle.y - previous.y,
              state.metrics,
              state.maxZoom,
            ),
          );
        }
        previous = middle;
        pinchDistance = distance;
        moved = true;
      } else {
        if (!moved && Math.hypot(p.x - origin.x, p.y - origin.y) < 6) return;
        if (!moved) {
          moved = true;
          node.setPointerCapture(event.pointerId);
        }
        const dx = p.x - previous.x,
          dy = p.y - previous.y,
          dt = Math.max(8, now - lastTime);
        emit(panCamera(state.camera, dx, dy, state.metrics, state.maxZoom));
        velocity = { x: limit(dx / dt, -2, 2), y: limit(dy / dt, -2, 2) };
        previous = p;
      }
      node.classList.add("is-panning");
      event.preventDefault();
      lastTime = lastMove = now;
    };
    const end = (event: PointerEvent) => {
      if (!points.has(event.pointerId)) return;
      points.delete(event.pointerId);
      if (node.hasPointerCapture(event.pointerId))
        node.releasePointerCapture(event.pointerId);
      if (points.size) {
        previous = origin = [...points.values()][0]!;
        pinchDistance = 0;
        velocity = { x: 0, y: 0 };
        return;
      }
      node.classList.remove("is-panning");
      if (!moved) return;
      suppressUntil = performance.now() + 500;
      if (
        event.type === "pointercancel" ||
        reduced.matches ||
        performance.now() - lastMove > 80 ||
        Math.hypot(velocity.x, velocity.y) < 0.08
      )
        return;
      let before = performance.now(),
        duration = 0;
      const coast = (time: number) => {
        const dt = Math.min(32, time - before);
        before = time;
        duration += dt;
        const state = latest.current,
          next = panCamera(
            state.camera,
            velocity.x * dt,
            velocity.y * dt,
            state.metrics,
            state.maxZoom,
          );
        const blocked =
          next.cx === state.camera.cx && next.cy === state.camera.cy;
        emit(next);
        velocity.x *= Math.exp(-dt / 150);
        velocity.y *= Math.exp(-dt / 150);
        if (
          !blocked &&
          duration < 600 &&
          Math.hypot(velocity.x, velocity.y) > 0.02
        )
          inertia = requestAnimationFrame(coast);
      };
      inertia = requestAnimationFrame(coast);
    };
    const click = (event: MouseEvent) => {
      if (event.detail > 0 && performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest("[data-map-controls]")) return;
      event.preventDefault();
      stop();
      const r = node.getBoundingClientRect(),
        state = latest.current;
      const scale =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? node.clientHeight
            : 1;
      // Trackpad two-finger scroll pans; mouse wheel and ctrl-pinch zoom at the pointer.
      const trackpad =
        event.deltaMode === 0 &&
        (Math.abs(event.deltaY) < 50 || event.deltaX !== 0);
      if (!event.ctrlKey && trackpad)
        emit(
          panCamera(
            state.camera,
            -event.deltaX * scale,
            -event.deltaY * scale,
            state.metrics,
            state.maxZoom,
          ),
        );
      else
        emit(
          zoomCamera(
            state.camera,
            Math.exp(
              -limit(event.deltaY * scale, -200, 200) *
                (event.ctrlKey ? 0.01 : 0.002),
            ),
            event.clientX - r.left,
            event.clientY - r.top,
            state.metrics,
            state.maxZoom,
          ),
        );
    };
    const key = (event: KeyboardEvent) => {
      if (event.target !== node) return;
      const state = latest.current;
      const directions: Record<string, [number, number]> = {
        ArrowLeft: [80, 0],
        ArrowRight: [-80, 0],
        ArrowUp: [0, 80],
        ArrowDown: [0, -80],
      };
      const direction = directions[event.key];
      if (direction) {
        event.preventDefault();
        stop();
        emit(
          panCamera(
            state.camera,
            direction[0],
            direction[1],
            state.metrics,
            state.maxZoom,
          ),
        );
      } else if (["+", "=", "-"].includes(event.key)) {
        event.preventDefault();
        stop();
        emit(
          zoomCamera(
            state.camera,
            event.key === "-" ? 1 / 1.3 : 1.3,
            state.metrics.offX + state.metrics.sheetW / 2,
            state.metrics.offY + state.metrics.sheetH / 2,
            state.metrics,
            state.maxZoom,
          ),
        );
      }
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    node.addEventListener("click", click, true);
    node.addEventListener("dblclick", click, true);
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("keydown", key);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      node.classList.remove("is-panning");
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      node.removeEventListener("click", click, true);
      node.removeEventListener("dblclick", click, true);
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("keydown", key);
    };
  }, [board]);
}
