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
  fetchBrandPortalUsers,
  fetchBrandContent,
  filterContentByBrand,
  filterPlansByBrand,
} from './_lib/portalBrandProfile.mjs';
import { isSupabaseConfigured } from './_lib/supabase.mjs';
import { normalizeHexColor } from './_lib/colorHex.mjs';
import { normalizeContentTypeColors } from './_lib/contentTypeColors.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

function normalizeBusinessType(businessType) {
  if (businessType === 'Cocktail Lounge' || businessType === 'Sports Bar') {
    return 'Hospitality';
  }
  return businessType || '';
}

function stripInternalCardFields(card) {
  if (!card || typeof card !== 'object') return card;
  const { assignedTo, contentCreator, accountManager, ...clientSafe } = card;
  return clientSafe;
}

/**
 * Load the brand profile using the new normalized architecture.
 * Prefers get_brand_profile RPC → legacy get_portal_brand_profile → blob fallback.
 */
async function loadBrandProfile(orgId, brand) {
  try {
    const profile = await fetchPortalBrandProfile(orgId, brand);
    if (profile) return profile;
  } catch (error) {
    console.error('[client-portal] profile RPC failed:', error?.message || error);
  }

  // Legacy fallback: resolve from the clients workspace blob
  try {
    const workspace = await loadPortalWorkspace(orgId);
    if (!workspace) return null;
    const data = workspace?.data || {};
    const clientStore = data[CLIENTS_STORAGE_KEY] || {};
    const { resolveBrandProfileFromStore } = await import('./_lib/portalBrandProfile.mjs');
    return resolveBrandProfileFromStore(clientStore, brand);
  } catch (error) {
    console.error('[client-portal] blob profile fallback failed:', error?.message || error);
    return null;
  }
}

/**
 * Load brand-scoped content (cards, ideas, plans, events, meetings) using
 * the normalized brand_id FK. Falls back to filtering the workspace blob.
 */
async function loadBrandContent(orgId, brand) {
  const loadFromBlob = async () => {
    const workspace = await loadPortalWorkspace(orgId);
    if (!workspace) return null;

    const data = workspace?.data || {};
    return {
      cards: filterContentByBrand(data[STORAGE_KEY], brand).map(stripInternalCardFields),
      ideas: filterContentByBrand(data[VIDEO_IDEAS_STORAGE_KEY] || data.video_ideas, brand),
      plans: filterPlansByBrand(data[SHOOT_PLANS_STORAGE_KEY] || data.shoot_plans, brand),
      events: filterContentByBrand(data[EVENTS_STORAGE_KEY] || data.events, brand),
      meetings: filterContentByBrand(data[MEETINGS_STORAGE_KEY] || data.meetings, brand),
    };
  };

  const [scoped, blob] = await Promise.all([fetchBrandContent(orgId, brand), loadFromBlob()]);
  if (!scoped && !blob) return null;
  if (!scoped) return blob;
  if (!blob) return scoped;

  // Normalized tables may be partially migrated — keep blob data when a section is empty.
  return {
    cards: scoped.cards?.length ? scoped.cards : blob.cards,
    ideas: scoped.ideas?.length ? scoped.ideas : blob.ideas,
    plans: Object.keys(scoped.plans || {}).length ? scoped.plans : blob.plans,
    events: scoped.events?.length ? scoped.events : blob.events,
    meetings: scoped.meetings?.length ? scoped.meetings : blob.meetings,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getClientSessionFromRequest(req);
  if (!isClientSessionValid(session)) return unauthorized(res);

  // For Supabase-backed deployments, sessions created without an orgId cannot
  // target the correct tenant. Force re-login.
  if (isSupabaseConfigured() && !session.orgId) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  const brand = session.brand;

  // Load brand profile and content in parallel
  const [profile, content] = await Promise.all([
    loadBrandProfile(session.orgId, brand),
    loadBrandContent(session.orgId, brand),
  ]);

  if (!profile && !content) {
    return unavailable(res);
  }

  const businessType = normalizeBusinessType(profile?.businessType || '');
  const contentTypeColors = normalizeContentTypeColors(profile?.contentTypeColors || {});

  // Resolve the current user's display info from portal_users via the new RPC
  let userAvatar = null;
  let userDisplayName = session.username;
  try {
    const portalUsers = await fetchBrandPortalUsers(session.orgId, brand);
    if (portalUsers.length > 0) {
      const sessionUsername = session.username.trim().toLowerCase();
      const currentUser = portalUsers.find(
        (user) => user.username.toLowerCase() === sessionUsername,
      );
      if (currentUser) {
        userAvatar = currentUser.avatar || null;
        userDisplayName = currentUser.displayName || session.username;
      }
    }
  } catch (error) {
    console.warn('[client-portal] portal user lookup failed:', error?.message || error);
    // Fall back to legacy auth map lookup
    try {
      const workspace = await loadPortalWorkspace(session.orgId);
      if (workspace) {
        const authMap = getClientPortalAuthMap(workspace);
        const brandUsers = normalizeBrandUsers(authMap[brand]);
        const sessionUsername = session.username.trim().toLowerCase();
        const currentUser = brandUsers.find(
          (user) => user.username.toLowerCase() === sessionUsername,
        ) || null;
        if (currentUser) {
          userAvatar = currentUser.avatar || null;
          userDisplayName = currentUser.displayName || session.username;
        }
      }
    } catch {
      // ignore
    }
  }

  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return res.status(200).json({
    brand,
    orgId: session.orgId || null,
    exportedAt: new Date().toISOString(),
    clientColor: normalizeHexColor(profile?.clientColor) || profile?.clientColor || null,
    clientLogo: profile?.clientLogo || null,
    businessType: businessType || null,
    contacts: normalizeClientContacts(profile?.contacts),
    socialLogins: normalizeClientSocialLogins(profile?.socialLogins),
    companyFiles: normalizeClientCompanyFiles(profile?.companyFiles, businessType),
    specialMenus: normalizeClientSpecialMenus(profile?.specialMenus),
    photoGalleryLink: profile?.photoGalleryLink || null,
    contentTypeColors,
    userAvatar,
    userDisplayName,
    cards: content?.cards || [],
    ideas: content?.ideas || [],
    plans: content?.plans || {},
    events: content?.events || [],
    meetings: content?.meetings || [],
  });
}