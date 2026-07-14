import { useState, useEffect, useCallback, useRef } from 'react';
import { FINANCES_STORAGE_KEY } from '../constants';
import { normalizePayRates, DEFAULT_PAY_RATES } from '../constants/clientPlans';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';
import { pushStaffSyncRows } from '../lib/staffSyncApi';

/** Return the current month as "YYYY-MM". */
function currentYearMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getFinanceId(category) {
  return category?.id || category; // 'revenue' | 'payroll' | 'expenses'
}

const FINANCE_RECORD_IDS = new Set(['revenue', 'payroll', 'expenses', 'pay_rates']);

function isFinanceRecord(record) {
  return FINANCE_RECORD_IDS.has(getFinanceId(record));
}

function loadFinances() {
  try {
    const parsed = readOrgScopedJson(FINANCES_STORAGE_KEY, null);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  return [];
}

function createLineItem(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    amount: 0,
    category: '',
    ...overrides,
  };
}

function isCreditCardPayment(method) {
  return method === 'cc';
}

function calculateQuickBooksCardFee(amount) {
  const value = Number(amount) || 0;
  return value > 0 ? (value * 0.029) + 0.25 : 0;
}

function previousYearMonth(yearMonth) {
  const [year, month] = String(yearMonth || currentYearMonth()).split('-').map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function compareYearMonth(left, right) {
  return String(left || '').localeCompare(String(right || ''));
}

function createRevenueItem(overrides = {}) {
  const item = {
    id: crypto.randomUUID(),
    name: '',
    amount: 0,
    paymentMethod: 'ach',
    ...overrides,
  };
  return {
    ...item,
    amount: Number(item.amount) || 0,
    qbFee:
      item.qbFee !== undefined
        ? Number(item.qbFee) || 0
        : isCreditCardPayment(item.paymentMethod)
          ? calculateQuickBooksCardFee(item.amount)
          : 0,
  };
}

function createSubscriptionItem(overrides = {}) {
  const item = createLineItem(overrides);
  const recurringId = item.recurringId || item.id;
  return {
    ...item,
    recurringId,
    recurring: item.recurring !== false,
  };
}

function getRevenueMonth(revenue, yearMonth) {
  return revenue?.data?.[yearMonth] && typeof revenue.data[yearMonth] === 'object'
    ? revenue.data[yearMonth]
    : {};
}

function getRetainerEntries(monthRevenue) {
  return Object.entries(monthRevenue || {}).filter(([key, value]) => {
    if (
      key === 'oneOff' ||
      key === 'oneOffProjects' ||
      key === 'retainersMeta' ||
      key === 'retainerTotal'
    ) {
      return false;
    }
    return typeof value === 'number' || typeof value === 'string';
  });
}

function calculateRetainerTotal(monthRevenue) {
  return getRetainerEntries(monthRevenue).reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
}

function normalizeRetainerMeta(monthRevenue, client) {
  const meta = monthRevenue?.retainersMeta?.[client];
  const amount = Number(monthRevenue?.[client]) || 0;
  return createRevenueItem({
    name: client,
    amount,
    paymentMethod: meta?.paymentMethod || 'ach',
    qbFee: meta?.qbFee,
  });
}

function normalizeOneOffProjects(monthRevenue) {
  if (Array.isArray(monthRevenue?.oneOffProjects)) {
    return monthRevenue.oneOffProjects
      .map((item) => createRevenueItem(item))
      .filter((item) => item.name || item.amount);
  }
  const legacyOneOff = Number(monthRevenue?.oneOff) || 0;
  return legacyOneOff
    ? [createRevenueItem({
        id: 'legacy-one-off-projects',
        name: 'Legacy one-off projects',
        amount: legacyOneOff,
        paymentMethod: 'ach',
      })]
    : [];
}

function createPayrollExtraField(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    // Preserve empty / in-progress labels — do not coerce blank back to "Pay"
    // on every keystroke (that made the word "Pay" keep reappearing while editing).
    label: Object.prototype.hasOwnProperty.call(overrides, 'label')
      ? String(overrides.label ?? '')
      : 'Pay',
    amount: Number(overrides.amount) || 0,
  };
}

