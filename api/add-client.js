import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import { fetchRecord, isSupabaseConfigured, upsertRecord } from './_lib/supabase.mjs';
import {
  brandProfilePatchFromWorkspaceBrand,
  fetchOrgBrandNames,
  patchBrandProfileRecord,
} from './_lib/brandRecordStore.mjs';
import {
  fetchClientBrandNameRow,
  isInternalClientBrandName,
  normalizeClientBrandName,
  releaseClientBrandNameOnServer,
  reserveClientBrandNameOnServer,
  upsertClientRecordOnServer,
} from './_lib/clientBrandNames.mjs';

function unauthorized(res) {
  return res.status(401).json({ ok: false, error: 'Sign in to add a client.' });
}

function unavailable(res) {
  return res.status(503).json({ ok: false, error: 'Cloud sync is not configured.' });
}

function isLikelyJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

function normalizeDisplayName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function workspaceHasClientName(names, displayName) {
  const key = normalizeClientBrandName(displayName);
  return (Array.isArray(names) ? names : []).some(
    (name) => normalizeClientBrandName(name) === key,
  );
}

async function resolveExistingBrandName(orgId, displayName) {
  const names = await fetchOrgBrandNames(orgId);
  const key = normalizeClientBrandName(displayName);
  return names.find((name) => normalizeClientBrandName(name) === key) || null;
}

async function verifySupabaseAccessToken(token) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || !token) return false;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

async function isAuthorized(req) {
  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) return true;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (!isLikelyJwt(token)) return false;

  try {
    return await verifySupabaseAccessToken(token);
  } catch {
    return false;
  }
}

/**
 * Atomically reserve a brand name and persist the client on the server workspace.
 * Heals orphaned reservations when the global lock succeeded but sync dropped the name.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const { displayName, color, logo, businessType, orgId } = req.body || {};
  const display = normalizeDisplayName(displayName);
  if (!display) {
    return res.status(400).json({ ok: false, error: 'Please enter a client name.' });
  }
  if (isInternalClientBrandName(display)) {
    return res.status(400).json({ ok: false, error: 'That client name is reserved.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ ok: false, error: orgCheck.error || 'Forbidden org scope.' });
  }
  const resolvedOrgId = orgCheck.orgId;

  let reservedName = null;

  try {
    const orgBrandNames = await fetchOrgBrandNames(resolvedOrgId);
    const existingInOrg = await resolveExistingBrandName(resolvedOrgId, display);
    if (existingInOrg) {
      return res.status(200).json({
        ok: true,
        name: existingInOrg,
        healed: false,
        alreadyInWorkspace: true,
        clientsPatch: {
          names: [...orgBrandNames],
          colors: {},
          logos: {},
          businessTypes: {},
        },
      });
    }

    const existingRow = await fetchClientBrandNameRow(display);
    if (existingRow && existingRow.org_id !== resolvedOrgId) {
      return res.status(409).json({
        ok: false,
        error: 'A client with that name already exists on Medici Social. Choose a different name.',
      });
    }

    let healed = false;
    let resolvedName = existingRow?.display_name || display;
    const nextColor = typeof color === 'string' && color.trim() ? color.trim() : '#9ca3af';

    // client_brand_names FK requires a client_records row before the name lock insert.
    await upsertClientRecordOnServer(resolvedOrgId, resolvedName, {
      color: nextColor,
      logo,
      businessType,
    });

    if (!existingRow) {
      const reserved = await reserveClientBrandNameOnServer(resolvedOrgId, display);
      if (!reserved.ok) {
        return res.status(409).json(reserved);
      }
      reservedName = reserved.name || display;
      resolvedName = reservedName;
    } else {
      healed = true;
    }

    const nextNames = [...orgBrandNames, resolvedName];
    const slimWorkspace = {
      colors: { [resolvedName]: nextColor },
      logos: logo ? { [resolvedName]: logo } : {},
      businessTypes: businessType ? { [resolvedName]: businessType } : {},
    };

    const workspace = (await fetchRecord('clients', 'workspace', resolvedOrgId)) || {};

    await upsertClientRecordOnServer(resolvedOrgId, resolvedName, {
      color: nextColor,
      logo,
      businessType,
    });

    await patchBrandProfileRecord(
      resolvedOrgId,
      resolvedName,
      brandProfilePatchFromWorkspaceBrand(resolvedName, slimWorkspace),
    );

    await upsertRecord(
      'clients',
      'workspace',
      {
        removedNames: workspace.removedNames || [],
        restoredNames: { ...(workspace.restoredNames || {}), [normalizeClientBrandName(resolvedName)]: Date.now() },
        contentTypeColors: workspace.contentTypeColors || {},
        customColorPalette: workspace.customColorPalette || [],
      },
      resolvedOrgId,
    );

    return res.status(200).json({
      ok: true,
      name: resolvedName,
      healed,
      alreadyInWorkspace: false,
      clientsPatch: {
        names: nextNames,
        colors: slimWorkspace.colors,
        logos: slimWorkspace.logos,
        businessTypes: slimWorkspace.businessTypes,
      },
    });
  } catch (error) {
    console.error('[add-client] failed:', error?.message || error);
    if (reservedName) {
      await releaseClientBrandNameOnServer(resolvedOrgId, reservedName).catch(() => {});
    }
    return res.status(500).json({
      ok: false,
      error: 'Could not add client. Try again in a moment.',
    });
  }
}
