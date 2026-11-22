import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useArchive, useService } from '../context';
import { buildWallModel, formattedDay, isNewWish, wallModelIsEmpty, type WallModel, type WallPhoto, type WallWish } from './model';
import {
  EMPTY_METRICS,
  WORLD_CAMERA,
  projectCity,
  mapCoordinate,
  projectRegion,
  projectWorld,
  toScreen,
  viewRect,
  inBoard,
  type Camera,
  type Metrics,
} from './geometry';
import {
  placeBubble,
  placeFrog,
  placeFrogActions,
  placeLabels,
  placeWish,
  clamp,
  type PilePlacement,
  type Rect,
} from './layout';
import { groupPoiRows, poiTotal } from './groups';
import { availableDestinations, type DestinationCandidate } from './candidates';
import { usePhotoImages, photoImage } from './usePhotoImages';
import {BasemapControls} from './BasemapControls';
import { MapBoard, type CityPhotoMarker, type DestTagPlacement, type RoutePath } from './MapBoard';
import { PoiList } from './PoiList';
import { PhotoLocationPicker } from './PhotoLocationPicker';
import { PhotoLocationInbox } from './PhotoLocationInbox';
import { photoLocationFocus, PHOTO_LOCATION_ZOOM } from './photo-location-focus';
import { usePhotoDrop } from './usePhotoDrop';
import { mergeSelection } from './import-selection';
import type { LocationSuggestion } from '../../domain/services/fill-locations';
import { photoLocationCamera } from './photo-location-camera';
import type { ManualLocationInput } from './ManualLocationForm';
import { namedMapPoint } from './waypoint-names';
import { EntrustChooser } from './EntrustChooser';
import { Crumb, EmptyCard, TopBar, Toast, ZoomControls } from './Chrome';
import { MemoryOverlay } from './MemoryOverlay';
import { Drawer, type DrawerTab } from './Drawer';
import { WishFocus, type WishBackPhoto } from './Postcard';
import { POSTCARD_MARK_SIZE } from './postcard-mark';
import { postcardFootprints } from './postcard-photos';
import { HomeRoom, SpecialtyFocus, type SpecialtyProvenance } from './HomeRoom';
import { ReplayBar, type FrogAction, type FrogMode } from './Frog';
import { furnitureFor, luggageTier, type SpecialtyAward } from '../../domain/home/collection';
import type { FrogPerch } from '../../domain/home/perch';
import type { MapViewState } from '../../domain/home/map-view';
import { SettingsPanel, type ThemeChoice } from './SettingsPanel';
import { SearchPanel, type SearchItem, type PlaceSearchTab } from './SearchPanel';
import type { PlacedPostcard } from './Postcard';
import { cityCamera } from './city-camera';
import { boundCamera, maxMapZoom } from './map-gestures';
import { POSTCARD_DELIVERY_MS } from '../../domain/wish/wish';
import { EMPTY_FROG_TRAVEL, frogJourneyLocation, journeyAway, journeyPhase } from '../../domain/frog/journey';
import { useFrogJourney } from './useFrogJourney';
import { FrogJourneyPanel } from './FrogJourneyPanel';
import {WaypointPanel,type WaypointDraft} from './WaypointPanel';
import {routeActivity,type TravelWaypoint} from '../../domain/frog/roaming';
import {landAt} from '../../infrastructure/geo/frog-landscape';
import './waypoints.css';
import './map-left-rail.css';
import './map-primary-actions.css';
import {RealPlaces} from './RealPlaces';
import {useRealPlaces} from './useRealPlaces';
import {poiArea} from './real-pois';
import {photoLocationReference,type PhotoLocationReference} from './photo-location-start';

const DetailedPhotoMap=lazy(()=>import('./DetailedPhotoMap').then(m=>({default:m.DetailedPhotoMap})));
type Mode = 'world' | 'city' | 'region';
type Level = 'world' | 'country' | 'city' | 'region';
type PhotoPickReturn =
  | { readonly kind: 'drawer'; readonly tab: DrawerTab }
  | { readonly kind: 'inbox'; readonly candidateId: string | null }
  | { readonly kind: 'memory'; readonly tripId: string };
interface PhotoPickSession {
  ids: readonly string[];
  returnTo: PhotoPickReturn;
  reference: PhotoLocationReference | null;
  draft: WaypointDraft | null;
  view: { camera: Camera; mode: Mode; level: Level };
  suggestion: LocationSuggestion | null;
}

interface ReplayState {
  readonly tripId: string;
  readonly index: number;
  readonly playing: boolean;
}

interface RawPile {
  cityKey: string;
  photoIds: string[];
  sx: number;
  sy: number;
  year: number;
  title: string;
  long: boolean;
}

function projectAt(mode: Mode, lat: number, lng: number): { x: number; y: number } {
  if (mode === 'city') return projectCity(lat, lng);
  if (mode === 'region') return projectRegion(lat, lng);
  return projectWorld(lat, lng);
}

