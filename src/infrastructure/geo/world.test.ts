import { describe, expect, it } from 'vitest';
import { CITY_TABLE } from './city-table';
import { WORLD_COUNTRIES } from './world';

describe('offline world atlas', () => {
  it('gives every country outline a unique id', () => {
    const ids = WORLD_COUNTRIES.map((country) => country.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses three-letter uppercase ids only', () => {
    for (const country of WORLD_COUNTRIES) {
      expect(country.id).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('resolves every gazetteer country code to an outline', () => {
    const ids = new Set(WORLD_COUNTRIES.map((country) => country.id));
    const missing = [...new Set(CITY_TABLE.map((city) => city.countryCode))].filter((code) => !ids.has(code));
    expect(missing).toEqual([]);
  });
});
