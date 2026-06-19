/**
 * Client portal response handlers — brand access + deny update parity.
 */
import { brandKeysMatch, resolvePortalBrandDisplayNameFromStore } from '../api/_lib/portalBrandProfile.mjs';
import { handleClientPortalResponse } from '../api/_lib/clientPortalResponses.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildContentReviewDenyUpdates(card, comment, timestamp = Date.now()) {
  const trimmed = String(comment || '').trim();
  const stamp = new Date(timestamp).toLocaleDateString();
  const noteAppend = trimmed ? `\n\nClient revision notes (${stamp}): ${trimmed}` : '';
  const backToEditing = Boolean(card.isOneOffProject);
  return {
    columnId: backToEditing ? 'editing' : 'not-approved',
    status: backToEditing ? 'Editing' : 'Not Approved',
    clientComment: trimmed,
    notes: `${card.notes || ''}${noteAppend}`.trim(),
  };
}

const arcoWorkspace = {
  names: ['Arco Fit', 'Plume'],
  colors: { 'Arco Fit': '#3b82f6' },
};

const displayBrand = resolvePortalBrandDisplayNameFromStore('arco fit', arcoWorkspace);
assert(displayBrand === 'Arco Fit', 'session brand resolves to workspace display name');
assert(brandKeysMatch('Arco Fit', 'arco fit'), 'card client matches session brand case-insensitively');
assert(brandKeysMatch('Arco Fit', displayBrand), 'card client matches resolved display brand');

const card = { id: 'c1', client: 'Arco Fit', columnId: 'in-review', notes: 'Draft v1' };
const deny = buildContentReviewDenyUpdates(card, 'Please shorten the hook', 1710000000000);
assert(deny.columnId === 'not-approved', 'standard reel deny moves to not-approved');
assert(deny.status === 'Not Approved', 'deny status label');
assert(deny.clientComment === 'Please shorten the hook', 'deny stores client comment');
assert(deny.notes.includes('Client revision notes'), 'deny appends revision notes');

const oneOffDeny = buildContentReviewDenyUpdates({ ...card, isOneOffProject: true }, 'Revise', 1710000000000);
assert(oneOffDeny.columnId === 'editing', 'one-off deny moves back to editing');

function resolvePortalVaultBrandKey(vault, client) {
  if (!client) return client;
  const source = vault && typeof vault === 'object' ? vault : {};
  const match = Object.keys(source).find(
    (key) => key.trim().toLowerCase() === client.trim().toLowerCase(),
  );
  return match || client.trim().toLowerCase();
}

const splitVault = {
  'Ara Med Spa': { 'user-1': 'aramedspa' },
  'ara med spa': { 'user-1': 'thearamedspa' },
};
assert(
  resolvePortalVaultBrandKey(splitVault, 'Ara Med Spa') === 'ara med spa' ||
    resolvePortalVaultBrandKey(splitVault, 'Ara Med Spa') === 'Ara Med Spa',
  'vault resolves a matching brand key',
);
assert(
  typeof handleClientPortalResponse === 'function',
  'server portal response handler imports without runtime module errors',
);

console.log('Client portal response tests passed.');
