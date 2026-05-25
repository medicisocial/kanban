import { ACCOUNT_MANAGERS } from '../constants';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50';

export default function ClientAssignmentsModal({
  clients,
  clientAccountManagers,
  onClose,
  onSetClientAccountManager,
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Account manager assignments</h2>
            <p className="mt-1 text-sm text-gray-400">Default AM per client for task filtering.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {clients.map((client) => (
            <label key={client} className="flex items-center justify-between gap-3">
              <span className="text-sm text-white">{client}</span>
              <select
                value={clientAccountManagers[client] || ''}
                onChange={(e) => onSetClientAccountManager(client, e.target.value)}
                className={`${inputClass} w-48`}
              >
                <option value="">Unassigned</option>
                {ACCOUNT_MANAGERS.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
