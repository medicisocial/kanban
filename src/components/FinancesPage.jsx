import { useState, useMemo, useCallback, useEffect } from 'react';
import { DEFAULT_PAY_RATES, normalizePayRates } from '../constants/clientPlans';
import {
  btnPrimaryClass,
  btnSecondaryClass,
  surfacePanelClass,
  glassSegmentClass,
  selectClass,
} from './clientPortal/clientPortalUi';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { IconChevronLeft, IconChevronRight } from './clientPortal/ClientPortalIcons';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import { isSharedOperationsLogin } from '../utils/staffAuth';
import { staffHasLeadershipWorkspaceAccess } from '../utils/staffMembers';
import { buildEditorReelPointsByAssignee } from '../utils/editorTodo';
import { buildPlanBasedPayByAssignee, buildFullQuotaEditorPay, projectPayrollAtFullDelivery } from '../utils/planBasedPay';
import { sortClientNamesAlphabetically } from '../utils/clients';

function fmt$(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function parse$(s) {
  const cleaned = String(s || '').replace(/[^0-9.\-]/g, '');
  return Number(cleaned) || 0;
}

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
    if (parsed !== (Number(value) || 0)) onSave(parsed);
  }, [draft, value, onSave]);

  const handleDraftChange = useCallback(
    (nextDraft) => {
      setDraft(nextDraft);
      const parsed = parse$(nextDraft);
      if (parsed !== (Number(value) || 0)) onSave(parsed);
    },
    [onSave, value],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleCommit();
      else if (e.key === 'Escape') setEditing(false);
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

function PaymentMethodSelect({ value, onChange }) {
  return (
    <select
      value={value || 'ach'}
      onChange={(event) => onChange(event.target.value)}
      className={`${financeInputClass} w-auto min-w-[7.5rem]`}
      title="QuickBooks payment method"
    >
      <option value="ach">ACH / bank</option>
      <option value="cc">Credit card</option>
    </select>
  );
}

const TABS = [
  { id: 'pay', label: 'Pay' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'rates', label: 'Rates' },
];

function yearMonthToDate(yearMonth) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
}

function createExtraField() {
  return { id: crypto.randomUUID(), label: '', amount: 0 };
}

function MonthNav({ monthLabel, onPrev, onNext, onToday }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        className="rounded p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
        aria-label="Previous month"
      >
        <IconChevronLeft />
      </button>
      <h2 className="min-w-[9rem] text-center text-base font-semibold text-white">{monthLabel}</h2>
      <button
        type="button"
        onClick={onNext}
        className="rounded p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
        aria-label="Next month"
      >
        <IconChevronRight />
      </button>
      <button
        type="button"
        onClick={onToday}
        className={`${btnSecondaryClass} ml-1 py-1 px-2.5 text-[10px]`}
      >
        This month
      </button>
    </div>
  );
}

function SummaryCard({ label, value, tone = 'default', hint }) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'bad'
        ? 'text-rose-300'
        : tone === 'warn'
          ? 'text-amber-300'
          : 'text-white';
  const hintClass =
    tone === 'good'
      ? 'text-emerald-200/70'
      : tone === 'bad'
        ? 'text-rose-200/70'
        : tone === 'warn'
          ? 'text-amber-200/70'
          : 'text-white/45';
  return (
    <div className={`${surfacePanelClass} px-4 py-3`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{fmt$(value)}</p>
      {hint ? <p className={`mt-1 text-[10px] ${hintClass}`}>{hint}</p> : null}
    </div>
  );
}

function RateField({ label, hint, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
        {label}
      </span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={financeInputClass}
      />
      {hint ? <p className="mt-1 text-[10px] text-white/35">{hint}</p> : null}
    </label>
  );
}

