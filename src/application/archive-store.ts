import { INITIAL_SNAPSHOT, type ArchiveSnapshot } from './snapshot';

/** Immutable snapshot + subscription, consumed by React through useSyncExternalStore. */
export class ArchiveStore {
  private snapshot: ArchiveSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): ArchiveSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set(next: ArchiveSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  patch(partial: Partial<ArchiveSnapshot>): void {
    this.set({ ...this.snapshot, ...partial });
  }
}