function normalizePayrollExtraFields(item = {}) {
  if (Array.isArray(item.extraFields) && item.extraFields.length > 0) {
    return item.extraFields.map((field) => createPayrollExtraField(field));
  }
  if (Array.isArray(item.extraFields)) {
    return [];
  }
  // Legacy flat `amount` → one field labeled "Pay"
  if (item.amount !== undefined && item.amount !== null && item.amount !== '') {
    return [createPayrollExtraField({ label: 'Pay', amount: Number(item.amount) || 0 })];
  }
  return [];
}

function sumExtraFields(extraFields = []) {
  return extraFields.reduce((sum, field) => sum + (Number(field.amount) || 0), 0);
}

function createPayrollStaff(overrides = {}) {
  const kind = overrides.kind === 'team' ? 'team' : 'custom';
  const name = String(overrides.name || '').trim();
  const extraFields = normalizePayrollExtraFields(overrides);
  return {
    id: overrides.id || crypto.randomUUID(),
    name,
    kind,
    teamMemberId: kind === 'team' ? overrides.teamMemberId || null : null,
    extraFields,
  };
}

function payrollStaffExtraTotal(staff = []) {
  return staff.reduce((sum, item) => sum + sumExtraFields(item.extraFields), 0);
}

function personPayrollTotal(person, pointsPay = 0, planPay = 0) {
  const extras = sumExtraFields(person?.extraFields);
  const teamPay =
    person?.kind === 'team' ? (Number(pointsPay) || 0) + (Number(planPay) || 0) : 0;
  return teamPay + extras;
}

function normalizePayrollMonth(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const staff = Array.isArray(value.staff)
      ? value.staff
          .map((item) => createPayrollStaff(item))
          .filter((item) => item.name || item.extraFields.length > 0)
      : [];
    const ownerComp = Number(value.ownerComp) || 0;
    const legacyTotal = Number(value.legacyTotal) || 0;
    return {
      staff,
      ownerComp,
      legacyTotal,
      // Stored total excludes live reel-points pay (computed at snapshot time).
      total: payrollStaffExtraTotal(staff) + ownerComp + legacyTotal,
    };
  }
  return {
    staff: [],
    ownerComp: 0,
    total: Number(value) || 0,
    legacyTotal: Number(value) || 0,
  };
}

function writePayrollMonth(month) {
  const payload = {
    staff: month.staff,
    ownerComp: month.ownerComp,
  };
  if (month.legacyTotal) {
    payload.legacyTotal = month.legacyTotal;
  }
  return payload;
}

function copyPayrollRoster(previousMonth) {
  const previous = normalizePayrollMonth(previousMonth);
  if (!previous.staff.length && !previous.ownerComp) return null;
  return {
    staff: previous.staff.map((item) =>
      createPayrollStaff({
        ...item,
        id: crypto.randomUUID(),
        extraFields: item.extraFields.map((field) =>
          createPayrollExtraField({ ...field, id: crypto.randomUUID() }),
        ),
      }),
    ),
    ownerComp: previous.ownerComp,
  };
}

function normalizeExpensesMonth(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const expenses = Array.isArray(value.expenses)
      ? value.expenses.map((item) => createLineItem(item)).filter((item) => item.name || item.amount)
      : [];
    const subscriptions = Array.isArray(value.subscriptions)
      ? value.subscriptions.map((item) => createSubscriptionItem(item)).filter((item) => item.name || item.amount)
      : [];
    const oneTime = Number(value.oneTime) || 0;
    return {
      expenses,
      subscriptions,
      oneTime,
      total:
        oneTime +
        expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) +
        subscriptions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    };
  }
  return {
    expenses: [],
    subscriptions: [],
    oneTime: 0,
    total: Number(value) || 0,
    legacyTotal: Number(value) || 0,
  };
}

