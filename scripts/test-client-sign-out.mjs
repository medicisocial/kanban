import {
  CLIENT_SIGNED_OUT_KEY,
  clearClientSignedOut,
  isClientSignedOut,
  markClientSignedOut,
  shouldSuppressClientAutoRestore,
} from '../src/utils/clientPortalSignOut.js';

const store = new Map();
globalThis.sessionStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => {
    store.set(key, String(value));
  },
  removeItem: (key) => {
    store.delete(key);
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

clearClientSignedOut();
assert(!isClientSignedOut(), 'starts unsigned out');
assert(!shouldSuppressClientAutoRestore(), 'no auto-restore suppression initially');

markClientSignedOut();
assert(isClientSignedOut(), 'marks signed out');
assert(shouldSuppressClientAutoRestore(), 'suppresses auto-restore after sign out');
assert(sessionStorage.getItem(CLIENT_SIGNED_OUT_KEY) === '1', 'persists tab flag');

clearClientSignedOut();
assert(!isClientSignedOut(), 'clears signed out on login');
assert(!shouldSuppressClientAutoRestore(), 'allows auto-restore after login');

console.log('test-client-sign-out: ok');