function payBreakdownLines(person, rates) {
  const reelRate = rates?.reelPointRate ?? DEFAULT_PAY_RATES.reelPointRate;
  const carouselRate = rates?.carouselRate ?? DEFAULT_PAY_RATES.carouselRate;
  const staticRate = rates?.staticPostRate ?? DEFAULT_PAY_RATES.staticPostRate;
  const lines = [];
  if ((person.amPay || 0) > 0) lines.push({ label: 'Account manager', amount: person.amPay });
  if ((person.videographerPay || 0) > 0) {
    lines.push({ label: 'Videographer', amount: person.videographerPay });
  }
  if ((person.photographerPay || 0) > 0) {
    lines.push({ label: 'Photographer', amount: person.photographerPay });
  }
  if ((person.points || 0) > 0 || (person.reelPay || 0) > 0) {
    lines.push({
      label: `Reels · ${person.points || 0} pts`,
      amount: person.reelPay ?? (person.points || 0) * reelRate,
      hint: `$${reelRate}/pt`,
    });
  }
  if ((person.carousels || 0) > 0 || (person.carouselPay || 0) > 0) {
    lines.push({
      label: `Carousels · ${person.carousels || 0}`,
      amount: person.carouselPay || 0,
      hint: `$${carouselRate}`,
    });
  }
  if ((person.statics || 0) > 0 || (person.staticPay || 0) > 0) {
    lines.push({
      label: `Statics · ${person.statics || 0}`,
      amount: person.staticPay || 0,
      hint: `$${staticRate}`,
    });
  }
  return lines;
}

