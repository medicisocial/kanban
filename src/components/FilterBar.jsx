import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import AddClientModal from './AddClientModal';

export default function FilterBar({ clientFilter, onClientChange }) {
  const { clients, addClient } = useClientsContext();
  const [showAddClient, setShowAddClient] = useState(false);

  const handleAddClient = (name, color) => {
    const result = addClient(name, color);
    if (result.ok) {
      onClientChange(result.name);
    }
    return result;
  };

  return (
    <>
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Filter</span>

        <select
          value={clientFilter}
          onChange={(e) => onClientChange(e.target.value)}
          className="select-dark rounded-lg border border-white/10 bg-[#1e2130] px-3 py-1.5 text-sm text-gray-200 outline-none transition focus:border-violet-500/50"
        >
          <option value="all">All Clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowAddClient(true)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          + Add client
        </button>

        <span className="ml-1 text-xs text-gray-500">📸 Instagram only</span>
      </div>

      {showAddClient && (
        <AddClientModal
          existingClients={clients}
          onClose={() => setShowAddClient(false)}
          onAdd={handleAddClient}
        />
      )}
    </>
  );
}
