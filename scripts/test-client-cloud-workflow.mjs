/**
 * Cloud client load + save workflow — verifies both paths against live Supabase when configured.
 */
import { mergeClientRecordRowsIntoWorkspace } from '../src/utils/clientRecordsAssembly.js';
import { mergeCloudClientsBlobRemote, mergeOrgSettingsIntoWorkspace } from '../src/utils/clientsWorkspacePush.js';
import { diffBrandProfilePatches } from '../src/utils/clientRecordsAssembly.js';
import { patchBrandProfileRecord, fetchClientRecordRows } from '../api/_lib/brandRecordStore.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── 1. Slim clients blob must never wipe hydrated names ─────────────────────
const hydrated = {
  names: ['Fulshear Regional', 'Plume'],
  contacts: { 'Fulshear Regional': [{ id: '1', name: 'Rachel Durham', email: 'r@x.com' }] },
  colors: { Plume: '#222222' },
};

const slimRemote = {
  names: null,
  colors: { Casalu: '#ffffff' },
  contentTypeColors: { Reel: '#ff0000' },
  removedNames: {},
};

const afterBlob = mergeCloudClientsBlobRemote(hydrated, slimRemote);
assert(afterBlob.names.length === 2, 'slim clients blob merge must preserve client names');
assert(afterBlob.contacts['Fulshear Regional']?.[0]?.name === 'Rachel Durham', 'contacts must survive blob merge');
assert(!afterBlob.colors?.Casalu, 'deprecated brand colors from blob must not overwrite workspace');
assert(afterBlob.contentTypeColors?.Reel === '#ff0000', 'org contentTypeColors should merge from blob');

const orgSettings = {
  removedNames: { casalu: 1 },
  contentTypeColors: { Reel: '#00ff00' },
  customColorPalette: ['#111111'],
};
const afterSettings = mergeOrgSettingsIntoWorkspace(hydrated, orgSettings);
assert(afterSettings.contentTypeColors?.Reel === '#00ff00', 'org settings merge should apply contentTypeColors');
assert(afterSettings.removedNames?.casalu === 1, 'org settings merge should apply removedNames');
assert(afterSettings.names.length === 2, 'org settings merge must preserve client names');

// ── 2. client_records rows populate empty workspace names ───────────────────
const rows = [
  {
    brand_key: 'fulshear regional',
    display_name: 'Fulshear Regional',
    contacts: [{ id: '1', name: 'Rachel Durham', email: 'r@x.com' }],
  },
  {
    brand_key: 'plume',
    display_name: 'Plume',
    client_color: '#222222',
  },
];

const mergedFromRecords = mergeClientRecordRowsIntoWorkspace({ names: [] }, rows);
assert(mergedFromRecords.names.length === 2, 'client_records hydrate must populate names');
assert(mergedFromRecords.names.includes('Fulshear Regional'), 'display names should come from rows');
assert(mergedFromRecords.colors.Plume === '#222222', 'profile fields should hydrate from rows');

// ── 2b. Client filter options populate from hydrated names ──────────────────
import { buildClientFilterOptions } from '../src/utils/clients.js';

const filterOptions = buildClientFilterOptions(mergedFromRecords.names, () => '#111111');
assert(filterOptions.length >= 3, 'filter should include All clients plus hydrated brands');
assert(filterOptions.some((opt) => opt.label === 'Plume'), 'filter should list Plume');
assert(filterOptions.some((opt) => opt.label === 'Fulshear Regional'), 'filter should list Fulshear Regional');

// ── 3. Live Supabase load (medici) ──────────────────────────────────────────
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const orgId = (process.env.VITE_ORG_ID || process.env.ORG_ID || 'medici').trim();

if (url && serviceRole) {
  const liveRows = await fetchClientRecordRows(orgId);
  assert(Array.isArray(liveRows), 'fetchClientRecordRows should return an array');
  assert(liveRows.length >= 1, `expected client_records rows for org ${orgId}, got ${liveRows.length}`);

  const liveMerged = mergeClientRecordRowsIntoWorkspace({ names: [] }, liveRows);
  assert(liveMerged.names.length >= 1, 'live client_records must yield at least one client name');

  // ── 4. Live contact save via patch_brand_profile RPC ──────────────────────
  const patch = {
    displayName: 'Fulshear Regional',
    contacts: [
      {
        id: 'workflow-test-contact',
        role: '',
        name: 'Rachel Durham',
        phone: '',
        email: 'rachel@fulshearregional.com',
        avatar: null,
      },
    ],
  };
  const patches = diffBrandProfilePatches(
    { names: ['Fulshear Regional'], contacts: { 'Fulshear Regional': [] } },
    { names: ['Fulshear Regional'], contacts: { 'Fulshear Regional': patch.contacts } },
    ['Fulshear Regional'],
  );
  assert(patches.length === 1, 'contact edit should produce exactly one patch');
  await patchBrandProfileRecord(orgId, 'fulshear regional', patches[0].patch, orgId);
  console.log(`Live Supabase load: ${liveRows.length} client_records rows, ${liveMerged.names.length} names`);
  console.log('Live Supabase contact save: ok');
} else {
  console.log('Live Supabase checks skipped (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
}

console.log('Client cloud workflow tests passed.');
