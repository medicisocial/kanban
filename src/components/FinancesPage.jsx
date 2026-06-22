import { useState, useMemo, useCallback } from 'react';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { IconChevronLeft, IconChevronRight } from './clientPortal/ClientPortalIcons';
import { useFinances } from '../hooks/useFinances';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useClientsContext } from '../context/ClientsContext';

/** Format a number as a dollar string. */
function fmt$(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('en-US');
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
        onChange={(e) => setDraft(e.target.value)}
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

export default function FinancesPage() {
  const {
    setMonthlyRetainer,
    setOneOffRevenue,
    setPayroll,
    setExpenses,
    getMonthlySnapshot,
    getAllMonths,
    getAllClientsWithRetainers,
    currentYearMonth,
  } = useFinances();

  const { session } = useStaffAuth();
  const { clients } = useClientsContext();

  // Determine if user has admin access (Owner or Creative Director)
  const isAdmin = useMemo(() => {
    if (!session?.roles) return false;
    return session.roles.some((r) => r === 'Owner' || r === 'Creative Director');
  }, [session]);

  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState(() => currentYearMonth());

  const months = useMemo(() => {
    const all = getAllMonths();
    if (!all.includes(selectedMonth)) {
      all.push(selectedMonth);
    }
    return all.sort();
  }, [getAllMonths, selectedMonth]);

  const currentIndex = months.indexOf(selectedMonth);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < months.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) setSelectedMonth(months[currentIndex - 1]);
  }, [hasPrev, months, currentIndex]);

  const goNext = useCallback(() => {
    if (hasNext) setSelectedMonth(months[currentIndex + 1]);
  }, [hasNext, months, currentIndex]);

  const snapshot = useMemo(
    () => getMonthlySnapshot(selectedMonth),
    [getMonthlySnapshot, selectedMonth],
  );

  // All client names from workspace + any that have retainer data
  const allClientNames = useMemo(() => {
    const nameSet = new Set(clients || []);
    for (const c of getAllClientsWithRetainers()) {
      nameSet.add(c);
    }
    return Array.from(nameSet).sort();
  }, [clients, getAllClientsWithRetainers]);

  // Month display label
  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    const date = new Date(Number(y), Number(m) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  if (!isAdmin) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Finances"
          description="Monthly revenue, payroll, and expense tracking."
        />
        <div className={`${surfacePanelClass} p-6 text-center`}>
          <p className="text-sm text-white/45">
            Only Owners and Creative Directors can access financial data.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ClientPortalSectionHeader
        title="Finances"
        description="Monthly revenue, payroll, and expense tracking."
      />

      {/* Month selector */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={!hasPrev}
          className={`rounded p-1 ${hasPrev ? 'cursor-pointer text-white/70 hover:text-white' : 'text-white/20'}`}
        >
          <IconChevronLeft />
        </button>
        <h2 className="text-lg font-semibold text-white">{monthLabel}</h2>
        <button
          type="button"
          onClick={goNext}
          disabled={!hasNext}
          className={`rounded p-1 ${hasNext ? 'cursor-pointer text-white/70 hover:text-white' : 'text-white/20'}`}
        >
          <IconChevronRight />
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Revenue</p>
          <p className="mt-1 text-lg font-bold text-emerald-300">{fmt$(snapshot.totalRevenue)}</p>
        </div>
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Payroll</p>
          <p className="mt-1 text-lg font-bold text-amber-300">{fmt$(snapshot.payroll)}</p>
        </div>
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Expenses</p>
          <p className="mt-1 text-lg font-bold text-red-300">{fmt$(snapshot.expenses)}</p>
        </div>
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Net Profit</p>
          <p
            className={`mt-1 text-lg font-bold ${
              snapshot.netProfit >= 0 ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {fmt$(snapshot.netProfit)}
          </p>
        </div>
      </div>

      {/* Revenue section */}
      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <h3 className="mb-3 text-sm font-semibold text-white">Revenue — Retainers</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-white/40">
                <th className="pb-2 pr-4 font-medium">Client</th>
                <th className="pb-2 text-right font-medium">Monthly Retainer</th>
              </tr>
            </thead>
            <tbody>
              {allClientNames.map((client) => {
                const retainerAmount = snapshot.retainers[client] || 0;
                return (
                  <tr key={client} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white/80">{client}</td>
                    <td className="py-2 text-right">
                      <EditableAmount
                        value={retainerAmount}
                        onSave={(amount) => setMonthlyRetainer(client, selectedMonth, amount)}
                      />
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-white/20 font-semibold">
                <td className="py-2 pr-4 text-white">Total Retainers</td>
                <td className="py-2 text-right text-emerald-300">
                  {fmt$(snapshot.retainerTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* One-off projects revenue */}
      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">One-off Projects</h3>
            <p className="mt-1 text-xs text-white/45">Project-based revenue outside retainers</p>
          </div>
          <EditableAmount
            value={snapshot.oneOff}
            onSave={(amount) => setOneOffRevenue(selectedMonth, amount)}
            className="text-base font-bold text-white"
          />
        </div>
      </div>

      {/* Total Revenue row */}
      <div className={`${surfacePanelClass} mb-6 border border-emerald-500/20 p-5`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-300">Total Revenue</h3>
          <p className="text-lg font-bold text-emerald-300">{fmt$(snapshot.totalRevenue)}</p>
        </div>
      </div>

      {/* Payroll */}
      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Payroll</h3>
            <p className="mt-1 text-xs text-white/45">Total staff payroll for this month</p>
          </div>
          <EditableAmount
            value={snapshot.payroll}
            onSave={(amount) => setPayroll(selectedMonth, amount)}
            className="text-base font-bold text-amber-300"
          />
        </div>
      </div>

      {/* Expenses */}
      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Expenses</h3>
            <p className="mt-1 text-xs text-white/45">Operating expenses for this month</p>
          </div>
          <EditableAmount
            value={snapshot.expenses}
            onSave={(amount) => setExpenses(selectedMonth, amount)}
            className="text-base font-bold text-red-300"
          />
        </div>
      </div>

      {/* Net Profit */}
      <div
        className={`${surfacePanelClass} border p-5 ${
          snapshot.netProfit >= 0
            ? 'border-emerald-500/20'
            : 'border-red-500/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Net Profit</h3>
          <p
            className={`text-lg font-bold ${
              snapshot.netProfit >= 0 ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {fmt$(snapshot.netProfit)}
          </p>
        </div>
      </div>
    </section>
  );
}