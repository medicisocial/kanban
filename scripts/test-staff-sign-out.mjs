import {
  STAFF_SIGNED_OUT_KEY,
  clearStaffSignedOut,
  isStaffSignedOut,
  markStaffSignedOut,
  shouldSuppressStaffAutoRestore,
} from '../src/utils/staffAuth.js';

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

clearStaffSignedOut();
assert(!isStaffSignedOut(), 'starts unsigned out');
assert(!shouldSuppressStaffAutoRestore(), 'no auto-restore suppression initially');

markStaffSignedOut();
assert(isStaffSignedOut(), 'marks signed out');
assert(shouldSuppressStaffAutoRestore(), 'suppresses auto-restore after sign out');
assert(sessionStorage.getItem(STAFF_SIGNED_OUT_KEY) === '1', 'persists tab flag');

clearStaffSignedOut();
assert(!isStaffSignedOut(), 'clears signed out on login');
assert(!shouldSuppressStaffAutoRestore(), 'allows auto-restore after login');

console.log('test-staff-sign-out: ok');