function pathD(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作没有完成，请重试';
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function computePiles(model: WallModel, camera: Camera, metrics: Metrics, level: Level, mode: Mode): PilePlacement[] {
  if (metrics.sheetW <= 0 || level === 'city') return [];
  const raw: RawPile[] = [];
  for (const city of model.cities) {
    const point = toScreen(projectAt(mode, city.lat, city.lng), camera, metrics);
    if (!inBoard(point.x, point.y, metrics, 90)) continue;
    raw.push({
      cityKey: city.key,
      photoIds: [...city.photoIds].sort((a,b)=>(model.photoById.get(b)?.importedAt??0)-(model.photoById.get(a)?.importedAt??0)),
      sx: point.x,
      sy: point.y,
      year: city.year,
      title: city.name,
      long: city.long,
    });
  }

  if (level === 'world') {
    raw.sort((a, b) => b.photoIds.length - a.photoIds.length);
    const merged: RawPile[] = [];
    for (const pile of raw) {
      const host = merged.find((item) => Math.hypot(item.sx - pile.sx, item.sy - pile.sy) < 34);
      if (!host) {
        merged.push({ ...pile, photoIds: [...pile.photoIds] });
        continue;
      }
      host.photoIds = host.photoIds.concat(pile.photoIds);
      if (pile.photoIds.length > host.photoIds.length / 2) host.year = pile.year;
    }
    for (const pile of merged) {
      let sx = 0;
      let sy = 0;
      let count = 0;
      for (const photoId of pile.photoIds) {
        const photo = model.photoById.get(photoId);
        if (!photo) continue;
        const screen = toScreen(projectAt(mode, photo.lat, photo.lng), camera, metrics);
        sx += screen.x;
        sy += screen.y;
        count += 1;
      }
      if (count > 0) {
        pile.sx = sx / count;
        pile.sy = sy / count;
      }
    }
    return merged;
  }

  for (let pass = 0; pass < 5; pass += 1) {
    for (let i = 0; i < raw.length; i += 1) {
      const a = raw[i];
      if (!a) continue;
      for (let j = i + 1; j < raw.length; j += 1) {
        const b = raw[j];
        if (!b) continue;
        const dx = b.sx - a.sx;
        const dy = b.sy - a.sy;
        const distance = Math.hypot(dx, dy);
        if (distance >= 46) continue;
        const angle = Math.atan2(dy, dx) + (i + 1) * 0.9;
        const push = (46 - distance) / 2 + 0.8;
        a.sx -= Math.cos(angle) * push;
        a.sy -= Math.sin(angle) * push;
        b.sx += Math.cos(angle) * push;
        b.sy += Math.sin(angle) * push;
      }
    }
  }
  return raw;
}

function buildRoutes(
  model: WallModel,
  camera: Camera,
  metrics: Metrics,
  level: Level,
  mode: Mode,
  activeTripId: string,
): RoutePath[] {
  if (metrics.sheetW <= 0) return [];
  const routes: RoutePath[] = [];
  if (level === 'city') {
    const photos = model.photos
      .filter((photo) => photo.tripId === activeTripId)
      .slice()
      .sort((a, b) => a.capturedAt - b.capturedAt);
    const points = photos
      .map((photo) => toScreen(projectAt(mode, photo.lat, photo.lng), camera, metrics))
      .filter((point) => inBoard(point.x, point.y, metrics, 220));
    if (points.length > 1) routes.push({ d: pathD(points), className: 'route-line live' });
    return routes;
  }

  const kansai = (lat: number, lng: number) => lat > 33.4 && lat < 36 && lng > 134.2 && lng < 136.8;
  model.trips.forEach((trip, index) => {
    if (trip.visits.length < 2) return;
    if (mode === 'region' && !trip.visits.every((visit) => kansai(visit.lat, visit.lng))) return;
    const points = trip.visits
      .map((visit) => toScreen(projectAt(mode, visit.lat, visit.lng), camera, metrics))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (points.length < 2) return;
    const className =
      level === 'region' && trip.id === activeTripId ? 'route-line live' : index < 3 ? 'route-line' : 'route-line muted';
    routes.push({ d: pathD(points), className });
  });
  return routes;
}

function nearestCityScreen(
  model: WallModel,
  x: number,
  y: number,
  camera: Camera,
  metrics: Metrics,
  mode: Mode,
): { x: number; y: number } | null {
  let best: { x: number; y: number; distance: number } | null = null;
  for (const city of model.cities) {
    const point = toScreen(projectAt(mode, city.lat, city.lng), camera, metrics);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (!best || distance < best.distance) best = { x: point.x, y: point.y, distance };
  }
  return best;
}

const ARRIVAL_MS = 1200;
const HIGHLIGHT_MS = 1500;

export function MapWall() {
  const service = useService();
  const snapshot = useArchive();
  const loadThumbnail=useCallback((id:string)=>service.thumbnail(id),[service]);
  const travel = snapshot.frogTravel ?? EMPTY_FROG_TRAVEL;
  const { journeyNow,journeyError,reconcile } = useFrogJourney(service,snapshot.frogTravel,snapshot.status==='ready');
  const [journeyPanelOpen,setJourneyPanelOpen] = useState(false);
  const travelPhase = journeyPhase(travel.current,journeyNow);
  const frogAway = journeyAway(travel.current,journeyNow);
  const model = useMemo(() => buildWallModel(snapshot, snapshot.home.city.key), [snapshot]);
  const suggestions = service.suggestions();
  const empty = wallModelIsEmpty(model);
  const missingPhotoCount=snapshot.photos.filter(p=>!p.ignored&&p.geo===null).length;

  const [scene, setScene] = useState<'wall' | 'home'>('wall');
  const [waypointsOpen,setWaypointsOpen]=useState(false),[selecting,setSelecting]=useState(false),[waypointDraft,setWaypointDraft]=useState<WaypointDraft|null>(null);
  const [photoPick,setPhotoPick]=useState<PhotoPickSession|null>(null);
  const [locationInbox,setLocationInbox]=useState<{candidateId:string|null}|null>(null);
  const [importSelection,setImportSelection]=useState<readonly File[]>([]);
  const [importing,setImporting]=useState(false);
  const [detailedPhotoMap,setDetailedPhotoMap]=useState(false);
  const photoSaving=useRef(false);
  const pendingPhotoFocus=useRef<readonly string[]>([]);
  const [following,setFollowing]=useState(false);
  const followingRef=useRef(false);
  const frogLocation=frogJourneyLocation(travel.current,snapshot.home.city,journeyNow);
  const movement=routeActivity(travel.current,journeyNow);

  const [mode, setMode] = useState<Mode>('world');
  const [level, setLevel] = useState<Level>('world');
  const [camera, setCamera] = useState<Camera>(WORLD_CAMERA);
  const cameraRef = useRef<Camera>(camera);
  const cameraFrame = useRef<number | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [measuredMetrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [liveBasemap,setLiveBasemap]=useState(import.meta.env.VITE_BASEMAP_MODE!=='offline');
  const [basemapMessage,setBasemapMessage]=useState('正在加载真实底图…');
  const metrics=useMemo<Metrics>(()=>liveBasemap?{...measuredMetrics,mercatorMode:mode}:measuredMetrics,[liveBasemap,measuredMetrics,mode]);
  const realPoiArea=poiArea(camera,metrics,mode);
  const realPlaces=useRealPlaces(realPoiArea);
  const [searchTab,setSearchTab]=useState<PlaceSearchTab>('archive');

  const [theme, setTheme] = useState<ThemeChoice>(snapshot.settings.theme);
  const [hints, setHints] = useState(snapshot.settings.frogHints);
  const [systemDark, setSystemDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('candidates');
  const [listOpen, setListOpen] = useState(false);
  const [linked, setLinked] = useState(false);
  const [entrusting, setEntrusting] = useState(false);
  const [frogMode, setFrogMode] = useState<FrogMode>('rest');
  const [frogActionsOpen, setFrogActionsOpen] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [fan, setFan] = useState<{ cityKey: string; photoIds: readonly string[] } | null>(null);
  const [highlightCity, setHighlightCity] = useState<string | null>(null);
  const [highlightWish, setHighlightWish] = useState<string | null>(null);
  const [memoryTripId, setMemoryTripId] = useState<string | null>(null);
  const [wishFocus, setWishFocus] = useState<{ wishId: string; left: number; top: number } | null>(null);
  const [choosingWish, setChoosingWish] = useState(false);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [activeTripId, setActiveTripId] = useState('');
  const [cityKey, setCityKey] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [flew, setFlew] = useState<ReadonlySet<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [specialtyFocus, setSpecialtyFocus] = useState<SpecialtyAward | null>(null);

  const toastTimer = useRef<number | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const linkedTimer = useRef<number | null>(null);
  const entrustBusy = useRef(false);
  const [entrustSelection, setEntrustSelection] = useState<string | null>(null);
  const poiScrollRef = useRef<HTMLDivElement>(null);
  const savedView = useRef<MapViewState | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const restoredView = useRef(false);
  const viewSaveTimer = useRef<number | null>(null);

  const notify = useCallback((message: string, duration = 2600) => {
    setToastMessage(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(null), duration);
  }, []);

  const photoDrop = usePhotoDrop({
    onFiles: (files) => {
      if (importing) {
        notify('正在导入照片，请稍候再添加');
        return;
      }
      if (photoPick) {
        notify('先完成当前位置，再添加照片');
        return;
      }
      setImportSelection((current) => mergeSelection(current, files));
      setLocationInbox(null);
      setMemoryTripId(null);
      setSettingsOpen(false);
      setSearchOpen(false);
      setWishFocus(null);
      setDrawerTab('import');
      setDrawerOpen(true);
      notify(`已选择 ${files.length} 个文件`);
    },
    onError: (error) => notify(errorMessage(error)),
  });

  const guard = useCallback(
    async (task: () => Promise<unknown>, success?: string) => {
      try {
        await task();
        if (success) notify(success);
        return true;
      } catch (error) {
        notify(errorMessage(error));
        return false;
      }
    },
    [notify],
  );

  const animationInstant = useMemo(() => {
    if (snapshot.settings.reducedMotion === 'reduce') return true;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, [snapshot.settings.reducedMotion]);

  const activeTrip = model.tripById.get(activeTripId) ?? model.trips[0] ?? null;
  const effectiveTripId = activeTrip?.id ?? '';
  const effectiveCityKey = model.cityByKey.has(cityKey) ? cityKey : model.cities[0]?.key ?? '';
  const photoUrls = usePhotoImages(model.photos, service);
  const imageFor = useCallback((photo: WallPhoto) => photoImage(photo, photoUrls), [photoUrls]);

  // ---------------------------------------------------------------- lifecycle

  useLayoutEffect(() => {
    const measure = () => {
      const board = boardRef.current;
      const sheet = sheetRef.current;
      if (!board || !sheet) return;
      setMetrics({
        boardW: board.clientWidth,
        boardH: board.clientHeight,
        sheetW: sheet.clientWidth,
        sheetH: sheet.clientHeight,
        offX: sheet.offsetLeft,
        offY: sheet.offsetTop,
      });
    };
    measure();
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    if (sheetRef.current) observer.observe(sheetRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [scene]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useLayoutEffect(() => {
    if (snapshot.status !== 'ready' || restoredView.current) return;
    restoredView.current = true;
    const saved = snapshot.mapView;
    if (!saved) return;
    savedView.current = saved;
    setMode(saved.mode);
    setLevel(saved.level);
    setCityKey(saved.cityKey ?? '');
    setActiveTripId(saved.activeTripId ?? '');
    setCamera(saved.camera);
    pendingScroll.current = saved.poiScrollTop;
  }, [snapshot.status, snapshot.mapView]);

  useLayoutEffect(() => {
    if (scene !== 'wall' || pendingScroll.current === null) return;
    const element = poiScrollRef.current;
    if (!element) return;
    element.scrollTop = pendingScroll.current;
    pendingScroll.current = null;
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTheme(snapshot.settings.theme);
    setHints(snapshot.settings.frogHints);
  }, [snapshot.settings.theme, snapshot.settings.frogHints]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(query.matches);
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (model.trips.length === 0) return;
    if (!model.tripById.has(activeTripId)) {
      const restored = snapshot.mapView?.activeTripId;
      setActiveTripId(restored && model.tripById.has(restored) ? restored : model.trips[0]?.id ?? '');
    }
  }, [model, activeTripId, snapshot.mapView]);

  const resolvedTheme = theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light';

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.body.classList.toggle('mode-city', mode === 'city');
    document.body.classList.toggle('mode-region', mode === 'region');
    document.body.classList.toggle('poi-list-closed', !listOpen);
    document.body.classList.toggle('drawer-open', drawerOpen);
    document.body.classList.toggle('is-entrusting', entrusting);
    document.body.dataset.level = level;
    document.body.dataset.scene = scene === 'home' ? 'home' : empty&&!photoPick&&!waypointsOpen&&!selecting&&!(travel.waypoints?.length)&&!frogAway ? 'empty' : 'wall';
  }, [resolvedTheme, mode, level, listOpen, drawerOpen, entrusting, empty, scene,waypointsOpen,selecting,travel.waypoints?.length,frogAway,photoPick]);

  useEffect(
    () => () => {
      if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
      if (linkedTimer.current !== null) window.clearTimeout(linkedTimer.current);
    },
    [],
  );

  // ---------------------------------------------------------------- camera

  const animateCamera = useCallback(
    (target: Camera, nextMode: Mode, nextLevel: Level, instant = false) => {
      followingRef.current=false;setFollowing(false);
      if (cameraFrame.current !== null) {
        cancelAnimationFrame(cameraFrame.current);
        cameraFrame.current = null;
      }
      setMode(nextMode);
      setLevel(nextLevel);
      const from = cameraRef.current;
      if (instant || animationInstant) {
        setCamera(target);
        return;
      }
      const start = performance.now();
      const step = (time: number) => {
        const t = Math.min(1, (time - start) / 320);
        const ease = 1 - (1 - t) ** 3;
        setCamera({
          cx: from.cx + (target.cx - from.cx) * ease,
          cy: from.cy + (target.cy - from.cy) * ease,
          zoom: from.zoom + (target.zoom - from.zoom) * ease,
        });
        if (t < 1) {
          cameraFrame.current = requestAnimationFrame(step);
        } else {
          cameraFrame.current = null;
        }
      };
      cameraFrame.current = requestAnimationFrame(step);
    },
    [animationInstant],
  );

  const gestureCamera = useCallback((next: Camera) => {
    followingRef.current=false;setFollowing(false);
    if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = null;
    cameraRef.current = next;
    setCamera(next);
    setReplay(current => current?.playing ? { ...current, playing: false } : current);
  }, [setReplay]);

  useEffect(()=>{
    if(!following||scene!=='wall'||metrics.sheetW<=0)return;
    let frame=0,last=performance.now();
    const step=(at:number)=>{
      if(!followingRef.current)return;
      if(at-last>=40){
        const t=travel.motionPausedAt??Date.now(),location=frogJourneyLocation(travel.current,snapshot.home.city,t);
        if(location){
          const p=projectWorld(location.lat,location.lng),current=cameraRef.current;
          const activity=routeActivity(travel.current,t),desired=activity==='walk'?3500:activity==='home'?Math.min(current.zoom,60):35;
          const alpha=animationInstant?1:Math.min(1,(at-last||40)/200);
          const next=boundCamera({cx:current.cx+(p.x-current.cx)*alpha,cy:current.cy+(p.y-current.cy)*alpha,zoom:current.zoom+(desired-current.zoom)*alpha},metrics,maxMapZoom('world'));
          if(Math.abs(next.cx-current.cx)+Math.abs(next.cy-current.cy)+Math.abs(next.zoom-current.zoom)>.000001){cameraRef.current=next;setCamera(next);}
        }
        last=at;
      }
      frame=requestAnimationFrame(step);
    };
    frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);
  },[following,scene,metrics,travel,snapshot.home.city,animationInstant]);

  const locateWaypoint=useCallback((point:Pick<TravelWaypoint,'lat'|'lng'>)=>{
    setScene('wall');setReplay(null);setFan(null);animateCamera({cx:projectWorld(point.lat,point.lng).x,cy:projectWorld(point.lat,point.lng).y,zoom:3600},'world','world');
  },[animateCamera,setReplay]);
  const focusPhotoCamera=useCallback((point:{lat:number;lng:number},zoom:number)=>{
    const projected=projectWorld(point.lat,point.lng);
    const base={cx:projected.x,cy:projected.y,zoom};
    const camera=window.matchMedia('(max-width: 700px)').matches
      ? photoLocationCamera(point,base,metrics,'world')
      : base;
    animateCamera(camera,'world','world',true);
  },[metrics,animateCamera]);
  const startPhotoPick=useCallback((ids:readonly string[],target:DrawerTab|{returnTo?:PhotoPickReturn}='fill')=>{
    if(!ids.length)return;
    setDetailedPhotoMap(false);
    const uniqueIds=[...new Set(ids)];
    const selectedPhotos=snapshot.photos.filter(photo=>uniqueIds.includes(photo.id));
    const suggestion=suggestions.find(item=>uniqueIds.includes(item.photoId))??null;
    const reference=photoLocationReference(uniqueIds,snapshot.photos,suggestions);
    const seedPhoto=selectedPhotos.find(photo=>photo.geo!==null);
    let draft:WaypointDraft|null=null;
    if(seedPhoto?.geo){
      const named=namedMapPoint(seedPhoto.geo);
      draft={
        ...named,
        name:seedPhoto.manualCityRef?.name??named.name,
        country:seedPhoto.manualCityRef?.countryName??named.country,
      };
    }
    const returnTo:PhotoPickReturn=typeof target==='string'
      ? {kind:'drawer',tab:target}
      : target.returnTo??{kind:'drawer',tab:'fill'};
    setPhotoPick({ids:uniqueIds,returnTo,reference,draft,view:{camera:cameraRef.current,mode,level},suggestion});
    setDrawerOpen(false);setLocationInbox(null);setScene('wall');setWaypointsOpen(false);setSelecting(false);setWaypointDraft(null);
    setListOpen(false);setFan(null);setMemoryTripId(null);setWishFocus(null);setJourneyPanelOpen(false);setFrogActionsOpen(false);setReplay(null);
    followingRef.current=false;setFollowing(false);
    const focus=photoLocationFocus({
      photos:selectedPhotos,
      suggestions,
      candidates:snapshot.candidates,
      trips:snapshot.trips,
      visits:snapshot.visits,
    })??(reference?{lat:reference.lat,lng:reference.lng,zoom:PHOTO_LOCATION_ZOOM}:null);
    if(focus){
      focusPhotoCamera(focus,focus.zoom);
    }else if(mode!=='world'){
      const p=mapCoordinate(metrics.offX+metrics.sheetW/2,metrics.offY+metrics.sheetH/2,cameraRef.current,metrics,mode);
      const centre=p?projectWorld(p.lat,p.lng):null;
      animateCamera(centre?{cx:centre.x,cy:centre.y,zoom:PHOTO_LOCATION_ZOOM}:WORLD_CAMERA,'world','world',true);
    }
  },[snapshot.photos,snapshot.candidates,snapshot.trips,snapshot.visits,suggestions,mode,level,metrics,animateCamera,focusPhotoCamera,setMemoryTripId,setWishFocus,setReplay]);
  const returnFromPhotoPick=useCallback((session:PhotoPickSession)=>{
    animateCamera(session.view.camera,session.view.mode,session.view.level,true);
    if(session.returnTo.kind==='inbox'){
      setLocationInbox({candidateId:session.returnTo.candidateId});
      setDrawerOpen(false);
      return;
    }
    if(session.returnTo.kind==='memory'){
      setMemoryTripId(session.returnTo.tripId);
      setDrawerOpen(false);
      return;
    }
    setDrawerTab(session.returnTo.tab);
    setDrawerOpen(true);
  },[animateCamera,setMemoryTripId]);
  const cancelPhotoPick=useCallback(()=>{
    if(!photoPick||photoSaving.current)return;
    returnFromPhotoPick(photoPick);
    setPhotoPick(null);
  },[photoPick,returnFromPhotoPick]);
  const savePhotoPick=useCallback(async(input:ManualLocationInput)=>{
    if(!photoPick||photoSaving.current)return;
    const session=photoPick;
    photoSaving.current=true;
    try{
      await service.setPhotoLocations(session.ids,input);
      const archive=service.getSnapshot(),photos=archive.photos.filter(p=>session.ids.includes(p.id));
      setPhotoPick(null);
      if(session.returnTo.kind==='inbox'){
        animateCamera(session.view.camera,session.view.mode,session.view.level,true);
        setLocationInbox({candidateId:session.returnTo.candidateId});
        notify('位置已保存，继续标记下一张');
        return;
      }
      if(session.returnTo.kind==='memory'){
        animateCamera(session.view.camera,session.view.mode,session.view.level,true);
        setMemoryTripId(session.returnTo.tripId);
        notify('位置已更新，地图和旅行站点已同步');
        return;
      }
      const pending=photos.some(p=>p.tripId===null);
      if(pending){
        pendingPhotoFocus.current=[...session.ids];
        animateCamera(session.view.camera,session.view.mode,session.view.level,true);
        setDrawerTab(photos.some(p=>!p.thumbRef||p.capturedAtSource==='missing')?'progress':'candidates');setDrawerOpen(true);
        notify('位置已保存，继续确认这组照片');
      }else{
        const fresh=buildWallModel(archive,archive.home.city.key),located=fresh.photos.find(p=>session.ids.includes(p.id));
        const city=located?fresh.cityByKey.get(located.cityKey):null;
        setDrawerOpen(false);
        if(city&&located){setActiveTripId(located.tripId);setCityKey(city.key);animateCamera(cityCamera(fresh.photos.filter(p=>p.cityKey===city.key),city,metrics.sheetW>0?metrics.sheetH/metrics.sheetW:.64),'world','city');}
        notify('位置已保存，正在地图查看这张照片');
      }
    }finally{photoSaving.current=false;}
  },[photoPick,service,animateCamera,metrics,notify,setActiveTripId,setCityKey,setMemoryTripId]);
  const revealPhotoPin=useCallback((point:{lat:number;lng:number})=>{
    if(window.matchMedia('(max-width: 700px)').matches)animateCamera(photoLocationCamera(point,cameraRef.current,metrics,mode),mode,level);
  },[animateCamera,metrics,mode,level]);
  const pickMapPoint=useCallback((point:{lat:number;lng:number})=>{
    if(photoSaving.current)return;
    if(photoPick){setPhotoPick(current=>current?{...current,draft:namedMapPoint(point)}:current);revealPhotoPin(point);return;}
    setWaypointDraft(namedMapPoint(point));setWaypointsOpen(true);setListOpen(false);setSelecting(false);
  },[photoPick,revealPhotoPin]);
  const startDestinationPick=()=>{setScene('wall');setWaypointDraft(null);setSelecting(true);setWaypointsOpen(false);setListOpen(false);setSearchOpen(false);setJourneyPanelOpen(false);followingRef.current=false;setFollowing(false);setFan(null);setFrogActionsOpen(false);};
  const cancelDestinationPick=()=>{setSelecting(false);setWaypointDraft(null);setWaypointsOpen(true);};
  const openDestinationDraft=(point:WaypointDraft)=>{setScene('wall');setSearchOpen(false);setSelecting(false);setListOpen(false);setFan(null);setFrogActionsOpen(false);followingRef.current=false;setFollowing(false);setWaypointDraft(point);setWaypointsOpen(true);};
  const beginFollowing=useCallback(()=>{
    if(following){followingRef.current=false;setFollowing(false);return;}
    if(cameraFrame.current!==null)cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current=null;setScene('wall');setReplay(null);setMode('world');setLevel('world');setSelecting(false);setWaypointsOpen(false);setJourneyPanelOpen(false);followingRef.current=true;setFollowing(true);
  },[following,setReplay]);

  const zoomBy = useCallback((factor: number) => {
    if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = null;
    const current = cameraRef.current;
    gestureCamera(boundCamera({ ...current, zoom: current.zoom * factor }, metrics, maxMapZoom(mode,!!metrics.mercatorMode)));
  }, [mode, metrics, gestureCamera]);

  const focusCountry = useCallback(() => {
    const visits = activeTrip?.visits ?? [];
    if (visits.length === 0) {
      animateCamera({ cx: 880, cy: 190, zoom: 7.2 }, 'world', 'country');
      return;
    }
    const points = visits.map((visit) => projectWorld(visit.lat, visit.lng));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const ratio = metrics.sheetW > 0 ? metrics.sheetH / metrics.sheetW : 0.64;
    const zoom = clamp(Math.min((1000 * 0.62) / Math.max(spanX, 60), (1000 * ratio * 0.6) / Math.max(spanY, 30)), 2, 7.2);
    animateCamera(
      { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, zoom },
      'world',
      'country',
    );
  }, [activeTrip, animateCamera, metrics]);

  const zoomToCity = useCallback(
    (key: string) => {
      const city = model.cityByKey.get(key);
      if (!city) return;
      setCityKey(key);
      if (city.tripIds[0]) setActiveTripId(city.tripIds[0]);
      if (city.name === '京都') {
        animateCamera({ cx: 500, cy: 320, zoom: 1 }, 'city', 'city');
        return;
      }
      if (city.name === '大阪' || city.name === '宇治') {
        const point = projectRegion(city.lat, city.lng);
        animateCamera({ cx: point.x, cy: point.y, zoom: 2.6 }, 'region', 'region');
        return;
      }
      const aspect = metrics.sheetW > 0 ? metrics.sheetH / metrics.sheetW : .64;
      animateCamera(cityCamera(model.photos.filter(photo => photo.cityKey === key), city, aspect), 'world', 'city');
    },
    [animateCamera, model, metrics],
  );

  const focusWish = useCallback(
    (wish: WallWish) => {
      const point = projectWorld(wish.lat, wish.lng);
      setHighlightWish(wish.id);
      animateCamera({ cx: point.x, cy: point.y, zoom: Math.max(cameraRef.current.zoom, 3.2) }, 'world', 'world');
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlightWish(null), HIGHLIGHT_MS);
    },
    [animateCamera],
  );

  // ---------------------------------------------------------------- derived map

  const view = useMemo(() => viewRect(camera, metrics), [camera, metrics]);
  const viewBox = `${view.vx.toFixed(6)} ${view.vy.toFixed(6)} ${view.viewW.toFixed(6)} ${view.viewH.toFixed(6)}`;
  const piles = useMemo(() => computePiles(model, camera, metrics, level, mode), [model, camera, metrics, level, mode]);
  const routes = useMemo(
    () => buildRoutes(model, camera, metrics, level, mode, effectiveTripId),
    [model, camera, metrics, level, mode, effectiveTripId],
  );

  const cityPhotos: CityPhotoMarker[] = useMemo(() => {
    if (level !== 'city' || !effectiveCityKey || metrics.sheetW <= 0) return [];
    const markers: CityPhotoMarker[] = [];
    for (const photo of model.photos) {
      if (photo.cityKey !== effectiveCityKey) continue;
      const point = toScreen(projectAt(mode, photo.lat, photo.lng), camera, metrics);
      if (!inBoard(point.x, point.y, metrics, 60)) continue;
      markers.push({ photo, x: point.x, y: point.y });
    }
    return markers;
  }, [model, level, effectiveCityKey, metrics, mode, camera]);

  const photoPoints = useMemo(() => cityPhotos.map((marker) => ({ x: marker.x, y: marker.y })), [cityPhotos]);

  const house = useMemo(() => {
    const marker = snapshot.home.marker;
    if (!marker || metrics.sheetW <= 0) return null;
    if (level === 'city' || level === 'region') return null;
    const point = toScreen(projectAt(mode, marker.lat, marker.lng), camera, metrics);
    if (!inBoard(point.x, point.y, metrics, 42)) return null;
    return { x: point.x, y: point.y, name: snapshot.home.city.name };
  }, [snapshot.home, metrics, mode, camera, level]);

  const replayPoints = useMemo(() => {
    if (!replay) return [];
    const trip = model.tripById.get(replay.tripId);
    if (!trip) return [];
    return trip.visits.map((visit) => {
      const screen = toScreen(projectAt('world', visit.lat, visit.lng), camera, metrics);
      return { x: screen.x + 10, y: screen.y - 4, name: visit.name };
    });
  }, [replay, model, camera, metrics]);

  const frogPos = useMemo(() => {
    if (metrics.sheetW <= 0) return null;
    let anchor: { x: number; y: number } | null = replayPoints[replay?.index ?? -1] ?? null;
    if (!anchor && mode === 'world') {
      const location = frogJourneyLocation(travel.current,snapshot.home.city,journeyNow);
      if (location) {
        const point = toScreen(projectWorld(location.lat,location.lng),camera,metrics);
        if (!inBoard(point.x,point.y,metrics,48)) return null;
        anchor = point;
      }
    }
    if (!anchor && mode !== 'world' && !replay) return null;
    if (!anchor && mode === 'city' && effectiveCityKey) {
      const photos = model.photos
        .filter((photo) => photo.cityKey === effectiveCityKey)
        .slice()
        .sort((a, b) => a.capturedAt - b.capturedAt);
      const last = photos[photos.length - 1];
      if (last) {
        const point = toScreen(projectAt(mode, last.lat, last.lng), camera, metrics);
        anchor = { x: point.x, y: point.y };
      }
    }
    if (!anchor) {
      const lastVisit = activeTrip?.visits[activeTrip.visits.length - 1];
      if (!lastVisit) return null;
      const point = toScreen(projectAt(mode, lastVisit.lat, lastVisit.lng), camera, metrics);
      anchor = { x: point.x, y: point.y };
    }
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return null;
    if(frogAway&&!replay)return anchor;
    return placeFrog({ anchor, piles, photoPoints, level, mode, metrics });
  }, [model, replayPoints, replay, mode, effectiveCityKey, activeTrip, camera, metrics, piles, photoPoints, level,travel,snapshot.home.city,journeyNow,frogAway]);

  const wishPlacement = useMemo(() => {
    const cards: Array<{ wish: WallWish; cx: number; cy: number; width: number; height: number }> = [];
    const rects: Rect[] = [];
    const links: string[] = [];
    const centers = new Map<string, { cx: number; cy: number }>();
    if (metrics.sheetW <= 0) return { cards, rects, links, centers };

    const frogRect = frogPos
      ? { x: frogPos.x - 32, y: frogPos.y - 31, w: 64, h: 62 }
      : null;
    const seen = new Set<string>();
    for (const wish of model.wishes) {
      if (seen.has(wish.cityKey)) continue;
      const anchor = toScreen(projectAt(mode, wish.lat, wish.lng), camera, metrics);
      if (!inBoard(anchor.x, anchor.y, metrics, 40)) continue;
      seen.add(wish.cityKey);
      const width = POSTCARD_MARK_SIZE;
      const height = POSTCARD_MARK_SIZE;
      const placement = placeWish({
        anchor,
        width,
        height,
        piles,
        placed: rects,
        frogRect,
        obstacles: [
          ...photoPoints.map(p=>({x:p.x-28,y:p.y-28,w:56,h:56})),
          ...(travel.waypoints??[]).map(p=>toScreen(projectAt(mode,p.lat,p.lng),camera,metrics)).map(p=>({x:p.x-18,y:p.y-18,w:36,h:36})),
          ...realPlaces.pois.map(p=>toScreen(projectAt(mode,p.lat,p.lng),camera,metrics)).map(p=>({x:p.x-78,y:p.y-15,w:156,h:30})),
        ],
        metrics,
      });
      cards.push({ wish, cx: placement.cx, cy: placement.cy, width, height });
      rects.push(placement.rect);
      centers.set(wish.id, { cx: placement.cx, cy: placement.cy });
      if (wish.status !== 'fulfilled') {
        const near = nearestCityScreen(model, placement.cx, placement.cy, camera, metrics, mode);
        if (near) {
          const mx = (placement.cx + near.x) / 2;
          const my = (placement.cy + near.y) / 2 - Math.min(30, Math.abs(placement.cx - near.x) * 0.12);
          links.push(
            `M${placement.cx.toFixed(1)} ${placement.cy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${near.x.toFixed(1)} ${near.y.toFixed(1)}`,
          );
        }
      }
    }
    return { cards, rects, links, centers };
  }, [model, metrics, frogPos, mode, camera, level, piles, photoPoints, travel.waypoints, realPlaces.pois]);

  const labels = useMemo(
    () =>
      placeLabels({
        piles,
        wishRects: wishPlacement.rects,
        frogPos,
        metrics,
        level,
        photoCount: model.photos.length,
      }),
    [piles, wishPlacement.rects, frogPos, metrics, level, model.photos.length],
  );

  const activeWishCityKeys = useMemo(
    () => model.wishes.filter((wish) => wish.status !== 'fulfilled').map((wish) => wish.cityKey),
    [model],
  );
  const visitedKeys = useMemo(() => model.cities.map((city) => city.key), [model]);
  const entrustOptions = useMemo(
    () => availableDestinations({ visitedCityKeys: visitedKeys, activeWishCityKeys }),
    [visitedKeys, activeWishCityKeys],
  );

  const destinations = useMemo<DestTagPlacement[]>(() => {
    if (!entrusting || metrics.sheetW <= 0) return [];
    const offers = entrustOptions;
    const tags: DestTagPlacement[] = [];
    offers.forEach((destination, index) => {
      const point = toScreen(projectWorld(destination.lat, destination.lng), camera, metrics);
      if (!inBoard(point.x, point.y, metrics, 12)) return;
      const dx = index % 2 === 0 ? 30 : -30;
      const dy = (index % 3) * 8 - 8;
      tags.push({
        destination,
        x: clamp(point.x + dx, metrics.offX + 42, metrics.offX + metrics.sheetW - 42),
        y: clamp(point.y + dy, metrics.offY + 24, metrics.offY + metrics.sheetH - 24),
      });
    });
    return tags;
  }, [entrusting, metrics, entrustOptions, camera]);

  const frogActions = useMemo(() => {
    if (!frogActionsOpen || !frogPos) return null;
    const obstacles: Rect[] = piles.map((pile) => ({ x: pile.sx - 40, y: pile.sy - 38, w: 80, h: 76 }));
    if (mode === 'city') {
      for (const point of photoPoints) obstacles.push({ x: point.x - 26, y: point.y - 25, w: 52, h: 50 });
    }
    const placement = placeFrogActions({ frogPos, obstacles, metrics });
    return {
      x: placement.x,
      y: placement.below ? placement.y - 20 : placement.y + 20,
      below: placement.below,
    };
  }, [frogActionsOpen, frogPos, piles, mode, photoPoints, metrics]);

  const bubble = useMemo(
    () => (bubbleText && frogPos ? { placement: placeBubble(frogPos, metrics.boardW), text: bubbleText } : null),
    [bubbleText, frogPos, metrics],
  );

  const postcards = useMemo<PlacedPostcard[]>(() => {
    const from = frogPos ?? { x: metrics.boardW / 2, y: metrics.boardH / 2 };
    return wishPlacement.cards.map((card) => {
      const arriving =
        card.wish.status === 'received' && isNewWish(card.wish, now) && !flew.has(card.wish.id);
      return {
        wish: card.wish,
        cx: card.cx,
        cy: card.cy,
        width: card.width,
        height: card.height,
        arriving,
        dropping: false,
        flipping: wishFocus?.wishId === card.wish.id,
        flyX: from.x - card.cx,
        flyY: from.y - card.cy,
      };
    });
  }, [wishPlacement.cards, frogPos, metrics, now, flew, wishFocus]);

  const arrivingKey = postcards
    .filter((card) => card.arriving)
    .map((card) => card.wish.id)
    .join('|');

  useEffect(() => {
    if (!arrivingKey) return;
    const timer = window.setTimeout(() => {
      const ids = arrivingKey.split('|');
      setFlew((previous) => {
        const next = new Set(previous);
        for (const id of ids) next.add(id);
        return next;
      });
    }, ARRIVAL_MS);
    return () => window.clearTimeout(timer);
  }, [arrivingKey]);

  const groups = useMemo(() => groupPoiRows(model), [model]);
  const totalPoi = poiTotal(groups);
  const visitedCountries = useMemo(() => new Set(model.cities.map((city) => city.countryName)), [model]);
  const charmCount = useMemo(() => model.wishes.filter((wish) => wish.status === 'fulfilled').length, [model]);
  const homeFurniture = useMemo(
    () => furnitureFor({ tripCount: model.trips.length, countryCount: visitedCountries.size }),
    [model.trips.length, visitedCountries],
  );
  const homeLuggage = useMemo(() => luggageTier(visitedCountries.size), [visitedCountries]);
  const homePostcards = useMemo(
    () =>
      model.wishes
        .map((wish) => ({
          id: wish.id,
          name: wish.name,
          status: wish.status,
          year: (wish.status === 'fulfilled' ? model.trips.find(trip => trip.cityKeys.includes(wish.cityKey))?.year : undefined) ?? new Date(wish.createdAt).getUTCFullYear(),
        })),
    [model.wishes, model.trips],
  );
  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    for (const trip of model.trips) {
      const places = trip.visits.map((visit) => visit.cityKey).slice(0, 3);
      items.push({
        id: `trip:${trip.id}`,
        kind: 'trip',
        title: trip.title,
        subtitle: `${trip.year} · ${trip.visits.length} 个站点 · ${trip.photoIds.length} 张`,
        go: '打开回忆',
      });
      void places;
    }
    for (const city of model.cities) {
      items.push({
        id: `city:${city.key}`,
        kind: 'city',
        title: city.name,
        subtitle: `${city.countryName} · ${city.photoIds.length} 张照片`,
        go: '飞到城市',
        destination:{name:city.name,country:city.countryName,lat:city.lat,lng:city.lng,source:'map'},
      });
    }
    for (const wish of model.wishes) {
      items.push({
        id: `wish:${wish.id}`,
        kind: 'wish',
        title: wish.name,
        subtitle: `${wish.countryName} · ${wish.note ?? '等青蛙路过'}`,
        go: '查看明信片',
        destination:{name:wish.name,country:wish.countryName,lat:wish.lat,lng:wish.lng,source:'map'},
      });
    }
    return items;
  }, [model]);

  // ---------------------------------------------------------------- interactions

  const showHighlightCity = useCallback((key: string) => {
    setHighlightCity(key);
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightCity(null), HIGHLIGHT_MS);
  }, []);

  useEffect(() => {
    if (!highlightCity) return;
    const node = document.querySelector(`.poi-row[data-city="${escapeAttribute(highlightCity)}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [highlightCity]);

  const pulseList = useCallback(() => {
    setLinked(true);
    if (linkedTimer.current !== null) window.clearTimeout(linkedTimer.current);
    linkedTimer.current = window.setTimeout(() => setLinked(false), 900);
  }, []);

  const openMemory = useCallback((tripId: string) => {
    setMemoryTripId(tripId);
    setWishFocus(null);
    setSettingsOpen(false);
    setSearchOpen(false);
  }, []);

  const toggleFan = useCallback(
    (pile: PilePlacement) => {
      showHighlightCity(pile.cityKey);
      if (!listOpen) pulseList();
      setFan((current) => {
        if (current && current.cityKey === pile.cityKey) return null;
        const photoIds = pile.photoIds.slice(0, 7);
        if (pile.photoIds.length > photoIds.length) {
          notify(`这里还有 ${pile.photoIds.length - photoIds.length} 张，打开回忆查看全部`);
        }
        return { cityKey: pile.cityKey, photoIds };
      });
    },
    [listOpen, notify, pulseList, showHighlightCity],
  );

  const openPileTrip = useCallback(
    (cityKeyValue: string, photoIds: readonly string[]) => {
      const firstId = photoIds[0];
      const photo = firstId ? model.photoById.get(firstId) : undefined;
      if (photo) openMemory(photo.tripId);
      else {
        const city = model.cityByKey.get(cityKeyValue);
        const visit = city ? model.trips.flatMap((trip) => trip.visits).find((item) => item.cityKey === city.key) : undefined;
        if (visit) openMemory(visit.tripId);
      }
    },
    [model, openMemory],
  );

  const focusCityFromList = useCallback(
    (key: string) => {
      showHighlightCity(key);
      zoomToCity(key);
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlightCity(null), HIGHLIGHT_MS);
    },
    [showHighlightCity, zoomToCity],
  );

  const focusWishRow = useCallback(
    (wishId: string) => {
      const wish = model.wishById.get(wishId);
      if (!wish) return;
      focusWish(wish);
    },
    [focusWish, model],
  );

  const openWishFocus = useCallback(
    (wish: WallWish) => {
      const center = wishPlacement.centers.get(wish.id);
      const board = boardRef.current?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const halfW = 142;
      const halfH = 160;
      const anchor = center ?? { cx: board.width / 2, cy: board.height / 2 };
      setWishFocus({
        wishId: wish.id,
        left: clamp(board.left + anchor.cx, board.left + halfW, board.left + board.width - halfW),
        top: clamp(board.top + anchor.cy, board.top + halfH, board.top + board.height - halfH),
      });
    },
    [wishPlacement.centers],
  );

  const chooseWish = useCallback(
    (wishId: string, keep: boolean) => {
      if (choosingWish) return;
      setChoosingWish(true);
      void guard(async () => {
        await service.setWishStatus(wishId, keep ? 'stamped' : 'declined');
        setWishFocus(null);
        setHighlightWish(keep ? wishId : null);
        notify(keep ? '已留着 · 想去的地方，慢慢来' : '这次不去 · 明信片已收起');
      }).finally(() => setChoosingWish(false));
    },
    [choosingWish, guard, notify, service],
  );

  const handleWishClick = useCallback(
    (wish: WallWish) => {
      if (wishFocus?.wishId === wish.id) {
        setWishFocus(null);
        return;
      }
      openWishFocus(wish);
    },
    [openWishFocus, wishFocus],
  );

  const startEntrust = useCallback(() => {
    setScene('wall');
    setJourneyPanelOpen(false);
    setFrogActionsOpen(false);
    setFan(null);
    setListOpen(false);
    setWishFocus(null);
    followingRef.current=false;setFollowing(false);setSelecting(true);setWaypointsOpen(true);setEntrusting(false);setWaypointDraft(null);
  }, []);

  // Rebuild the next delivery from durable postcards, including after reload.
  useEffect(() => {
    if (snapshot.status !== 'ready') return;
    const pending = snapshot.wishes.filter((wish) => wish.origin === 'user' && wish.delivery !== 'journey' && wish.status === 'pending');
    if (pending.length === 0) return;
    const deadline = Math.min(...pending.map((wish) => wish.createdAt + POSTCARD_DELIVERY_MS));
    const timer = window.setTimeout(() => {
      void guard(async () => {
        await service.deliverDuePostcards();
        setNow(Date.now());
        setFrogMode('rest');
        setBubbleText(null);
        notify('青蛙带回了一张明信片');
      });
    }, Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [snapshot.status, snapshot.wishes, service, guard, notify]);

  const entrustTo = useCallback(
    (destination: DestinationCandidate) => {
      if (entrustBusy.current) return;
      entrustBusy.current = true;
      setEntrustSelection(destination.key);
      void guard(async () => {
        const wishId = await service.directFrogTravel({
          name: destination.name,
          country: destination.country,
          countryCode: destination.countryCode,
          lat: destination.lat,
          lng: destination.lng,
        });
        setEntrusting(false);
        setFrogMode('postcard');
        setBubbleText(null);
        setJourneyPanelOpen(true);
        notify(`方向已留好 · ${destination.name} · 蛙蛙会按旅行日程寄信`,5000);
        setHighlightWish(wishId);
      }).finally(() => {
        entrustBusy.current = false;
        setEntrustSelection(null);
      });
    },
    [guard, notify, service],
  );

  const startReplay = useCallback(
    (tripId: string) => {
      const trip = model.tripById.get(tripId) ?? activeTrip;
      if (!trip || trip.visits.length < 2) {
        notify('这趟还没找到位置，去定位工作台补一张？');
        setDrawerOpen(false);
        setLocationInbox({ candidateId: null });
        return;
      }
      const points = trip.visits.map((visit) => projectWorld(visit.lat, visit.lng));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);
      const ratio = metrics.sheetW > 0 ? metrics.sheetH / metrics.sheetW : 0.64;
      const zoom = clamp(Math.min((1000 * 0.66) / Math.max(spanX, 60), (1000 * ratio * 0.62) / Math.max(spanY, 30)), 1, 8);
      if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
      cameraFrame.current = null;
      setMode('world');
      setLevel('country');
      setCamera({
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
        zoom,
      });
      setReplay({ tripId: trip.id, index: 0, playing: true });
      setMemoryTripId(null);
    },
    [activeTrip, metrics, model, notify],
  );

  useEffect(() => {
    if (!replay || !replay.playing) return;
    const total = model.tripById.get(replay.tripId)?.visits.length ?? 0;
    if (total === 0) return;
    const timer = window.setTimeout(() => {
      setReplay((current) => {
        if (!current) return current;
        if (current.index >= total - 1) return { ...current, playing: false };
        return { ...current, index: current.index + 1 };
      });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [replay, model]);

  const endReplay = useCallback(() => setReplay(null), []);

  const onFrogAction = useCallback(
    (action: FrogAction) => {
      setFrogActionsOpen(false);
      if (action === 'replay') {
        if (activeTrip) startReplay(activeTrip.id);
        else { setJourneyPanelOpen(true); notify('还没有真实照片旅程；这里可以查看蛙蛙自己的行程'); }
        return;
      }
      if (action === 'entrust') {
        startEntrust();
        return;
      }
      if (!hints) {
        notify('青蛙提示已在设置里关闭');
        return;
      }
      setFrogMode('packing');
      setBubbleText(model.noGpsCount > 0 ? `有 ${model.noGpsCount} 张照片还没找到家` : '行李已经收好了');
    },
    [activeTrip, hints, model.noGpsCount, notify, startEntrust, startReplay],
  );

  const changeTheme = useCallback(
    (next: ThemeChoice) => {
      setTheme(next);
      void guard(() => service.saveSettings({ theme: next }));
    },
    [guard, service],
  );

  const toggleTheme = useCallback(() => {
    changeTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [changeTheme, resolvedTheme]);

  const changeHints = useCallback(
    (enabled: boolean) => {
      setHints(enabled);
      if (!enabled) setBubbleText(null);
      void guard(() => service.saveSettings({ frogHints: enabled }));
    },
    [guard, service],
  );

  const exportArchive = useCallback(() => {
    void guard(async () => {
      const data = await service.exportArchive(true);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `travel-frog-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    }, '档案已导出');
  }, [guard, service]);

  const loadDemo = useCallback(() => {
    void guard(async () => {
      await service.loadDemo();
      setSettingsOpen(false);
      notify('示例档案已加载，带示例标记');
    });
  }, [guard, notify, service]);

  const removeDemo = useCallback(() => {
    void guard(() => service.removeDemo(), '示例档案已移除');
  }, [guard, service]);

  const clearAll = useCallback(() => {
    void guard(async () => {
      await service.deleteAll();
      setSettingsOpen(false);
      setDrawerOpen(false);
      setMemoryTripId(null);
      setWishFocus(null);
      setReplay(null);
      notify('已清空本机档案，原图未受影响');
    });
  }, [guard, notify, service]);

  const closeOverlays = useCallback(() => {
    setSettingsOpen(false);
    setSearchOpen(false);
    setMemoryTripId(null);
  }, []);

  const scheduleViewSave = useCallback(() => {
    if (snapshot.status !== 'ready' || scene !== 'wall') return;
    if (viewSaveTimer.current !== null) window.clearTimeout(viewSaveTimer.current);
    viewSaveTimer.current = window.setTimeout(() => {
      viewSaveTimer.current = null;
      const view: MapViewState = {
        cityKey,
        activeTripId,
        camera: cameraRef.current,
        mode,
        level,
        poiScrollTop: poiScrollRef.current?.scrollTop ?? 0,
        savedAt: Date.now(),
      };
      void service.saveMapView(view).catch(() => undefined);
    }, 500);
  }, [scene, mode, level, cityKey, activeTripId, service, snapshot.status]);

  useEffect(() => {
    if (!restoredView.current || snapshot.status !== 'ready') return;
    scheduleViewSave();
  }, [camera, mode, level, scheduleViewSave, snapshot.status]);

  useEffect(
    () => () => {
      if (viewSaveTimer.current !== null) window.clearTimeout(viewSaveTimer.current);
    },
    [],
  );

  // ---------------------------------------------------------------- home

  const openHome = useCallback(() => {
    followingRef.current=false;setFollowing(false);setWaypointsOpen(false);setSelecting(false);
    const view: MapViewState = {
      cityKey,
      activeTripId,
      camera,
      mode,
      level,
      poiScrollTop: poiScrollRef.current?.scrollTop ?? 0,
      savedAt: Date.now(),
    };
    savedView.current = view;
    void service.saveMapView(view).catch(() => undefined);
    setWishFocus(null);
    setSpecialtyFocus(null);
    setFan(null);
    setFrogActionsOpen(false);
    setEntrusting(false);
    setMemoryTripId(null);
    setScene('home');
  }, [camera, mode, level, cityKey, activeTripId, service]);

  const returnToMap = useCallback(() => {
    setScene('wall');
    setSpecialtyFocus(null);
    const view = savedView.current ?? snapshot.mapView;
    if (!view) return;
    if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = null;
    setMode(view.mode);
    setLevel(view.level);
    setCityKey(view.cityKey ?? '');
    setActiveTripId(view.activeTripId ?? '');
    setCamera(view.camera);
    pendingScroll.current = view.poiScrollTop;
  }, [snapshot.mapView]);

  const moveFrogTo = useCallback(
    (perch: FrogPerch) => {
      void guard(() => service.setFrogPerch(perch));
    },
    [guard, service],
  );

  const moveHomeCity = useCallback(
    (cityName: string) => guard(() => service.moveHome(cityName)),
    [guard, service],
  );

  const focusWishPhotos = useMemo<WishBackPhoto[]>(() => {
    if (!wishFocus) return [];
    const wish = model.wishById.get(wishFocus.wishId);
    if (!wish) return [];
    return postcardFootprints(model,wish.cityKey)
      .map((photo) => ({ id: photo.id, at: photo.capturedAt }));
  }, [wishFocus, model]);

  const specialtyProvenance = useMemo<SpecialtyProvenance | null>(() => {
    if (!specialtyFocus) return null;
    const trip = model.tripById.get(specialtyFocus.tripId);
    const photos = specialtyFocus.photoIds
      .map((id) => model.photoById.get(id))
      .filter((photo): photo is WallPhoto => photo !== undefined)
      .slice(0, 4)
      .map((photo) => ({ id: photo.id, image: imageFor(photo), day: formattedDay(photo.capturedAt) }));
    return {
      award: specialtyFocus,
      cityName: model.cityByKey.get(specialtyFocus.cityKey)?.name ?? specialtyFocus.cityKey,
      tripTitle: trip?.title ?? '一趟旅行',
      photos,
    };
  }, [specialtyFocus, model, imageFor]);

  // ---------------------------------------------------------------- keyboard

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if(photoPick){if(event.key==='Escape'){event.preventDefault();cancelPhotoPick();}return;}
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSelecting(false);setSearchOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        if(selecting){setSelecting(false);setWaypointDraft(null);setWaypointsOpen(true);return;}
        if (wishFocus) setWishFocus(null);
        else if (specialtyFocus) setSpecialtyFocus(null);
        else if (scene === 'home') returnToMap();
        else if (entrusting) setEntrusting(false);
        else if (settingsOpen || searchOpen) closeOverlays();
        else if (waypointsOpen && waypointDraft) setWaypointDraft(null);
        else if (waypointsOpen) setWaypointsOpen(false);
        else if (memoryTripId) setMemoryTripId(null);
        else if (drawerOpen) setDrawerOpen(false);
        else if (replay) setReplay(null);
        else if (level === 'city') focusCountry();
        return;
      }
      if (!replay) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const total = model.tripById.get(replay.tripId)?.visits.length ?? 0;
        setReplay({ ...replay, index: Math.min(total - 1, replay.index + 1), playing: false });
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setReplay({ ...replay, index: Math.max(0, replay.index - 1), playing: false });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    photoPick,cancelPhotoPick,
    wishFocus,
    specialtyFocus,
    scene,
    returnToMap,
    entrusting,
    settingsOpen,
    searchOpen,
    selecting,waypointsOpen,waypointDraft,
    memoryTripId,
    drawerOpen,
    replay,
    level,
    closeOverlays,
    focusCountry,
    model,
  ]);

  // ---------------------------------------------------------------- render

  const memoryTrip = memoryTripId ? model.tripById.get(memoryTripId) : undefined;
  const memoryPhotos = memoryTrip ? model.photos.filter((photo) => photo.tripId === memoryTrip.id) : [];
  const focusWishValue = wishFocus ? model.wishById.get(wishFocus.wishId) : undefined;
  const replayTrip = replay ? model.tripById.get(replay.tripId) : undefined;
  const replayStop = replay ? replayPoints[replay.index] : undefined;

  const countryName =
    model.cityByKey.get(effectiveCityKey)?.countryName ?? activeTrip?.visits[0]?.countryName ?? '世界';
  const cityName =
    level === 'region'
      ? '关西'
      : model.cityByKey.get(effectiveCityKey)?.name ?? activeTrip?.visits[0]?.name ?? '京都';

  const basemapControls=<BasemapControls live={liveBasemap} message={liveBasemap?basemapMessage:basemapMessage.includes('失败')?basemapMessage:'离线示意图 · 无真实街道'} onToggle={()=>{setBasemapMessage('正在加载真实底图…');setLiveBasemap(current=>!current);}}/>;
  const photosById = useMemo(() => new Map(snapshot.photos.map((photo) => [photo.id, photo] as const)), [snapshot.photos]);
  const unlocatedPhotos = snapshot.photos.filter((photo) => !photo.ignored && photo.geo === null);
  const locatedCount = snapshot.photos.filter((photo) => !photo.ignored && photo.geo !== null).length;
  const inboxCandidate = locationInbox?.candidateId
    ? snapshot.candidates.find((candidate) => candidate.id === locationInbox.candidateId) ?? null
    : null;
  const inboxPhotos = locationInbox
    ? unlocatedPhotos.filter((photo) => !inboxCandidate || inboxCandidate.photoIds.includes(photo.id))
    : [];
  const inboxCandidateTitle = inboxCandidate
    ? inboxCandidate.cityRefs.map((city) => city.name).slice(0, 2).join(' · ') || '未识别地点'
    : undefined;

  return (
    <>
      {photoDrop.active || photoDrop.reading ? (
        <div
          className={`photo-drop-overlay${photoDrop.reading ? " is-reading" : ""}`}
          role="status"
          aria-live="polite"
        >
          <strong>
            {photoDrop.reading ? "正在读取照片…" : "松开即可导入照片"}
          </strong>
          <span>支持 JPG、PNG、WebP、HEIC，可拖入整个文件夹</span>
        </div>
      ) : null}
      {scene === 'home' ? (
        <HomeRoom
          away={frogAway}
          onTravel={() => setJourneyPanelOpen(true)}
          home={snapshot.home}
          furniture={homeFurniture}
          luggage={homeLuggage}
          postcards={homePostcards}
          onPerch={moveFrogTo}
          onMap={returnToMap}
          onSpecialty={setSpecialtyFocus}
          onPostcard={(wishId) => {
            const wish = model.wishById.get(wishId);
            if (wish) openWishFocus(wish);
          }}
          onMoveHome={moveHomeCity}
        />
      ) : (
      <MapBoard
        liveBasemap={liveBasemap}
        onBasemapFailure={()=>{setBasemapMessage('真实底图加载失败，已切换离线示意图。');setLiveBasemap(false);}}
        onBasemapReady={()=>setBasemapMessage('真实底图 · 地名采用服务提供的语言')}
        boardRef={boardRef}
        sheetRef={sheetRef}
        camera={camera}
        metrics={metrics}
        onCamera={gestureCamera}
        selecting={selecting||!!photoPick}
        photoPicking={!!photoPick}
        onMapPick={pickMapPoint}
        realPois={realPlaces.pois}
        onPoiPick={poi=>{if(photoPick){if(!photoSaving.current)setPhotoPick(current=>current?{...current,draft:{name:poi.name,country:landAt(poi)?.name??'未命名地区',lat:poi.lat,lng:poi.lng,source:'poi'}}:current);revealPhotoPin(poi);return;}if(selecting){openDestinationDraft({name:poi.name,country:landAt(poi)?.name??'未命名地区',lat:poi.lat,lng:poi.lng,source:'poi'});return;}realPlaces.setSelected(poi);setSearchTab('real');setSearchOpen(true);}}

        waypointPins={(photoPick?[]:travel.waypoints??[]).map(point=>{const p=toScreen(projectAt(mode,point.lat,point.lng),camera,metrics);return {...point,x:p.x,y:p.y};}).filter(p=>inBoard(p.x,p.y,metrics,24))}
        draftPin={photoPick?.draft?toScreen(projectAt(mode,photoPick.draft.lat,photoPick.draft.lng),camera,metrics):waypointDraft?toScreen(projectAt(mode,waypointDraft.lat,waypointDraft.lng),camera,metrics):null}
        onWaypointClick={id=>{const point=travel.waypoints?.find(p=>p.id===id);if(point){setListOpen(false);setWaypointDraft({...point});setWaypointsOpen(true);}}}
        viewBox={viewBox}
        viewWidth={metrics.boardW}
        viewHeight={metrics.boardH}
        mode={mode}
        level={level}
        visitedCountries={visitedCountries}
        routes={routes.concat(mode==='world'&&frogAway&&travel.current?.route?travel.current.route.slice(1).flatMap((point,index)=>{
          const previous=travel.current!.route![index]!;const a=toScreen(projectWorld(previous.lat,previous.lng),camera,metrics),b=toScreen(projectWorld(point.lat,point.lng),camera,metrics);
          if(Math.abs(projectWorld(previous.lat,previous.lng).x-projectWorld(point.lat,point.lng).x)>500)return [];
          return [{d:pathD([a,b]),className:`route-line frog-${point.kind}`}];
        }):[])}
        piles={piles}
        cityPhotos={cityPhotos}
        labels={labels}
        postcards={postcards}
        wishLinks={wishPlacement.links}
        frog={frogPos ? { x: frogPos.x, y: frogPos.y, mode: replay ? 'rest' : travelPhase==='packing'?'packing':travelPhase==='visiting'?'postcard':frogMode, charmCount } : null}
        frogActions={frogActions}
        bubble={bubble}
        destTags={destinations}
        destHint={entrusting}
        highlightCity={highlightCity}
        highlightWish={highlightWish}
        fan={fan}
        house={house}
        now={now}
        photoImage={imageFor}
        photoById={model.photoById}
        onPileClick={toggleFan}
        onPileOpen={openPileTrip}
        onPhotoOpen={(photo) => openMemory(photo.tripId)}
        onLabelClick={focusCityFromList}
        onWishClick={handleWishClick}
        onFrogClick={() => {
          setFrogActionsOpen((open) => !open);
        }}
        onFrogAction={onFrogAction}
        onBubbleDismiss={() => setBubbleText(null)}
        onDestTag={entrustTo}
        onHouseClick={openHome}
        onBackgroundClick={() => {
          setFan(null);
          setFrogActionsOpen(false);
        }}
      />
      )}

      {scene==='wall'&&snapshot.status==='ready'&&!photoPick&&<aside className="map-left-rail" aria-label="地图侧栏" data-map-controls>
          {basemapControls}
          {!photoPick&&<PoiList
            groups={groups}
            total={totalPoi}
            open={listOpen}
            linked={linked}
            highlightCity={highlightCity}
            highlightWish={highlightWish}
            homeCityName={snapshot.home.city.name}
            scrollRef={poiScrollRef}
            imageForPhoto={(photoId) => {
              const photo = model.photoById.get(photoId);
              return photo ? imageFor(photo) : null;
            }}
            onToggle={() => {setListOpen(!listOpen);if(!listOpen){setWaypointsOpen(false);setSelecting(false);}}}
            onCity={focusCityFromList}
            onWish={focusWishRow}
            onHome={openHome}
            onScroll={scheduleViewSave}
          />}
        <aside className={`roaming-tools${waypointsOpen?' destinations-open':''}`} data-map-controls aria-label="蛙蛙状态与动作">
          <button className="roaming-title" type="button" aria-label="蛙蛙的旅行" onClick={()=>setJourneyPanelOpen(true)}>{travel.current?.destination.name??snapshot.home.city.name} · {{resting:'在家休息',packing:'收拾行李',outbound:'去程中',visiting:'在目的地停留',returning:'回家路上'}[travelPhase]}</button>
          {frogLocation&&<output aria-label="蛙蛙模拟位置" aria-live="off" data-frog-lat={frogLocation.lat} data-frog-lng={frogLocation.lng} data-motion-kind={movement}>蛙蛙 · {travel.motionPausedAt!==undefined?'已暂停':movement==='walk'?'落脚点附近漫游':movement==='transit'?'交通转场（可能过海）':'在家'}</output>}
        <WaypointPanel state={travel} open={waypointsOpen} selecting={selecting} draft={waypointDraft} onOpen={value=>{setWaypointsOpen(value);if(value)setListOpen(false);else{setWaypointDraft(null);setSelecting(false);}}} onSelecting={value=>{if(value)startDestinationPick();else setSelecting(false);}} onDraft={setWaypointDraft}
          onSave={async(point,next)=>{const id=await service.saveTravelWaypoint(point);if(next)await service.setFrogNextWaypoint(id);}}
          onNext={id=>service.setFrogNextWaypoint(id)} onLocate={locateWaypoint} onRemove={id=>service.removeTravelWaypoint(id)}/>
          <div className="roaming-actions"><button type="button" aria-pressed={following} onClick={beginFollowing}>{following?'停止镜头跟随':'镜头跟随'}</button><button type="button" onClick={()=>void guard(()=>service.pauseFrogMotion(travel.motionPausedAt===undefined))}>{travel.motionPausedAt!==undefined?'继续漫游':'暂停漫游'}</button>{!frogAway&&travel.current?<button type="button" onClick={()=>void guard(()=>service.startFrogJourneyNow())}>现在出发</button>:frogAway?<button type="button" onClick={()=>void guard(()=>service.returnFrogHome())}>让蛙蛙回家</button>:null}</div>
          <small className="camera-follow-status">{following?'镜头跟随中 · 拖地图即退出':'自由查看 · 镜头跟随不改变蛙蛙行程'}</small>
        </aside>
      </aside>}
      {selecting&&!photoPick&&scene==='wall'&&<section className="destination-pickbar" aria-label="添加蛙蛙目的地"><strong>添加目的地</strong><p>轻点地图放图钉；可拖动、缩放。确认保存前不会添加。</p><button type="button" onClick={cancelDestinationPick}>取消选点</button></section>}
      {import.meta.env.DEV&&photoPick&&detailedPhotoMap&&<Suspense fallback={<p className="photo-map-loading" role="status">正在准备街道地图…</p>}><DetailedPhotoMap
        initialView={{...(photoPick.reference??mapCoordinate(metrics.offX+metrics.sheetW/2,metrics.offY+metrics.sheetH/2,photoPick.view.camera,metrics,photoPick.view.mode)??{lat:0,lng:0}),zoom:photoPick.reference?14:photoPick.view.mode==='world'?Math.log2(Math.max(1,metrics.sheetW)*photoPick.view.camera.zoom/512):14}}
        reference={photoPick.reference} selected={photoPick.draft} onPick={pickMapPoint} onExit={()=>setDetailedPhotoMap(false)}/></Suspense>}
      {photoPick?<PhotoLocationPicker mapControls={basemapControls} photos={snapshot.photos.filter(p=>photoPick.ids.includes(p.id))} draft={photoPick.draft} onSave={savePhotoPick} onCancel={cancelPhotoPick} onRepick={()=>{if(!photoSaving.current)setPhotoPick(current=>current?{...current,draft:null}:current);}} load={loadThumbnail} detailedMap={detailedPhotoMap} {...(import.meta.env.DEV?{onDetailedMap:()=>setDetailedPhotoMap(true)}:{})} referenceLabel={photoPick.reference?.label??null}
        searchCities={(query)=>service.searchCities(query)}
        onPickCity={(city)=>{
          const point=city.centroid;
          if(!point)return;
          setPhotoPick(current=>current?{...current,suggestion:null,reference:{lat:point.lat,lng:point.lng,label:city.name,kind:'search'},draft:null}:current);
          focusPhotoCamera(point,PHOTO_LOCATION_ZOOM);
        }}
        suggestion={photoPick.suggestion}
        onUseSuggestion={()=>{
          const suggestion=photoPick.suggestion;
          if(!suggestion)return;
          setPhotoPick(current=>current?{...current,reference:{lat:suggestion.geo.lat,lng:suggestion.geo.lng,label:suggestion.cityRef.name,kind:'suggestion'},draft:{name:`${suggestion.cityRef.name}附近`,country:suggestion.cityRef.countryName,lat:suggestion.geo.lat,lng:suggestion.geo.lng,source:'map'}}:current);
          focusPhotoCamera(suggestion.geo,PHOTO_LOCATION_ZOOM);
        }}
      />:<TopBar
        onHome={openHome}
        missingCount={missingPhotoCount}
        onImport={() => {
          setDrawerTab('import');
          setDrawerOpen(true);
        }}
        onDrawer={() => {
          setDrawerTab(missingPhotoCount>0?'fill':'candidates');
          setDrawerOpen(true);
        }}
        onSearch={() => {setSelecting(false);setSearchOpen(true);}}
        onTheme={toggleTheme}
        onSettings={() => setSettingsOpen(true)}
      />}

      {snapshot.status === 'ready' && !photoPick && <FrogJourneyPanel
        showChip={scene!=='wall'} state={travel} home={snapshot.home.city} now={journeyNow}
        open={journeyPanelOpen} onOpen={setJourneyPanelOpen}
        onConfigure={input=>service.configureFrogTravel(input)}
        onHome={openHome} onEntrust={startEntrust}
        onLetter={id=>{ const wish=model.wishById.get(id); if(wish) openWishFocus(wish); else notify('这张信已收起，可以在档案中保留它的记录'); }}
        error={journeyError} onRetry={reconcile}
        onCancelDirection={()=>service.cancelFrogDirection()}
      />}

      {entrusting && scene === 'wall' ? (
        <EntrustChooser
          destinations={entrustOptions}
          busy={entrustSelection}
          onSelect={entrustTo}
          onClose={() => setEntrusting(false)}
        />
      ) : null}

      {(!empty||!!travel.waypoints?.length||selecting||waypointsOpen||!!photoPick) && scene === 'wall' ? (
        <>
          {!photoPick ? (
            <Crumb
              level={level}
              countryName={following?'世界':countryName}
              cityName={following?'漫游中':cityName}
              onWorld={() => animateCamera(WORLD_CAMERA, 'world', 'world')}
              onCountry={focusCountry}
              onCity={() => zoomToCity(effectiveCityKey)}
            />
          ) : null}
          <ZoomControls
            level={level}
            onZoomIn={() => zoomBy(1.9)}
            onZoomOut={() => zoomBy(1 / 1.9)}
          />
        </>
      ) : null}

      {empty && !photoPick && scene === 'wall' && !entrusting && !waypointsOpen && !selecting && !travel.waypoints?.length && !frogAway ? (
        <EmptyCard
          onFrog={() => setJourneyPanelOpen(true)}
          onImport={() => {
            setDrawerTab('import');
            setDrawerOpen(true);
          }}
          onDemo={loadDemo}
        />
      ) : null}

      {replay && replayTrip && replayStop ? (
        <ReplayBar
          replay={{
            tripId: replay.tripId,
            cityName: replayStop.name,
            index: replay.index,
            total: replayTrip.visits.length,
            playing: replay.playing,
          }}
          onPrev={() => setReplay({ ...replay, index: Math.max(0, replay.index - 1), playing: false })}
          onPlay={() => setReplay({ ...replay, playing: !replay.playing })}
          onNext={() =>
            setReplay({ ...replay, index: Math.min(replayTrip.visits.length - 1, replay.index + 1), playing: false })
          }
          onClose={endReplay}
        />
      ) : null}

      <Drawer
        open={drawerOpen}
        tab={drawerTab}
        onTab={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        candidates={snapshot.candidates}
        batches={snapshot.batches}
        issues={snapshot.issues}
        suggestions={suggestions}
        photosById={photosById}
        selection={importSelection}
        onSelectionChange={setImportSelection}
        onImportingChange={setImporting}
        onImportFiles={(files, onProgress, signal) => service.importFiles(Array.from(files), onProgress, signal)}
        onThumbnail={loadThumbnail}
        onRetryPhoto={(id,file)=>service.retryPhotoPreview(id,file)}
        onPhotoTime={async(id,at)=>{await service.setPhotoCaptureTime(id,at);if(at!==null)setDrawerTab('candidates');}}
        onSetPhotoLocations={(ids,input)=>service.setPhotoLocations(ids,input)}
        onPickPhotoLocation={startPhotoPick}
        onOpenLocationInbox={(candidateId) => {
          setDrawerOpen(false);
          setLocationInbox({ candidateId });
        }}
        onConfirmCandidate={async id => {
          await guard(async()=>{
            const tripId=await service.confirmCandidate(id);
            const fresh=buildWallModel(service.getSnapshot(),snapshot.home.city.key);
            const focus=fresh.photos.find(p=>p.tripId===tripId&&pendingPhotoFocus.current.includes(p.id));
            const city=(focus?fresh.cityByKey.get(focus.cityKey):null)??fresh.cities.find(c=>c.tripIds.includes(tripId));
            if(focus)pendingPhotoFocus.current=[];
            setActiveTripId(tripId);setDrawerOpen(false);
            if(city){setCityKey(city.key);animateCamera(cityCamera(fresh.photos.filter(p=>p.cityKey===city.key),city,metrics.sheetW>0?metrics.sheetH/metrics.sheetW:.64),'world','city');notify('已确认，正在地图查看这组照片');}
            else notify('已存入档案；缺位置的照片补好后才能上地图');
          });
        }}
        onIgnoreCandidate={async (id) => {
          await guard(() => service.ignoreCandidate(id), '已忽略，可稍后恢复');
        }}
        onMergeCandidates={async (first, second) => {
          await guard(() => service.mergeCandidates(first, second), '已合并为 1 个候选');
        }}
        onSplitCandidate={async (id, at) => {
          await guard(() => service.splitCandidate(id, at), '已拆分为 2 个候选');
        }}
        onApplySuggestions={async (ids) => {
          const applied=await service.applyLocationSuggestions(ids);
          const archive=service.getSnapshot(),photos=archive.photos.filter(p=>ids.includes(p.id));
          if(applied&&photos.some(p=>p.tripId===null)){setDrawerTab('candidates');notify(`已应用 ${applied} 张照片的位置建议，请继续确认照片`);}
          else if(applied){const fresh=buildWallModel(archive,archive.home.city.key),located=fresh.photos.find(p=>ids.includes(p.id)),city=located?fresh.cityByKey.get(located.cityKey):null;if(city&&located){setDrawerOpen(false);setScene('wall');setActiveTripId(located.tripId);setCityKey(city.key);animateCamera(cityCamera(fresh.photos.filter(p=>p.cityKey===city.key),city,metrics.sheetW>0?metrics.sheetH/metrics.sheetW:.64),'world','city');}notify(`已应用 ${applied} 张照片的位置建议，正在地图查看`);}
          else throw new Error('这些照片已没有可用建议，请更新列表后再试');
        }}
      />

      {locationInbox ? (
        <PhotoLocationInbox
          photos={inboxPhotos}
          locatedCount={locatedCount}
          withoutLocation={unlocatedPhotos.length}
          suggestions={suggestions}
          candidates={snapshot.candidates}
          trips={snapshot.trips}
          filterCandidateId={locationInbox.candidateId}
          filterCandidateTitle={inboxCandidateTitle}
          load={loadThumbnail}
          onTag={(ids) =>
            startPhotoPick(ids, {
              returnTo: { kind: 'inbox', candidateId: locationInbox.candidateId },
            })
          }
          onApplySuggestions={async (ids) => {
            await service.applyLocationSuggestions(ids);
          }}
          onClearFilter={() => setLocationInbox({ candidateId: null })}
          onGoCandidates={() => {
            setLocationInbox(null);
            setDrawerTab('candidates');
            setDrawerOpen(true);
          }}
          onRepair={() => {
            setLocationInbox(null);
            setDrawerTab('progress');
            setDrawerOpen(true);
          }}
          onClose={() => setLocationInbox(null)}
        />
      ) : null}

      {memoryTrip ? (
        <>
          <div className="scrim" onClick={() => setMemoryTripId(null)} />
          <MemoryOverlay
            trip={memoryTrip}
            photos={memoryPhotos}
            photoImage={imageFor}
            onClose={() => setMemoryTripId(null)}
            onReplay={() => startReplay(memoryTrip.id)}
            onSaveMemory={(text) => guard(() => service.saveMemory(memoryTrip.id, text), '记忆已保存')}
            onRenameTrip={(title) => guard(() => service.updateTrip(memoryTrip.id, { title }), '旅行已重命名')}
            onEditPhotoLocation={(photoId) => {
              const photo = snapshot.photos.find((item) => item.id === photoId);
              if (!photo?.tripId) return;
              setMemoryTripId(null);
              startPhotoPick([photoId], {
                returnTo: { kind: 'memory', tripId: photo.tripId },
              });
            }}
            onDeleteTrip={() => {
              void guard(async () => {
                await service.deleteTrip(memoryTrip.id);
                setMemoryTripId(null);
                notify('已删除这趟旅行');
              });
            }}
          />
        </>
      ) : null}

      {focusWishValue && wishFocus ? (
        <WishFocus
          wish={focusWishValue}
          left={wishFocus.left}
          top={wishFocus.top}
          photos={focusWishPhotos}
          photoImage={(photoId) => {
            return photoUrls.get(photoId) ?? null;
          }}
          onChoose={(keep) => chooseWish(focusWishValue.id, keep)}
          busy={choosingWish}
          onClose={() => setWishFocus(null)}
        />
      ) : null}

      {specialtyProvenance ? (
        <SpecialtyFocus provenance={specialtyProvenance} onClose={() => setSpecialtyFocus(null)} />
      ) : null}

      <SettingsPanel
        open={settingsOpen}
        theme={theme}
        hints={hints}
        tripCount={model.trips.length}
        photoCount={snapshot.photos.length}
        wishCount={snapshot.wishes.length}
        lastWrite={snapshot.loadedAt > 0 ? new Date(snapshot.loadedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
        onClose={() => setSettingsOpen(false)}
        onTheme={changeTheme}
        onHints={changeHints}
        onExport={exportArchive}
        onDemo={loadDemo}
        onRemoveDemo={removeDemo}
        onClearAll={clearAll}
      />

      <SearchPanel
        open={searchOpen}
        items={searchItems}
        tab={searchTab} onTab={setSearchTab}
        realPlaces={<RealPlaces places={realPlaces} area={realPoiArea} onSave={poi=>openDestinationDraft({name:poi.name,country:landAt(poi)?.name??'未命名地区',lat:poi.lat,lng:poi.lng,source:'poi'})}/>}
        onDestination={openDestinationDraft}
        onLocate={point=>{setSearchOpen(false);locateWaypoint(point);}}
        onClose={() => setSearchOpen(false)}
        onPick={(item) => {
          setSearchOpen(false);
          if (item.kind === 'trip') {
            openMemory(item.id.slice('trip:'.length));
          } else if (item.kind === 'city') {
            focusCityFromList(item.id.slice('city:'.length));
          } else {
            const wish = model.wishById.get(item.id.slice('wish:'.length));
            if (wish) focusWish(wish);
          }
        }}
      />

      <Toast message={toastMessage} />
    </>
  );
}
