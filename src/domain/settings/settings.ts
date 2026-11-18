export type ThemePreference = 'light' | 'dark' | 'system';
export type ReducedMotionPreference = 'system' | 'reduce';

export interface Settings {
  /** v2 has no upload path; the flag is recorded but nothing leaves the device. */
  readonly rawPhotoLocal: boolean;
  readonly cloudSync: boolean;
  readonly cityLevelOnly: boolean;
  readonly telemetryOptIn: boolean;
  readonly reducedMotion: ReducedMotionPreference;
  readonly theme: ThemePreference;
}

export const DEFAULT_SETTINGS: Settings = {
  rawPhotoLocal: true,
  cloudSync: false,
  cityLevelOnly: true,
  telemetryOptIn: false,
  reducedMotion: 'system',
  theme: 'system',
};

export function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  return {
    rawPhotoLocal: Boolean(merged.rawPhotoLocal),
    cloudSync: Boolean(merged.cloudSync),
    cityLevelOnly: Boolean(merged.cityLevelOnly),
    telemetryOptIn: false,
    reducedMotion: merged.reducedMotion === 'reduce' ? 'reduce' : 'system',
    theme: merged.theme === 'dark' || merged.theme === 'light' ? merged.theme : 'system',
  };
}
