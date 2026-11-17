import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppData, Candidate, Photo, Settings, SplitConfig, Trip } from './types';
import { clearData, loadData, saveData } from './lib/db';
import { emptyData, demoData } from './lib/demo';
import { buildVisits, cityNamesOf } from './lib/visits';
import { candidatesFromPhotos, mergeCandidates, splitCandidate } from './lib/splitTrips';
import { seasonOf, startOfDay, uid } from './lib/format';

interface StoreValue {
  data: AppData;
  ready: boolean;
  toast: string;
  notify: (message: string) => void;
  addPhotos: (photos: Photo[]) => void;
  confirmCandidates: (ids?: string[]) => number;
  ignoreCandidate: (id: string) => void;
  restoreCandidate: (id: string) => void;
  mergeCandidatesInto: (id: string, targetId: string) => void;
  splitCandidateAt: (id: string, at: number) => boolean;
  saveMemory: (tripId: string, memory: string) => void;
  fillPhotos: (
    tripId: string,
    updates: { id: string; lat: number; lng: number; placeLabel: string }[],
    ignoredIds: string[],
  ) => void;
  shiftTime: (tripId: string, photoIds: string[], offsetHours: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setConfig: (patch: Partial<SplitConfig>) => void;
  wishAction: (id: string, action: 'next' | 'visited') => void;
  loadDemo: () => void;
  resetAll: () => void;
  exportJson: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function endOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(23, 59, 59, 0);
  return d.getTime();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    loadData().then((loaded) => {
      if (!mounted) return;
      setData(loaded ?? emptyData());
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!data || !ready) return;
    const timer = window.setTimeout(() => {
      void saveData(data);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [data, ready]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2800);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => (prev ? fn(prev) : prev));
  }, []);

  const addPhotos = useCallback((incoming: Photo[]) => {
    update((d) => {
      const photos = { ...d.photos };
      for (const p of incoming) photos[p.id] = p;
      const unassigned = Object.values(photos).filter((p) => !p.tripId && !p.ignored);
      const candidates = candidatesFromPhotos(unassigned, d.config);
      for (const p of Object.values(photos)) {
        if (!p.tripId) {
          const cid = candidates.find((c) => c.photoIds.includes(p.id))?.id;
          photos[p.id] = { ...p, candidateId: cid };
        }
      }
      return { ...d, photos, candidates };
    });
  }, [update]);

  const confirmCandidates = useCallback((ids?: string[]): number => {
    const targets = (data?.candidates ?? []).filter(
      (c) => c.status === 'pending' && (!ids || ids.includes(c.id)),
    );
    if (!targets.length) return 0;
    const targetIds = new Set(targets.map((c) => c.id));
    update((d) => {
      const photos = { ...d.photos };
      const trips = [...d.trips];
      const remaining: Candidate[] = [];
      for (const c of d.candidates) {
        if (!targetIds.has(c.id)) {
          remaining.push(c);
          continue;
        }
        const candPhotos = c.photoIds.map((id) => photos[id]).filter((p): p is Photo => Boolean(p));
        if (!candPhotos.length) continue;
        const tripId = uid('trip');
        const { visits, assignments } = buildVisits(tripId, candPhotos, d.config);
        const cities = cityNamesOf(candPhotos);
        const trip: Trip = {
          id: tripId,
          title: `${new Date(c.startAt).getFullYear()} ${cities.join(' · ')} ${seasonOf(c.startAt)}`,
          startAt: startOfDay(c.startAt),
          endAt: endOfDay(c.endAt),
          cityNames: cities,
          visits,
          memory: '',
          createdAt: Date.now(),
        };
        trips.push(trip);
        for (const p of candPhotos) {
          photos[p.id] = {
            ...p,
            tripId,
            visitId: assignments[p.id],
            candidateId: undefined,
          };
        }
      }
      return { ...d, photos, trips, candidates: remaining };
    });
    return targets.length;
  }, [data?.candidates, update]);

  const ignoreCandidate = useCallback((id: string) => {
    update((d) => {
      const candidate = d.candidates.find((c) => c.id === id);
      if (!candidate) return d;
      const photos = { ...d.photos };
      for (const pid of candidate.photoIds) {
        if (photos[pid]) photos[pid] = { ...photos[pid], ignored: true, candidateId: undefined };
      }
      return {
        ...d,
        photos,
        candidates: d.candidates.map((c) => (c.id === id ? { ...c, status: 'ignored' } : c)),
      };
    });
  }, [update]);

  const restoreCandidate = useCallback((id: string) => {
    update((d) => {
      const candidate = d.candidates.find((c) => c.id === id);
      if (!candidate) return d;
      const photos = { ...d.photos };
      for (const pid of candidate.photoIds) {
        if (photos[pid]) photos[pid] = { ...photos[pid], ignored: false, candidateId: id };
      }
      return {
        ...d,
        photos,
        candidates: d.candidates.map((c) => (c.id === id ? { ...c, status: 'pending' } : c)),
      };
    });
  }, [update]);

  const mergeCandidatesInto = useCallback((id: string, targetId: string) => {
    update((d) => {
      const a = d.candidates.find((c) => c.id === id);
      const b = d.candidates.find((c) => c.id === targetId);
      if (!a || !b) return d;
      const merged = mergeCandidates(a, b, d.photos);
      const photos = { ...d.photos };
      for (const pid of merged.photoIds) {
        if (photos[pid]) photos[pid] = { ...photos[pid], candidateId: merged.id, ignored: false };
      }
      const candidates = d.candidates.filter((c) => c.id !== id && c.id !== targetId);
      return { ...d, photos, candidates: [merged, ...candidates] };
    });
  }, [update]);