function PayrollPersonRow({ person, rates, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false);
  const fields = Array.isArray(person.extraFields) ? person.extraFields : [];
  const lines = person.kind === 'team' ? payBreakdownLines(person, rates) : [];

  const setFields = (nextFields) => onUpdate({ extraFields: nextFields });
  const updateField = (fieldId, patch) => {
    setFields(fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  };
  const removeField = (fieldId) => setFields(fields.filter((field) => field.id !== fieldId));

  return (
    <div className="rounded-lg border border-white/10 bg-black/25">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="text-white/35 text-[10px] w-3">{open ? '▾' : '▸'}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{person.name}</span>
            <span className="block text-[10px] text-white/35">
              {person.kind === 'team' ? 'Team' : 'Custom'}
              {lines.length ? ` · ${lines.length} auto lines` : ''}
              {fields.length ? ` · ${fields.length} field${fields.length === 1 ? '' : 's'}` : ''}
            </span>
          </span>
        </button>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-300">
          {fmt$(person.personTotal)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[10px] uppercase tracking-wide text-white/30 hover:text-rose-300"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-3 py-3">
          {lines.length > 0 && (
            <ul className="space-y-1 text-xs text-white/55">
              {lines.map((line) => (
                <li key={line.label} className="flex items-center justify-between gap-3">
                  <span>
                    {line.label}
                    {line.hint ? <span className="text-white/30"> · {line.hint}</span> : null}
                  </span>
                  <span className="tabular-nums text-white/75">{fmt$(line.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            {fields.map((field) => (
              <div
                key={field.id}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-center"
              >
                <input
                  type="text"
                  value={field.label}
                  onChange={(event) => updateField(field.id, { label: event.target.value })}
                  placeholder="Label (bonus, mileage…)"
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
                  className="justify-self-start text-[10px] text-white/35 hover:text-rose-300 sm:justify-self-end"
                >
                  Delete
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFields([...fields, createExtraField()])}
              className={`${btnSecondaryClass} py-1.5 text-[10px]`}
            >
              Add field
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPeopleBar({ teamMembers, existingIds, onAddTeam, onAddCustom }) {
  const [memberId, setMemberId] = useState('');
  const [customName, setCustomName] = useState('');

  const available = useMemo(
    () =>
      (teamMembers || []).filter(
        (member) => member?.id && member?.name && !existingIds.has(member.id),
      ),
    [teamMembers, existingIds],
  );

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const member = available.find((entry) => entry.id === memberId);
          if (!member) return;
          onAddTeam({
            name: member.name,
            kind: 'team',
            teamMemberId: member.id,
            extraFields: [],
          });
          setMemberId('');
        }}
      >
        <select
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className={`${selectClass} flex-1`}
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
          className={`${btnSecondaryClass} shrink-0 py-1.5 text-[10px] disabled:opacity-40`}
        >
          Add
        </button>
      </form>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = customName.trim();
          if (!trimmed) return;
          onAddCustom({
            name: trimmed,
            kind: 'custom',
            teamMemberId: null,
            extraFields: [{ id: crypto.randomUUID(), label: 'Pay', amount: 0 }],
          });
          setCustomName('');
        }}
      >
        <input
          type="text"
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
          placeholder="Custom person name"
          className={`${financeInputClass} flex-1`}
        />
        <button type="submit" className={`${btnSecondaryClass} shrink-0 py-1.5 text-[10px]`}>
          Add
        </button>
      </form>
    </div>
  );
}

function SaveBar({ saveStatus, saveMessage, onSave, label = 'Save' }) {
  return (
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
        {saveMessage || 'Edits auto-save. Use Save to push to Supabase now.'}
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={saveStatus === 'saving'}
        className={`${btnPrimaryClass} py-2 text-xs disabled:cursor-wait disabled:opacity-60`}
      >
        {saveStatus === 'saving' ? 'Saving…' : label}
      </button>
    </div>
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
    setMonthlyRetainer,
    setRetainerPaymentMethod,
    addOneOffProject,
    updateOneOffProject,
    deleteOneOffProject,
    addExpenseItem,
    updateExpenseItem,
    deleteExpenseItem,
    setOneTimeExpenses,
    getMonthlySnapshot,
    getPayRates,
    setPayRates,
    getAllClientsWithRetainers,
    currentYearMonth,
  } = finances;

  const { session, org } = useStaffAuth();
  const {
    teamMembers: contextTeamMembers,
    clients = [],
    getClientAccountManager,
    getClientVideographer,
    getClientPhotographer,
    getClientReelPointsTarget,
    getClientCarouselStaticTarget,
    getClientCarouselTarget,
    getClientStaticTarget,
    getClientShootDaysPerMonth,
    getClientShootHoursPerDay,
    getClientMonthlyPackageAmount,
  } = useClientsContext();
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
  const [activeTab, setActiveTab] = useState('pay');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [ratesDraft, setRatesDraft] = useState(() => normalizePayRates(DEFAULT_PAY_RATES));
  const [oneOffDraft, setOneOffDraft] = useState({ name: '', amount: '', paymentMethod: 'ach' });
  const [expenseDraft, setExpenseDraft] = useState({ name: '', amount: '' });

  const payRates = useMemo(
    () => getPayRates?.() || normalizePayRates(DEFAULT_PAY_RATES),
    [getPayRates],
  );

  useEffect(() => {
    setRatesDraft(payRates);
  }, [payRates]);

  useEffect(() => {
    ensureRecurringMonth(selectedMonth);
  }, [ensureRecurringMonth, selectedMonth]);

  // Seed empty retainers from each client's stored monthly package amount.
  useEffect(() => {
    for (const client of clients || []) {
      const packageAmount = getClientMonthlyPackageAmount?.(client) || 0;
      if (!(packageAmount > 0)) continue;
      const existing = Number(snapshot.retainers?.[client]) || 0;
      if (existing > 0) continue;
      setMonthlyRetainer(client, selectedMonth, packageAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, getClientMonthlyPackageAmount, selectedMonth, setMonthlyRetainer]);

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
      setSaveMessage(error?.message || 'Could not save.');
    }
  }, [saveFinancesNow]);

  const handleSaveRates = useCallback(async () => {
    setPayRates?.(normalizePayRates(ratesDraft));
    setSaveStatus('saving');
    setSaveMessage('');
    try {
      await saveFinancesNow();
      setSaveStatus('saved');
      setSaveMessage('Rates saved.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error?.message || 'Could not save rates.');
    }
  }, [ratesDraft, saveFinancesNow, setPayRates]);

  const updateRateDraft = useCallback((key, value) => {
    setRatesDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const planPayMaps = useMemo(() => {
    const { byName } = buildPlanBasedPayByAssignee({
      clients,
      getClientAccountManager,
      getClientVideographer,
      getClientPhotographer,
      getClientReelPointsTarget,
      getClientCarouselStaticTarget,
      getClientShootDaysPerMonth,
      getClientShootHoursPerDay,
      rates: payRates,
    });
    const planPayByName = {};
    const amPayByName = {};
    const videographerPayByName = {};
    const photographerPayByName = {};
    for (const [key, entry] of Object.entries(byName)) {
      planPayByName[key] = entry.planPay || 0;
      amPayByName[key] = entry.amPay || 0;
      videographerPayByName[key] = entry.videographerPay || 0;
      photographerPayByName[key] = entry.photographerPay || 0;
    }
    return {
      planPayByName,
      amPayByName,
      videographerPayByName,
      photographerPayByName,
      assigneeKeys: Object.keys(byName),
    };
  }, [
    clients,
    getClientAccountManager,
    getClientVideographer,
    getClientPhotographer,
    getClientReelPointsTarget,
    getClientCarouselStaticTarget,
    getClientShootDaysPerMonth,
    getClientShootHoursPerDay,
    payRates,
  ]);

  const pointsMaps = useMemo(() => {
    const referenceDate = yearMonthToDate(selectedMonth);
    const roster = buildEditorReelPointsByAssignee(cards || [], {
      referenceDate,
      rates: payRates,
    });
    const pointsByName = {};
    const pointsPayByName = {};
    const carouselsByName = {};
    const staticsByName = {};
    const carouselPayByName = {};
    const staticPayByName = {};
    const reelPayByName = {};
    for (const entry of roster) {
      const key = String(entry.name || '').trim().toLowerCase();
      if (!key) continue;
      pointsByName[key] = entry.points || 0;
      pointsPayByName[key] = entry.pay || 0;
      carouselsByName[key] = entry.carousels || 0;
      staticsByName[key] = entry.statics || 0;
      carouselPayByName[key] = entry.carouselPay || 0;
      staticPayByName[key] = entry.staticPay || 0;
      reelPayByName[key] = entry.reelPay || 0;
    }
    return {
      pointsByName,
      pointsPayByName,
      carouselsByName,
      staticsByName,
      carouselPayByName,
      staticPayByName,
      reelPayByName,
      ...planPayMaps,
    };
  }, [cards, selectedMonth, payRates, planPayMaps]);

  const snapshot = useMemo(
    () => getMonthlySnapshot(selectedMonth, pointsMaps),
    [getMonthlySnapshot, selectedMonth, pointsMaps],
  );

  const actualEditorPay = useMemo(
    () =>
      (snapshot.payrollStaff || []).reduce(
        (sum, person) => sum + (Number(person.pointsPay) || 0),
        0,
      ),
    [snapshot.payrollStaff],
  );

  const fullQuotaEditorPay = useMemo(() => {
    const { total } = buildFullQuotaEditorPay({
      clients,
      getClientReelPointsTarget,
      getClientCarouselStaticTarget,
      getClientCarouselTarget,
      getClientStaticTarget,
      rates: payRates,
    });
    return total;
  }, [
    clients,
    getClientReelPointsTarget,
    getClientCarouselStaticTarget,
    getClientCarouselTarget,
    getClientStaticTarget,
    payRates,
  ]);

  /** Revenue uses payroll as if all plan deliverables are done; Pay tab still uses actuals. */
  const projectedPayroll = useMemo(
    () =>
      projectPayrollAtFullDelivery({
        currentPayroll: snapshot.payroll,
        actualEditorPay,
        fullQuotaEditorPay,
      }),
    [snapshot.payroll, actualEditorPay, fullQuotaEditorPay],
  );

  const projectedNetProfit = useMemo(
    () =>
      (Number(snapshot.totalRevenue) || 0) -
      projectedPayroll -
      (Number(snapshot.totalExpenses) || 0),
    [snapshot.totalRevenue, snapshot.totalExpenses, projectedPayroll],
  );

  const existingTeamIds = useMemo(() => {
    const ids = new Set();
    for (const person of snapshot.payrollStaff || []) {
      if (person.kind === 'team' && person.teamMemberId) ids.add(person.teamMemberId);
    }
    return ids;
  }, [snapshot.payrollStaff]);

  const planAssigneeKey = planPayMaps.assigneeKeys.slice().sort().join('|');

  useEffect(() => {
    if (!planAssigneeKey) return;
    const needed = new Set(planAssigneeKey.split('|').filter(Boolean));
    const onRoster = new Set(
      (snapshot.payrollStaff || []).map((person) => String(person.name || '').trim().toLowerCase()),
    );
    for (const member of teamMembers || []) {
      const name = String(member?.name || '').trim();
      const key = name.toLowerCase();
      if (!name || !needed.has(key) || onRoster.has(key)) continue;
      addPayrollStaff(selectedMonth, {
        name,
        kind: 'team',
        teamMemberId: member.id || null,
        extraFields: [],
      });
      onRoster.add(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPayrollStaff, planAssigneeKey, selectedMonth, teamMembers]);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    const date = new Date(Number(y), Number(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const retainerClients = useMemo(() => {
    const names = new Set([...(clients || []), ...(getAllClientsWithRetainers?.() || [])]);
    return sortClientNamesAlphabetically([...names]);
  }, [clients, getAllClientsWithRetainers]);

  const staffTotal = useMemo(
    () =>
      (snapshot.payrollStaff || []).reduce(
        (sum, person) => sum + (Number(person.personTotal) || 0),
        0,
      ),
    [snapshot.payrollStaff],
  );

  if (!isAdmin) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Finances"
          description="Payroll, revenue, and profit — owners and creative directors only."
        />
        <div className={`${surfacePanelClass} p-6 text-center`}>
          <p className="text-sm text-white/45">
            Only Owners and Creative Directors can access finances.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ClientPortalSectionHeader
        title="Finances"
        description="Pay the team, track revenue, and see monthly profit."
      />

      <div className={`${glassSegmentClass} mb-5 inline-flex gap-1 p-1`}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition ${
              activeTab === tab.id ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/75'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== 'rates' && (
        <MonthNav
          monthLabel={monthLabel}
          onPrev={goPrev}
          onNext={goNext}
          onToday={() => selectMonth(currentYearMonth())}
        />
      )}

      {activeTab === 'rates' && (
        <div className={`${surfacePanelClass} max-w-3xl space-y-6 p-5`}>
          <div>
            <h3 className="text-sm font-semibold text-white">Editor</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <RateField
                label="Reel ($/pt)"
                value={ratesDraft.reelPointRate}
                onChange={(v) => updateRateDraft('reelPointRate', v)}
              />
              <RateField
                label="Carousel"
                value={ratesDraft.carouselRate}
                onChange={(v) => updateRateDraft('carouselRate', v)}
              />
              <RateField
                label="Static"
                value={ratesDraft.staticPostRate}
                onChange={(v) => updateRateDraft('staticPostRate', v)}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Shoot roles</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RateField
                label="Videographer ($/hr)"
                value={ratesDraft.videographerHourly}
                onChange={(v) => updateRateDraft('videographerHourly', v)}
              />
              <RateField
                label="Photographer ($/hr)"
                value={ratesDraft.photographerHourly}
                onChange={(v) => updateRateDraft('photographerHourly', v)}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Account manager</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <RateField
                label="Base / client"
                value={ratesDraft.accountManagerBase}
                onChange={(v) => updateRateDraft('accountManagerBase', v)}
              />
              <RateField
                label="Per reel pt"
                value={ratesDraft.accountManagerPerReelPoint}
                onChange={(v) => updateRateDraft('accountManagerPerReelPoint', v)}
              />
              <RateField
                label="Per feed pt"
                value={ratesDraft.accountManagerPerCarousel}
                onChange={(v) => updateRateDraft('accountManagerPerCarousel', v)}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Ads</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RateField
                label="Meta specialist / client"
                value={ratesDraft.metaAdsSpecialistFlat}
                onChange={(v) => updateRateDraft('metaAdsSpecialistFlat', v)}
                hint="Stored for reference."
              />
            </div>
          </div>

          <SaveBar
            saveStatus={saveStatus}
            saveMessage={saveMessage}
            onSave={handleSaveRates}
            label="Save rates"
          />
        </div>
      )}

      {activeTab === 'pay' && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard label="Staff pay" value={staffTotal} tone="warn" />
            <SummaryCard label="Owner draw" value={snapshot.ownerComp} />
            <SummaryCard label="Total payroll" value={snapshot.payroll} tone="warn" />
          </div>

          <div className={`${surfacePanelClass} p-4 sm:p-5`}>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">People</h3>
              <span className="text-xs text-white/40">{(snapshot.payrollStaff || []).length} on roster</span>
            </div>

            {snapshot.legacyPayroll > 0 && !(snapshot.payrollStaff || []).length && (
              <div className="mb-3 flex items-center justify-between rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-amber-100">Legacy payroll total</p>
                <EditableAmount
                  value={snapshot.legacyPayroll}
                  onSave={(amount) => setPayroll(selectedMonth, amount)}
                  className="text-amber-200"
                />
              </div>
            )}

            <div className="space-y-2">
              {(snapshot.payrollStaff || []).length === 0 ? (
                <p className="py-6 text-center text-xs text-white/35">
                  No one on payroll this month yet.
                </p>
              ) : (
                (snapshot.payrollStaff || []).map((person) => (
                  <PayrollPersonRow
                    key={person.id}
                    person={person}
                    rates={payRates}
                    onUpdate={(updates) => updatePayrollStaff(selectedMonth, person.id, updates)}
                    onRemove={() => deletePayrollStaff(selectedMonth, person.id)}
                  />
                ))
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <AddPeopleBar
                teamMembers={teamMembers}
                existingIds={existingTeamIds}
                onAddTeam={(person) => addPayrollStaff(selectedMonth, person)}
                onAddCustom={(person) => addPayrollStaff(selectedMonth, person)}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div>
                <p className="text-xs font-medium text-white">Owner draw</p>
                <p className="text-[10px] text-white/35">Separate from staff pay</p>
              </div>
              <EditableAmount
                value={snapshot.ownerComp}
                onSave={(amount) => setOwnerComp(selectedMonth, amount)}
                className="text-amber-200"
              />
            </div>
          </div>

          <SaveBar
            saveStatus={saveStatus}
            saveMessage={saveMessage}
            onSave={handleSaveNow}
            label="Save payroll"
          />
        </>
      )}

      {activeTab === 'revenue' && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Revenue" value={snapshot.totalRevenue} tone="good" />
            <SummaryCard
              label="Payroll"
              value={projectedPayroll}
              tone="warn"
              hint={
                actualEditorPay !== fullQuotaEditorPay
                  ? `At full plan delivery · ${fmt$(actualEditorPay)} earned so far`
                  : 'At full plan delivery'
              }
            />
            <SummaryCard
              label="Expenses"
              value={snapshot.totalExpenses}
              tone="bad"
              hint={
                snapshot.qbFees > 0
                  ? `Includes ${fmt$(snapshot.qbFees)} QB card fees`
                  : undefined
              }
            />
            <SummaryCard
              label="Net profit"
              value={projectedNetProfit}
              tone={projectedNetProfit >= 0 ? 'good' : 'bad'}
            />
          </div>

          <div className="space-y-4">
            <div className={`${surfacePanelClass} p-4 sm:p-5`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Client retainers</h3>
                  <p className="mt-0.5 text-[10px] text-white/35">
                    Credit card adds a 2.9% + $0.25 QB fee to expenses.
                  </p>
                </div>
                <span className="text-xs tabular-nums text-emerald-300/90">
                  {fmt$(snapshot.retainerTotal)}
                </span>
              </div>
              <div className="max-h-[22rem] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#141414]">
                    <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/35">
                      <th className="pb-2 font-medium">Client</th>
                      <th className="pb-2 font-medium">Pay</th>
                      <th className="pb-2 text-right font-medium">Monthly</th>
                      <th className="pb-2 text-right font-medium">QB fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retainerClients.map((client) => {
                      const payment = snapshot.retainerPayments?.[client] || {};
                      const retainerAmount = Number(snapshot.retainers?.[client]) || 0;
                      return (
                        <tr key={client} className="border-t border-white/5">
                          <td className="py-2 pr-3 text-white/80">{client}</td>
                          <td className="py-2 pr-3">
                            <PaymentMethodSelect
                              value={payment.paymentMethod}
                              onChange={(method) =>
                                setRetainerPaymentMethod(client, selectedMonth, method)
                              }
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <EditableAmount
                              value={retainerAmount}
                              onSave={(amount) => setMonthlyRetainer(client, selectedMonth, amount)}
                              className="text-white"
                            />
                          </td>
                          <td className="py-2 text-right tabular-nums text-rose-200/90">
                            {fmt$(payment.qbFee || 0)}
                          </td>
                        </tr>
                      );
                    })}
                    {retainerClients.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-white/35">
                          No clients yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${surfacePanelClass} p-4 sm:p-5`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">One-off projects</h3>
                <span className="text-xs tabular-nums text-emerald-300/90">{fmt$(snapshot.oneOff)}</span>
              </div>
              <div className="space-y-2">
                {(snapshot.oneOffProjects || []).map((project) => (
                  <div
                    key={project.id}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7.5rem_7rem_5rem_auto] sm:items-center"
                  >
                    <input
                      type="text"
                      value={project.name}
                      onChange={(event) =>
                        updateOneOffProject(selectedMonth, project.id, { name: event.target.value })
                      }
                      placeholder="Project name"
                      className={financeInputClass}
                    />
                    <PaymentMethodSelect
                      value={project.paymentMethod}
                      onChange={(paymentMethod) =>
                        updateOneOffProject(selectedMonth, project.id, { paymentMethod })
                      }
                    />
                    <EditableAmount
                      value={project.amount}
                      onSave={(amount) =>
                        updateOneOffProject(selectedMonth, project.id, { amount })
                      }
                      className="justify-self-end text-white"
                    />
                    <span className="justify-self-end text-xs tabular-nums text-rose-200/90">
                      {fmt$(project.qbFee || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteOneOffProject(selectedMonth, project.id)}
                      className="justify-self-start text-[10px] text-white/35 hover:text-rose-300 sm:justify-self-end"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = oneOffDraft.name.trim();
                  const amount = Number(oneOffDraft.amount) || 0;
                  if (!name && !amount) return;
                  addOneOffProject(selectedMonth, {
                    name,
                    amount,
                    paymentMethod: oneOffDraft.paymentMethod || 'ach',
                  });
                  setOneOffDraft({ name: '', amount: '', paymentMethod: 'ach' });
                }}
              >
                <input
                  type="text"
                  value={oneOffDraft.name}
                  onChange={(event) =>
                    setOneOffDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="New project"
                  className={`${financeInputClass} flex-1`}
                />
                <PaymentMethodSelect
                  value={oneOffDraft.paymentMethod}
                  onChange={(paymentMethod) =>
                    setOneOffDraft((prev) => ({ ...prev, paymentMethod }))
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={oneOffDraft.amount}
                  onChange={(event) =>
                    setOneOffDraft((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  placeholder="Amount"
                  className={`${financeInputClass} sm:w-28`}
                />
                <button type="submit" className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
                  Add
                </button>
              </form>
            </div>

            <div className={`${surfacePanelClass} p-4 sm:p-5`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Expenses</h3>
                <span className="text-xs tabular-nums text-rose-300/90">
                  {fmt$(snapshot.totalExpenses)}
                </span>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3 rounded border border-white/10 bg-black/20 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-white/80">QuickBooks Payments — CC fees</p>
                  <p className="mt-0.5 text-[10px] text-white/35">
                    Auto-calculated at 2.9% + $0.25 when a retainer or one-off is paid by credit card.
                  </p>
                </div>
                <p className="text-xs font-semibold tabular-nums text-rose-200">
                  {fmt$(snapshot.qbFees || 0)}
                </p>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3 rounded border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-xs text-white/55">One-time / misc for this month</p>
                <EditableAmount
                  value={snapshot.oneTimeExpenses || 0}
                  onSave={(amount) => setOneTimeExpenses(selectedMonth, amount)}
                  className="text-white"
                />
              </div>

              <div className="space-y-2">
                {(snapshot.expenseItems || []).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-center"
                  >
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) =>
                        updateExpenseItem(selectedMonth, item.id, { name: event.target.value })
                      }
                      placeholder="Expense name"
                      className={financeInputClass}
                    />
                    <EditableAmount
                      value={item.amount}
                      onSave={(amount) =>
                        updateExpenseItem(selectedMonth, item.id, { amount })
                      }
                      className="justify-self-end text-white"
                    />
                    <button
                      type="button"
                      onClick={() => deleteExpenseItem(selectedMonth, item.id)}
                      className="justify-self-start text-[10px] text-white/35 hover:text-rose-300 sm:justify-self-end"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {(snapshot.subscriptions || []).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-center"
                  >
                    <div>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) =>
                          updateExpenseItem(
                            selectedMonth,
                            item.id,
                            { name: event.target.value },
                            'subscriptions',
                          )
                        }
                        placeholder="Subscription"
                        className={financeInputClass}
                      />
                      <p className="mt-0.5 text-[10px] text-white/30">Recurring</p>
                    </div>
                    <EditableAmount
                      value={item.amount}
                      onSave={(amount) =>
                        updateExpenseItem(selectedMonth, item.id, { amount }, 'subscriptions')
                      }
                      className="justify-self-end text-white"
                    />
                    <button
                      type="button"
                      onClick={() => deleteExpenseItem(selectedMonth, item.id, 'subscriptions')}
                      className="justify-self-start text-[10px] text-white/35 hover:text-rose-300 sm:justify-self-end"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>

              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = expenseDraft.name.trim();
                  const amount = Number(expenseDraft.amount) || 0;
                  if (!name && !amount) return;
                  addExpenseItem(selectedMonth, { name, amount }, 'expenses');
                  setExpenseDraft({ name: '', amount: '' });
                }}
              >
                <input
                  type="text"
                  value={expenseDraft.name}
                  onChange={(event) =>
                    setExpenseDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="New expense"
                  className={`${financeInputClass} flex-1`}
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={expenseDraft.amount}
                  onChange={(event) =>
                    setExpenseDraft((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  placeholder="Amount"
                  className={`${financeInputClass} sm:w-28`}
                />
                <button type="submit" className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
                  Add
                </button>
              </form>
              <p className="mt-2 text-[10px] text-white/30">
                Profit = revenue − payroll (full plan delivery) − expenses (includes QB card fees
                above). Pay tab still shows who earned what from completed work.
              </p>
            </div>
          </div>

          <SaveBar
            saveStatus={saveStatus}
            saveMessage={saveMessage}
            onSave={handleSaveNow}
            label="Save revenue"
          />
        </>
      )}
    </section>
  );
}
