import { UP_DISTRICTS, UP_ONLY_STATE } from './upDistricts';

/**
 * UP-only location model for KisanMitra.
 */
export const INDIA_LOCATIONS: { [state: string]: string[] } = {
  [UP_ONLY_STATE]: [...UP_DISTRICTS],
};

export const STATE_LIST = [UP_ONLY_STATE];

export const getDistricts = (state: string): string[] => {
  if (state !== UP_ONLY_STATE) return [];
  return [...UP_DISTRICTS];
};

/** Fixed coordinates for Varanasi fallback used by weather lookups */
export const STATE_CAPITAL_COORDS: Record<string, { lat: number; lon: number }> = {
  [UP_ONLY_STATE]: {
    lat: 25.3176,
    lon: 82.9739,
  },
};
