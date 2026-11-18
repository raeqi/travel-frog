import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SVGRenderer, SVGObject } from "three/addons/renderers/SVGRenderer.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type {
  FurnitureState,
  LuggageTier,
  SpecialtyAward,
} from "../../domain/home/collection";
import type { HomePostcard } from "./HomeRoom";
import type { RoomActor } from "./useRoomFrog";
import type { RoomCommand } from "./room-motion";
import {
  actorInSpace,
  luggageBounds,
  roomGrowth,
  roomToWorld,
  worldToRoom,
} from "./room-space";
import { WORLD_COUNTRIES } from "../../infrastructure/geo/world";
import type { FrogPose } from "./frog-poses";

interface Props {
  away?: boolean;
  onTravel?: (() => void) | undefined;
  actor: RoomActor;
  luggage: LuggageTier;
  furniture: FurnitureState;
  postcards: readonly HomePostcard[];
  specialties: readonly SpecialtyAward[];
  city: string;
  onMove: (command: RoomCommand) => void;
  onPose: () => void;
  onMap: () => void;
  onPostcard: (id: string) => void;
  onSpecialty: (award: SpecialtyAward) => void;
  onCollection: (kind: "postcards" | "souvenirs") => void;
}
const POSE_CELL: Record<FrogPose, readonly [number, number]> = {
  front: [0, 0],
  profile: [1, 0],
  back: [2, 0],
  mushroom: [0, 1],
  welcome: [1, 1],
  box: [2, 1],
  sleep: [0, 2],
  walk: [1, 2],
  placard: [2, 2],
};

