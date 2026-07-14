import { useState, useMemo, useCallback, useEffect } from 'react';
import { DEFAULT_PAY_RATES, normalizePayRates } from '../constants/clientPlans';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass, glassSegmentClass } from './clientPortal/clientPortalUi';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { IconChevronLeft, IconChevronRight } from './clientPortal/ClientPortalIcons';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import { isSharedOperationsLogin } from '../utils/staffAuth';
import { staffHasLeadershipWorkspaceAccess } from '../utils/staffMembers';
import { buildEditorReelPointsByAssignee } from '../utils/editorTodo';
import { buildPlanBasedPayByAssignee } from '../utils/planBasedPay';

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

function PayrollPersonRow({ person, rates, onUpdate, onRemove }) {
  const fields = Array.isArray(person.extraFields) ? person.extraFields : [];
  const reelRate = rates?.reelPointRate ?? DEFAULT_PAY_RATES.reelPointRate;
  const carouselRate = rates?.carouselRate ?? DEFAULT_PAY_RATES.carouselRate;
  const staticRate = rates?.staticPostRate ?? DEFAULT_PAY_RATES.staticPostRate;

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
        <div className="mt-3 space-y-1 text-xs text-white/55">
          {(person.amPay || 0) > 0 && (
            <p>
              Account manager (plans): {fmt$(person.amPay || 0)}
            </p>
          )}
          {(person.videographerPay || 0) > 0 && (
            <p>
              Videographer (shoots): {fmt$(person.videographerPay || 0)}
            </p>
          )}
          {(person.photographerPay || 0) > 0 && (
            <p>
              Photographer (shoots): {fmt$(person.photographerPay || 0)}
            </p>
          )}
          <p>
            Reels: {person.points || 0} pts · {fmt$(person.reelPay ?? (person.points || 0) * reelRate)}
            <span className="text-white/35"> (${reelRate}/pt)</span>
          </p>
          <p>
            Carousels: {person.carousels || 0} · {fmt$(person.carouselPay || 0)}
            <span className="text-white/35"> (${carouselRate} each)</span>
          </p>
          <p>
            Statics: {person.statics || 0} · {fmt$(person.staticPay || 0)}
            <span className="text-white/35"> (${staticRate} each)</span>
          </p>
        </div>
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

function RateField({ label, hint, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
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
    getPayRates,
    setPayRates,
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
    getClientCarouselTarget,
    getClientStaticTarget,
    getClientShootDaysPerMonth,
    getClientShootHoursPerDay,
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
  const [payrollTab, setPayrollTab] = useState('pay');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [ratesDraft, setRatesDraft] = useState(() => normalizePayRates(DEFAULT_PAY_RATES));

  const payRates = useMemo(
    () => getPayRates?.() || normalizePayRates(DEFAULT_PAY_RATES),
    [getPayRates],
  );

  useEffect(() => {
    setRatesDraft(payRates);
  }, [payRates]);

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
      getClientCarouselTarget,
      getClientStaticTarget,
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
    getClientCarouselTarget,
    getClientStaticTarget,
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

  const existingTeamIds = useMemo(() => {
    const ids = new Set();
    for (const person of snapshot.payrollStaff || []) {
      if (person.kind === 'team' && person.teamMemberId) {
        ids.add(person.teamMemberId);
      }
    }
    return ids;
  }, [snapshot.payrollStaff]);

  const planAssigneeKey = planPayMaps.assigneeKeys.slice().sort().join('|');

  // Auto-include team members assigned as AM / videographer / photographer on any client.
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
    // Intentionally omit snapshot.payrollStaff from deps — duplicate guard in addPayrollStaff is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPayrollStaff, planAssigneeKey, selectedMonth, teamMembers]);

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
        description="Monthly staff pay from completed work, custom fields, and owner draw."
      />

      <div className={`${glassSegmentClass} mb-6 inline-flex gap-1 p-1`}>
        <button
          type="button"
          onClick={() => setPayrollTab('pay')}
          className={`rounded px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition ${
            payrollTab === 'pay' ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/75'
          }`}
        >
          Pay
        </button>
        <button
          type="button"
          onClick={() => setPayrollTab('rates')}
          className={`rounded px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition ${
            payrollTab === 'rates' ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/75'
          }`}
        >
          Rates
        </button>
      </div>

      {payrollTab === 'rates' ? (
        <div className={`${surfacePanelClass} mb-4 max-w-3xl space-y-6 p-5`}>
          <div>
            <h3 className="text-sm font-semibold text-white">Editor pay rates</h3>
            <p className="mt-1 text-xs text-white/45">
              These rates drive team payroll for completed reels, carousels, and statics.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <RateField
                label="Reel point ($/pt)"
                value={ratesDraft.reelPointRate}
                onChange={(v) => updateRateDraft('reelPointRate', v)}
              />
              <RateField
                label="Carousel ($/each)"
                value={ratesDraft.carouselRate}
                onChange={(v) => updateRateDraft('carouselRate', v)}
              />
              <RateField
                label="Static post ($/each)"
                value={ratesDraft.staticPostRate}
                onChange={(v) => updateRateDraft('staticPostRate', v)}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Shoot roles (hourly)</h3>
            <p className="mt-1 text-xs text-white/45">
              Paid from each client&apos;s plan shoot days × hours/day for the assigned videographer and
              photographer.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <p className="mt-1 text-xs text-white/45">
              Paid from each assigned client&apos;s plan quotas (base + reel/carousel/static).
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RateField
                label="Base ($/client/mo)"
                value={ratesDraft.accountManagerBase}
                onChange={(v) => updateRateDraft('accountManagerBase', v)}
              />
              <RateField
                label="Per reel point"
                value={ratesDraft.accountManagerPerReelPoint}
                onChange={(v) => updateRateDraft('accountManagerPerReelPoint', v)}
              />
              <RateField
                label="Per carousel"
                value={ratesDraft.accountManagerPerCarousel}
                onChange={(v) => updateRateDraft('accountManagerPerCarousel', v)}
              />
              <RateField
                label="Per static"
                value={ratesDraft.accountManagerPerStatic}
                onChange={(v) => updateRateDraft('accountManagerPerStatic', v)}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Ads</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RateField
                label="Meta ads specialist ($/client/mo)"
                value={ratesDraft.metaAdsSpecialistFlat}
                onChange={(v) => updateRateDraft('metaAdsSpecialistFlat', v)}
                hint="Stored for reference — apply on Pro plans later."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <button type="button" onClick={handleSaveRates} className={btnPrimaryClass}>
              {saveStatus === 'saving' ? 'Saving…' : 'Save rates'}
            </button>
            {saveMessage && (
              <p className={`text-xs ${saveStatus === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                {saveMessage}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
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
              Team pay includes plan roles (AM / videographer / photographer) plus editor points on completed
              cards (${payRates.reelPointRate}/pt, carousel ${payRates.carouselRate}, static $
              {payRates.staticPostRate}). Custom people use fields only.
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
                rates={payRates}
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
        </>
      )}
    </section>
  );
}
