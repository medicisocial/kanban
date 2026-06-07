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
  mergeClientsWorkspaceState,
  mergePortalCredentialDataForPush,
} from '../src/lib/syncHelpers.js';
import {
  mergePortalCredentialData,
  filterAuthCriticalDeletes,
} from '../api/_lib/authCriticalSync.mjs';
import {
  applyAuthoritativeBrandAssets,
  mergeBrandCompanyFiles,
  mergeClientsWorkspaceData,
} from '../api/_lib/clientsWorkspaceMerge.mjs';
import {
  mergeBrandCompanyFilesPortalRefresh,
  mergeClientsWorkspaceBrandFiles,
  mergeClientsWorkspaceNames,
  mergeClientsWorkspaceNamesOnWrite,
  mergeClientNameTombstones,
  suppressedClientNameKeys,
  stripSuppressedClientNames,
  mergeBrandLogoMap,
} from '../src/utils/clientsWorkspaceMerge.js';
import { isTestClientName } from '../src/utils/clients.js';
import {
  isPortalContentCalendarCard,
  buildCalendarNoteUpdates,
  buildCalendarNoteDeleteUpdates,
} from '../api/_lib/calendarNote.mjs';
import { buildCalendarNoteResponse, buildCalendarNoteDeletePatch } from '../src/utils/calendarNote.js';
import { getCalendarClientNote } from '../src/utils/calendarClientNote.js';

function filterIdsFromCompanyFiles(files, deletedIds) {
  const deleted =
    deletedIds instanceof Set ? deletedIds : new Set((deletedIds || []).map((id) => String(id)));
  if (!deleted.size) return Array.isArray(files) ? files : [];
  return (Array.isArray(files) ? files : []).filter((file) => !deleted.has(String(file?.id || '')));
}

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

// ---------------------------------------------------------------------------
// Server-side auth-critical merge (the /api/staff-sync write path). These guard
// the same login invariant the database triggers enforce, so a regression here
// is caught before it ever reaches production.
// ---------------------------------------------------------------------------

// An empty incoming payload must never erase configured cloud logins.
{
  const existing = [{ id: 'u1', username: 'plumehtx', passwordHash: 'a'.repeat(64) }];
  const merged = mergePortalCredentialData(existing, []);
  assert(merged.length === 1, 'server merge: empty incoming must not wipe existing login');
  assert(merged[0].passwordHash === 'a'.repeat(64), 'server merge: existing hash must survive empty write');
}

// A username-only edit (blanked hash) must inherit the existing password hash.
{
  const existing = [{ id: 'u1', username: 'plumehtx', passwordHash: 'b'.repeat(64) }];
  const incoming = [{ id: 'u1', username: 'plumehtx', passwordHash: '' }];
  const merged = mergePortalCredentialData(existing, incoming);
  assert(merged.length === 1, 'server merge: blanked-hash edit should keep the user');
  assert(merged[0].passwordHash === 'b'.repeat(64), 'server merge: blanked hash should inherit existing hash');
}

// Stale sync must not replace a configured cloud hash with a different local hash.
{
  const existing = [{ id: 'u1', username: 'plumehtx', passwordHash: 'c'.repeat(64) }];
  const incoming = [{ id: 'u1', username: 'plumehtx', passwordHash: 'd'.repeat(64) }];
  const merged = mergePortalCredentialData(existing, incoming);
  assert(merged[0].passwordHash === 'c'.repeat(64), 'server merge: stale hash change must be blocked');
}

// A genuine password change must replace the stored hash when explicitly allowed.
{
  const existing = [{ id: 'u1', username: 'plumehtx', passwordHash: 'c'.repeat(64) }];
  const incoming = [{ id: 'u1', username: 'plumehtx', passwordHash: 'd'.repeat(64) }];
  const merged = mergePortalCredentialData(existing, incoming, { allowPasswordChange: true });
  assert(merged[0].passwordHash === 'd'.repeat(64), 'server merge: real password change must persist');
  assert(
    merged[0]._passwordChangeAuthorized === true,
    'server merge: authorized password change should include DB marker',
  );
}

