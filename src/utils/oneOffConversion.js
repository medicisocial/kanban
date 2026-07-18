import { normalizeEditorPoints } from '../constants';

/** Columns where a one-off can stay without being moved into Editing by default. */
const ONE_OFF_EDITOR_COLUMNS = new Set(['editing', 'in-review', 'approved', 'finished']);

/** Stages a one-off may be created in or converted into from the modal. */
const ONE_OFF_START_COLUMNS = new Set(['shoot', 'editing']);

function statusForOneOffColumn(columnId) {
  if (columnId === 'shoot') return 'To Create';
  if (columnId === 'editing') return 'Editing';
  return columnId;
}

/**
 * In-place conversion of a board card into a one-off project.
 * Preserves editorPoints for editor payroll (not deliverables / AM pay).
 * Honors an explicit `form.columnId` (To Create / Editing); otherwise moves
 * non-editor-column cards into Editing.
 */
export function buildOneOffConversionUpdates(card = {}, form = {}) {
  const dueDate = form.dueDate || card.dueDate || '';
  const dueTime = dueDate ? form.dueTime || card.dueTime || '' : '';
  const notes = form.notes ?? form.description ?? card.notes ?? '';

  const requested = form.columnId;
  let nextColumnId = null;
  if (requested && ONE_OFF_START_COLUMNS.has(requested)) {
    nextColumnId = requested;
  } else if (!ONE_OFF_EDITOR_COLUMNS.has(card.columnId)) {
    nextColumnId = 'editing';
  }

  // Align shootDate with dueDate for one-off schedule sync. When staying in To Create
  // without a due date, keep any existing shoot day instead of wiping it.
  const shootDate =
    dueDate || (nextColumnId === 'shoot' ? card.shootDate || '' : '');
  const shootTime =
    dueTime || (nextColumnId === 'shoot' && !dueDate ? card.shootTime || '' : '');

  const updates = {
    contentType: 'One-off Project',
    isOneOffProject: true,
    client: (form.client ?? card.client ?? '').trim() || card.client || '',
    title: (form.title ?? card.title ?? '').trim() || card.title || '',
    notes,
    dueDate,
    dueTime,
    shootDate,
    shootTime,
    assignedTo: form.assignedTo || card.assignedTo || '',
    editorPoints: normalizeEditorPoints(form.editorPoints ?? card.editorPoints),
    shootEndTime: '',
    shootModels: '',
    shootNeeds: '',
    storyRecurrenceDays: [],
    storyEndDate: '',
    storyOccurrenceNotes: {},
  };

  if (nextColumnId) {
    updates.columnId = nextColumnId;
    updates.status = statusForOneOffColumn(nextColumnId);
  }

  return updates;
}
