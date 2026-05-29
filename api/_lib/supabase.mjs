// Server-side Supabase access for the auth endpoints. Dependency-free (uses the
// PostgREST REST API via global fetch) so it adds no bundle weight to the
// serverless functions.
//
// Reads project env vars. The VITE_-prefixed vars are also available to the
// serverless runtime on Vercel, so this works with the same values the client
// build uses. A dedicated server key can be added later:
//   SUPABASE_SERVICE_ROLE_KEY  (preferred — bypasses RLS, never sent to the client)
//   SUPABASE_URL / SUPABASE_ANON_KEY / ORG_ID

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  const orgId = process.env.ORG_ID || process.env.VITE_ORG_ID || 'medici';
  return { url: url.replace(/\/$/, ''), key, orgId };
}

export function isSupabaseConfigured() {
  const { url, key } = getConfig();
  return Boolean(url && key);
}

async function fetchRows(table) {
  const { url, key, orgId } = getConfig();
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${table}?select=id,data&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} fetch failed: ${response.status} ${detail}`.trim());
  }

  return response.json();
}

/** Returns an array of each row's `data` payload (or null if not configured). */
export async function fetchCollection(table) {
  const rows = await fetchRows(table);
  if (!rows) return null;
  return rows.map((row) => row.data);
}

/** Returns an object map of { [row.id]: row.data } (or null if not configured). */
export async function fetchCollectionMap(table) {
  const rows = await fetchRows(table);
  if (!rows) return null;
  const map = {};
  for (const row of rows) map[row.id] = row.data;
  return map;
}

/** Returns a single record's `data` payload (or null if missing / not configured). */
export async function fetchRecord(table, id) {
  const { url, key, orgId } = getConfig();
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${table}?select=data&id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} fetchRecord failed: ${response.status} ${detail}`.trim());
  }
  const rows = await response.json();
  return rows?.[0]?.data ?? null;
}

/** Inserts or updates a single record (upsert on the (org_id, id) primary key). */
export async function upsertRecord(table, id, data) {
  const { url, key, orgId } = getConfig();
  if (!url || !key) throw new Error('Supabase is not configured.');

  const endpoint = `${url}/rest/v1/${table}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([{ id, org_id: orgId, data, updated_at: new Date().toISOString() }]),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} upsert failed: ${response.status} ${detail}`.trim());
  }
}

/** Deletes a single record by id. */
export async function deleteRecord(table, id) {
  const { url, key, orgId } = getConfig();
  if (!url || !key) throw new Error('Supabase is not configured.');

  const endpoint = `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} delete failed: ${response.status} ${detail}`.trim());
  }
}
