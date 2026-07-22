import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { decideRealtimePayloadAction } from '../src/lib/realtimeStaffScope.js';

assert.equal(
  decideRealtimePayloadAction({ restricted: false, rowClient: 'Ara', allowedClients: ['Plume'] }),
  'apply',
  'company-wide sessions apply realtime inline',
);

assert.equal(
  decideRealtimePayloadAction({ restricted: true, rowClient: 'Ara', allowedClients: null }),
  'refetch',
  'restricted without allowlist defers to staff-sync refetch',
);

assert.equal(
  decideRealtimePayloadAction({ restricted: true, rowClient: 'Ara', allowedClients: ['Plume'] }),
  'drop',
  'restricted drops realtime for clients outside allowlist',
);

assert.equal(
  decideRealtimePayloadAction({ restricted: true, rowClient: 'Plume', allowedClients: ['Plume'] }),
  'apply',
  'restricted may apply realtime for allowlisted clients',
);

assert.equal(
  decideRealtimePayloadAction({ restricted: true, rowClient: '', allowedClients: ['Plume'] }),
  'refetch',
  'restricted with unknown client refetches rather than applying',
);

for (const file of ['useCollectionSync.js', 'useMapSync.js', 'useSingletonSync.js']) {
  const source = readFileSync(new URL(`../src/lib/${file}`, import.meta.url), 'utf8');
  assert.ok(source.includes('decideRealtimePayloadAction'), `${file} gates realtime`);
  assert.ok(source.includes("realtimeAction === 'refetch'"), `${file} refetches when restricted`);
  assert.ok(source.includes("realtimeAction === 'drop'"), `${file} drops out-of-allowlist events`);
}

console.log('test-realtime-staff-scope: ok');
