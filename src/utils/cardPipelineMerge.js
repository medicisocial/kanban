/** Pipeline order — higher rank means further along production. */
export const CARD_PIPELINE_RANK = {
  shoot: 0,
  editing: 1,
  'in-review': 2,
  'not-approved': 3,
  approved: 4,
  scheduled: 5,
  finished: 6,
};

export function getCardPipelineRank(columnId) {
  return CARD_PIPELINE_RANK[columnId] ?? -1;
}

/** Cards still waiting to be created / shot on set. */
export function isActiveShootQueueCard(card) {
  return Boolean(card && card.columnId === 'shoot');
}

/**
 * Prevent stale full-record upserts from moving cards backward in the pipeline
 * (e.g. scheduled → shoot) while still accepting other field updates.
 */
export function mergeCardPipelineFields(stored, incoming) {
  if (!stored || !incoming) return incoming || stored;

  const storedRank = getCardPipelineRank(stored.columnId);
  const incomingRank = getCardPipelineRank(incoming.columnId);
  if (storedRank < 0 || incomingRank < 0 || incomingRank >= storedRank) {
    return incoming;
  }

  return {
    ...incoming,
    columnId: stored.columnId,
    status: stored.status ?? incoming.status,
    postedAt: stored.postedAt ?? incoming.postedAt,
  };
}

/** Keep the furthest-along pipeline stage when reconciling conflicting card copies. */
export function resolveCardPipelineStage(...records) {
  return records.reduce((best, record) => {
    if (!record?.columnId) return best;
    if (!best || getCardPipelineRank(record.columnId) > getCardPipelineRank(best.columnId)) {
      return record;
    }
    return best;
  }, null);
}

/** Merge content from one card with the pipeline stage from the most advanced copy. */
export function mergeCardRecords(...records) {
  const defined = records.filter(Boolean);
  if (!defined.length) return null;
  const stage = resolveCardPipelineStage(...defined);
  const latest = defined.reduce((best, record) => {
    const bestTs = best?.updatedAt || best?.createdAt || 0;
    const recordTs = record?.updatedAt || record?.createdAt || 0;
    return recordTs >= bestTs ? record : best;
  }, defined[0]);

  if (!stage) return latest;
  return {
    ...latest,
    columnId: stage.columnId,
    status: stage.status ?? latest.status,
    postedAt: stage.postedAt ?? latest.postedAt,
  };
}
