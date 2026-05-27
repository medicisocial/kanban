import { useEffect, useState } from 'react';
import { createClientContactId, normalizeClientContacts } from '../../utils/clientProfile';
import { btnPrimaryClass, btnSecondaryClass, inputClass } from './clientPortalUi';

function buildDraftContacts(client, getClientContacts) {
  const contacts = getClientContacts(client);
  if (contacts.length > 0) {
    return contacts.map((contact) => ({ ...contact }));
  }
  return [
    {
      id: createClientContactId(),
      role: '',
      name: '',
      phone: '',
      email: '',
    },
  ];
}

export default function ClientContactsEditor({
  client,
  getClientContacts,
  onSaveClientContacts,
  showSaveButton = true,
  onContactsChange,
}) {
  const [contacts, setContacts] = useState(() => buildDraftContacts(client, getClientContacts));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContacts(buildDraftContacts(client, getClientContacts));
    setMessage('');
    setError('');
  }, [client, getClientContacts]);

  useEffect(() => {
    onContactsChange?.(contacts);
  }, [contacts, onContactsChange]);

  const updateContact = (contactId, patch) => {
    setContacts((prev) =>
      prev.map((contact) => (contact.id === contactId ? { ...contact, ...patch } : contact)),
    );
  };

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      {
        id: createClientContactId(),
        role: '',
        name: '',
        phone: '',
        email: '',
      },
    ]);
  };

  const removeContact = (contactId) => {
    setContacts((prev) => {
      const next = prev.filter((contact) => contact.id !== contactId);
      return next.length > 0
        ? next
        : [
            {
              id: createClientContactId(),
              role: '',
              name: '',
              phone: '',
              email: '',
            },
          ];
    });
  };

  const handleSave = () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const normalized = normalizeClientContacts(contacts);
      onSaveClientContacts(client, normalized);
      setContacts(normalized.length > 0 ? normalized.map((contact) => ({ ...contact })) : buildDraftContacts(client, () => []));
      setMessage('Contacts saved.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Could not save contacts.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Contacts</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
              Owner, staff, and key people for {client}
            </p>
          </div>
          <button type="button" onClick={addContact} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
            + Add contact
          </button>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {contacts.map((contact, index) => (
            <div key={contact.id} className="space-y-3 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
                  Contact {index + 1}
                </p>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(contact.id)}
                    className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 transition-colors duration-300 hover:text-rose-300"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Role
                  </span>
                  <input
                    type="text"
                    value={contact.role}
                    onChange={(e) => updateContact(contact.id, { role: e.target.value })}
                    placeholder="e.g. Owner"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Name
                  </span>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => updateContact(contact.id, { phone: e.target.value })}
                    placeholder="e.g. (555) 555-5555"
                    className={inputClass}
                    autoComplete="tel"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Email
                  </span>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(contact.id, { email: e.target.value })}
                    placeholder="e.g. john.doe@company.com"
                    className={inputClass}
                    autoComplete="email"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      {showSaveButton && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`${btnPrimaryClass} disabled:opacity-60`}
        >
          {saving ? 'Saving…' : 'Save contacts'}
        </button>
      )}
    </div>
  );
}
