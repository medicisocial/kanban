import {
  ADMIN_TASKS_STORAGE_KEY,
  EVENTS_STORAGE_KEY,
  MEETINGS_STORAGE_KEY,
  STORAGE_KEY,
  VIDEO_IDEAS_STORAGE_KEY,
} from '../constants';
import { fetchWorkspace } from '../utils/cloudSync';
import { loadStaffSession } from '../utils/staffAuth';
import { getOrgId, LEGACY_ORG_ID } from './orgSession';

const TABLE_STORAGE_KEYS = {
  cards: STORAGE_KEY,
  video_ideas: VIDEO_IDEAS_STORAGE_KEY,
  meetings: MEETINGS_STORAGE_KEY,
  admin_tasks: ADMIN_TASKS_STORAGE_KEY,
  events: EVENTS_STORAGE_KEY,
};

/** Legacy Upstash workspace blob when Supabase tables are still empty. */
export async function fetchLegacyWorkspaceBlobRows(table) {
  if (getOrgId() !== LEGACY_ORG_ID) return null;

  const storageKey = TABLE_STORAGE_KEYS[table];
  if (!storageKey) return null;

  const session = loadStaffSession();
  if (!session?.username) return null;

  try {
    const { unavailable, workspace } = await fetchWorkspace(session);
    if (unavailable || !workspace?.data) return null;

    const collection = workspace.data[storageKey];
    if (!Array.isArray(collection) || !collection.length) return null;

    return collection
      .filter((record) => record && record.id != null)
      .map((record) => ({
        id: String(record.id),
        data: record,
        updated_at: null,
      }));
  } catch {
    return null;
  }
}
