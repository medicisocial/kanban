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
if (!Array.isArray(slim.names) || !slim.contentTypeColors) {
  throw new Error('slimClientsWorkspaceForCloudPush should keep org-level keys');
}

console.log('Client records assembly tests passed.');
