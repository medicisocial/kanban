/** Latest updatedAt across a list of records that carry an updatedAt field. */
export function maxRecordUpdatedAt(records) {
  if (!Array.isArray(records) || !records.length) return 0;
  return records.reduce((max, record) => Math.max(max, Number(record?.updatedAt) || 0), 0);
}

/**
 * True when local editor state is strictly newer than incoming props — props sync
 * should be skipped so a lagging cloud read cannot wipe an upload in progress.
 */
export function incomingRecordsAreStale(local, incoming) {
  return maxRecordUpdatedAt(local) > maxRecordUpdatedAt(incoming);
}