function copyRecurringRetainers(previousMonth) {
  if (!previousMonth || typeof previousMonth !== 'object') return null;
  const retainers = Object.fromEntries(getRetainerEntries(previousMonth));
  if (!Object.keys(retainers).length) return null;
  const retainersMeta = {};
  for (const [client, amount] of Object.entries(retainers)) {
    const previousMeta = previousMonth.retainersMeta?.[client] || {};
    retainersMeta[client] = createRevenueItem({
      ...previousMeta,
      name: client,
      amount,
      qbFee: undefined,
    });
  }
  return {
    ...retainers,
    retainersMeta,
    oneOff: 0,
    oneOffProjects: [],
    retainerTotal: calculateRetainerTotal(retainers),
  };
}

function copyRecurringSubscriptions(previousMonth) {
  const previous = normalizeExpensesMonth(previousMonth);
  const recurringSubscriptions = previous.subscriptions.filter((item) => item.recurring !== false);
  if (!recurringSubscriptions.length) return null;
  return {
    expenses: [],
    subscriptions: recurringSubscriptions.map((item) =>
      createSubscriptionItem({
        ...item,
        id: crypto.randomUUID(),
      }),
    ),
    oneTime: 0,
  };
}

function mergeRecurringSubscriptions(targetMonth, previousMonth) {
  const target = normalizeExpensesMonth(targetMonth);
  const copied = copyRecurringSubscriptions(previousMonth);
  if (!copied) return { month: targetMonth, changed: false };

  const existingRecurringIds = new Set(
    target.subscriptions.map((item) => item.recurringId || item.id).filter(Boolean),
  );
  const missingSubscriptions = copied.subscriptions.filter((item) => {
    const recurringId = item.recurringId || item.id;
    return recurringId && !existingRecurringIds.has(recurringId);
  });

  if (!missingSubscriptions.length) return { month: targetMonth, changed: false };
  return {
    month: {
      expenses: target.expenses,
      subscriptions: [...target.subscriptions, ...missingSubscriptions],
      oneTime: target.oneTime,
    },
    changed: true,
  };
}

/**
 * Creates or ensures a finance record shape.
 * Each record is { id, data: { ... } } where id is 'revenue', 'payroll', or 'expenses'.
 * data maps "YYYY-MM" → value (for payroll/expenses) or { per-client retainers + oneOff }
 */
