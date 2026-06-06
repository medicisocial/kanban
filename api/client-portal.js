import {
  getClientSessionFromRequest,
  getClientPortalAuthMap,
  isClientSessionValid,
  normalizeBrandUsers,
} from './_lib/clientPortalAuth.mjs';
import {
  normalizeClientContacts,
  normalizeClientSocialLogins,
} from './_lib/clientProfile.mjs';
import { normalizeClientCompanyFiles } from './_lib/clientCompanyFiles.mjs';
import { normalizeClientSpecialMenus } from './_lib/clientSpecialMenus.mjs';
import {
  CLIENTS_STORAGE_KEY,
  EVENTS_STORAGE_KEY,
  MEETINGS_STORAGE_KEY,
  SHOOT_PLANS_STORAGE_KEY,
  STORAGE_KEY,
  VIDEO_IDEAS_STORAGE_KEY,
  loadPortalWorkspace,
} from './_lib/portalWorkspace.mjs';
import {
  fetchPortalBrandProfile,
  resolveBrandProfileFromStore,
} from './_lib/portalBrandProfile.mjs';
import { normalizeHexColor } from './_lib/colorHex.mjs';
import { normalizeContentTypeColors } from './_lib/contentTypeColors.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

function filterForBrand(items, brand) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item?.client === brand);
}

function filterPlansForBrand(plans, brand) {
  if (!plans || typeof plans !== 'object') return {};
  const filtered = {};
  for (const [key, plan] of Object.entries(plans)) {
    if (plan?.client === brand) filtered[key] = plan;
  }
  return filtered;
}

function stripInternalCardFields(card) {
  if (!card || typeof card !== 'object') return card;
  const { assignedTo, contentCreator, accountManager, ...clientSafe } = card;
  return clientSafe;
}

function normalizeBusinessType(businessType) {
  if (businessType === 'Cocktail Lounge' || businessType === 'Sports Bar') {
    return 'Hospitality';
  }
  return businessType || '';
}

async function loadBrandProfile(orgId, brand, clientStore) {
  try {
    const profile = await fetchPortalBrandProfile(orgId, brand);
    if (profile) return profile;
  } catch (error) {
    console.error('[client-portal] profile RPC failed:', error?.message || error);
  }
  return resolveBrandProfileFromStore(clientStore, brand);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getClientSessionFromRequest(req);
  if (!isClientSessionValid(session)) return unauthorized(res);

  // For Supabase-backed deployments, sessions created without an orgId (issued
  // before multi-tenant support) cannot target the correct tenant. Force re-login.
  const { isSupabaseConfigured } = await import('./_lib/supabase.mjs');
  if (isSupabaseConfigured() && !session.orgId) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  const workspace = await loadPortalWorkspace(session.orgId);
  if (!workspace) return unavailable(res);

  const data = workspace?.data || {};
  const brand = session.brand;
  const clientStore = data[CLIENTS_STORAGE_KEY] || {};
  const profile = await loadBrandProfile(session.orgId, brand, clientStore);
  const businessType = normalizeBusinessType(profile.businessType || '');
  const contentTypeColors = normalizeContentTypeColors(profile.contentTypeColors || {});
  const authMap = getClientPortalAuthMap(workspace);
  const brandUsers = normalizeBrandUsers(authMap[brand]);
  const sessionUsername = session.username.trim().toLowerCase();
  const currentUser =
    brandUsers.find((user) => user.username.toLowerCase() === sessionUsername) || null;

  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return res.status(200).json({
    brand,
    orgId: session.orgId || null,
    exportedAt: workspace?.exportedAt || null,
    clientColor: normalizeHexColor(profile.clientColor) || profile.clientColor || null,
    clientLogo: profile.clientLogo || null,
    businessType: businessType || null,
    contacts: normalizeClientContacts(profile.contacts),
    socialLogins: normalizeClientSocialLogins(profile.socialLogins),
    companyFiles: normalizeClientCompanyFiles(profile.companyFiles, businessType),
    specialMenus: normalizeClientSpecialMenus(profile.specialMenus),
    photoGalleryLink: profile.photoGalleryLink || null,
    contentTypeColors,
    userAvatar: currentUser?.avatar || null,
    userDisplayName: currentUser?.displayName || session.username,
    cards: filterForBrand(data[STORAGE_KEY], brand).map(stripInternalCardFields),
    ideas: filterForBrand(data[VIDEO_IDEAS_STORAGE_KEY], brand),
    plans: filterPlansForBrand(data[SHOOT_PLANS_STORAGE_KEY], brand),
    events: filterForBrand(data[EVENTS_STORAGE_KEY], brand),
    meetings: filterForBrand(data[MEETINGS_STORAGE_KEY], brand),
  });
}
