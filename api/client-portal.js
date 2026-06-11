import {
  getClientSessionFromRequest,
  isClientSessionValid,
} from './_lib/clientPortalAuth.mjs';
import {
  normalizeClientContacts,
  normalizeClientSocialLogins,
} from './_lib/clientProfile.mjs';
import { normalizeClientCompanyFiles } from './_lib/clientCompanyFiles.mjs';
import { normalizeClientSpecialMenus } from './_lib/clientSpecialMenus.mjs';
import {
  fetchPortalBrandProfile,
  fetchBrandPortalUsers,
  fetchBrandContent,
  resolvePortalBrandDisplayName,
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
 * Load the brand profile from normalized client_records via get_brand_profile RPC.
 */
async function loadBrandProfile(orgId, brand) {
  try {
    const profile = await fetchPortalBrandProfile(orgId, brand);
    if (profile) return profile;
  } catch (error) {
    console.error('[client-portal] profile RPC failed:', error?.message || error);
  }
  return null;
}

/**
 * Load brand-scoped content (cards, ideas, plans, events, meetings) by brand_id FK.
 */
async function loadBrandContent(orgId, brand) {
  const content = await fetchBrandContent(orgId, brand);
  if (!content) return null;
  return {
    ...content,
    cards: (content.cards || []).map(stripInternalCardFields),
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
  const [profile, content, displayBrand] = await Promise.all([
    loadBrandProfile(session.orgId, brand),
    loadBrandContent(session.orgId, brand),
    resolvePortalBrandDisplayName(session.orgId, brand),
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
  }

  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  const portalBrand =
    profile?.displayName || displayBrand || profile?.brandKey || brand;
  return res.status(200).json({
    brand: portalBrand,
    orgId: session.orgId || null,
    exportedAt: new Date().toISOString(),
    clientColor: normalizeHexColor(profile?.clientColor) || profile?.clientColor || null,
    clientLogo: profile?.clientLogo || null,
    businessType: businessType || null,
    contacts: normalizeClientContacts(profile?.contacts),
    socialLogins: normalizeClientSocialLogins(profile?.socialLogins),
    companyFiles: normalizeClientCompanyFiles(profile?.companyFiles, businessType),
    deletedCompanyFileIds: Array.isArray(profile?.deletedCompanyFileIds)
      ? profile.deletedCompanyFileIds.map(String)
      : [],
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