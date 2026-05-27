import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!client || !trimmedTitle) {
      setError('Client and project title are required.');
      return;
    }

    onAdd({
      client,
      title: trimmedTitle,
      description: description.trim(),
      dueDate,
      assignedTo,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Add one-off project</h2>
          <p className="mt-1 text-sm text-gray-400">
            Creates a card on the board in Editing — goes through review and approval like other content.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-400">Client</span>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className={inputClass}
              required
            >
              {clients.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
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
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
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

          <div className="flex gap-2 border-t border-white/5 pt-4">
            <button type="button" onClick={onClose} className={btnSecondaryClass}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimaryClass} flex-1`}>
              Add project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
