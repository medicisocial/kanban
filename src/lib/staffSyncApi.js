import { loadStaffSession } from '../utils/staffAuth';

function staffAuthHeaders() {
  const session = loadStaffSession();
  if (!session?.username || !session?.signature) return null;
  return {
    Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
    'Content-Type': 'application/json',
  };
}

/** Server-side Supabase writes when the browser has staff login but no Supabase JWT. */
export async function pushStaffSync({ table, changed = [], removed = [] }) {
  const headers = staffAuthHeaders();
  if (!headers) return false;
  if (!changed.length && !removed.length) return true;

  const response = await fetch('/api/staff-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      table,
      upserts: changed.map((record) => ({ id: record.id, data: record })),
      deleteIds: removed,
    }),
  });

  return response.ok;
}
