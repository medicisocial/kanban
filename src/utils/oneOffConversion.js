import { normalizeEditorPoints } from '../constants';

/** Columns where a one-off can stay without being moved into Editing. */
const ONE_OFF_EDITOR_COLUMNS = new Set(['editing', 'in-review', 'approved', 'finished']);

/**
 * In-place conversion of a board card into a one-off project.
 * Preserves editorPoints for editor payroll (not deliverables / AM pay).
 */
export function buildOneOffConversionUpdates(card = {}, form = {}) {
  const dueDate = form.dueDate || card.dueDate || '';
  const notes = form.notes ?? form.description ?? card.notes ?? '';

  const updates = {
    contentType: 'One-off Project',
    isOneOffProject: true,
    client: (form.client ?? card.client ?? '').trim() || card.client || '',
    title: (form.title ?? card.title ?? '').trim() || card.title || '',
    notes,
    dueDate,
    // Align shootDate with dueDate so syncOneOffScheduleFields does not wipe dueDate.
    shootDate: dueDate,
    assignedTo: form.assignedTo || card.assignedTo || '',
    editorPoints: normalizeEditorPoints(form.editorPoints ?? card.editorPoints),
    shootTime: '',
    shootEndTime: '',
    shootModels: '',
    shootNeeds: '',
    dueTime: '',
    storyRecurrenceDays: [],
    storyEndDate: '',
    storyOccurrenceNotes: {},
  };

  if (!ONE_OFF_EDITOR_COLUMNS.has(card.columnId)) {
    updates.columnId = 'editing';
    updates.status = 'Editing';
  }

  return updates;
}