  const splitCandidateAt = useCallback((id: string, at: number): boolean => {
    const candidate = (data?.candidates ?? []).find((c) => c.id === id);
    if (!candidate) return false;
    const parts = splitCandidate(candidate, at, data?.photos ?? {});
    if (!parts) return false;
    update((d) => {
      const photos = { ...d.photos };
      for (const pid of parts[0].photoIds) {
        if (photos[pid]) photos[pid] = { ...photos[pid], candidateId: parts[0].id };
      }
      for (const pid of parts[1].photoIds) {
        if (photos[pid]) photos[pid] = { ...photos[pid], candidateId: parts[1].id };
      }
      const candidates = d.candidates
        .filter((c) => c.id !== id)
        .concat(parts);
      return { ...d, photos, candidates };
    });
    return true;
  }, [data?.candidates, data?.photos, update]);

  const saveMemory = useCallback((tripId: string, memory: string) => {
    update((d) => ({
      ...d,
      trips: d.trips.map((t) => (t.id === tripId ? { ...t, memory: memory.slice(0, 60) } : t)),
    }));
  }, [update]);

  const rebuildTrip = useCallback((d: AppData, tripId: string): AppData => {
    const tripPhotos = Object.values(d.photos)
      .filter((p) => p.tripId === tripId)
      .sort((a, b) => a.takenAt - b.takenAt);
    const { visits, assignments } = buildVisits(tripId, tripPhotos, d.config);
    const photos = { ...d.photos };
    for (const p of tripPhotos) {
      photos[p.id] = { ...p, visitId: assignments[p.id] };
    }
    const cities = cityNamesOf(tripPhotos);
    return {
      ...d,
      photos,
      trips: d.trips.map((t) =>
        t.id === tripId
          ? { ...t, visits, cityNames: cities.length ? cities : t.cityNames }
          : t,
      ),
    };
  }, []);

  const fillPhotos = useCallback((
    tripId: string,
    updates: { id: string; lat: number; lng: number; placeLabel: string }[],
    ignoredIds: string[],
  ) => {
    update((d) => {
      const photos = { ...d.photos };
      for (const u of updates) {
        const p = photos[u.id];
        if (!p) continue;
        photos[u.id] = {
          ...p,
          lat: u.lat,
          lng: u.lng,
          placeLabel: u.placeLabel,
          locationSource: 'candidate',
          ignored: false,
        };
      }
      for (const id of ignoredIds) {
        if (photos[id]) photos[id] = { ...photos[id], ignored: true };
      }
      return rebuildTrip({ ...d, photos }, tripId);
    });
  }, [update, rebuildTrip]);

  const shiftTime = useCallback((tripId: string, photoIds: string[], offsetHours: number) => {
    update((d) => {
      const photos = { ...d.photos };
      for (const id of photoIds) {
        const p = photos[id];
        if (!p || p.tripId !== tripId) continue;
        photos[id] = { ...p, takenAt: p.takenAt + offsetHours * 3_600_000 };
      }
      return rebuildTrip({ ...d, photos }, tripId);
    });
  }, [update, rebuildTrip]);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, [update]);

  const setConfig = useCallback((patch: Partial<SplitConfig>) => {
    update((d) => ({ ...d, config: { ...d.config, ...patch } }));
  }, [update]);

  const wishAction = useCallback((id: string, action: 'next' | 'visited') => {
    update((d) => {
      const wish = d.wishes.find((w) => w.id === id);
      if (!wish) return d;
      if (action === 'next') {
        return {
          ...d,
          wishes: d.wishes.map((w) => (w.id === id ? { ...w, status: 'next' } : w)),
        };
      }
      return {
        ...d,
        wishes: d.wishes.filter((w) => w.id !== id),
        manualVisited: [
          ...d.manualVisited,
          { id: uid('visited'), name: wish.name, country: wish.country, year: new Date().getFullYear() },
        ],
      };
    });
  }, [update]);

  const loadDemo = useCallback(() => {
    setData(demoData());
    notify('已加载示例档案：5 趟旅行、12 个城市');
  }, [notify]);

  const resetAll = useCallback(() => {
    setData(emptyData());
    void clearData();
    notify('已删除全部本地数据');
  }, [notify]);

  const exportJson = useCallback(() => {
    if (!data) return;
    const payload = {
      app: 'travel-frog',
      version: data.version,
      exportedAt: new Date().toISOString(),
      settings: data.settings,
      trips: data.trips,
      photos: Object.values(data.photos).map(({ thumb: _thumb, ...rest }) => rest),
      wishes: data.wishes,
      manualVisited: data.manualVisited,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-frog-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('已导出 JSON 索引（不含原图与缩略图）');
  }, [data, notify]);

  const value = useMemo<StoreValue | null>(() => {
    if (!data) return null;
    return {
      data,
      ready,
      toast,
      notify,
      addPhotos,
      confirmCandidates,
      ignoreCandidate,
      restoreCandidate,
      mergeCandidatesInto,
      splitCandidateAt,
      saveMemory,
      fillPhotos,
      shiftTime,
      setSettings,
      setConfig,
      wishAction,
      loadDemo,
      resetAll,
      exportJson,
    };
  }, [
    data, ready, toast, notify, addPhotos, confirmCandidates, ignoreCandidate, restoreCandidate,
    mergeCandidatesInto, splitCandidateAt, saveMemory, fillPhotos, shiftTime, setSettings, setConfig,
    wishAction, loadDemo, resetAll, exportJson,
  ]);

  if (!value) {
    return <div className="boot-screen">正在打开旅行档案…</div>;
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
