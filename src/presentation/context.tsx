import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { TravelFrogService } from '../application/travel-frog-service';
import type { ArchiveSnapshot } from '../application/snapshot';

const ServiceContext = createContext<TravelFrogService | null>(null);

export const ServiceProvider = ServiceContext.Provider;

export function useService(): TravelFrogService {
  const service = useContext(ServiceContext);
  if (!service) throw new Error('TravelFrogService is missing');
  return service;
}

export function useArchive(): ArchiveSnapshot {
  const service = useService();
  const subscribe = useCallback((onChange: () => void) => service.subscribe(onChange), [service]);
  const getSnapshot = useCallback(() => service.getSnapshot(), [service]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
