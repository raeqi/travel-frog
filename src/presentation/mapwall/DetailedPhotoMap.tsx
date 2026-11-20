import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./detailed-photo-map.css";

import {
  detailMapPoint,
  type DetailMapPoint,
  type DetailMapView,
} from "./detail-map-point";
export function DetailedPhotoMap({
  initialView,
  reference,
  selected,
  onPick,
  onExit,
}: {
  initialView: DetailMapView;
  reference: DetailMapPoint | null;
  selected: DetailMapPoint | null;
  onPick: (point: DetailMapPoint) => void;
  onExit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    mapRef = useRef<L.Map | null>(null),
    marker = useRef<L.CircleMarker | null>(null);
  const onPickRef = useRef(onPick),
    firstView = useRef(initialView),
    lastDrag = useRef(-Infinity);
  const [status, setStatus] = useState<
      "loading" | "ready" | "partial" | "error"
    >("loading"),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let live = true,
      successful = 0,
      failed = 0;
    const first = firstView.current;
    const map = L.map(element, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 2,
      maxZoom: 19,
      worldCopyJump: true,
    }).setView(
      [Math.max(-85, Math.min(85, first.lat)), first.lng],
      Math.max(2, Math.min(19, first.zoom)),
    );
    mapRef.current = map;
    L.control.zoom({ position: "topleft" }).addTo(map);
    L.control.attribution({ position: "topright", prefix: false }).addTo(map);
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        minZoom: 2,
        maxZoom: 19,
        keepBuffer: 1,
        updateWhenIdle: true,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        referrerPolicy: "strict-origin-when-cross-origin",
      },
    );
    const update = () => {
      if (live)
        setStatus(
          successful
            ? failed
              ? "partial"
              : "ready"
            : failed
              ? "error"
              : "loading",
        );
    };
    tiles.on("tileload", () => {
      successful++;
      update();
    });
    tiles.on("tileerror", () => {
      failed++;
      update();
    });
    tiles.addTo(map);
    const timer = window.setTimeout(() => {
      if (live && !successful) setStatus("error");
    }, 15000);
    map.on("dragend", () => {
      lastDrag.current = performance.now();
    });
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (performance.now() - lastDrag.current < 300) return;
      const point = detailMapPoint(event.latlng);
      if (point) onPickRef.current(point);
    });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.target === element) {
        event.preventDefault();
        const point = detailMapPoint(map.getCenter());
        if (point) onPickRef.current(point);
      }
    };
    element.addEventListener("keydown", key);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(element);
    return () => {
      live = false;
      window.clearTimeout(timer);
      observer.disconnect();
      element.removeEventListener("keydown", key);
      marker.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    if (reference && mapRef.current)
      mapRef.current.setView([reference.lat, reference.lng], 14);
  }, [reference, attempt]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    marker.current?.remove();
    marker.current = null;
    if (selected) {
      marker.current = L.circleMarker([selected.lat, selected.lng], {
        radius: 9,
        color: "#fff",
        weight: 3,
        fillColor: "#226241",
        fillOpacity: 1,
      }).addTo(map);
      const bounds = host.current?.getBoundingClientRect(),
        picker = document
          .querySelector(".photo-location-picker")
          ?.getBoundingClientRect();
      const bottom =
        picker && bounds
          ? Math.max(0, bounds.bottom - picker.top) + 20
          : Math.min(map.getSize().y * 0.6, 380);
      map.panInside([selected.lat, selected.lng], {
        paddingTopLeft: [30, 80],
        paddingBottomRight: [30, bottom],
      });
    }
  }, [selected, attempt]);
  return (
    <section className="photo-detail-map" aria-label="照片街道地图">
      <div
        className="photo-detail-map-canvas"
        ref={host}
        tabIndex={0}
        role="region"
        aria-label="街道地图：拖动缩放，点击选位置；回车选择中心"
      />
      <div className="photo-detail-toolbar">
        <span>街道底图 · OpenStreetMap</span>
        <button type="button" onClick={onExit}>
          返回离线地图
        </button>
      </div>
      <div className={`photo-detail-status is-${status}`} role="status">
        {status === "loading"
          ? "正在加载街道底图…"
          : status === "ready"
            ? "底图已加载，点击确认照片位置"
            : status === "partial"
              ? "部分底图加载失败，仍可返回离线地图"
              : "街道底图暂不可用，照片位置未改动。"}
        {status === "error" && (
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
          >
            重试底图
          </button>
        )}
      </div>
    </section>
  );
}
