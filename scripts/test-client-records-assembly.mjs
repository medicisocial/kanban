import {
  brandProfilePatchFromWorkspaceBrand,
  diffBrandProfilePatches,
  mergeClientRecordRowsIntoWorkspace,
} from '../src/utils/clientRecordsAssembly.js';
import { slimClientsWorkspaceForCloudPush } from '../src/utils/clientsWorkspacePush.js';

const workspace = {
  names: ['Arco Fit', 'Plume'],
  colors: { 'Arco Fit': '#111111' },
  contacts: { Plume: [{ name: 'Owner' }] },
  contentTypeColors: { Reel: '#ff0000' },
  logos: {},
};

const rows = [
  {
    display_name: 'Plume',
    brand_key: 'plume',
    client_color: '#222222',
    contacts: [{ name: 'Cloud Owner' }],
  },
];

const merged = mergeClientRecordRowsIntoWorkspace(workspace, rows);
if (merged.colors.Plume !== '#222222') {
  throw new Error('mergeClientRecordRowsIntoWorkspace should apply client_color');
}
if (!Array.isArray(merged.contacts.Plume) || merged.contacts.Plume[0]?.name !== 'Cloud Owner') {
  throw new Error('mergeClientRecordRowsIntoWorkspace should apply contacts');
}
if (!merged.names.includes('Plume') || merged.names.length !== 2) {
  throw new Error('mergeClientRecordRowsIntoWorkspace should preserve and union client names');
}

const namesOnly = mergeClientRecordRowsIntoWorkspace({ names: [] }, rows);
if (!namesOnly.names.includes('Plume') || namesOnly.names.length !== 1) {
  throw new Error('mergeClientRecordRowsIntoWorkspace should derive names from client_records rows');
}

const patches = diffBrandProfilePatches(
  workspace,
  {
    ...workspace,
    colors: { ...workspace.colors, 'Arco Fit': '#333333' },
  },
  ['Arco Fit'],
);
if (patches.length !== 1 || patches[0].brandKey !== 'arco fit') {
  throw new Error('diffBrandProfilePatches should detect color change');
}

const patch = brandProfilePatchFromWorkspaceBrand('Plume', merged);
if (patch.clientColor !== '#222222') {
  throw new Error('brandProfilePatchFromWorkspaceBrand should include color');
}

const slim = slimClientsWorkspaceForCloudPush(workspace);
if (slim.colors || slim.contacts) {
  throw new Error('slimClientsWorkspaceForCloudPush should omit per-brand maps');
}
if (slim.names) {
  throw new Error('slimClientsWorkspaceForCloudPush should omit names (brands table is source of truth)');
}
if (!slim.contentTypeColors) {
  throw new Error('slimClientsWorkspaceForCloudPush should keep org-level keys');
}

const araRows = [
  {
    display_name: 'Ara Med Spa',
    brand_key: 'ara med spa',
    client_color: '#ec4899',
  },
];
const araMerged = mergeClientRecordRowsIntoWorkspace({ names: ['ara med spa'] }, araRows);
if (!araMerged.names.includes('Ara Med Spa')) {
  throw new Error('mergeClientRecordRowsIntoWorkspace should canonicalize ara med spa display name');
}
if (araMerged.colors['Ara Med Spa'] !== '#ec4899' && araMerged.colors['ara med spa'] !== '#ec4899') {
  throw new Error('mergeClientRecordRowsIntoWorkspace should apply color under canonical client name');
}

const localContacts = mergeClientRecordRowsIntoWorkspace(
  { names: ['Plume'], contacts: { Plume: [{ name: 'Local Owner', email: 'local@test.com' }] } },
  [{ display_name: 'Plume', brand_key: 'plume', contacts: [] }],
);
if (localContacts.contacts.Plume?.[0]?.name !== 'Local Owner') {
  throw new Error('mergeClientRecordRowsIntoWorkspace should not stomp local contacts with empty cloud rows');
}

const aliasedPatch = brandProfilePatchFromWorkspaceBrand('Plume', {
  contacts: { plume: [{ name: 'Aliased Owner' }] },
});
if (aliasedPatch.contacts?.[0]?.name !== 'Aliased Owner') {
  throw new Error('brandProfilePatchFromWorkspaceBrand should resolve brand-key aliases');
}

console.log('Client records assembly tests passed.');
