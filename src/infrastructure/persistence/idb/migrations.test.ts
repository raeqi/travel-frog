import { describe, expect, it } from 'vitest';
import { migrateWishRow } from './migrations';

const NOW = Date.UTC(2026, 4, 1, 9, 0);

function legacyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'w1',
    status: 'wish',
    name: '金泽',
    countryCode: 'JPN',
    country: '日本',
    region: '北陆',
    note: '想去看看兼六园。',
    createdAt: NOW - 86_400_000,
    ...overrides,
  };
}

describe('migrateWishRow', () => {
  it('maps the legacy "wish" state to "opened"', () => {
    const wish = migrateWishRow(legacyRow(), NOW);
    expect(wish?.status).toBe('opened');
    expect(wish?.cityRef.key).toBe('JPN:金泽');
    expect(wish?.note).toBe('想去看看兼六园。');
  });

  it('maps the legacy "next" state to "opened", "visited" to "fulfilled", and "declined" to "received"', () => {
    expect(migrateWishRow(legacyRow({ status: 'next' }), NOW)?.status).toBe('opened');
    expect(migrateWishRow(legacyRow({ status: 'visited' }), NOW)?.status).toBe('fulfilled');
    expect(migrateWishRow(legacyRow({ status: 'declined' }), NOW)?.status).toBe('received');
  });

  it('keeps rows that already use the five-state model', () => {
    const wish = migrateWishRow(legacyRow({ status: 'received', source: 'frog', from: 'JPN:京都' }), NOW);
    expect(wish).toMatchObject({ status: 'received', source: 'frog', from: 'JPN:京都' });
  });

  it('rejects an unknown legacy state instead of guessing', () => {
    expect(migrateWishRow(legacyRow({ status: 'someday' }), NOW)).toBeNull();
  });

  it('rejects a row without an id', () => {
    expect(migrateWishRow(legacyRow({ id: '' }), NOW)).toBeNull();
  });

  it('infers the postcard source from the legacy origin', () => {
    expect(migrateWishRow(legacyRow({ status: 'wished' }), NOW)?.source).toBe('user');
    expect(migrateWishRow(legacyRow({ status: 'wished', origin: 'demo' }), NOW)?.source).toBe('frog');
    expect(migrateWishRow(legacyRow({ status: 'wished', source: 'frog' }), NOW)?.source).toBe('frog');
  });

  it('clears a note on a pending postcard and preserves timestamps', () => {
    const created = NOW - 5_000;
    const updated = NOW - 1_000;
    const wish = migrateWishRow(legacyRow({ status: 'pending', note: '还没寄出', createdAt: created, updatedAt: updated }), NOW);
    expect(wish).toMatchObject({ status: 'pending', note: null, createdAt: created, updatedAt: updated });
  });

  it('defaults a missing note when the legacy status needs one', () => {
    const wish = migrateWishRow(legacyRow({ note: undefined }), NOW);
    expect(wish?.status).toBe('opened');
    expect(wish?.note).toBeTruthy();
  });
});
