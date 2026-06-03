import {
  mergeRemoteListWithLocalPending,
  mergeRemoteMapWithLocalPending,
  mergePortalCredentialValue,
  filterProtectedSyncRemovals,
  filterProtectedSyncUpserts,
  registerPortalCredentialBrand,
  excludePendingRemovedFromCollection,
  excludePendingRemovedFromMap,
  markPendingRemoved,
  pendingRemovedKey,
  pendingCreatesKey,
} from '../src/lib/syncHelpers.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const getId = (record) => record.id;

// Stale localStorage ghosts must not reappear when cloud is authoritative.
{
  const remote = [{ id: 'keep', title: 'Real card', updatedAt: 10 }];
  const local = [
    { id: 'keep', title: 'Real card', updatedAt: 10 },
    { id: 'ghost', title: 'dfasd', updatedAt: 1 },
  ];
  const merged = mergeRemoteListWithLocalPending({
    remoteItems: remote,
    getId,
    syncedSnapshot: new Map([['keep', JSON.stringify(remote[0])]]),
    localItems: local,
    pendingRemoved: new Set(),
    pendingLocalCreates: new Set(),
  });
  assert(merged.length === 1, 'ghost card should be dropped');
  assert(merged[0].id === 'keep', 'real card should remain');
}

// Unsynced creates should survive until upload completes.
{
  const remote = [];
  const local = [{ id: 'new-local', title: 'Draft', updatedAt: 99 }];
  const merged = mergeRemoteListWithLocalPending({
    remoteItems: remote,
    getId,
    syncedSnapshot: new Map(),
    localItems: local,
    pendingRemoved: new Set(),
    pendingLocalCreates: new Set(['new-local']),
  });
  assert(merged.length === 1, 'pending local create should be kept');
  assert(merged[0].id === 'new-local', 'pending local create id should match');
}

// Deleted cards must not resurrect from stale cloud pulls.
{
  const remote = [{ id: 'deleted', title: 'Old', updatedAt: 5 }];
  const merged = mergeRemoteListWithLocalPending({
    remoteItems: remote,
    getId,
    syncedSnapshot: new Map([['deleted', JSON.stringify({ id: 'deleted', title: 'Old', updatedAt: 5 })]]),
    localItems: [],
    pendingRemoved: new Set(['deleted']),
    pendingLocalCreates: new Set(),
  });
  assert(merged.length === 0, 'pending delete should hide remote row');
}

// Map merge should ignore stale local-only keys.
{
  const merged = mergeRemoteMapWithLocalPending({
    remoteMap: { a: { value: 1 } },
    syncedSnapshot: new Map([['a', JSON.stringify({ value: 1 })]]),
    localMap: { a: { value: 1 }, ghost: { value: 9 } },
    pendingRemoved: new Set(),
    pendingLocalCreates: new Set(),
  });
  assert(Object.keys(merged).length === 1, 'stale map ghost should be dropped');
  assert(merged.a.value === 1, 'remote map value should remain');
}

// Auth-critical tables must not bulk-delete unless explicitly tombstoned.
{
  const pending = new Set(['explicit-delete']);
  const removed = filterProtectedSyncRemovals(
    'client_portal_credentials',
    ['Plume', 'Ara Med Spa', 'explicit-delete'],
    pending,
  );
  assert(removed.length === 1, 'only tombstoned ids should be deleted');
  assert(removed[0] === 'explicit-delete', 'tombstoned id should pass through');
}

{
  const removed = filterProtectedSyncRemovals(
    'cards',
    ['card-1', 'card-2'],
    new Set(),
  );
  assert(removed.length === 2, 'non-auth tables should allow all removals');
}

// Tombstoned rows must not hydrate from local cache when pending-remove storage is set.
if (typeof localStorage !== 'undefined') {
  markPendingRemoved('test-org', 'meetings', ['ghost']);
  try {
    const filtered = excludePendingRemovedFromCollection(
      [{ id: 'keep' }, { id: 'ghost' }],
      (row) => row.id,
      'test-org',
      'meetings',
    );
    assert(filtered.length === 1, 'tombstoned collection row should be skipped');
    assert(filtered[0].id === 'keep', 'active row should remain');
  } finally {
    localStorage.removeItem(pendingRemovedKey('test-org', 'meetings'));
  }
}

{
  const map = excludePendingRemovedFromMap(
    { keep: { value: 1 }, ghost: { value: 2 } },
    'medici',
    'shoot_plans',
  );
  assert(Object.keys(map).length === 2, 'map filter without pending should pass through');
}

// Empty local portal users must not wipe configured cloud users.
{
  const remoteUsers = [{ id: 'u1', username: 'plumehtx', passwordHash: 'abc123' }];
  const merged = mergePortalCredentialValue({
    remote: remoteUsers,
    local: [],
    syncedStr: JSON.stringify(remoteUsers),
  });
  assert(merged.length === 1, 'empty local should not wipe remote portal users');
  assert(merged[0].username === 'plumehtx', 'remote portal username should remain');
}

// Empty credential upserts must be blocked before cloud push.
{
  const changed = filterProtectedSyncUpserts('client_portal_credentials', [
    { id: 'Plume', data: [] },
    { id: 'Arco Fit', data: [{ id: 'u1', username: 'arco', passwordHash: 'deadbeef' }] },
  ]);
  assert(changed.length === 1, 'only configured credential upserts should pass');
  assert(changed[0].id === 'Arco Fit', 'configured brand should remain');
}

// New client credentials saved on another device should hydrate locally.
{
  const remoteUsers = [{ id: 'u2', username: 'newclient', passwordHash: 'abc123' }];
  const merged = mergeRemoteMapWithLocalPending({
    remoteMap: { 'New Client Co': remoteUsers },
    syncedSnapshot: new Map([['New Client Co', JSON.stringify([])]]),
    localMap: {},
    pendingRemoved: new Set(),
    pendingLocalCreates: new Set(['New Client Co']),
    protectCredentialEntries: true,
  });
  assert(merged['New Client Co']?.[0]?.username === 'newclient', 'new client portal users should hydrate from cloud');
}

// Adding a client registers it for protected portal credential sync.
if (typeof localStorage !== 'undefined') {
  registerPortalCredentialBrand('test-org', 'New Client Co');
  try {
    const raw = localStorage.getItem(pendingCreatesKey('test-org', 'client_portal_credentials'));
    const parsed = JSON.parse(raw);
    assert(parsed.includes('New Client Co'), 'new client brand should be registered for portal sync');
  } finally {
    localStorage.removeItem(pendingCreatesKey('test-org', 'client_portal_credentials'));
  }
}

console.log('Sync merge tests passed.');
