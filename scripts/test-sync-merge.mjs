import {
  mergeRemoteListWithLocalPending,
  mergeRemoteMapWithLocalPending,
  filterProtectedSyncRemovals,
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

console.log('Sync merge tests passed.');
