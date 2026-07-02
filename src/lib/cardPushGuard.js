import { fetchStaffSyncRows } from './staffSyncApi';
import {
  PIPELINE_REGRESSION_AUTH_KEY,
  prepareCardPipelineUpsert,
  stripPipelineInternalFields,
} from '../utils/cardPipelineMerge';

/** Merge outgoing card writes against live cloud rows so stale tabs cannot regress pipeline. */
export async function guardCardPushBatch(
  changed,
  orgId,
  { getId = (record) => record.id } = {},
) {
  if (!changed?.length) return changed;

  const authorized = [];
  const guarded = [];

  for (const record of changed) {
    if (record?.[PIPELINE_REGRESSION_AUTH_KEY]) {
      authorized.push(stripPipelineInternalFields(record));
    } else {
      guarded.push(record);
    }
  }

  if (!guarded.length) return authorized;

  const rows = await fetchStaffSyncRows('cards', orgId);
  const cloudById = new Map(
    (rows || []).map((row) => [String(row.id), row.data && typeof row.data === 'object' ? row.data : {}]),
  );

  const safeGuarded = guarded.map((record) => {
    const cloud = cloudById.get(String(getId(record)));
    if (!cloud) return record;
    return prepareCardPipelineUpsert(cloud, record);
  });

  return [...safeGuarded, ...authorized];
}
