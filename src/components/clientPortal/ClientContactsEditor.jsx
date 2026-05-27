import { useEffect, useState } from 'react';
import {
  createClientContactId,
  normalizeClientContacts,
  prepareClientContactsForSave,
} from '../../utils/clientProfile';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import { btnPrimaryClass, btnSecondaryClass, inputClass, glassInsetClass } from './clientPortalUi';

function buildDraftContacts(client, getClientContacts) {
  const contacts = getClientContacts(client);
  if (contacts.length > 0) {
    return contacts.map((contact) => ({
      ...contact,
      pendingAvatar: undefined,
    }));
  }
  return [
    {
      id: createClientContactId(),
      role: '',
      name: '',
      phone: '',
      email: '',
      avatar: null,
      pendingAvatar: undefined,
    },
  ];
}

export default function ClientContactsEditor({
  client,
  clientColor = '#810100',
  getClientContacts,
  onSaveClientContacts,
  showSaveButton = true,
  embedded = false,
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
        avatar: null,
        pendingAvatar: undefined,
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
              avatar: null,
              pendingAvatar: undefined,
            },
          ];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const normalized = await prepareClientContactsForSave(contacts);
      onSaveClientContacts(client, normalized);
      setContacts(
        normalized.length > 0
          ? normalized.map((contact) => ({ ...contact, pendingAvatar: undefined }))
          : buildDraftContacts(client, () => []),
      );
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
      {embedded ? (
        <>
          <div className="flex justify-end">
            <button type="button" onClick={addContact} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
              + Add contact
            </button>
          </div>

          <div className={`${glassInsetClass} divide-y divide-white/[0.06]`}>
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

                <ProfilePhotoEditor
                  avatar={contact.pendingAvatar !== undefined ? contact.pendingAvatar : contact.avatar}
                  name={contact.name || contact.role || `Contact ${index + 1}`}
                  color={clientColor}
                  compact
                  label="Profile photo"
                  onPendingChange={(pending) => updateContact(contact.id, { pendingAvatar: pending })}
                />

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
        </>
      ) : (
      <div className={glassInsetClass}>
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

              <ProfilePhotoEditor
                avatar={contact.pendingAvatar !== undefined ? contact.pendingAvatar : contact.avatar}
                name={contact.name || contact.role || `Contact ${index + 1}`}
                color={clientColor}
                compact
                label="Profile photo"
                onPendingChange={(pending) => updateContact(contact.id, { pendingAvatar: pending })}
              />

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
      )}

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
