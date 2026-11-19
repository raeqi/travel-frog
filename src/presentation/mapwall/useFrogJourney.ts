import { useCallback, useEffect, useRef, useState } from 'react';
import type { TravelFrogService } from '../../application/travel-frog-service';
import {
  nextJourneyWake,
  type FrogTravelState,
} from '../../domain/frog/journey';

export function useFrogJourney(
  service: TravelFrogService,
  state: FrogTravelState | null,
  ready: boolean,
) {
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const reconcile = useCallback(async () => {
    if (running.current || !ready) return;
    running.current = true;
    try {
      await service.advanceFrogTravel();
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : '旅行进度暂时无法保存',
      );
    } finally {
      running.current = false;
      setNow(Date.now());
    }
  }, [service, ready]);
  useEffect(() => {
    if (!ready) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 100);
    const wake = () => {
      if (!document.hidden) void reconcile();
    };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [ready, reconcile]);
  useEffect(() => {
    if (!ready || !state) return;
    const deadline = nextJourneyWake(state, Date.now());
    if (deadline === null) return;
    const timer = window.setTimeout(
      () => void reconcile(),
      Math.max(30, deadline - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [ready, state, reconcile]);
  return { journeyNow: state?.motionPausedAt ?? now, journeyError: error, reconcile };
}