export function useFinances() {
  const [finances, setFinances] = useState(() =>
    initialSyncCollectionState(loadFinances, { table: 'finances', getId: getFinanceId }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setFinances(loadFinances());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useCollectionSync({
    table: 'finances',
    items: finances,
    setItems: setFinances,
    getId: getFinanceId,
    filterItems: (items) => items.filter(isFinanceRecord),
    loadLocal: loadFinances,
  });

  // Debounce localStorage writes
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeOrgScopedJson(FINANCES_STORAGE_KEY, finances);
    }, 400);
    return () => clearTimeout(persistTimerRef.current);
  }, [finances, syncLoaded]);

  const replaceFinances = useCallback((next) => {
    setFinances(next);
  }, []);

  const saveFinancesNow = useCallback(async () => {
    if (!SUPABASE_ENABLED) {
      writeOrgScopedJson(FINANCES_STORAGE_KEY, finances);
      return { ok: true, localOnly: true };
    }
    const rows = finances.map((record) => ({ id: getFinanceId(record.id), data: record }));
    const ok = await pushStaffSyncRows('finances', rows);
    if (!ok) {
      throw new Error('Could not save finances to Supabase. Please make sure you are signed in and try again.');
    }
    return { ok: true };
  }, [finances]);

  const ensureRecurringMonth = useCallback((yearMonth) => {
    notifyMutation();
    setFinances((prev) => {
      const previousMonth = previousYearMonth(yearMonth);
      let changed = false;
      let next = prev;

      const revenue = next.find((r) => r.id === 'revenue');
      const revenueData = revenue?.data ? { ...revenue.data } : {};
      if (!revenueData[yearMonth]) {
        const copiedRevenue = copyRecurringRetainers(revenueData[previousMonth]);
        if (copiedRevenue) {
          revenueData[yearMonth] = copiedRevenue;
          next = [
            ...next.filter((r) => r.id !== 'revenue'),
            { id: 'revenue', data: revenueData },
          ];
          changed = true;
        }
      }

      const expenses = next.find((r) => r.id === 'expenses');
      const expensesData = expenses?.data ? { ...expenses.data } : {};
      const recurringSubscriptions = mergeRecurringSubscriptions(
        expensesData[yearMonth],
        expensesData[previousMonth],
      );
      if (recurringSubscriptions.changed) {
        expensesData[yearMonth] = recurringSubscriptions.month;
        next = [
          ...next.filter((r) => r.id !== 'expenses'),
          { id: 'expenses', data: expensesData },
        ];
        changed = true;
      }

      const payroll = next.find((r) => r.id === 'payroll');
      const payrollData = payroll?.data ? { ...payroll.data } : {};
      const existingPayroll = normalizePayrollMonth(payrollData[yearMonth]);
      if (!payrollData[yearMonth] || (!existingPayroll.staff.length && !existingPayroll.ownerComp && !existingPayroll.legacyTotal)) {
        const copiedPayroll = copyPayrollRoster(payrollData[previousMonth]);
        if (copiedPayroll) {
          payrollData[yearMonth] = copiedPayroll;
          next = [
            ...next.filter((r) => r.id !== 'payroll'),
            { id: 'payroll', data: payrollData },
          ];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, []);

  /** Get a finance record by id, creating default if doesn't exist. */
  const ensureRecord = useCallback(
    (id) => {
      let record = finances.find((r) => r.id === id);
      if (!record) {
        record = { id, data: {} };
        setFinances((prev) => [...prev, record]);
      }
      return record;
    },
    [finances],
  );

  /** Set a retainer value for a specific client in a specific month. */
  const setMonthlyRetainer = useCallback((client, yearMonth, amount) => {
    notifyMutation();
    setFinances((prev) => {
      const revenue = prev.find((r) => r.id === 'revenue');
      const rest = prev.filter((r) => r.id !== 'revenue');
      const data = revenue?.data ? { ...revenue.data } : {};
      if (!data[yearMonth]) {
        data[yearMonth] = {};
      }
      const month = { ...data[yearMonth] };
      month[client] = Number(amount) || 0;
      const prevMeta = month.retainersMeta?.[client] || {};
      month.retainersMeta = {
        ...(month.retainersMeta || {}),
        [client]: createRevenueItem({
          ...prevMeta,
          name: client,
          amount: month[client],
          qbFee: undefined,
        }),
      };
      month.retainerTotal = calculateRetainerTotal(month);
      data[yearMonth] = month;
      return [...rest, { id: 'revenue', data }];
    });
  }, []);

  const setRetainerPaymentMethod = useCallback((client, yearMonth, paymentMethod) => {
    notifyMutation();
    setFinances((prev) => {
      const revenue = prev.find((r) => r.id === 'revenue');
      const rest = prev.filter((r) => r.id !== 'revenue');
      const data = revenue?.data ? { ...revenue.data } : {};
      const month = { ...(data[yearMonth] || {}) };
      const amount = Number(month[client]) || 0;
      month.retainersMeta = {
        ...(month.retainersMeta || {}),
        [client]: createRevenueItem({
          ...(month.retainersMeta?.[client] || {}),
          name: client,
          amount,
          paymentMethod,
          qbFee: undefined,
        }),
      };
      data[yearMonth] = month;
      return [...rest, { id: 'revenue', data }];
    });
  }, []);

  /** Set one-off project revenue for a month. */
  const setOneOffRevenue = useCallback((yearMonth, amount) => {
    notifyMutation();
    setFinances((prev) => {
      const revenue = prev.find((r) => r.id === 'revenue');
      const rest = prev.filter((r) => r.id !== 'revenue');
      const data = revenue?.data ? { ...revenue.data } : {};
      if (!data[yearMonth]) {
        data[yearMonth] = {};
      }
      const month = { ...data[yearMonth] };
      month.oneOff = Number(amount) || 0;
      data[yearMonth] = month;
      return [...rest, { id: 'revenue', data }];
    });
  }, []);

  const addOneOffProject = useCallback((yearMonth, project) => {
    notifyMutation();
    setFinances((prev) => {
      const revenue = prev.find((r) => r.id === 'revenue');
      const rest = prev.filter((r) => r.id !== 'revenue');
      const data = revenue?.data ? { ...revenue.data } : {};
      const month = { ...(data[yearMonth] || {}) };
      const projects = normalizeOneOffProjects(month);
      month.oneOffProjects = [...projects, createRevenueItem(project)];
      month.oneOff = month.oneOffProjects.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      data[yearMonth] = month;
      return [...rest, { id: 'revenue', data }];
    });
  }, []);

  const updateOneOffProject = useCallback((yearMonth, projectId, updates) => {
    notifyMutation();
    setFinances((prev) => {
      const revenue = prev.find((r) => r.id === 'revenue');
      const rest = prev.filter((r) => r.id !== 'revenue');
      const data = revenue?.data ? { ...revenue.data } : {};
      const month = { ...(data[yearMonth] || {}) };
      month.oneOffProjects = normalizeOneOffProjects(month).map((item) => {
        if (item.id !== projectId) return item;
        const next = { ...item, ...updates };
        if (
          (Object.prototype.hasOwnProperty.call(updates, 'amount') ||
            Object.prototype.hasOwnProperty.call(updates, 'paymentMethod')) &&
          !Object.prototype.hasOwnProperty.call(updates, 'qbFee')
        ) {
          delete next.qbFee;
        }
        return createRevenueItem(next);
      });
      month.oneOff = month.oneOffProjects.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      data[yearMonth] = month;
      return [...rest, { id: 'revenue', data }];
    });
  }, []);

  const deleteOneOffProject = useCallback((yearMonth, projectId) => {
    notifyMutation();
    setFinances((prev) => {
      const revenue = prev.find((r) => r.id === 'revenue');
      const rest = prev.filter((r) => r.id !== 'revenue');
      const data = revenue?.data ? { ...revenue.data } : {};
      const month = { ...(data[yearMonth] || {}) };
      month.oneOffProjects = normalizeOneOffProjects(month).filter((item) => item.id !== projectId);
      month.oneOff = month.oneOffProjects.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      data[yearMonth] = month;
      return [...rest, { id: 'revenue', data }];
    });
  }, []);

  /** Set payroll for a month. */
  const setPayroll = useCallback((yearMonth, amount) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      data[yearMonth] = Number(amount) || 0;
      return [...rest, { id: 'payroll', data }];
    });
  }, []);

  const resolvePayrollMonth = useCallback((data, yearMonth) => {
    const existing = data[yearMonth];
    if (existing !== undefined && existing !== null) {
      return normalizePayrollMonth(existing);
    }
    const copied = copyPayrollRoster(data[previousYearMonth(yearMonth)]);
    if (copied) return normalizePayrollMonth(copied);
    return normalizePayrollMonth(undefined);
  }, []);

  const addPayrollStaff = useCallback((yearMonth, staff) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = resolvePayrollMonth(data, yearMonth);
      const nextStaff = createPayrollStaff(staff);
      if (!nextStaff.name) return prev;
      // Avoid duplicate team members in the same month.
      if (nextStaff.kind === 'team') {
        const nameKey = nextStaff.name.toLowerCase();
        const dup = month.staff.some(
          (item) =>
            item.kind === 'team' &&
            ((nextStaff.teamMemberId && item.teamMemberId === nextStaff.teamMemberId) ||
              String(item.name || '')
                .trim()
                .toLowerCase() === nameKey),
        );
        if (dup) return prev;
      }
      data[yearMonth] = writePayrollMonth({
        staff: [...month.staff, nextStaff],
        ownerComp: month.ownerComp,
        legacyTotal: month.legacyTotal,
      });
      return [...rest, { id: 'payroll', data }];
    });
  }, [resolvePayrollMonth]);

  const updatePayrollStaff = useCallback((yearMonth, staffId, updates) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = resolvePayrollMonth(data, yearMonth);
      data[yearMonth] = writePayrollMonth({
        staff: month.staff.map((item) => {
          if (item.id !== staffId) return item;
          const merged = { ...item, ...updates };
          if (Array.isArray(updates.extraFields)) {
            merged.extraFields = updates.extraFields;
          }
          return createPayrollStaff(merged);
        }),
        ownerComp: month.ownerComp,
        legacyTotal: month.legacyTotal,
      });
      return [...rest, { id: 'payroll', data }];
    });
  }, [resolvePayrollMonth]);

  const deletePayrollStaff = useCallback((yearMonth, staffId) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = resolvePayrollMonth(data, yearMonth);
      data[yearMonth] = writePayrollMonth({
        staff: month.staff.filter((item) => item.id !== staffId),
        ownerComp: month.ownerComp,
        legacyTotal: month.legacyTotal,
      });
      return [...rest, { id: 'payroll', data }];
    });
  }, [resolvePayrollMonth]);

  const setOwnerComp = useCallback((yearMonth, amount) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = resolvePayrollMonth(data, yearMonth);
      data[yearMonth] = writePayrollMonth({
        staff: month.staff,
        ownerComp: Number(amount) || 0,
        legacyTotal: month.legacyTotal,
      });
      return [...rest, { id: 'payroll', data }];
    });
  }, [resolvePayrollMonth]);

  const getPayRates = useCallback(() => {
    const record = finances.find((r) => r.id === 'pay_rates');
    return normalizePayRates(record?.data || DEFAULT_PAY_RATES);
  }, [finances]);

  const setPayRates = useCallback((nextRates) => {
    notifyMutation();
    setFinances((prev) => {
      const rest = prev.filter((r) => r.id !== 'pay_rates');
      return [...rest, { id: 'pay_rates', data: normalizePayRates(nextRates) }];
    });
  }, []);

  /** Set expenses for a month. */
  const setExpenses = useCallback((yearMonth, amount) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'expenses');
      const rest = prev.filter((r) => r.id !== 'expenses');
      const data = record?.data ? { ...record.data } : {};
      data[yearMonth] = Number(amount) || 0;
      return [...rest, { id: 'expenses', data }];
    });
  }, []);

  const addExpenseItem = useCallback((yearMonth, item, type = 'expenses') => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'expenses');
      const rest = prev.filter((r) => r.id !== 'expenses');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizeExpensesMonth(data[yearMonth]);
      const key = type === 'subscriptions' ? 'subscriptions' : 'expenses';
      const nextItem = type === 'subscriptions' ? createSubscriptionItem(item) : createLineItem(item);
      data[yearMonth] = {
        expenses: month.expenses,
        subscriptions: month.subscriptions,
        oneTime: month.oneTime,
        [key]: [...month[key], nextItem],
      };
      return [...rest, { id: 'expenses', data }];
    });
  }, []);

  const updateExpenseItem = useCallback((yearMonth, itemId, updates, type = 'expenses') => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'expenses');
      const rest = prev.filter((r) => r.id !== 'expenses');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizeExpensesMonth(data[yearMonth]);
      const key = type === 'subscriptions' ? 'subscriptions' : 'expenses';
      data[yearMonth] = {
        expenses: month.expenses,
        subscriptions: month.subscriptions,
        oneTime: month.oneTime,
        [key]: month[key].map((item) =>
          item.id === itemId
            ? type === 'subscriptions'
              ? createSubscriptionItem({ ...item, ...updates })
              : createLineItem({ ...item, ...updates })
            : item,
        ),
      };
      return [...rest, { id: 'expenses', data }];
    });
  }, []);

  const stopRecurringSubscription = useCallback((yearMonth, itemId) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'expenses');
      const rest = prev.filter((r) => r.id !== 'expenses');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizeExpensesMonth(data[yearMonth]);
      const subscription = month.subscriptions.find((item) => item.id === itemId);
      if (!subscription) return prev;
      const recurringId = subscription.recurringId || subscription.id;

      data[yearMonth] = {
        expenses: month.expenses,
        subscriptions: month.subscriptions.map((item) =>
          item.id === itemId ? createSubscriptionItem({ ...item, recurring: false }) : item,
        ),
        oneTime: month.oneTime,
      };

      for (const monthKey of Object.keys(data)) {
        if (compareYearMonth(monthKey, yearMonth) <= 0) continue;
        const futureMonth = normalizeExpensesMonth(data[monthKey]);
        const nextSubscriptions = futureMonth.subscriptions.filter(
          (item) => (item.recurringId || item.id) !== recurringId,
        );
        if (nextSubscriptions.length === futureMonth.subscriptions.length) continue;
        data[monthKey] = {
          expenses: futureMonth.expenses,
          subscriptions: nextSubscriptions,
          oneTime: futureMonth.oneTime,
        };
      }

      return [...rest, { id: 'expenses', data }];
    });
  }, []);

  const deleteExpenseItem = useCallback((yearMonth, itemId, type = 'expenses') => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'expenses');
      const rest = prev.filter((r) => r.id !== 'expenses');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizeExpensesMonth(data[yearMonth]);
      const key = type === 'subscriptions' ? 'subscriptions' : 'expenses';
      data[yearMonth] = {
        expenses: month.expenses,
        subscriptions: month.subscriptions,
        oneTime: month.oneTime,
        [key]: month[key].filter((item) => item.id !== itemId),
      };
      return [...rest, { id: 'expenses', data }];
    });
  }, []);

  const setOneTimeExpenses = useCallback((yearMonth, amount) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'expenses');
      const rest = prev.filter((r) => r.id !== 'expenses');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizeExpensesMonth(data[yearMonth]);
      data[yearMonth] = {
        expenses: month.expenses,
        subscriptions: month.subscriptions,
        oneTime: Number(amount) || 0,
      };
      return [...rest, { id: 'expenses', data }];
    });
  }, []);

  /**
   * Get all data for a given month across revenue/payroll/expenses.
   * @param {string} yearMonth
   * @param {{ pointsPayByName?: Record<string, number>, pointsByName?: Record<string, number> }} [options]
   *   Optional maps keyed by assignee name (case-insensitive). Used for team reel-points pay.
   */
  const getMonthlySnapshot = useCallback(
    (yearMonth, options = {}) => {
      const revenue = finances.find((r) => r.id === 'revenue');
      const payroll = finances.find((r) => r.id === 'payroll');
      const expenses = finances.find((r) => r.id === 'expenses');

      const monthRevenue = getRevenueMonth(revenue, yearMonth);
      const retainerTotal = calculateRetainerTotal(monthRevenue);
      const oneOffProjects = normalizeOneOffProjects(monthRevenue);
      const oneOff = oneOffProjects.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const totalRevenue = retainerTotal + oneOff;
      const retainerPayments = Object.fromEntries(
        getRetainerEntries(monthRevenue).map(([client]) => [
          client,
          normalizeRetainerMeta(monthRevenue, client),
        ]),
      );
      const retainerQbFees = Object.values(retainerPayments)
        .reduce((sum, item) => sum + (Number(item.qbFee) || 0), 0);
      const oneOffQbFees = oneOffProjects.reduce((sum, item) => sum + (Number(item.qbFee) || 0), 0);
      const qbFees = retainerQbFees + oneOffQbFees;
      const payrollMonth = normalizePayrollMonth(payroll?.data?.[yearMonth]);
      const pointsPayByName = options.pointsPayByName || {};
      const pointsByName = options.pointsByName || {};
      const carouselsByName = options.carouselsByName || {};
      const staticsByName = options.staticsByName || {};
      const carouselPayByName = options.carouselPayByName || {};
      const staticPayByName = options.staticPayByName || {};
      const reelPayByName = options.reelPayByName || {};
      const planPayByName = options.planPayByName || {};
      const amPayByName = options.amPayByName || {};
      const videographerPayByName = options.videographerPayByName || {};
      const photographerPayByName = options.photographerPayByName || {};
      const payrollStaff = payrollMonth.staff.map((person) => {
        const nameKey = String(person.name || '').trim().toLowerCase();
        const points = Number(pointsByName[nameKey]) || 0;
        const carousels = Number(carouselsByName[nameKey]) || 0;
        const statics = Number(staticsByName[nameKey]) || 0;
        const reelPay = Number(reelPayByName[nameKey]) || 0;
        const carouselPay = Number(carouselPayByName[nameKey]) || 0;
        const staticPay = Number(staticPayByName[nameKey]) || 0;
        const amPay = Number(amPayByName[nameKey]) || 0;
        const videographerPay = Number(videographerPayByName[nameKey]) || 0;
        const photographerPay = Number(photographerPayByName[nameKey]) || 0;
        const planPay =
          person.kind === 'team' ? Number(planPayByName[nameKey]) || 0 : 0;
        const pointsPay =
          person.kind === 'team' ? Number(pointsPayByName[nameKey]) || 0 : 0;
        const extraTotal = sumExtraFields(person.extraFields);
        const personTotal = personPayrollTotal(person, pointsPay, planPay);
        return {
          ...person,
          points,
          carousels,
          statics,
          reelPay,
          carouselPay,
          staticPay,
          amPay,
          videographerPay,
          photographerPay,
          planPay,
          pointsPay,
          extraTotal,
          personTotal,
          // Compat for older UI that still reads `.amount`
          amount: personTotal,
        };
      });
      const staffPayrollTotal = payrollStaff.reduce(
        (sum, person) => sum + (Number(person.personTotal) || 0),
        0,
      );
      const totalPayroll =
        staffPayrollTotal + (Number(payrollMonth.ownerComp) || 0) + (Number(payrollMonth.legacyTotal) || 0);
      const expensesMonth = normalizeExpensesMonth(expenses?.data?.[yearMonth]);
      const totalExpenses = expensesMonth.total + qbFees;
      const netProfit = totalRevenue - totalPayroll - totalExpenses;

      return {
        retainers: Object.fromEntries(getRetainerEntries(monthRevenue)),
        retainerPayments,
        retainerTotal,
        retainerQbFees,
        oneOff,
        oneOffProjects,
        oneOffQbFees,
        totalRevenue,
        qbFees,
        effectiveRevenue: totalRevenue - qbFees,
        payroll: totalPayroll,
        payrollStaff,
        ownerComp: payrollMonth.ownerComp,
        legacyPayroll: payrollMonth.legacyTotal || 0,
        expenses: totalExpenses,
        expenseItems: expensesMonth.expenses,
        subscriptions: expensesMonth.subscriptions,
        oneTimeExpenses: expensesMonth.oneTime,
        legacyExpenses: expensesMonth.legacyTotal || 0,
        netProfit,
      };
    },
    [finances],
  );

  /** Get sorted list of all months that have any finance data. */
  const getAllMonths = useCallback(() => {
    const monthSet = new Set();
    for (const record of finances) {
      if (record?.data) {
        Object.keys(record.data).forEach((m) => monthSet.add(m));
      }
    }
    return Array.from(monthSet).sort();
  }, [finances]);

  /** Get list of all client names that have retainer data across any month. */
  const getAllClientsWithRetainers = useCallback(() => {
    const clientSet = new Set();
    const revenue = finances.find((r) => r.id === 'revenue');
    if (revenue?.data) {
      for (const month of Object.values(revenue.data)) {
        if (month && typeof month === 'object') {
          Object.keys(month).forEach((k) => {
            if (
              k !== 'oneOff' &&
              k !== 'oneOffProjects' &&
              k !== 'retainersMeta' &&
              k !== 'retainerTotal'
            ) {
              clientSet.add(k);
            }
          });
        }
      }
    }
    return Array.from(clientSet).sort();
  }, [finances]);

  return {
    finances,
    replaceFinances,
    saveFinancesNow,
    ensureRecurringMonth,
    setMonthlyRetainer,
    setRetainerPaymentMethod,
    setOneOffRevenue,
    addOneOffProject,
    updateOneOffProject,
    deleteOneOffProject,
    setPayroll,
    addPayrollStaff,
    updatePayrollStaff,
    deletePayrollStaff,
    setOwnerComp,
    getPayRates,
    setPayRates,
    setExpenses,
    addExpenseItem,
    updateExpenseItem,
    deleteExpenseItem,
    stopRecurringSubscription,
    setOneTimeExpenses,
    getMonthlySnapshot,
    getAllMonths,
    getAllClientsWithRetainers,
    currentYearMonth,
  };
}