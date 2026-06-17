import {
  buildClientRecordUpsertRow,
  patchNeedsBrandProfileRpc,
  patchToRecordColumns,
} from '../src/utils/clientRecordsPatch.js';

const orgId = 'medici';
const brandKey = 'fulshear regional';
const patch = {
  displayName: 'Fulshear Regional',
  contacts: [
    {
      id: 'test-contact-1',
      role: '',
      name: 'Rachel Durham',
      phone: '',
      email: 'rachel@fulshearregional.com',
      avatar: null,
    },
  ],
};

const columns = patchToRecordColumns(patch);
if (!columns.contacts?.[0]?.name) {
  throw new Error('patchToRecordColumns should map contacts');
}

const row = buildClientRecordUpsertRow(orgId, brandKey, patch);
if (row.brand_key !== brandKey || row.org_id !== orgId) {
  throw new Error('buildClientRecordUpsertRow should normalize brand key and org');
}
if (!Array.isArray(row.contacts) || row.contacts.length !== 1) {
  throw new Error('buildClientRecordUpsertRow should include contacts');
}

if (patchNeedsBrandProfileRpc(patch)) {
  throw new Error('contacts patch should not require RPC');
}
if (!patchNeedsBrandProfileRpc({ appendDeletedCompanyFileIds: ['file-1'] })) {
  throw new Error('tombstone patch should require RPC');
}

console.log('Client records patch helper tests passed.');