// Client push merge should attach the same authorization marker for password edits.
{
  const existing = [{ id: 'u1', username: 'clientx', passwordHash: 'e'.repeat(64) }];
  const incoming = [{ id: 'u1', username: 'clientx', passwordHash: 'f'.repeat(64) }];
  const merged = mergePortalCredentialDataForPush(existing, incoming, { allowPasswordChange: true });
  assert(merged[0].passwordHash === 'f'.repeat(64), 'client push merge: password change must persist');
  assert(
    merged[0]._passwordChangeAuthorized === true,
    'client push merge: authorized password change should include DB marker',
  );
}

// Authoritative portal-access save must drop users removed in the staff editor.
{
  const existing = [
    { id: 'u1', username: 'plumehtx', passwordHash: 'a'.repeat(64) },
    { id: 'u2', username: 'vaulttestmq1p9fil', passwordHash: 'b'.repeat(64) },
  ];
  const incoming = [{ id: 'u1', username: 'plumehtx', passwordHash: 'a'.repeat(64) }];
  const merged = mergePortalCredentialDataForPush(existing, incoming, {
    authoritativeUserList: true,
  });
  assert(merged.length === 1, 'authoritative save should remove omitted portal users');
  assert(merged[0].username === 'plumehtx', 'authoritative save should keep remaining users');
}

// Auth-critical deletes are blocked unless explicitly confirmed.
{
  const blocked = filterAuthCriticalDeletes('client_portal_credentials', ['Plume'], false);
  assert(blocked.length === 0, 'server: unconfirmed auth delete must be blocked');
  const allowed = filterAuthCriticalDeletes('client_portal_credentials', ['Plume'], true);
  assert(allowed.length === 1, 'server: confirmed auth delete must pass through');
  const nonAuth = filterAuthCriticalDeletes('cards', ['card-1'], false);
  assert(nonAuth.length === 1, 'server: non-auth deletes are unaffected');
}

// Stale staff-sync must not drop a client upload with a newer updatedAt.
{
  const clientFile = {
    id: 'file-1',
    name: 'Menu',
    dataUrl: 'data:application/pdf;base64,abc',
    updatedAt: 200,
  };
  const staleStaff = {
    companyFiles: {
      Plume: [],
    },
  };
  const stored = {
    companyFiles: {
      Plume: [clientFile],
    },
  };
  const merged = mergeClientsWorkspaceData(stored, staleStaff);
  assert(merged.companyFiles.Plume.length === 1, 'stale staff push should keep client upload');
  assert(merged.companyFiles.Plume[0].id === 'file-1', 'client upload id should survive');
}

// Stale staff-sync must not wipe Plume vault passwords used for login recovery.
{
  const stored = {
    portalPasswordVault: {
      Plume: { 'user-1': 'SecretPass123' },
    },
  };
  const staleStaff = {
    portalPasswordVault: {},
  };
  const merged = mergeClientsWorkspaceData(stored, staleStaff);
  assert(
    merged.portalPasswordVault?.Plume?.['user-1'] === 'SecretPass123',
    'stale staff push should keep Plume vault password',
  );
}

// Stale staff-sync must not wipe contacts, logos, or social logins.
{
  const stored = {
    contacts: {
      Plume: [{ id: 'c1', name: 'Owner', role: 'Owner', phone: '555-0100' }],
    },
    logos: {
      Plume: { src: 'data:image/png;base64,abc', zoom: 1, x: 50, y: 50 },
    },
    socialLogins: {
      Plume: {
        instagram: { username: 'plumehtx', password: 'secret' },
        tiktok: { username: '', password: '' },
        facebook: { username: '', password: '' },
      },
    },
  };
  const staleStaff = {
    contacts: {},
    logos: {},
    socialLogins: {},
  };
  const merged = mergeClientsWorkspaceData(stored, staleStaff);
  assert(merged.contacts?.Plume?.length === 1, 'stale staff push should keep Plume contacts');
  assert(merged.contacts.Plume[0].id === 'c1', 'Plume contact id should survive');
  assert(merged.logos?.Plume?.src === stored.logos.Plume.src, 'stale staff push should keep Plume logo');
  assert(
    merged.socialLogins?.Plume?.instagram?.username === 'plumehtx',
    'stale staff push should keep Plume social logins',
  );
}

