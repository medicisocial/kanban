import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';

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
          <h2 className="text-lg font-semibold text-white">Add administrative task</h2>
          <p className="mt-1 text-sm text-gray-400">
            Billing, client follow-ups, reporting, and other internal work.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
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
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
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

          <div className="flex gap-2 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000]"
            >
              Add task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
