/**
 * Portal brand profile helpers — case-insensitive brand key + gallery link lookup.
 */
import {
  resolveBrandStorageKey,
  resolveBrandProfileFromStore,
  brandKeysMatch,
  filterContentByBrand,
  resolvePortalBrandDisplayNameFromStore,
  resolvePortalBrandLabel,
  matchesBrandContentRow,
  mergeBrandLinkedAndFallbackRows,
  chooseBestBrandDisplayName,
} from '../api/_lib/portalBrandProfile.mjs';
import {
  attachBrandIdToContentRow,
  buildBrandIdLookupMap,
  resolveBrandIdForClient,
} from '../api/_lib/contentBrandLink.mjs';

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
assert(
  resolvePortalBrandDisplayNameFromStore('ara med spa', {
    names: ['Ara Med Spa', 'Plume'],
    colors: { 'Ara Med Spa': '#ec4899' },
  }) === 'Ara Med Spa',
  'credential key resolves via names before storage key',
);
assert(
  resolvePortalBrandLabel({
    profile: { brandKey: 'plume', displayName: 'Plume' },
    displayBrand: 'Plume',
    sessionBrand: 'plume',
  }) === 'Plume',
  'portal brand label prefers profile display name',
);
assert(
  resolvePortalBrandLabel({
    profile: { brandKey: 'ara med spa' },
    displayBrand: 'Ara Med Spa',
    sessionBrand: 'ara med spa',
  }) === 'Ara Med Spa',
  'portal brand label uses resolved display name for all clients',
);
assert(
  chooseBestBrandDisplayName(['ara med spa', 'Ara Med Spa']) === 'Ara Med Spa',
  'brand display resolver prefers correctly cased client brand name',
);
assert(
  resolvePortalBrandLabel({
    profile: { brandKey: 'ara med spa', displayName: 'ara med spa' },
    displayBrand: 'Ara Med Spa',
    sessionBrand: 'ara med spa',
  }) === 'Ara Med Spa',
  'portal brand label does not let lowercase profile display override cased brand name',
);

const brandMap = buildBrandIdLookupMap([
  { id: 'brand-1', brand_key: 'ara med spa', display_name: 'Ara Med Spa' },
]);
assert(
  resolveBrandIdForClient('Ara Med Spa', brandMap) === 'brand-1',
  'content upsert links brand_id from display client name',
);
assert(
  attachBrandIdToContentRow(
    'cards',
    { id: 'c1', org_id: 'medici', data: { client: 'Plume' } },
    buildBrandIdLookupMap([{ id: 'brand-2', brand_key: 'plume', display_name: 'Plume' }]),
  ).brand_id === 'brand-2',
  'content upsert attaches brand_id for any client portal brand',
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

const mergedRows = mergeBrandLinkedAndFallbackRows(
  [{ id: 'linked-event', data: { client: 'Ara Med Spa', title: 'Linked' } }],
  [
    { id: 'linked-event', data: { client: 'Ara Med Spa', title: 'Duplicate' } },
    { id: 'fallback-event', data: { client: 'Ara Med Spa', title: 'Fallback' } },
    { id: 'other-event', data: { client: 'Plume', title: 'Other' } },
  ],
  'ara med spa',
  'events',
);
assert(
  mergedRows.length === 2 &&
    mergedRows.some((row) => row.id === 'linked-event') &&
    mergedRows.some((row) => row.id === 'fallback-event'),
  'brand content loader merges linked rows with same-client fallback rows',
);

console.log('Portal brand profile helper tests passed.');