// Per-brand file lists merge by id with newest updatedAt winning.
{
  const merged = mergeBrandCompanyFiles(
    [{ id: 'a', name: 'Old', updatedAt: 10 }],
    [{ id: 'a', name: 'New', updatedAt: 20 }],
  );
  assert(merged.length === 1, 'merge should keep one file');
  assert(merged[0].name === 'New', 'incoming newer file should win');
}

// Explicit API save must not resurrect a deleted file (e.g. Playwright e2e-test uploads).
{
  const stored = {
    companyFiles: {
      Plume: [
        { id: 'file-e2e-1', name: 'e2e-test', updatedAt: 500 },
        { id: 'file-real', name: 'Spring menu', updatedAt: 100 },
      ],
    },
  };
  const workspace = { companyFiles: { Plume: [] } };
  const patch = { companyFiles: { Plume: [{ id: 'file-real', name: 'Spring menu', updatedAt: 100 }] } };
  const merged = applyAuthoritativeBrandAssets(workspace, { companyFilesByBrand: patch.companyFiles });
  assert(merged.companyFiles.Plume.length === 1, 'authoritative save should drop deleted file');
  assert(merged.companyFiles.Plume[0].id === 'file-real', 'authoritative save should keep remaining file');
}

// Portal delete must not resurrect removed files via union merge on post-save refresh.
{
  const saved = [{ id: 'f1', name: 'Keep', updatedAt: 10 }];
  const staleServer = [
    { id: 'f1', name: 'Keep', updatedAt: 10 },
    { id: 'f2', name: 'Removed', updatedAt: 500 },
  ];
  const resurrected = mergeBrandCompanyFiles(
    mergeBrandCompanyFiles(staleServer, saved),
    saved,
  );
  assert(resurrected.length === 2, 'union merge resurrects deleted file');
  assert(
    saved.length === 1 && saved[0].id === 'f1',
    'authoritative saved list should keep only remaining file',
  );
}

// Portal refresh should drop server-only ghosts after a local delete.
{
  const screen = [{ id: 'f1', name: 'Keep', updatedAt: 10 }];
  const server = [
    { id: 'f1', name: 'Keep', updatedAt: 10 },
    { id: 'f2', name: 'Removed', updatedAt: 500 },
  ];
  const merged = mergeBrandCompanyFilesPortalRefresh(screen, server);
  assert(merged.length === 1, 'portal refresh should drop resurrected server file');
  assert(merged[0].id === 'f1', 'portal refresh should keep on-screen file');
}

// Stale remote refresh must not drop a client that is still in the synced baseline.
{
  const synced = ['Plume', 'Casalu'];
  const local = [...synced];
  const remote = ['Plume'];
  const merged = mergeClientsWorkspaceNames(remote, local, synced);
  assert(merged.length === 2, 'stale remote should not drop newly added client');
  assert(merged.includes('Casalu'), 'newly added client should survive stale remote');
}

// Stale staff-sync push must not drop a client the server just added.
{
  const stored = {
    names: ['Plume', 'Casalu'],
    colors: { Plume: '#111', Casalu: '#222' },
  };
  const incoming = {
    names: ['Plume'],
    colors: { Plume: '#111' },
  };
  const merged = mergeClientsWorkspaceData(stored, incoming);
  assert(merged.names.length === 2, 'stale push should not drop server-added client');
  assert(merged.names.includes('Casalu'), 'server-added client should survive stale push');
  assert(merged.colors.Casalu === '#222', 'stale push should keep server-added client color');
}

// Push-path three-way merge: stale local must not drop a server-added client.
{
  const existing = ['Plume', 'Casalu'];
  const local = ['Plume'];
  const synced = ['Plume'];
  const merged = mergeClientsWorkspaceNames(existing, local, synced);
  assert(merged.length === 2, 'push merge should keep server-added client');
  assert(merged.includes('Casalu'), 'push merge should include Casalu');
}

