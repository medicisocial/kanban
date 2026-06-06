/**
 * Portal brand profile helpers — case-insensitive brand key + gallery link lookup.
 */
import {
  resolveBrandStorageKey,
  resolveBrandProfileFromStore,
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

console.log('Portal brand profile helper tests passed.');
