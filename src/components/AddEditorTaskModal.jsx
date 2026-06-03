import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClientsContext } from '../context/ClientsContext';
import ClientNameInput from './ClientNameInput';
import DateInput from './DateInput';
import { btnPrimaryClass, btnSecondaryClass, inputClass } from './clientPortal/clientPortalUi';

export default function AddEditorTaskModal({ onClose, onAdd, defaultAssignee }) {
  const { clients, getMemberNamesForRole } = useClientsContext();
  const editors = getMemberNamesForRole('Editor');
  const [client, setClient] = useState(clients[0] || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState(defaultAssignee || editors[0] || '');
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

    onAdd({
      client: trimmedClient,
      title: trimmedTitle,
      description: description.trim(),
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
      aria-labelledby="add-editor-task-title"
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
            <h2 id="add-editor-task-title" className="text-lg font-semibold text-white">
              Add one-off project
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Creates a card on the board in Editing — goes through review and approval like other content.
            </p>
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              Add project
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
