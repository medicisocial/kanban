// Server-side Supabase access for the auth endpoints. Dependency-free (uses the
// PostgREST REST API via global fetch) so it adds no bundle weight to the
// serverless functions.
//
// Env vars (server-only — never use VITE_ prefix for the service-role key):
//   SUPABASE_SERVICE_ROLE_KEY  (required in production when Supabase URL is set)
//   SUPABASE_URL / SUPABASE_ANON_KEY / ORG_ID  (optional overrides)

export function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
}

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function resolveAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
}

/** Key for server reads (client login, etc.). Prefers service role, falls back to anon. */
export function resolveAuthReadKey() {
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (serviceRole) return serviceRole;
  return resolveAnonKey();
}

function resolveServerKey() {
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (serviceRole) return serviceRole;

  if (isProductionRuntime() && getSupabaseUrl()) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required in production when Supabase URL is set. ' +
        'Add it in Vercel environment variables (never use a VITE_ prefix).',
    );
  }

  return resolveAnonKey();
}

function getDefaultOrgId() {
  return (process.env.ORG_ID || process.env.VITE_ORG_ID || 'medici').trim();
}

function getReadConfig(orgIdOverride) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  const orgId = orgIdOverride || getDefaultOrgId();
  return { url, key, orgId };
}

/** Write paths (staff-sync POST) require the service role in production. */
function getWriteConfig(orgIdOverride) {
  const url = getSupabaseUrl();
  const key = resolveServerKey();
  const orgId = orgIdOverride || getDefaultOrgId();
  return { url, key, orgId };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && resolveAuthReadKey());
}

/** Safe auth lookup check — never throws, unlike isSupabaseConfigured(). */
export function canUseSupabaseForAuth() {
  const url = getSupabaseUrl();
  return Boolean(url && resolveAuthReadKey());
}

/** True when Supabase URL is set but no API key is available for auth reads. */
export function isSupabaseAuthMisconfigured() {
  return Boolean(getSupabaseUrl() && !resolveAuthReadKey());
}

const SERVER_FETCH_TIMEOUT_MS = 10000;
const SERVER_WRITE_TIMEOUT_MS = 55000;

async function fetchWithTimeout(url, options = {}, timeoutMs = SERVER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Supabase request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRows(table, orgIdOverride) {
  const { url, key, orgId } = getReadConfig(orgIdOverride);
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${table}?select=id,data&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetchWithTimeout(endpoint, {
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

/** Full rows for staff-sync reads (includes updated_at for client merge). */
export async function fetchSyncRows(table, orgIdOverride) {
  const { url, key, orgId } = getReadConfig(orgIdOverride);
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${table}?select=id,data,updated_at&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetchWithTimeout(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} sync fetch failed: ${response.status} ${detail}`.trim());
  }

  return response.json();
}

/** Returns an array of each row's `data` payload (or null if not configured). */
export async function fetchCollection(table, orgIdOverride) {
  const rows = await fetchRows(table, orgIdOverride);
  if (!rows) return null;
  return rows.map((row) => row.data);
}

/** Returns an object map of { [row.id]: row.data } (or null if not configured). */
export async function fetchCollectionMap(table, orgIdOverride) {
  const rows = await fetchRows(table, orgIdOverride);
  if (!rows) return null;
  const map = {};
  for (const row of rows) map[row.id] = row.data;
  return map;
}

/**
 * Returns every row across all orgs as { id, org_id, data } (or null if not
 * configured). Used by cross-tenant lookups such as client-portal login, where
 * the org owning a brand is not known until the credentials are matched.
 */
async function fetchRowsAcrossOrgsWithKey(table, key) {
  const url = getSupabaseUrl();
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${table}?select=id,org_id,data`;
  const response = await fetchWithTimeout(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} cross-org fetch failed: ${response.status} ${detail}`.trim());
  }

  return response.json();
}

async function fetchRowsForOrgWithKey(table, orgId, key) {
  const url = getSupabaseUrl();
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${table}?select=id,data&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetchWithTimeout(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} org fetch failed: ${response.status} ${detail}`.trim());
  }

  return response.json();
}

export async function fetchRowsAcrossOrgs(table) {
  const key = resolveAuthReadKey();
  return fetchRowsAcrossOrgsWithKey(table, key);
}

/**
 * Client portal login: service role reads all orgs; anon key reads the legacy org only
 * (RLS allows select on org_id = medici).
 */
export async function fetchClientPortalCredentialsRows() {
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (serviceRole) {
    try {
      const rows = await fetchRowsAcrossOrgsWithKey('client_portal_credentials', serviceRole);
      if (rows) return rows;
    } catch (error) {
      console.warn(
        '[supabase] client_portal_credentials cross-org failed:',
        error?.message || error,
      );
    }
  }

  const orgId = getDefaultOrgId();
  const key = resolveAuthReadKey();
  if (!key) return null;

  const rows = await fetchRowsForOrgWithKey('client_portal_credentials', orgId, key);
  return (rows || []).map((row) => ({
    id: row.id,
    org_id: orgId,
    data: row.data,
  }));
}

/** Returns a single record's `data` payload (or null if missing / not configured). */
export async function fetchRecord(table, id, orgIdOverride, timeoutMs = SERVER_FETCH_TIMEOUT_MS) {
  const { url, key, orgId } = getReadConfig(orgIdOverride);
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${table}?select=data&id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetchWithTimeout(
    endpoint,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    },
    timeoutMs,
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} fetchRecord failed: ${response.status} ${detail}`.trim());
  }
  const rows = await response.json();
  return rows?.[0]?.data ?? null;
}

/** Read one brand's normalized portal password vault (portal_password_vault table). */
export async function getPortalPasswordVault(brand, orgIdOverride) {
  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) throw new Error('Supabase is not configured.');
  if (!brand) throw new Error('Missing brand for portal password vault read.');

  const endpoint = `${url}/rest/v1/rpc/get_portal_password_vault`;
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_org_id: orgId,
        p_brand_key: String(brand).trim().toLowerCase(),
      }),
    },
    SERVER_FETCH_TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase portal vault read failed: ${response.status} ${detail}`.trim());
  }
  const payload = await response.json();
  return payload && typeof payload === 'object' ? payload : {};
}

