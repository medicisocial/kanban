/**
 * Brand profile save chain — partial patches, single-client sync scope, RPC path.
 */
import { diffBrandProfilePatches } from '../src/utils/clientRecordsAssembly.js';
import { patchBrandProfileRecord } from '../api/_lib/brandRecordStore.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const workspace = {
  names: ['Fulshear Regional', 'Plume'],
  colors: { 'Fulshear Regional': '#111111', Plume: '#222222' },
  contacts: {
    'Fulshear Regional': [],
    Plume: [{ id: 'p1', name: 'Owner', role: '', phone: '', email: '', avatar: null }],
  },
};

const nextContacts = [
  {
    id: 'c1',
    role: '',
    name: 'Rachel Durham',
    phone: '',
    email: 'rachel@fulshearregional.com',
    avatar: null,
  },
];

const next = {
  ...workspace,
  contacts: {
    ...workspace.contacts,
    'Fulshear Regional': nextContacts,
  },
};

const allClientPatches = diffBrandProfilePatches(workspace, next, workspace.names);
const singleClientPatches = diffBrandProfilePatches(workspace, next, ['Fulshear Regional']);

assert(allClientPatches.length === 1, 'only Fulshear contacts should change across workspace');
assert(singleClientPatches.length === 1, 'single-client diff should produce one patch');
assert(
  singleClientPatches[0].brandKey === 'fulshear regional',
  'brand key should normalize to lowercase',
);
assert(Array.isArray(singleClientPatches[0].patch.contacts), 'patch should include contacts');
assert(
  singleClientPatches[0].patch.contacts[0].email === 'rachel@fulshearregional.com',
  'contact email should be preserved in patch',
);
assert(
  !('clientLogo' in singleClientPatches[0].patch),
  'contacts-only patch must stay partial (no logo field)',
);

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (url && serviceRole) {
  await patchBrandProfileRecord('medici', 'fulshear regional', singleClientPatches[0].patch, 'medici');
  console.log('Live Supabase patch_brand_profile save: ok');
} else {
  console.log('Live Supabase patch skipped (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run integration check).');
}

console.log('Brand profile save tests passed.');