// Union write merge keeps both sides when lists diverge.
{
  const merged = mergeClientsWorkspaceNamesOnWrite(['Plume'], ['Plume', 'Casalu']);
  assert(merged.length === 2, 'union write should include both clients');
  assert(merged.includes('Casalu'), 'union write should include incoming-only client');
}

// Cold load without sync baseline must union local and remote client lists.
{
  const local = {
    names: ['Plume', 'Casalu'],
    colors: { Plume: '#111', Casalu: '#222' },
  };
  const remote = { names: ['Plume'], colors: { Plume: '#111' } };
  const merged = mergeClientsWorkspaceState({ remote, local, syncedStr: null });
  assert(merged.names.includes('Casalu'), 'cold load should keep local-only client');
  assert(merged.colors.Casalu === '#222', 'cold load should keep local-only client color');
}

// Full workspace state stays stable through stale remote after local add.
{
  const synced = { names: ['Plume'] };
  const local = {
    names: ['Plume', 'Casalu'],
    colors: { Plume: '#111', Casalu: '#222' },
  };
  const remote = { names: ['Plume'], colors: { Plume: '#111' } };
  const merged = mergeClientsWorkspaceState({
    remote,
    local,
    syncedStr: JSON.stringify(synced),
  });
  assert(merged.names.includes('Casalu'), 'local add should survive stale remote refresh');
  assert(merged.colors.Casalu === '#222', 'local add color should survive stale remote refresh');
}

// Removing a client locally must propagate through the names three-way merge (push path).
{
  const synced = ['Plume', 'Casalu'];
  const local = ['Plume'];
  const remote = ['Plume', 'Casalu'];
  const merged = mergeClientsWorkspaceNames(remote, local, synced);
  assert(!merged.includes('Casalu'), 'local removal should drop the client on push');
  assert(merged.length === 1, 'push merge should keep only remaining client after removal');
}

// Removing a client locally must propagate through the full realtime state merge.
{
  const synced = { names: ['Plume', 'Casalu'] };
  const local = { names: ['Plume'], colors: { Plume: '#111' } };
  const remote = { names: ['Plume', 'Casalu'], colors: { Plume: '#111', Casalu: '#222' } };
  const merged = mergeClientsWorkspaceState({
    remote,
    local,
    syncedStr: JSON.stringify(synced),
  });
  assert(!merged.names.includes('Casalu'), 'realtime merge should honor local removal');
}

// Tombstoned ids never render again during this session.
{
  const files = filterIdsFromCompanyFiles(
    [
      { id: 'f1', updatedAt: 10 },
      { id: 'f2', updatedAt: 500 },
    ],
    ['f2'],
  );
  assert(files.length === 1, 'tombstoned file should stay hidden');
  assert(files[0].id === 'f1', 'non-tombstoned file should remain');
}

// Stale staff local must not repush files the server already deleted.
{
  const synced = [
    { id: 'f1', updatedAt: 10 },
    { id: 'f2', updatedAt: 500 },
  ];
  const local = [...synced];
  const remote = [{ id: 'f1', updatedAt: 10 }];
  const merged = mergeClientsWorkspaceBrandFiles(remote, local, synced);
  assert(merged.length === 1, 'stale staff local should not repush deleted file');
  assert(merged[0].id === 'f1', 'remaining server file should stay');
}

// Staff explicit delete must not resurrect removed files from a stale server snapshot.
{
  const synced = [
    { id: 'f1', name: 'Keep', updatedAt: 10 },
    { id: 'f2', name: 'Removed', updatedAt: 500 },
  ];
  const local = [{ id: 'f1', name: 'Keep', updatedAt: 10 }];
  const remote = [...synced];
  const merged = mergeClientsWorkspaceBrandFiles(remote, local, synced);
  assert(merged.length === 1, 'staff delete should not resurrect removed file');
  assert(merged[0].id === 'f1', 'staff delete should keep remaining file');
}

