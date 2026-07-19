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

/** Ephemeral flag — only present on writes that intentionally move a card backward. */
export const PIPELINE_REGRESSION_AUTH_KEY = '_allowPipelineRegression';

export function isPipelineRegression(fromColumnId, toColumnId) {
  const fromRank = getCardPipelineRank(fromColumnId);
  const toRank = getCardPipelineRank(toColumnId);
  return fromRank >= 0 && toRank >= 0 && toRank < fromRank;
}

export function withPipelineRegressionAuthorization(card, updates = {}) {
  const nextColumnId = updates.columnId ?? card?.columnId;
  if (!isPipelineRegression(card?.columnId, nextColumnId)) return updates;
  return { ...updates, [PIPELINE_REGRESSION_AUTH_KEY]: true };
}

export function stripPipelineInternalFields(record) {
  if (!record || typeof record !== 'object') return record;
  if (!record[PIPELINE_REGRESSION_AUTH_KEY]) return record;
  const next = { ...record };
  delete next[PIPELINE_REGRESSION_AUTH_KEY];
  return next;
}

/**
 * Server-side card upsert prep: honor explicit regression, otherwise keep advanced stage.
 * Authorized regressions keep `_allowPipelineRegression` so the DB `protect_card_pipeline`
 * trigger can allow the backward move and strip the flag itself.
 */
export function prepareCardPipelineUpsert(stored, incoming) {
  if (!incoming) return incoming || stored;
  if (incoming[PIPELINE_REGRESSION_AUTH_KEY]) {
    return {
      ...preserveCardIdeaLink(stored, stripPipelineInternalFields(incoming)),
      [PIPELINE_REGRESSION_AUTH_KEY]: true,
    };
  }
  return mergeCardPipelineFields(stored, stripPipelineInternalFields(incoming));
}

/**
 * Never let a write blank the card→idea link. Losing sourceIdeaId makes the
 * linked bank idea reappear in the vault even though its card is mid-pipeline.
 */
export function preserveCardIdeaLink(stored, incoming) {
  if (!stored || !incoming) return incoming;
  if (incoming.sourceIdeaId || !stored.sourceIdeaId) return incoming;
  return { ...incoming, sourceIdeaId: stored.sourceIdeaId };
}

/** Cards still waiting to be created / shot on set. */
export function isActiveShootQueueCard(card) {
  return Boolean(card && card.columnId === 'shoot');
}

/**
 * Apply a vault-idea shoot schedule without regressing cards that already
 * moved past To Create.
 */
export function applyVaultIdeaShootSchedule(card, schedule, { isNew = false } = {}) {
  if (!schedule?.shootDate) return card;
  const next = {
    ...card,
    shootDate: schedule.shootDate,
    shootTime: schedule.shootTime ?? card.shootTime ?? '',
    shootEndTime: schedule.shootEndTime ?? card.shootEndTime ?? '',
  };
  if (isNew || card.columnId === 'shoot' || !card.columnId) {
    next.columnId = 'shoot';
  }
  return next;
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
    return preserveCardIdeaLink(stored, incoming);
  }

  return preserveCardIdeaLink(stored, {
    ...incoming,
    columnId: stored.columnId,
    status: stored.status ?? incoming.status,
    postedAt: stored.postedAt ?? incoming.postedAt,
    editorCompletedAt: stored.editorCompletedAt ?? incoming.editorCompletedAt,
  });
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

/**
 * Merge content from one card with the pipeline stage from the most advanced copy.
 * Exception: when the newest copy carries `_allowPipelineRegression`, keep its stage
 * so intentional send-backs / backward moves are not snapped forward on pull.
 */
export function mergeCardRecords(...records) {
  const defined = records.filter(Boolean);
  if (!defined.length) return null;
  const stage = resolveCardPipelineStage(...defined);
  const latest = defined.reduce((best, record) => {
    const bestTs = best?.updatedAt || best?.createdAt || 0;
    const recordTs = record?.updatedAt || record?.createdAt || 0;
    return recordTs >= bestTs ? record : best;
  }, defined[0]);

  const sourceIdeaId =
    latest.sourceIdeaId ||
    defined.find((record) => record.sourceIdeaId)?.sourceIdeaId ||
    latest.sourceIdeaId;

  // Intentional regression: trust the newest authorized copy's stage.
  if (latest?.[PIPELINE_REGRESSION_AUTH_KEY]) {
    const authorized = sourceIdeaId ? { ...latest, sourceIdeaId } : { ...latest };
    // Cloud caught up to the same stage (flag already stripped there) — drop local flag.
    const confirmed = defined.some(
      (record) =>
        record !== latest &&
        record?.columnId === latest.columnId &&
        !record[PIPELINE_REGRESSION_AUTH_KEY],
    );
    return confirmed ? stripPipelineInternalFields(authorized) : authorized;
  }

  if (!stage) return sourceIdeaId ? { ...latest, sourceIdeaId } : latest;
  return {
    ...latest,
    columnId: stage.columnId,
    status: stage.status ?? latest.status,
    postedAt: stage.postedAt ?? latest.postedAt,
    editorCompletedAt: stage.editorCompletedAt ?? latest.editorCompletedAt,
    ...(sourceIdeaId ? { sourceIdeaId } : {}),
  };
}
