import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EDITOR_POINT_OPTIONS, normalizeEditorPoints } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import ClientNameInput from './ClientNameInput';
import DateInput from './DateInput';
import { btnPrimaryClass, btnSecondaryClass, inputClass } from './clientPortal/clientPortalUi';

export default function MakeOneOffModal({
  onClose,
  onConfirm,
  initialClient = '',
  initialTitle = '',
  initialNotes = '',
  initialDueDate = '',
  initialEditorPoints = 1,
  defaultAssignee = '',
  heading = 'Make one-off project',
  description = 'Confirm the client name (existing or custom) and project details. Moves the card to Editing — find it under Team Tasks → Editors (not To Create or Content Creator).',
  confirmLabel = 'Make one-off',
}) {
  const { clients, getMemberNamesForRole } = useClientsContext();
  const editors = getMemberNamesForRole('Editor');
  const [client, setClient] = useState(initialClient || clients[0] || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [notes, setNotes] = useState(initialNotes || '');
  const [dueDate, setDueDate] = useState(initialDueDate || '');
  const [assignedTo, setAssignedTo] = useState(defaultAssignee || editors[0] || '');
  const [editorPoints, setEditorPoints] = useState(normalizeEditorPoints(initialEditorPoints));
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedClient = client.trim();
    if (!trimmedClient || !trimmedTitle) {
      setError('Client and project title are required.');
      return;
    }

    onConfirm({
      client: trimmedClient,
      title: trimmedTitle,
      notes: notes.trim(),
      description: notes.trim(),
      dueDate,
      assignedTo,
      editorPoints: normalizeEditorPoints(editorPoints),
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[520]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="make-one-off-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div className="pointer-events-none relative flex min-h-full items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto my-4 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
          style={{ maxHeight: 'min(720px, calc(100dvh - 2rem))' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-white/5 px-5 py-4">
            <h2 id="make-one-off-title" className="text-lg font-semibold text-white">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Client</span>
              <ClientNameInput
                value={client}
                onChange={(e) => setClient(e.target.value)}
                clients={clients}
                inputClass={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Project title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Conference recap video"
                className={inputClass}
                autoFocus
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${inputClass} resize-y`}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Due date (optional)</span>
                <DateInput
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="Select date"
                  inputClassName={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Assigned to</span>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className={inputClass}
                >
                  {editors.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Editor points</span>
              <select
                value={String(editorPoints)}
                onChange={(e) => setEditorPoints(Number(e.target.value))}
                className={inputClass}
              >
                {EDITOR_POINT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-white/35">
                For editor payroll only — not deliverable quotas or account manager pay.
              </p>
            </label>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-white/5 px-5 py-4">
            <button type="button" onClick={onClose} className={btnSecondaryClass}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimaryClass} flex-1`}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
