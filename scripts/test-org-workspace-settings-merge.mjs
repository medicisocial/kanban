/**
 * Org workspace settings write merge — stale empty removedNames cannot wipe tombstones.
 */
import assert from 'node:assert/strict';
import {
  mergeClientNameTombstones,
  mergeOrgWorkspaceSettingsWrite,
} from '../api/_lib/orgWorkspaceSettingsMerge.mjs';

const now = Date.now();

{
  const merged = mergeOrgWorkspaceSettingsWrite(
    {
      removed_names: { 'ara med spa': now },
      restored_names: {},
      content_type_colors: { Reel: '#ff0000' },
      custom_color_palette: ['#111'],
    },
    { removedNames: {}, restoredNames: {} },
  );
  assert.equal(
    merged.removed_names['ara med spa'],
    now,
    'stale empty removedNames must not wipe a newer cloud tombstone',
  );
  assert.equal(merged.content_type_colors.Reel, '#ff0000', 'palette fields should keep existing when omitted');
}

{
  const newer = now + 1000;
  const merged = mergeOrgWorkspaceSettingsWrite(
    { removed_names: { casalu: now }, restored_names: {} },
    { removedNames: { casalu: now - 5000 }, restoredNames: { casalu: newer } },
  );
  assert.equal(merged.restored_names.casalu, newer, 'newer restore should win');
  const tombstones = mergeClientNameTombstones(
    { removedNames: merged.removed_names, restoredNames: merged.restored_names },
    {},
  );
  // restored newer than removed → not suppressed by restored check at write time;
  // both maps are retained with newest timestamps.
  assert.ok(tombstones.restoredNames.casalu > tombstones.removedNames.casalu);
}

{
  const merged = mergeOrgWorkspaceSettingsWrite(null, {
    removedNames: { plume: now },
    contentTypeColors: { Story: '#00ff00' },
  });
  assert.equal(merged.removed_names.plume, now);
  assert.equal(merged.content_type_colors.Story, '#00ff00');
}

console.log('Org workspace settings merge tests passed.');