// Portal delete must not be resurrected when staff sync has not changed locally.
{
  const synced = [
    { id: 'f1', name: 'Keep', updatedAt: 10 },
    { id: 'f2', name: 'Removed', updatedAt: 500 },
  ];
  const local = [...synced];
  const remote = [{ id: 'f1', name: 'Keep', updatedAt: 10 }];
  const merged = mergeClientsWorkspaceBrandFiles(remote, local, synced);
  assert(merged.length === 1, 'portal delete should not be resurrected by unchanged staff sync');
  assert(merged[0].id === 'f1', 'portal delete should keep remaining file');
}

// Admin delete should stick when staff removes a file locally.
{
  const synced = [
    { id: 'f1', name: 'Logo', updatedAt: 10 },
    { id: 'f2', name: 'Menu', updatedAt: 20 },
  ];
  const local = [{ id: 'f1', name: 'Logo', updatedAt: 10 }];
  const remote = [...synced];
  const merged = mergeClientsWorkspaceBrandFiles(remote, local, synced);
  assert(merged.length === 1, 'admin delete should drop removed file');
  assert(merged[0].id === 'f1', 'admin delete should keep remaining file');
}

// Admin upload should keep a concurrent client upload on the same brand.
{
  const synced = [{ id: 'f1', name: 'Logo', updatedAt: 10 }];
  const local = [
    { id: 'f1', name: 'Logo', updatedAt: 10 },
    { id: 'f3', name: 'Staff PDF', updatedAt: 30 },
  ];
  const remote = [
    { id: 'f1', name: 'Logo', updatedAt: 10 },
    { id: 'f2', name: 'Client PDF', updatedAt: 25 },
  ];
  const merged = mergeClientsWorkspaceBrandFiles(remote, local, synced);
  assert(merged.length === 3, 'admin upload should union concurrent client upload');
  assert(merged.some((file) => file.id === 'f3'), 'staff upload should remain');
  assert(merged.some((file) => file.id === 'f2'), 'client upload should remain');
}

// Staff realtime merge should not revert an admin upload when remote is briefly stale.
{
  const synced = { companyFiles: { Plume: [] } };
  const local = {
    companyFiles: {
      Plume: [{ id: 'f1', name: 'Admin PDF', updatedAt: 40 }],
    },
  };
  const remote = {
    companyFiles: {
      Plume: [],
    },
  };
  const merged = mergeClientsWorkspaceState({
    remote,
    local,
    syncedStr: JSON.stringify(synced),
  });
  assert(merged.companyFiles.Plume.length === 1, 'stale remote should not revert admin upload');
  assert(merged.companyFiles.Plume[0].id === 'f1', 'admin upload id should survive realtime merge');
}

// Calendar notes: only scheduled pipeline cards are eligible.
{
  assert(
    isPortalContentCalendarCard({
      columnId: 'scheduled',
      contentType: 'Reel',
      dueDate: '2026-06-10',
    }),
    'scheduled reel with due date should be eligible',
  );
  assert(
    !isPortalContentCalendarCard({
      columnId: 'ideas',
      contentType: 'Reel',
      dueDate: '2026-06-10',
    }),
    'ideas column should not be eligible',
  );
  assert(
    !isPortalContentCalendarCard({
      columnId: 'scheduled',
      contentType: 'Reel',
    }),
    'post without due date should not be eligible',
  );
}

// Calendar notes: append history and stamp calendarNoteAt.
{
  const card = {
    id: 'c1',
    contentType: 'Static Post',
    notes: 'Existing',
  };
  const updates = buildCalendarNoteUpdates(card, {
    comment: 'Please move to Friday',
    timestamp: 1_700_000_000_000,
  });
  assert(updates.clientComment === 'Please move to Friday', 'clientComment should be set');
  assert(updates.calendarNoteAt === 1_700_000_000_000, 'calendarNoteAt should be set');
  assert(!('notes' in updates), 'calendar note save should not touch staff notes');
}

// Story occurrence notes keyed by date.
{
  const card = {
    contentType: 'Story',
    storyOccurrenceNotes: { '2026-06-05': 'Old note' },
  };
  const updates = buildCalendarNoteUpdates(card, {
    comment: 'Use alternate CTA',
    occurrenceDate: '2026-06-12',
    timestamp: 1_700_000_000_000,
  });
  assert(
    updates.storyOccurrenceNotes['2026-06-12'] === 'Use alternate CTA',
    'story occurrence note should be stored by date',
  );
  assert(
    updates.storyOccurrenceNotes['2026-06-05'] === 'Old note',
    'other occurrence notes should be preserved',
  );
}

