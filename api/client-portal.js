import { getRedis, loadWorkspace, saveWorkspace } from './_lib/redis.mjs';
import {
  getClientSessionFromRequest,
  getClientPortalAuthMap,
  isClientSessionValid,
  normalizeBrandUsers,
} from './_lib/clientPortalAuth.mjs';
import {
  normalizeClientContacts,
  normalizeClientSocialLogins,
  mergeClientSocialLogins,
} from './_lib/clientProfile.mjs';

const STORAGE_KEY = 'medici-social-kanban';
const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';
const SHOOT_PLANS_STORAGE_KEY = 'medici-social-shoot-plans';
const EVENTS_STORAGE_KEY = 'medici-social-events';
const CLIENTS_STORAGE_KEY = 'medici-social-clients';
const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getClientSessionFromRequest(req);
  if (!isClientSessionValid(session)) return unauthorized(res);

  const redis = getRedis();
  if (!redis) return unavailable(res);

  const workspace = await loadWorkspace(redis);
  const data = workspace?.data || {};
  const brand = session.brand;
  const clientStore = data[CLIENTS_STORAGE_KEY] || {};
  const colors = clientStore.colors || {};
  const logos = clientStore.logos || {};
  const businessTypes = clientStore.businessTypes || {};
  const contacts = clientStore.contacts || {};
  const socialLogins = clientStore.socialLogins || {};
  const authMap = getClientPortalAuthMap(workspace);
  const brandUsers = normalizeBrandUsers(authMap[brand]);
  const sessionUsername = session.username.trim().toLowerCase();
  const currentUser =
    brandUsers.find((user) => user.username.toLowerCase() === sessionUsername) || null;

  return res.status(200).json({
    brand,
    exportedAt: workspace?.exportedAt || null,
    clientColor: colors[brand] || null,
    clientLogo: logos[brand] || null,
    businessType: normalizeBusinessType(businessTypes[brand] || '') || null,
    contacts: normalizeClientContacts(contacts[brand]),
    socialLogins: normalizeClientSocialLogins(socialLogins[brand]),
    userAvatar: currentUser?.avatar || null,
    userDisplayName: currentUser?.displayName || session.username,
    cards: filterForBrand(data[STORAGE_KEY], brand).map(stripInternalCardFields),
    ideas: filterForBrand(data[VIDEO_IDEAS_STORAGE_KEY], brand),
    plans: filterPlansForBrand(data[SHOOT_PLANS_STORAGE_KEY], brand),
    events: filterForBrand(data[EVENTS_STORAGE_KEY], brand),
  });
}
