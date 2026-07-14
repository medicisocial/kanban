import { useState, useMemo, useCallback, useEffect } from 'react';
import { EDITOR_POINT_PAY_RATE } from '../constants';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { IconChevronLeft, IconChevronRight } from './clientPortal/ClientPortalIcons';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import { isSharedOperationsLogin } from '../utils/staffAuth';
import { staffHasLeadershipWorkspaceAccess } from '../utils/staffMembers';
import { buildEditorReelPointsByAssignee } from '../utils/editorTodo';

/** Format a number as a dollar string. */
function fmt$(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Parse a dollar string back to a number. */
function parse$(s) {
  const cleaned = String(s || '').replace(/[^0-9.\-]/g, '');
  return Number(cleaned) || 0;
}

/** Editable amount cell — click to edit, blur/enter to save. */
function EditableAmount({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const handleStartEdit = useCallback(() => {
    setDraft(String(value || 0));
    setEditing(true);
  }, [value]);

  const handleCommit = useCallback(() => {
    setEditing(false);
    const parsed = parse$(draft);
    if (parsed !== (Number(value) || 0)) {
      onSave(parsed);
    }
  }, [draft, value, onSave]);

  const handleDraftChange = useCallback(
    (nextDraft) => {
      setDraft(nextDraft);
      const parsed = parse$(nextDraft);
      if (parsed !== (Number(value) || 0)) {
        onSave(parsed);
      }
    },
    [onSave, value],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        handleCommit();
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [handleCommit],
  );

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => handleDraftChange(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`w-24 rounded border border-white/20 bg-black/40 px-2 py-1 text-right text-xs text-white outline-none focus:border-emerald-400 ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className={`cursor-pointer text-right text-xs hover:text-emerald-300 ${className}`}
      title="Click to edit"
    >
      {fmt$(value)}
    </button>
  );
}

const financeInputClass =
  'w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white outline-none transition focus:border-emerald-400';

function yearMonthToDate(yearMonth) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
}

function createExtraField() {
  return { id: crypto.randomUUID(), label: '', amount: 0 };
}

function PayrollPersonRow({ person, onUpdate, onRemove }) {
  const fields = Array.isArray(person.extraFields) ? person.extraFields : [];

  const setFields = (nextFields) => {
    onUpdate({ extraFields: nextFields });
  };

  const updateField = (fieldId, patch) => {
    setFields(fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  };

  const removeField = (fieldId) => {
    setFields(fields.filter((field) => field.id !== fieldId));
  };

  return (
    <div className="rounded border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{person.name}</p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {person.kind === 'team' ? 'Team member' : 'Custom person'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-amber-300">{fmt$(person.personTotal)}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-white/35 hover:text-rose-300"
          >
            Remove
          </button>
        </div>
      </div>

      {person.kind === 'team' && (
        <p className="mt-3 text-xs text-white/55">
          Reel points: {person.points || 0} · {fmt$(person.pointsPay || 0)}
          <span className="text-white/35"> (${EDITOR_POINT_PAY_RATE}/pt)</span>
        </p>
      )}

      <div className="mt-3 space-y-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-center"
          >
            <input
              type="text"
              value={field.label}
              onChange={(event) => updateField(field.id, { label: event.target.value })}
              placeholder="Label (e.g. Bonus, Mileage)"
              className={financeInputClass}
            />
            <EditableAmount
              value={field.amount}
              onSave={(amount) => updateField(field.id, { amount })}
              className="justify-self-end text-white"
            />
            <button
              type="button"
              onClick={() => removeField(field.id)}
              className="justify-self-start text-xs text-white/35 hover:text-rose-300 sm:justify-self-end"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setFields([...fields, createExtraField()])}
        className={`${btnSecondaryClass} mt-3 py-1.5 text-[10px]`}
      >
        Add field
      </button>
    </div>
  );
}

function AddTeamMemberForm({ teamMembers, existingIds, onAdd }) {
  const [memberId, setMemberId] = useState('');

  const available = useMemo(
    () =>
      (teamMembers || []).filter(
        (member) => member?.id && member?.name && !existingIds.has(member.id),
      ),
    [teamMembers, existingIds],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const member = available.find((entry) => entry.id === memberId);
    if (!member) return;
    onAdd({
      name: member.name,
      kind: 'team',
      teamMemberId: member.id,
      extraFields: [],
    });
    setMemberId('');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
      <select
        value={memberId}
        onChange={(event) => setMemberId(event.target.value)}
        className={financeInputClass}
      >
        <option value="">Add team member…</option>
        {available.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!memberId}
        className={`${btnSecondaryClass} justify-center py-1.5 text-[10px] disabled:opacity-40`}
      >
        Add
      </button>
    </form>
  );
}

function AddCustomPersonForm({ onAdd }) {
  const [name, setName] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({
      name: trimmed,
      kind: 'custom',
      teamMemberId: null,
      extraFields: [{ id: crypto.randomUUID(), label: 'Pay', amount: 0 }],
    });
    setName('');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Custom person name"
        className={financeInputClass}
      />
      <button type="submit" className={`${btnSecondaryClass} justify-center py-1.5 text-[10px]`}>
        Add
      </button>
    </form>
  );
}

export default function FinancesPage({ finances, cards = [], teamMembers: teamMembersProp }) {
  const {
    saveFinancesNow,
    ensureRecurringMonth,
    setPayroll,
    addPayrollStaff,
    updatePayrollStaff,
    deletePayrollStaff,
    setOwnerComp,
    getMonthlySnapshot,
    currentYearMonth,
  } = finances;

  const { session, org } = useStaffAuth();
  const { teamMembers: contextTeamMembers } = useClientsContext();
  const teamMembers = teamMembersProp || contextTeamMembers || [];

  const isAdmin = useMemo(() => {
    const orgRole = String(org?.role || '').toLowerCase();
    return (
      isSharedOperationsLogin(session) ||
      staffHasLeadershipWorkspaceAccess(session, teamMembers) ||
      orgRole === 'owner' ||
      orgRole === 'admin'
    );
  }, [session, teamMembers, org?.role]);

  const [selectedMonth, setSelectedMonth] = useState(() => currentYearMonth());
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Carry prior-month roster into the viewed month when it has no staff yet.
  useEffect(() => {
    ensureRecurringMonth(selectedMonth);
  }, [ensureRecurringMonth, selectedMonth]);

  const shiftMonth = useCallback(
    (yearMonth, offset) => {
      const [year, month] = String(yearMonth || currentYearMonth()).split('-').map(Number);
      const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },
    [currentYearMonth],
  );

  const selectMonth = useCallback(
    (nextMonth) => {
      ensureRecurringMonth(nextMonth);
      setSelectedMonth(nextMonth);
    },
    [ensureRecurringMonth],
  );

  const goPrev = useCallback(() => {
    setSelectedMonth((month) => {
      const prevMonth = shiftMonth(month, -1);
      ensureRecurringMonth(prevMonth);
      return prevMonth;
    });
  }, [ensureRecurringMonth, shiftMonth]);

  const goNext = useCallback(() => {
    setSelectedMonth((month) => {
      const nextMonth = shiftMonth(month, 1);
      ensureRecurringMonth(nextMonth);
      return nextMonth;
    });
  }, [ensureRecurringMonth, shiftMonth]);

  const handleSaveNow = useCallback(async () => {
    setSaveStatus('saving');
    setSaveMessage('');
    try {
      await saveFinancesNow();
      setSaveStatus('saved');
      setSaveMessage('Saved to Supabase.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error?.message || 'Could not save payroll.');
    }
  }, [saveFinancesNow]);

  const pointsMaps = useMemo(() => {
    const referenceDate = yearMonthToDate(selectedMonth);
    const roster = buildEditorReelPointsByAssignee(cards || [], { referenceDate });
    const pointsByName = {};
    const pointsPayByName = {};
    for (const entry of roster) {
      const key = String(entry.name || '').trim().toLowerCase();
      if (!key) continue;
      pointsByName[key] = entry.points || 0;
      pointsPayByName[key] = entry.pay || 0;
    }
    return { pointsByName, pointsPayByName };
  }, [cards, selectedMonth]);

  const snapshot = useMemo(
    () => getMonthlySnapshot(selectedMonth, pointsMaps),
    [getMonthlySnapshot, selectedMonth, pointsMaps],
  );

  const existingTeamIds = useMemo(() => {
    const ids = new Set();
    for (const person of snapshot.payrollStaff || []) {
      if (person.kind === 'team' && person.teamMemberId) {
        ids.add(person.teamMemberId);
      }
    }
    return ids;
  }, [snapshot.payrollStaff]);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    const date = new Date(Number(y), Number(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  if (!isAdmin) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Payroll"
          description="Monthly staff pay, reel points, and owner draw."
        />
        <div className={`${surfacePanelClass} p-6 text-center`}>
          <p className="text-sm text-white/45">
            Only Owners and Creative Directors can access payroll data.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ClientPortalSectionHeader
        title="Payroll"
        description="Monthly staff pay from reel points, custom fields, and owner draw."
      />

      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          className="rounded p-1 text-white/70 hover:text-white"
          aria-label="Previous month"
        >
          <IconChevronLeft />
        </button>
        <h2 className="text-lg font-semibold text-white">{monthLabel}</h2>
        <button
          type="button"
          onClick={goNext}
          className="rounded p-1 text-white/70 hover:text-white"
          aria-label="Next month"
        >
          <IconChevronRight />
        </button>
        <button
          type="button"
          onClick={() => selectMonth(currentYearMonth())}
          className={`${btnSecondaryClass} ml-2 py-1.5 text-[10px]`}
        >
          Today
        </button>
      </div>

      <div className="mb-6 max-w-xs">
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Total payroll</p>
          <p className="mt-1 text-lg font-bold text-amber-300">{fmt$(snapshot.payroll)}</p>
        </div>
      </div>

      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">People</h3>
            <p className="mt-1 text-xs text-white/45">
              Team members earn reel points × ${EDITOR_POINT_PAY_RATE}. Add custom fields for bonuses or
              other pay. Custom people use fields only.
            </p>
          </div>
          <p className="text-base font-bold text-amber-300">
            {fmt$(
              (snapshot.payrollStaff || []).reduce(
                (sum, person) => sum + (Number(person.personTotal) || 0),
                0,
              ),
            )}
          </p>
        </div>

        {snapshot.legacyPayroll > 0 && !(snapshot.payrollStaff || []).length && (
          <div className="mt-3 flex items-center justify-between rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-amber-100">Legacy payroll total</p>
              <p className="text-[11px] text-white/40">Break this into people rows when ready.</p>
            </div>
            <EditableAmount
              value={snapshot.legacyPayroll}
              onSave={(amount) => setPayroll(selectedMonth, amount)}
              className="text-amber-200"
            />
          </div>
        )}

        <div className="mt-4 space-y-3">
          {(snapshot.payrollStaff || []).length === 0 ? (
            <p className="text-xs text-white/35">No people on payroll this month yet.</p>
          ) : (
            (snapshot.payrollStaff || []).map((person) => (
              <PayrollPersonRow
                key={person.id}
                person={person}
                onUpdate={(updates) => updatePayrollStaff(selectedMonth, person.id, updates)}
                onRemove={() => deletePayrollStaff(selectedMonth, person.id)}
              />
            ))
          )}
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-white">Add team member</p>
          <AddTeamMemberForm
            teamMembers={teamMembers}
            existingIds={existingTeamIds}
            onAdd={(person) => addPayrollStaff(selectedMonth, person)}
          />
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-white">Add custom person</p>
          <AddCustomPersonForm onAdd={(person) => addPayrollStaff(selectedMonth, person)} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div>
            <p className="text-xs font-semibold text-white">Owner draw / distributions</p>
            <p className="mt-0.5 text-[11px] text-white/40">Tracked separately from staff payroll.</p>
          </div>
          <EditableAmount
            value={snapshot.ownerComp}
            onSave={(amount) => setOwnerComp(selectedMonth, amount)}
            className="text-amber-200"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p
          className={`text-xs ${
            saveStatus === 'error'
              ? 'text-rose-200'
              : saveStatus === 'saved'
                ? 'text-emerald-200'
                : 'text-white/40'
          }`}
        >
          {saveMessage || 'Changes auto-save, and this button forces an immediate Supabase save.'}
        </p>
        <button
          type="button"
          onClick={handleSaveNow}
          disabled={saveStatus === 'saving'}
          className={`${btnPrimaryClass} py-2 text-xs disabled:cursor-wait disabled:opacity-60`}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save payroll'}
        </button>
      </div>
    </section>
  );
}