// Calendar note delete clears client fields and occurrence overrides.
{
  const card = {
    contentType: 'Story',
    clientComment: 'Remove me',
    calendarNoteAt: 1_700_000_000_000,
    storyOccurrenceNotes: { '2026-06-12': 'Remove me', '2026-06-05': 'Keep' },
    notes: 'Staff context',
  };
  const updates = buildCalendarNoteDeleteUpdates(card, {
    occurrenceDate: '2026-06-12',
    timestamp: 1_700_000_100_000,
  });
  assert(updates.clientComment === '', 'delete should clear clientComment');
  assert(updates.calendarNoteAt === 0, 'delete should clear calendarNoteAt');
  assert(!updates.storyOccurrenceNotes['2026-06-12'], 'delete should remove occurrence note');
  assert(updates.storyOccurrenceNotes['2026-06-05'] === 'Keep', 'other occurrence notes should remain');
  assert(!('notes' in updates), 'calendar note delete should not touch staff notes');
}

// Staff delete patch mirrors server delete updates.
{
  const card = { contentType: 'Reel', clientComment: 'Old', calendarNoteAt: 99, notes: '' };
  const patch = buildCalendarNoteDeletePatch(card, { timestamp: 50 });
  assert(patch.clientComment === '', 'staff patch should clear clientComment');
  assert(patch.calendarNoteAt === 0, 'staff patch should clear calendarNoteAt');
}

// Client note display respects story occurrence date.
{
  const note = getCalendarClientNote({
    contentType: 'Story',
    occurrenceDate: '2026-06-12',
    clientComment: 'General',
    storyOccurrenceNotes: { '2026-06-12': 'For this day only' },
  });
  assert(note === 'For this day only', 'occurrence note should win over clientComment');
}

// Portal payload shape for client-responses API.
{
  const payload = buildCalendarNoteResponse({
    card: { id: 'c9', occurrenceDate: '2026-06-12' },
    comment: 'Looks great',
    client: 'Plume',
  });
  assert(payload.cardId === 'c9', 'cardId should be included');
  assert(payload.comment === 'Looks great', 'comment should be trimmed');
  assert(payload.occurrenceDate === '2026-06-12', 'occurrenceDate should pass through');
  assert(payload.client === 'Plume', 'client should pass through');

  const deleted = buildCalendarNoteResponse({
    card: { id: 'c9', occurrenceDate: '2026-06-12' },
    client: 'Plume',
    action: 'delete',
  });
  assert(deleted.action === 'delete', 'delete action should pass through');
  assert(deleted.comment === '', 'delete payload should omit comment');
}

// Cross-device delete: a removal tombstone suppresses the name even when a stale
// remote still lists it (the bug where a deleted client "comes back").
{
  const now = Date.now();
  const remote = { names: ['Plume', 'Casalu'], colors: { Casalu: '#fff' } };
  const local = {
    names: ['Plume'],
    removedNames: { casalu: now },
  };
  const merged = mergeClientsWorkspaceState({
    remote,
    local,
    syncedStr: JSON.stringify({ names: ['Plume', 'Casalu'] }),
  });
  assert(!merged.names.includes('Casalu'), 'tombstoned client must not be resurrected by stale remote');
  assert(!('Casalu' in (merged.colors || {})), 'tombstoned client brand map entry should be stripped');
  assert(merged.removedNames?.casalu === now, 'removal tombstone should persist through merge');
}

// Cold load (no sync baseline) must honor a local delete tombstone, not union it back.
{
  const now = Date.now();
  const remote = { names: ['Plume', 'Casalu'] };
  const local = { names: ['Plume'], removedNames: { casalu: now } };
  const merged = mergeClientsWorkspaceState({ remote, local, syncedStr: null });
  assert(!merged.names.includes('Casalu'), 'cold-load union must not resurrect a tombstoned client');
}

