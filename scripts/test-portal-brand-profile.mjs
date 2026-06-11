/**
 * Portal brand profile helpers — case-insensitive brand key + gallery link lookup.
 */
import {
  resolveBrandStorageKey,
  resolveBrandProfileFromStore,
  brandKeysMatch,
  filterContentByBrand,
  resolvePortalBrandDisplayNameFromStore,
  matchesBrandContentRow,
} from '../api/_lib/portalBrandProfile.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(resolveBrandStorageKey({ Plume: 'x' }, 'plume', ['Plume']) === 'Plume', 'case-insensitive brand key');
assert(
  resolveBrandStorageKey({ 'The Locker Room': 'x' }, 'the locker room', ['The Locker Room']) === 'The Locker Room',
  'multi-word brand key',
);

const store = {
  names: ['Plume'],
  photoGalleryLinks: { Plume: 'https://www.dropbox.com/scl/fo/example' },
  colors: { Plume: '#22c55e' },
};

const profile = resolveBrandProfileFromStore(store, 'Plume');
assert(profile.photoGalleryLink === 'https://www.dropbox.com/scl/fo/example', 'gallery link resolved');
assert(profile.clientColor === '#22c55e', 'color resolved');

const emptyStore = { names: ['Plume'], photoGalleryLinks: {} };
assert(resolveBrandProfileFromStore(emptyStore, 'Plume').photoGalleryLink === null, 'missing link is null');

assert(brandKeysMatch('Plume', 'plume'), 'brand keys match case-insensitively');
assert(!brandKeysMatch('Plume', 'Plume HTX'), 'different brands do not match');

const meetings = [
  { id: '1', title: 'Kickoff', client: 'Plume', date: '2026-06-10' },
  { id: '2', title: 'Internal', client: '', date: '2026-06-11' },
  { id: '3', title: 'Other', client: 'Acme', date: '2026-06-12' },
];
assert(
  filterContentByBrand(meetings, 'plume').length === 1 && filterContentByBrand(meetings, 'plume')[0].id === '1',
  'filterContentByBrand is case-insensitive',
);
assert(filterContentByBrand(meetings, 'PLUME')[0].client === 'Plume', 'filterContentByBrand preserves stored client name');

const arcoStore = {
  names: ['Arco Fit', 'Plume'],
  colors: { 'Arco Fit': '#3b82f6', Plume: '#22c55e' },
};
assert(
  resolvePortalBrandDisplayNameFromStore('arco fit', arcoStore) === 'Arco Fit',
  'credential key resolves to workspace display name',
);
assert(
  resolvePortalBrandDisplayNameFromStore('plume', arcoStore) === 'Plume',
  'lowercase credential key resolves to display name',
);

import { clientMatchesBrand } from '../src/utils/clients.js';

assert(clientMatchesBrand('Arco Fit', 'arco fit'), 'portal brand matches display client name');
assert(!clientMatchesBrand('Plume', 'Arco Fit'), 'different clients do not match');

assert(
  matchesBrandContentRow(
    { id: 'card-1', data: { client: 'Ara Med Spa', shootDate: '2026-06-11' } },
    'ara med spa',
    'cards',
  ),
  'portal content fallback matches cards by client text when brand_id is missing',
);
assert(
  matchesBrandContentRow(
    { id: 'Ara Med Spa|2026-06-11', data: { client: 'Ara Med Spa' } },
    'ara med spa',
    'shoot_plans',
  ),
  'portal content fallback matches shoot plans by client text',
);

console.log('Portal brand profile helper tests passed.');
