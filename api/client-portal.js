import { getRedis, loadWorkspace, saveWorkspace } from './_lib/redis.mjs';
import {
  getClientSessionFromRequest,
  isClientSessionValid,
} from './_lib/clientPortalAuth.mjs';

const STORAGE_KEY = 'medici-social-kanban';
const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';
const SHOOT_PLANS_STORAGE_KEY = 'medici-social-shoot-plans';
const CLIENTS_STORAGE_KEY = 'medici-social-clients';
const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';
const CONTENT_REVIEW_RESPONSES_KEY = 'medici-social-content-review-responses';

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

  return res.status(200).json({
    brand,
    exportedAt: workspace?.exportedAt || null,
    clientColor: colors[brand] || null,
    cards: filterForBrand(data[STORAGE_KEY], brand),
    ideas: filterForBrand(data[VIDEO_IDEAS_STORAGE_KEY], brand),
    plans: filterPlansForBrand(data[SHOOT_PLANS_STORAGE_KEY], brand),
  });
}