// Re-add after delete wins: a newer restore tombstone beats the older removal.
{
  const now = Date.now();
  const stored = { names: ['Plume'], removedNames: { casalu: now - 1000 } };
  const incoming = { names: ['Plume', 'Casalu'], restoredNames: { casalu: now } };
  const merged = mergeClientsWorkspaceData(stored, incoming);
  assert(merged.names.includes('Casalu'), 're-added client (newer restore) should survive');
}

// A delete still wins when it is the newer event than a prior restore.
{
  const now = Date.now();
  const keys = suppressedClientNameKeys({
    removedNames: { casalu: now },
    restoredNames: { casalu: now - 1000 },
  });
  assert(keys.has('casalu'), 'newest removal should suppress the name');
}

// Tombstone union keeps the newest timestamp per name across devices.
{
  const now = Date.now();
  const merged = mergeClientNameTombstones(
    { removedNames: { a: now - 100 } },
    { removedNames: { a: now - 500, b: now - 50 } },
  );
  assert(merged.removedNames.a === now - 100, 'newest removal timestamp should win');
  assert(merged.removedNames.b === now - 50, 'other device removal should be unioned in');
}

// Automated test clients are always stripped, regardless of tombstones.
{
  assert(isTestClientName('Cursor Audit Sync 123'), 'cursor audit sync should be a test client');
  assert(isTestClientName('E2E Test Client'), 'e2e test should be a test client');
  assert(!isTestClientName('Casalu'), 'real client should not match test patterns');
  const stripped = stripSuppressedClientNames(
    { names: ['Plume', 'Cursor Audit Sync 9'], colors: { 'Cursor Audit Sync 9': '#000' } },
    new Set(),
  );
  assert(!stripped.names.includes('Cursor Audit Sync 9'), 'test client should be stripped on merge');
  assert(!('Cursor Audit Sync 9' in stripped.colors), 'test client brand map entry should be stripped');
}

// Expired tombstones (older than TTL) stop suppressing so the maps stay bounded.
{
  const old = Date.now() - 200 * 24 * 60 * 60 * 1000;
  const keys = suppressedClientNameKeys({ removedNames: { casalu: old } });
  assert(!keys.has('casalu'), 'expired tombstone should no longer suppress');
}

// A stale base64 logo push must never overwrite a storage-backed (URL) logo.
// This is what keeps the workspace row from re-inflating to >1MB after the
// logo-to-storage migration.
{
  const stored = {
    Plume: { src: 'https://cdn.example.com/medici/plume/logos/abc.png', storagePath: 'medici/plume/logos/abc.png', updatedAt: 2000 },
  };
  const incoming = { Plume: { src: 'data:image/png;base64,AAAA', updatedAt: 0 } };
  const merged = mergeBrandLogoMap(stored, incoming);
  assert(merged.Plume.src.startsWith('https://'), 'storage-backed logo should beat a stale base64 push');
}

// A genuinely newer logo (higher updatedAt) wins even over a storage URL.
{
  const stored = { Plume: { src: 'https://cdn.example.com/old.png', updatedAt: 1000 } };
  const incoming = { Plume: { src: 'https://cdn.example.com/new.png', updatedAt: 5000 } };
  const merged = mergeBrandLogoMap(stored, incoming);
  assert(merged.Plume.src.endsWith('new.png'), 'newest logo (by updatedAt) should win');
}

// New storage logo (with timestamp) wins over an undated legacy base64.
{
  const stored = { Plume: { src: 'data:image/png;base64,LEGACY' } };
  const incoming = { Plume: { src: 'https://cdn.example.com/fresh.png', updatedAt: Date.now() } };
  const merged = mergeBrandLogoMap(stored, incoming);
  assert(merged.Plume.src.startsWith('https://'), 'fresh storage logo should replace legacy base64');
}

// An empty incoming logo still never wipes a stored one (existing guard intact).
{
  const stored = { Plume: { src: 'https://cdn.example.com/keep.png', updatedAt: 10 } };
  const merged = mergeBrandLogoMap(stored, { Plume: null });
  assert(merged.Plume?.src?.endsWith('keep.png'), 'empty incoming logo must not wipe a stored logo');
}

console.log('Sync merge tests passed.');
