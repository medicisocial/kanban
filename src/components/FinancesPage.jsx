import { useState, useMemo, useCallback } from 'react';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { IconChevronLeft, IconChevronRight } from './clientPortal/ClientPortalIcons';
import { useStaffAuth } from '../context/StaffAuthContext';
import { useClientsContext } from '../context/ClientsContext';
import { isSharedOperationsLogin } from '../utils/staffAuth';
import { staffHasLeadershipWorkspaceAccess } from '../utils/staffMembers';

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

function AddLineItemForm({ label, amountLabel = 'Monthly amount', includeCategory = false, onAdd }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedAmount = parse$(amount);
    if (!trimmedName && !parsedAmount) return;
    onAdd({
      name: trimmedName || label,
      category: category.trim(),
      amount: parsedAmount,
    });
    setName('');
    setCategory('');
    setAmount('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`mt-3 grid grid-cols-1 gap-2 ${
        includeCategory ? 'sm:grid-cols-[1fr_10rem_9rem_auto]' : 'sm:grid-cols-[1fr_9rem_auto]'
      }`}
    >
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={label}
        className={financeInputClass}
      />
      {includeCategory && (
        <input
          type="text"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category"
          className={financeInputClass}
        />
      )}
      <input
        type="text"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder={amountLabel}
        className={`${financeInputClass} text-right`}
      />
      <button type="submit" className={`${btnSecondaryClass} justify-center py-1.5 text-[10px]`}>
        Add
      </button>
    </form>
  );
}

function PaymentMethodSelect({ value, onChange }) {
  return (
    <select
      value={value || 'ach'}
      onChange={(event) => onChange(event.target.value)}
      className={`${financeInputClass} w-auto min-w-28`}
      title="QuickBooks payment method"
    >
      <option value="ach">ACH / bank</option>
      <option value="cc">Credit card</option>
    </select>
  );
}

function AddOneOffProjectForm({ onAdd }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ach');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedAmount = parse$(amount);
    if (!trimmedName && !parsedAmount) return;
    onAdd({
      name: trimmedName || 'One-off project',
      amount: parsedAmount,
      paymentMethod,
    });
    setName('');
    setAmount('');
    setPaymentMethod('ach');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_8rem_auto]"
    >
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Project name"
        className={financeInputClass}
      />
      <input
        type="text"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="Invoice amount"
        className={`${financeInputClass} text-right`}
      />
      <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
      <button type="submit" className={`${btnSecondaryClass} justify-center py-1.5 text-[10px]`}>
        Add project
      </button>
    </form>
  );
}

function OneOffProjectsTable({ projects, onUpdate, onDelete }) {
  if (!projects.length) {
    return <p className="mt-3 text-xs text-white/35">No one-off projects added yet.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-white/40">
            <th className="pb-2 pr-4 font-medium">Project</th>
            <th className="pb-2 pr-4 text-right font-medium">Invoice</th>
            <th className="pb-2 pr-4 font-medium">Payment</th>
            <th className="pb-2 pr-4 text-right font-medium">QB Fee</th>
            <th className="pb-2 pr-4 text-right font-medium">Net Deposit</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b border-white/5 align-middle">
              <td className="py-2 pr-4">
                <input
                  type="text"
                  value={project.name}
                  onChange={(event) => onUpdate(project.id, { name: event.target.value })}
                  className={financeInputClass}
                />
              </td>
              <td className="py-2 pr-4 text-right">
                <EditableAmount
                  value={project.amount}
                  onSave={(amount) => onUpdate(project.id, { amount })}
                />
              </td>
              <td className="py-2 pr-4">
                <PaymentMethodSelect
                  value={project.paymentMethod}
                  onChange={(paymentMethod) => onUpdate(project.id, { paymentMethod })}
                />
              </td>
              <td className="py-2 pr-4 text-right text-red-200">{fmt$(project.qbFee)}</td>
              <td className="py-2 pr-4 text-right text-emerald-200">
                {fmt$((Number(project.amount) || 0) - (Number(project.qbFee) || 0))}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => onDelete(project.id)}
                  className="text-xs text-white/35 hover:text-rose-300"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinanceLineItems({
  items = [],
  emptyLabel,
  showCategory = false,
  showRecurring = false,
  onUpdate,
  onDelete,
  onStopRecurring,
}) {
  if (!items.length) {
    return <p className="mt-3 text-xs text-white/35">{emptyLabel}</p>;
  }

  return (
    <div className="mt-3 divide-y divide-white/5">
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-[1fr_10rem_7rem_auto] sm:items-center">
          <input
            type="text"
            value={item.name}
            onChange={(event) => onUpdate(item.id, { name: event.target.value })}
            className={financeInputClass}
          />
          {showCategory ? (
            <input
              type="text"
              value={item.category || ''}
              onChange={(event) => onUpdate(item.id, { category: event.target.value })}
              placeholder="Category"
              className={financeInputClass}
            />
          ) : showRecurring ? (
            <span className={`text-xs ${item.recurring === false ? 'text-amber-200' : 'text-emerald-200'}`}>
              {item.recurring === false ? 'Stops after this month' : 'Recurring monthly'}
            </span>
          ) : (
            <span className="hidden text-xs text-white/30 sm:block">{item.category || ''}</span>
          )}
          <EditableAmount
            value={item.amount}
            onSave={(amount) => onUpdate(item.id, { amount })}
            className="justify-self-end text-white"
          />
          <div className="flex flex-wrap gap-2 justify-self-start sm:justify-self-end">
            {showRecurring && item.recurring !== false && (
              <button
                type="button"
                onClick={() => onStopRecurring?.(item.id)}
                className="text-xs text-white/35 hover:text-amber-200"
              >
                Stop recurring
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="text-xs text-white/35 hover:text-rose-300"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FinancesPage({ finances }) {
  const {
    setMonthlyRetainer,
    saveFinancesNow,
    ensureRecurringMonth,
    setRetainerPaymentMethod,
    addOneOffProject,
    updateOneOffProject,
    deleteOneOffProject,
    setPayroll,
    addPayrollStaff,
    updatePayrollStaff,
    deletePayrollStaff,
    setOwnerComp,
    setExpenses,
    addExpenseItem,
    updateExpenseItem,
    deleteExpenseItem,
    stopRecurringSubscription,
    setOneTimeExpenses,
    getMonthlySnapshot,
    getAllClientsWithRetainers,
    currentYearMonth,
  } = finances;

  const { session, org } = useStaffAuth();
  const { clients, teamMembers } = useClientsContext();

  // Shared agency ops login and leadership roles can access financials.
  const isAdmin = useMemo(() => {
    const orgRole = String(org?.role || '').toLowerCase();
    return (
      isSharedOperationsLogin(session) ||
      staffHasLeadershipWorkspaceAccess(session, teamMembers) ||
      orgRole === 'owner' ||
      orgRole === 'admin'
    );
  }, [session, teamMembers, org?.role]);

  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState(() => currentYearMonth());
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const shiftMonth = useCallback((yearMonth, offset) => {
    const [year, month] = String(yearMonth || currentYearMonth()).split('-').map(Number);
    const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }, [currentYearMonth]);

  const selectMonth = useCallback((nextMonth) => {
    ensureRecurringMonth(nextMonth);
    setSelectedMonth(nextMonth);
  }, [ensureRecurringMonth]);

  const goPrev = useCallback(() => {
    setSelectedMonth((month) => shiftMonth(month, -1));
  }, [shiftMonth]);

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
      setSaveMessage(error?.message || 'Could not save finances.');
    }
  }, [saveFinancesNow]);

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

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Revenue</p>
          <p className="mt-1 text-lg font-bold text-emerald-300">{fmt$(snapshot.totalRevenue)}</p>
          <p className="mt-1 text-[10px] text-white/35">Gross invoices</p>
        </div>
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Payroll</p>
          <p className="mt-1 text-lg font-bold text-amber-300">{fmt$(snapshot.payroll)}</p>
        </div>
        <div className={`${surfacePanelClass} p-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40">Expenses</p>
          <p className="mt-1 text-lg font-bold text-red-300">{fmt$(snapshot.expenses)}</p>
          {snapshot.qbFees > 0 && (
            <p className="mt-1 text-[10px] text-red-200/70">Includes {fmt$(snapshot.qbFees)} QB fees</p>
          )}
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
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white">Revenue — Retainers</h3>
          <p className="mt-1 text-xs text-white/45">
            Track gross invoice revenue. Credit card payments add a 2.9% + $0.25 QB fee expense.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-white/40">
                <th className="pb-2 pr-4 font-medium">Client</th>
                <th className="pb-2 pr-4 text-right font-medium">Monthly Retainer</th>
                <th className="pb-2 pr-4 font-medium">Payment</th>
                <th className="pb-2 pr-4 text-right font-medium">QB Fee</th>
                <th className="pb-2 text-right font-medium">Net Deposit</th>
              </tr>
            </thead>
            <tbody>
              {allClientNames.map((client) => {
                const retainerAmount = snapshot.retainers[client] || 0;
                const payment = snapshot.retainerPayments?.[client] || {};
                return (
                  <tr key={client} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white/80">{client}</td>
                    <td className="py-2 pr-4 text-right">
                      <EditableAmount
                        value={retainerAmount}
                        onSave={(amount) => setMonthlyRetainer(client, selectedMonth, amount)}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <PaymentMethodSelect
                        value={payment.paymentMethod}
                        onChange={(method) => setRetainerPaymentMethod(client, selectedMonth, method)}
                      />
                    </td>
                    <td className="py-2 pr-4 text-right text-red-200">{fmt$(payment.qbFee)}</td>
                    <td className="py-2 text-right text-emerald-200">
                      {fmt$(retainerAmount - (Number(payment.qbFee) || 0))}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-white/20 font-semibold">
                <td className="py-2 pr-4 text-white">Total Retainers</td>
                <td className="py-2 pr-4 text-right text-emerald-300">
                  {fmt$(snapshot.retainerTotal)}
                </td>
                <td className="py-2 pr-4 text-white/35">Gross</td>
                <td className="py-2 pr-4 text-right text-red-200">{fmt$(snapshot.retainerQbFees)}</td>
                <td className="py-2 text-right text-emerald-200">
                  {fmt$(snapshot.retainerTotal - snapshot.retainerQbFees)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* One-off projects revenue */}
      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">One-off Projects</h3>
            <p className="mt-1 text-xs text-white/45">Project-based invoices outside retainers</p>
          </div>
          <p className="text-base font-bold text-emerald-300">{fmt$(snapshot.oneOff)}</p>
        </div>
        <OneOffProjectsTable
          projects={snapshot.oneOffProjects}
          onUpdate={(id, updates) => updateOneOffProject(selectedMonth, id, updates)}
          onDelete={(id) => deleteOneOffProject(selectedMonth, id)}
        />
        {snapshot.oneOffQbFees > 0 && (
          <p className="mt-2 text-xs text-red-200/75">
            QuickBooks card fees on one-off projects: {fmt$(snapshot.oneOffQbFees)}
          </p>
        )}
        <AddOneOffProjectForm
          onAdd={(project) => addOneOffProject(selectedMonth, project)}
        />
      </div>

      {/* Total Revenue row */}
      <div className={`${surfacePanelClass} mb-6 border border-emerald-500/20 p-5`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-300">Total Revenue</h3>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-300">{fmt$(snapshot.totalRevenue)}</p>
            <p className="text-xs text-white/40">
              Net after QB card fees: {fmt$(snapshot.effectiveRevenue)}
            </p>
          </div>
        </div>
      </div>

      {/* Payroll */}
      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Payroll</h3>
            <p className="mt-1 text-xs text-white/45">Staff monthly pay and owner compensation</p>
          </div>
          <p className="text-base font-bold text-amber-300">{fmt$(snapshot.payroll)}</p>
        </div>

        {snapshot.legacyPayroll > 0 && !snapshot.payrollStaff.length && (
          <div className="mt-3 flex items-center justify-between rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-amber-100">Legacy payroll total</p>
              <p className="text-[11px] text-white/40">Break this into staff rows when ready.</p>
            </div>
            <EditableAmount
              value={snapshot.legacyPayroll}
              onSave={(amount) => setPayroll(selectedMonth, amount)}
              className="text-amber-200"
            />
          </div>
        )}

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

        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Staff monthly pay</p>
              <p className="mt-0.5 text-[11px] text-white/40">Add W-2 employees or recurring 1099 contractor pay.</p>
            </div>
            <span className="text-xs font-semibold text-amber-300">
              {fmt$(snapshot.payrollStaff.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
            </span>
          </div>
          <FinanceLineItems
            items={snapshot.payrollStaff}
            emptyLabel="No staff pay rows yet."
            onUpdate={(id, updates) => updatePayrollStaff(selectedMonth, id, updates)}
            onDelete={(id) => deletePayrollStaff(selectedMonth, id)}
          />
          <AddLineItemForm
            label="Staff member or contractor"
            amountLabel="Monthly pay"
            onAdd={(item) => addPayrollStaff(selectedMonth, item)}
          />
        </div>
      </div>

      {/* Expenses */}
      <div className={`${surfacePanelClass} mb-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Expenses</h3>
            <p className="mt-1 text-xs text-white/45">Operating expenses and monthly subscriptions</p>
          </div>
          <p className="text-base font-bold text-red-300">{fmt$(snapshot.expenses)}</p>
        </div>

        {snapshot.legacyExpenses > 0 && !snapshot.expenseItems.length && !snapshot.subscriptions.length && (
          <div className="mt-3 flex items-center justify-between rounded border border-red-500/20 bg-red-500/5 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-red-100">Legacy expense total</p>
              <p className="text-[11px] text-white/40">Break this into expense or subscription rows when ready.</p>
            </div>
            <EditableAmount
              value={snapshot.legacyExpenses}
              onSave={(amount) => setExpenses(selectedMonth, amount)}
              className="text-red-200"
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div>
            <p className="text-xs font-semibold text-white">One-time / uncategorized expenses</p>
            <p className="mt-0.5 text-[11px] text-white/40">Use for quick entries before itemizing.</p>
          </div>
          <EditableAmount
            value={snapshot.oneTimeExpenses}
            onSave={(amount) => setOneTimeExpenses(selectedMonth, amount)}
            className="text-red-200"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div>
            <p className="text-xs font-semibold text-white">QuickBooks Payments - CC Fees</p>
            <p className="mt-0.5 text-[11px] text-white/40">Auto-calculated at 2.9% + $0.25 for credit card invoices.</p>
          </div>
          <p className="text-xs font-semibold text-red-200">{fmt$(snapshot.qbFees)}</p>
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Monthly subscriptions</p>
              <p className="mt-0.5 text-[11px] text-white/40">Software, hosting, scheduling tools, and recurring overhead.</p>
            </div>
            <span className="text-xs font-semibold text-red-300">
              {fmt$(snapshot.subscriptions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
            </span>
          </div>
          <FinanceLineItems
            items={snapshot.subscriptions}
            emptyLabel="No monthly subscriptions yet."
            showRecurring
            onUpdate={(id, updates) => updateExpenseItem(selectedMonth, id, updates, 'subscriptions')}
            onDelete={(id) => deleteExpenseItem(selectedMonth, id, 'subscriptions')}
            onStopRecurring={(id) => stopRecurringSubscription(selectedMonth, id)}
          />
          <AddLineItemForm
            label="Subscription name"
            amountLabel="Monthly cost"
            onAdd={(item) => addExpenseItem(selectedMonth, item, 'subscriptions')}
          />
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Other operating expenses</p>
              <p className="mt-0.5 text-[11px] text-white/40">Gear, meals, transportation, ads, professional services, fees.</p>
            </div>
            <span className="text-xs font-semibold text-red-300">
              {fmt$(snapshot.expenseItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
            </span>
          </div>
          <FinanceLineItems
            items={snapshot.expenseItems}
            emptyLabel="No itemized expenses yet."
            showCategory
            onUpdate={(id, updates) => updateExpenseItem(selectedMonth, id, updates, 'expenses')}
            onDelete={(id) => deleteExpenseItem(selectedMonth, id, 'expenses')}
          />
          <AddLineItemForm
            label="Expense name"
            amountLabel="Amount"
            includeCategory
            onAdd={(item) => addExpenseItem(selectedMonth, item, 'expenses')}
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
          {saveStatus === 'saving' ? 'Saving...' : 'Save finances'}
        </button>
      </div>
    </section>
  );
}