/** Patch one brand's normalized portal password vault (portal_password_vault table). */
export async function patchPortalPasswordVault(brand, brandVault, orgIdOverride) {
  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) throw new Error('Supabase is not configured.');
  if (!brand) throw new Error('Missing brand for portal password vault patch.');

  const endpoint = `${url}/rest/v1/rpc/patch_portal_password_vault`;
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_org_id: orgId,
        p_brand_key: String(brand).trim().toLowerCase(),
        p_brand_vault: brandVault && typeof brandVault === 'object' ? brandVault : {},
      }),
    },
    SERVER_WRITE_TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase portal vault patch failed: ${response.status} ${detail}`.trim());
  }
}

/** Patch one brand's portal password vault on the legacy clients workspace blob. */
export async function patchClientsPortalPasswordVault(brand, brandVault, orgIdOverride) {
  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) throw new Error('Supabase is not configured.');
  if (!brand) throw new Error('Missing brand for portal password vault patch.');

  const endpoint = `${url}/rest/v1/rpc/patch_clients_portal_password_vault`;
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_org_id: orgId,
        p_brand: brand,
        p_brand_vault: brandVault && typeof brandVault === 'object' ? brandVault : {},
      }),
    },
    SERVER_WRITE_TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase portal vault patch failed: ${response.status} ${detail}`.trim());
  }
}

/** Inserts or updates a single record (upsert on the (org_id, id) primary key). */
export async function upsertRecord(table, id, data, orgIdOverride) {
  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) throw new Error('Supabase is not configured.');

  const endpoint = `${url}/rest/v1/${table}`;
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{ id, org_id: orgId, data, updated_at: new Date().toISOString() }]),
    },
    SERVER_WRITE_TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} upsert failed: ${response.status} ${detail}`.trim());
  }
}

/** Deletes a single record by id. */
export async function deleteRecord(table, id, orgIdOverride) {
  await deleteRecords(table, [id], orgIdOverride);
}

/** Deletes multiple records by id. */
export async function deleteRecords(table, ids, orgIdOverride) {
  const list = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!list.length) return;

  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) throw new Error('Supabase is not configured.');

  const idFilter = list.map((id) => encodeURIComponent(id)).join(',');
  const endpoint = `${url}/rest/v1/${table}?org_id=eq.${encodeURIComponent(orgId)}&id=in.(${idFilter})`;
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} delete failed: ${response.status} ${detail}`.trim());
  }
}

/** Inserts or updates multiple records. */
export async function upsertRecords(table, records, orgIdOverride) {
  const rows = (records || []).filter((record) => record?.id);
  if (!rows.length) return;

  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) throw new Error('Supabase is not configured.');

  const payload = rows.map(({ id, data }) => ({
    id: String(id),
    org_id: orgId,
    data,
    updated_at: new Date().toISOString(),
  }));

  const endpoint = `${url}/rest/v1/${table}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} upsert failed: ${response.status} ${detail}`.trim());
  }
}