/** A geometry-based cutaway room, lazy loaded separately from the travel map. */
export default function SpatialRoom(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const reset = useRef<(() => void) | null>(null);
  const orbit = useRef<((direction: number) => void) | null>(null);
  const [failed, setFailed] = useState(false);

  const sceneKey = [
    props.furniture.stage,
    props.luggage,
    ...props.postcards.map((c) => `${c.id}:${c.status}:${c.year}`),
    ...props.specialties.map((a) => a.specialtyId),
  ].join("|");
  useEffect(() => {
    const config = latest.current;
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer | SVGRenderer;
    let svg = false;
    let dirty = true;
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2");
      if (context) {
        renderer = new THREE.WebGLRenderer({
          canvas,
          context,
          antialias: true,
          alpha: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.5;
      } else {
        svg = true;
        renderer = new SVGRenderer();
        renderer.setPrecision(2);
        renderer.setQuality("low");
      }
    } catch {
      const timer = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(timer);
    }
    container.dataset.renderer = svg ? "svg" : "webgl";
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#181d18");
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    camera.position.set(8.2, 9, 14);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.1, -0.1);
    controls.enableDamping = !window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    controls.enablePan = false;
    controls.minDistance = 9;
    controls.maxDistance = 25;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.25;
    controls.minAzimuthAngle = -1.35;
    controls.maxAzimuthAngle = 1.35;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    reset.current = () => {
      camera.position.set(8.2, 9, 14);
      controls.target.set(0, 1.1, -0.1);
      controls.update();
    };
    orbit.current = (direction) => {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta = Math.max(
        -1.3,
        Math.min(1.3, spherical.theta + direction * 0.25),
      );
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3().setFromSpherical(spherical));
      controls.update();
    };
    scene.add(
      svg
        ? new THREE.AmbientLight("#eee2c8", 0.55)
        : new THREE.HemisphereLight("#ede2c8", "#3a2b21", 2),
    );
    const afternoon = new THREE.DirectionalLight("#ffdfae", svg ? 1 : 3);
    afternoon.position.set(-5, 8, 5);
    afternoon.castShadow = true;
    afternoon.shadow.mapSize.set(1024, 1024);
    Object.assign(afternoon.shadow.camera, {
      left: -8,
      right: 8,
      top: 8,
      bottom: -8,
    });
    afternoon.shadow.bias = -0.001;
    scene.add(afternoon);
    const interactive: THREE.Object3D[] = [];
    const textures: THREE.Texture[] = [];
    const disposables: Array<{ dispose(): void }> = [];
    const material = (color: string, roughness = 0.85, metalness = 0) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      disposables.push(m);
      return m;
    };
    const wood = material("#644934"),
      darkWood = material("#3c2c22"),
      green = material("#365640");
    const sand = material("#d5c19a"),
      brass = material("#b88e46", 0.35, 0.65);
    const add = (
      geometry: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      disposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const box = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    const hit = (object: THREE.Object3D, action: () => void) => {
      object.userData.action = action;
      interactive.push(object);
    };
    const floor = box(12.5, 0.2, 9.8, wood, 0, -0.12, 0);
    floor.renderOrder = -30;
    hit(floor, () => {});
    for (let i = 0; i < 19; i++)
      box(0.022, 0.008, 9.8, darkWood, -6.1 + i * 0.67, 0.001, 0).renderOrder =
        -29;
    box(12.5, 4.8, 0.15, material("#354538"), 0, 2.25, -4.85).renderOrder = -20;
    // Low cutaway side walls preserve the view while orbiting.
    box(0.15, 0.65, 9.8, darkWood, -6.2, 0.2, 0).renderOrder = -19;
    box(0.15, 0.65, 9.8, darkWood, 6.2, 0.2, 0).renderOrder = -19;
    for (let i = 0; i < 10; i++)
      box(0.055, 3.9, 0.03, wood, -5.6 + i * 1.25, 2, -4.75).renderOrder = -18;
    box(12.4, 0.09, 0.08, wood, 0, 0.7, -4.7).renderOrder = -18;
    const rug = box(7.8, 0.035, 5.2, material("#67453b"), 0, 0.025, 1.7);
    rug.renderOrder = -25;
    hit(rug, () => {});
    // Fireplace on the left, three separate geometry layers.
    const hearth = box(2.7, 2.9, 1.1, darkWood, -4.1, 1.45, -3.9);
    box(2.1, 1.45, 0.12, material("#171612"), -4.1, 0.85, -3.25);
    box(3.05, 0.18, 1.35, wood, -4.1, 2.85, -3.8);
    hit(hearth, () =>
      latest.current.onMove({ kind: "perch", perch: "fireplace-rug" }),
    );
    if (config.furniture.fireplaceLit) {
      const fireMat = new THREE.MeshStandardMaterial({
        color: "#edb35d",
        emissive: "#ed8a32",
        emissiveIntensity: 2,
      });
      disposables.push(fireMat);
      add(new THREE.ConeGeometry(0.42, 0.9, 6), fireMat, -4.1, 0.65, -3.1);
      const fireLight = new THREE.PointLight("#ffc078", svg ? 0.25 : 14, 6);
      fireLight.position.set(-4.1, 1, -2.7);
      scene.add(fireLight);
    }
    const growth = roomGrowth(
      config.furniture.stage,
      config.specialties.length,
    );
    const seatX = roomToWorld({ x: 64.5, y: 77 }).x;
    const chair = new THREE.Group();
    scene.add(chair);
    const chairPart = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = box(w, h, d, green, x, y, z);
      chair.attach(m);
      return m;
    };
    chairPart(growth.seatWidth, 0.45, 1.7, seatX, 0.8, -0.5);
    chairPart(growth.seatWidth, 1.8, 0.4, seatX, 1.55, -1.5);
    for (const sign of [-1, 1]) {
      chairPart(
        0.32,
        1.25,
        2.1,
        seatX + sign * (growth.seatWidth / 2 - 0.1),
        0.9,
        -0.55,
      );
      box(
        0.18,
        0.4,
        0.18,
        darkWood,
        seatX + sign * (growth.seatWidth / 2 - 0.2),
        0.2,
        0.2,
      );
    }
    for (let i = 0; i < Math.round(growth.seatWidth / 0.65); i++) {
      const button = add(
        new THREE.SphereGeometry(0.045, 8, 8),
        brass,
        seatX - growth.seatWidth / 2 + 0.4 + i * 0.6,
        1.8,
        -1.28,
      );
      hit(button, () =>
        latest.current.onMove({ kind: "perch", perch: "armchair" }),
      );
    }
    chair.traverse((o) => {
      if (o instanceof THREE.Mesh)
        hit(o, () =>
          latest.current.onMove({ kind: "perch", perch: "armchair" }),
        );
    });
    // Table occupies the same normalized footprint as the preserved navigation model.
    const tableX = roomToWorld({ x: 43, y: 88 }).x;
    const table = box(4.7, 0.16, 2.5, wood, tableX, 0.9, 2.2);
    if (svg) table.renderOrder = 2;
    for (const dx of [-1.9, 1.9])
      for (const dz of [-0.95, 0.95])
        box(0.13, 0.85, 0.13, darkWood, tableX + dx, 0.43, 2.2 + dz);
    // Draw the real world polygons onto paper; no cards or fabricated memories on this entrance.
    const mapCanvas = document.createElement("canvas");
    mapCanvas.width = 1024;
    mapCanvas.height = 600;
    const ctx = mapCanvas.getContext("2d")!;
    ctx.fillStyle = "#dde6e4";
    ctx.fillRect(0, 0, 1024, 600);
    ctx.save();
    ctx.scale(1.024, 0.93);
    for (const country of WORLD_COUNTRIES) {
      const path = new Path2D(country.d);
      ctx.fillStyle = "#e4dccb";
      ctx.fill(path);
      ctx.strokeStyle = "#9c9681";
      ctx.lineWidth = 0.6;
      ctx.stroke(path);
    }
    ctx.restore();
    const mapTexture = new THREE.CanvasTexture(mapCanvas);
    mapTexture.colorSpace = THREE.SRGBColorSpace;
    textures.push(mapTexture);
    const mapMat = new THREE.MeshStandardMaterial({
      map: mapTexture,
      roughness: 1,
    });
    disposables.push(mapMat);
    const map = add(
      new THREE.PlaneGeometry(4.2, 2.2),
      mapMat,
      tableX,
      0.991,
      2.2,
    );
    map.rotation.x = -Math.PI / 2;
    hit(map, () => latest.current.onMap());
    hit(table, () => latest.current.onMap());
    for (const dx of [-1.93, 1.93])
      for (const dz of [-0.95, 0.95])
        add(
          new THREE.SphereGeometry(0.045, 8, 8),
          brass,
          tableX + dx,
          1.02,
          2.2 + dz,
        );
    // Live postcard board, not a painted-in collection.
    const board = box(3.4, 1.9, 0.09, material("#8e734f"), 1.8, 3.2, -4.68);
    hit(board, () => latest.current.onCollection("postcards"));
    const activeCards = config.postcards.filter(
      (c) => !["pending", "declined"].includes(c.status),
    );
    for (const [index, card] of activeCards.slice(-8).entries()) {
      const cardMesh = box(
        0.65,
        0.65,
        0.035,
        material("#fff5df"),
        0.6 + (index % 4) * 0.8,
        3.65 - Math.floor(index / 4) * 0.85,
        -4.59,
      );
      cardMesh.rotation.z = (index % 2 ? 1 : -1) * 0.07;
      const lines = box(
        0.42,
        0.018,
        0.015,
        material("#aa9d82"),
        cardMesh.position.x,
        cardMesh.position.y - 0.1,
        -4.56,
      );
      hit(cardMesh, () => latest.current.onPostcard(card.id));
      hit(lines, () => latest.current.onPostcard(card.id));
      const pin = add(
        new THREE.SphereGeometry(0.045, 8, 8),
        card.status === "received" ? material("#ac4939") : brass,
        cardMesh.position.x,
        cardMesh.position.y + 0.25,
        -4.54,
      );
      hit(pin, () => latest.current.onPostcard(card.id));
    }
    // A cabinet grows upwards and the full collection stays available from its shared drawer.
    const cabinet = box(1.6, 3.25, 0.75, darkWood, -1.8, 1.62, -3.9);
    hit(cabinet, () => latest.current.onCollection("souvenirs"));
    for (let row = 0; row < 4; row++) {
      box(1.75, 0.1, 0.9, wood, -1.8, 0.35 + row * 0.78, -3.85);
      for (let col = 0; col < 2; col++) {
        const award = config.specialties[row * 2 + col];
        if (!award) continue;
        const x = -2.17 + col * 0.72,
          y = 0.42 + row * 0.78;
        const object = /石/.test(award.name)
          ? add(
              new THREE.DodecahedronGeometry(0.2),
              material("#4b4b4a", 0.45),
              x,
              y + 0.2,
              -3.65,
            )
          : /扇|书签|票|牌/.test(award.name)
            ? box(0.35, 0.42, 0.06, sand, x, y + 0.21, -3.65)
            : /布|毯/.test(award.name)
              ? box(0.42, 0.2, 0.3, material("#345877"), x, y + 0.1, -3.65)
              : add(
                  new THREE.CylinderGeometry(0.12, 0.17, 0.38, 12),
                  brass,
                  x,
                  y + 0.19,
                  -3.65,
                );
        hit(object, () => latest.current.onSpecialty(award));
      }
    }
    if (growth.cabinets > 1) {
      const extra = box(1.45, 1.25, 0.65, wood, 4.6, 0.63, -3.7);
      hit(extra, () => latest.current.onCollection("souvenirs"));
      for (let i = 0; i < Math.min(8, config.specialties.length - 8); i++) {
        const award = config.specialties[8 + i]!;
        const item = box(
          0.18,
          0.24,
          0.18,
          i % 2 ? brass : sand,
          4.1 + (i % 4) * 0.3,
          1.38,
          -3.8 + Math.floor(i / 4) * 0.3,
        );
        hit(item, () => latest.current.onSpecialty(award));
      }
    }
    if (config.furniture.bookshelf) {
      box(1.2, 1, 0.5, wood, -0.15, 0.5, -4.35);
      for (let i = 0; i < 6; i++)
        box(
          0.11,
          0.52,
          0.3,
          i % 2 ? green : sand,
          -0.56 + i * 0.16,
          1.25,
          -4.35,
        );
    }
    if (config.furniture.roundMirror) {
      const mirror = add(
        new THREE.CylinderGeometry(0.45, 0.45, 0.06, 32),
        brass,
        4.7,
        2.8,
        -4.65,
      );
      mirror.rotation.x = Math.PI / 2;
    }
    if (config.furniture.globe) {
      add(
        new THREE.SphereGeometry(0.32, 24, 16),
        material("#7f9b88"),
        4.7,
        1.95,
        -3.7,
      );
      add(
        new THREE.CylinderGeometry(0.15, 0.25, 0.16, 16),
        brass,
        4.7,
        1.5,
        -3.7,
      );
    }
    if (config.furniture.floorLampLit) {
      add(
        new THREE.CylinderGeometry(0.035, 0.035, 2.6, 12),
        brass,
        3.9,
        1.3,
        -2.9,
      );
      add(
        new THREE.CylinderGeometry(0.38, 0.6, 0.6, 24),
        material("#e4b76f"),
        3.9,
        2.65,
        -2.9,
      );
      const lamp = new THREE.PointLight("#ffd49b", svg ? 0.2 : 10, 6);
      lamp.position.set(3.9, 2.4, -2.9);
      scene.add(lamp);
    }
    const lb = luggageBounds(config.luggage),
      lp = roomToWorld(
        config.luggage === "small"
          ? { x: 85.5, y: 90.85 }
          : config.luggage === "standard"
            ? { x: 87.75, y: 88.6 }
            : { x: 89.5, y: 90.25 },
      );
    const suitcase = box(
      lb.width,
      lb.height,
      lb.depth,
      material("#815739"),
      lp.x,
      lb.height / 2,
      lp.z,
    );
    hit(suitcase, () =>
      latest.current.onMove({ kind: "perch", perch: "suitcase" }),
    );
    for (const dx of [-lb.width * 0.3, lb.width * 0.3])
      box(
        0.05,
        lb.height + 0.03,
        lb.depth + 0.02,
        brass,
        lp.x + dx,
        lb.height / 2,
        lp.z,
      );
    const atlas = new THREE.TextureLoader().load("/art/frog-poses.webp", () => {
      dirty = true;
    });
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.repeat.set(1 / 3, 1 / 3);
    textures.push(atlas);
    const frogMaterial = new THREE.SpriteMaterial({
      map: atlas,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
    });
    disposables.push(frogMaterial);
    const frog = new THREE.Sprite(frogMaterial);
    frog.scale.set(1.3, 1.3, 1);
    frog.center.set(0.5, 0.06);
    scene.add(frog);
    hit(frog, () => latest.current.onPose());
    const shadow = add(
      new THREE.CircleGeometry(0.27, 24),
      new THREE.MeshBasicMaterial({
        color: "#171910",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      0,
      0.045,
      0,
    );
    disposables.push(shadow.material);
    shadow.rotation.x = -Math.PI / 2;
    const destination = add(
      new THREE.RingGeometry(0.12, 0.15, 28),
      new THREE.MeshBasicMaterial({ color: "#ddd0a4", side: THREE.DoubleSide }),
      0,
      0.055,
      0,
    );
    disposables.push(destination.material);
    destination.rotation.x = -Math.PI / 2;
    destination.visible = false;
    // SVG compatibility uses identical projected geometry and depth order, without requiring a GPU.
    const ns = "http://www.w3.org/2000/svg";
    const frogNode = document.createElementNS(ns, "g");
    const frogImage = document.createElementNS(ns, "svg");
    const frogAtlas = document.createElementNS(ns, "image");
    frogAtlas.setAttribute("href", "/art/frog-poses.webp");
    frogAtlas.setAttribute("width", "900");
    frogAtlas.setAttribute("height", "900");
    frogImage.appendChild(frogAtlas);
    frogNode.appendChild(frogImage);
    const frogSvg = new SVGObject(frogNode);
    const mapNode = document.createElementNS(ns, "g"),
      mapImage = document.createElementNS(ns, "image");
    mapImage.setAttribute("href", mapCanvas.toDataURL());
    mapImage.setAttribute("width", "1024");
    mapImage.setAttribute("height", "600");
    mapNode.appendChild(mapImage);
    const mapSvg = new SVGObject(mapNode);
    mapSvg.position.copy(map.position);
    mapSvg.renderOrder = 3;
    if (svg) {
      scene.add(frogSvg, mapSvg);
      frogMaterial.opacity = 0;
    }
    const projectPixels = (point: THREE.Vector3) => {
      const v = point.clone().project(camera);
      return {
        x: (v.x * container.clientWidth) / 2,
        y: (-v.y * container.clientHeight) / 2,
      };
    };
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const pointerDown = (raw: Event) => {
      const event = raw as PointerEvent;
      down = { x: event.clientX, y: event.clientY };
    };
    const pointerUp = (raw: Event) => {
      const event = raw as PointerEvent;
      if (
        !down ||
        Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6
      ) {
        down = null;
        return;
      }
      down = null;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const intersection = raycaster.intersectObjects(
        interactive.filter(
          (object) =>
            object !== frog ||
            (!latest.current.away &&
              ["idle", "seated"].includes(latest.current.actor.phase)),
        ),
        false,
      )[0];
      if (!intersection) return;
      if (intersection.object === floor || intersection.object === rug) {
        latest.current.onMove({
          kind: "floor",
          point: worldToRoom(intersection.point.x, intersection.point.z),
        });
      } else
        (intersection.object.userData.action as (() => void) | undefined)?.();
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      dirty = true;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(container);
    let frame = 0,
      disposed = false,
      lastActor: RoomActor | null = null,
      lastAway: boolean | undefined;
    const draw = () => {
      if (disposed) return;
      const away = !!latest.current.away;
      frog.visible = frogSvg.visible = shadow.visible = !away;
      const actor = latest.current.actor,
        p = actorInSpace(actor),
        [col, row] = POSE_CELL[actor.pose];
      atlas.repeat.x = actor.facing === "left" ? -1 / 3 : 1 / 3;
      atlas.offset.set(
        (col + (actor.facing === "left" ? 1 : 0)) / 3,
        (2 - row) / 3,
      );
      frog.position.set(p.x, p.y, p.z);
      frogMaterial.rotation =
        actor.phase === "walk"
          ? Math.sin(performance.now() * 0.014) * 0.025
          : 0;
      shadow.position.set(p.x, 0.045, p.z);
      shadow.scale.setScalar(1 - actor.jump * 0.06);
      destination.position.set(p.x, 0.055, p.z);
      destination.visible = !away && actor.phase === "walk";
      const changed = controls.update();
      if (svg) {
        frogSvg.position.copy(frog.position);
        frogSvg.renderOrder = actor.position.y > 95 ? 4 : 1;
        camera.updateMatrixWorld();
        const foot = projectPixels(frog.position),
          head = projectPixels(
            frog.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
          );
        const size = Math.abs(head.y - foot.y);
        frogImage.setAttribute("viewBox", `${col * 300} ${row * 300} 300 300`);
        frogImage.setAttribute("width", String(size));
        frogImage.setAttribute("height", String(size));
        frogImage.setAttribute("x", String(-size / 2));
        frogImage.setAttribute("y", String(-size * 0.94));
        frogImage.setAttribute(
          "transform",
          actor.facing === "left" ? "scale(-1,1)" : "",
        );
        const center = projectPixels(map.position),
          a = projectPixels(new THREE.Vector3(tableX - 2.1, 0.991, 1.1)),
          b = projectPixels(new THREE.Vector3(tableX + 2.1, 0.991, 1.1)),
          c = projectPixels(new THREE.Vector3(tableX - 2.1, 0.991, 3.3));
        mapImage.setAttribute(
          "transform",
          `matrix(${(b.x - a.x) / 1024} ${(b.y - a.y) / 1024} ${(c.x - a.x) / 600} ${(c.y - a.y) / 600} ${a.x - center.x} ${a.y - center.y})`,
        );
      }
      if (changed || dirty || lastActor !== actor || lastAway !== away) {
        renderer.render(scene, camera);
        dirty = false;
        lastActor = actor;
        lastAway = away;
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      textures.forEach((t) => t.dispose());
      disposables.forEach((d) => d.dispose());
      if (renderer instanceof THREE.WebGLRenderer) renderer.dispose();
      renderer.domElement.remove();
      delete container.dataset.renderer;
      reset.current = null;
      orbit.current = null;
    };
  }, [sceneKey]);

  return (
    <section className="spatial-room" aria-label="三维房间">
      <div
        className="space-canvas"
        ref={host}
        role="img"
        aria-label="可旋转的三维房间，点击地板让蛙蛙走动，点击桌面地图展开旅行地图"
      />
      <header className="space-bar">
        <button onClick={props.onMap}>← 回到地图</button>
        <span>家 · {props.city}</span>
      </header>
      {failed && (
        <p className="space-error" role="alert">
          此浏览器暂时无法显示三维房间，请切换到插画视角。
        </p>
      )}
      {props.away && (
        <button
          type="button"
          className="room-away-note"
          onClick={props.onTravel}
        >
          蛙蛙自己出门旅行了 · 看看它的行程
        </button>
      )}
      <nav className="space-controls" aria-label="房间视角和陈列">
        <button aria-label="向左看" onClick={() => orbit.current?.(-1)}>
          ↶
        </button>
        <button onClick={() => reset.current?.()}>重置视角</button>
        <button aria-label="向右看" onClick={() => orbit.current?.(1)}>
          ↷
        </button>
        <button
          disabled={props.away}
          onClick={() => props.onMove({ kind: "perch", perch: "armchair" })}
        >
          坐回沙发
        </button>
        <button onClick={() => props.onCollection("postcards")}>
          墙上来信
        </button>
        <button onClick={() => props.onCollection("souvenirs")}>
          旅行纪念品
        </button>
        <button onClick={props.onMap}>桌面地图</button>
      </nav>
      <div className="space-hint" role="status">
        {props.away
          ? "家里的位置留着，等蛙蛙回来"
          : props.actor.phase === "walk"
            ? "蛙蛙走过去…"
            : ["jump-up", "jump-down", "rise", "sit"].includes(
                  props.actor.phase,
                )
              ? "蛙蛙正在上下沙发…"
              : "拖动环视 · 滚轮或双指缩放 · 点空地走走"}
      </div>
      <div className="sr-only">
        <button
          disabled={props.away}
          onClick={() =>
            props.onMove({ kind: "floor", point: { x: 12, y: 94 } })
          }
        >
          走到房间左侧
        </button>
        <button
          disabled={props.away}
          onClick={() =>
            props.onMove({ kind: "floor", point: { x: 76, y: 96 } })
          }
        >
          走到房间右侧
        </button>
        <button disabled={props.away} onClick={props.onPose}>
          蛙蛙换姿态
        </button>
      </div>
    </section>
  );
}
