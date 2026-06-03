import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';
import DateInput from './DateInput';
import { btnPrimaryClass, btnSecondaryClass } from './clientPortal/clientPortalUi';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

export default function AddAdminTaskModal({ onClose, onAdd, defaultAssignee }) {
  const { clients, getAllTeamMemberNames } = useClientsContext();
  const adminStaff = getAllTeamMemberNames();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('');
  const [dueDate, setDueDate] = useState(toDateKey(new Date()));
  const [assignedTo, setAssignedTo] = useState(defaultAssignee || adminStaff[0] || '');
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
    if (!trimmedTitle) {
      setError('Task title is required.');
      return;
    }
    if (!dueDate) {
      setError('Pick a due date for this task.');
      return;
    }

    onAdd({
      title: trimmedTitle,
      description: description.trim(),
      client: client.trim(),
      dueDate,
      assignedTo,
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[500]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-admin-task-title"
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
            <h2 id="add-admin-task-title" className="text-lg font-semibold text-white">
              Add administrative task
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Billing, client follow-ups, reporting, and other internal work.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Task</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Send March invoice to Plume"
                className={inputClass}
                autoFocus
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Notes (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputClass} resize-y`}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Client (optional)</span>
                <select
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className={inputClass}
                >
                  <option value="">General / internal</option>
                  {clients.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Due date</span>
                <DateInput
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="Select date"
                  inputClassName={inputClass}
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Assigned to</span>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={inputClass}
              >
                {adminStaff.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
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
              Add task
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
