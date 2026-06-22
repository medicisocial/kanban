import { useState, useEffect, useCallback, useRef } from 'react';
import { FINANCES_STORAGE_KEY } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

/** Return the current month as "YYYY-MM". */
function currentYearMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getFinanceId(category) {
  return category; // 'revenue' | 'payroll' | 'expenses'
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

function getRevenueMonth(revenue, yearMonth) {
  return revenue?.data?.[yearMonth] && typeof revenue.data[yearMonth] === 'object'
    ? revenue.data[yearMonth]
    : {};
}

function getRetainerEntries(monthRevenue) {
  return Object.entries(monthRevenue || {}).filter(([key, value]) => {
    if (key === 'oneOff' || key === 'retainerTotal') return false;
    return typeof value === 'number' || typeof value === 'string';
  });
}

function calculateRetainerTotal(monthRevenue) {
  return getRetainerEntries(monthRevenue).reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
}

function normalizePayrollMonth(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const staff = Array.isArray(value.staff)
      ? value.staff.map((item) => createLineItem(item)).filter((item) => item.name || item.amount)
      : [];
    const ownerComp = Number(value.ownerComp) || 0;
    return {
      staff,
      ownerComp,
      total: staff.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) + ownerComp,
    };
  }
  return {
    staff: [],
    ownerComp: 0,
    total: Number(value) || 0,
    legacyTotal: Number(value) || 0,
  };
}

function normalizeExpensesMonth(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const expenses = Array.isArray(value.expenses)
      ? value.expenses.map((item) => createLineItem(item)).filter((item) => item.name || item.amount)
      : [];
    const subscriptions = Array.isArray(value.subscriptions)
      ? value.subscriptions.map((item) => createLineItem(item)).filter((item) => item.name || item.amount)
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
      month.retainerTotal = calculateRetainerTotal(month);
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

  const addPayrollStaff = useCallback((yearMonth, staff) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizePayrollMonth(data[yearMonth]);
      const nextStaff = createLineItem(staff);
      data[yearMonth] = {
        staff: [...month.staff, nextStaff],
        ownerComp: month.ownerComp,
      };
      return [...rest, { id: 'payroll', data }];
    });
  }, []);

  const updatePayrollStaff = useCallback((yearMonth, staffId, updates) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizePayrollMonth(data[yearMonth]);
      data[yearMonth] = {
        staff: month.staff.map((item) =>
          item.id === staffId ? createLineItem({ ...item, ...updates }) : item,
        ),
        ownerComp: month.ownerComp,
      };
      return [...rest, { id: 'payroll', data }];
    });
  }, []);

  const deletePayrollStaff = useCallback((yearMonth, staffId) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizePayrollMonth(data[yearMonth]);
      data[yearMonth] = {
        staff: month.staff.filter((item) => item.id !== staffId),
        ownerComp: month.ownerComp,
      };
      return [...rest, { id: 'payroll', data }];
    });
  }, []);

  const setOwnerComp = useCallback((yearMonth, amount) => {
    notifyMutation();
    setFinances((prev) => {
      const record = prev.find((r) => r.id === 'payroll');
      const rest = prev.filter((r) => r.id !== 'payroll');
      const data = record?.data ? { ...record.data } : {};
      const month = normalizePayrollMonth(data[yearMonth]);
      data[yearMonth] = {
        staff: month.staff,
        ownerComp: Number(amount) || 0,
      };
      return [...rest, { id: 'payroll', data }];
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
      data[yearMonth] = {
        expenses: month.expenses,
        subscriptions: month.subscriptions,
        oneTime: month.oneTime,
        [key]: [...month[key], createLineItem(item)],
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
          item.id === itemId ? createLineItem({ ...item, ...updates }) : item,
        ),
      };
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

  /** Get all data for a given month across revenue/payroll/expenses. */
  const getMonthlySnapshot = useCallback(
    (yearMonth) => {
      const revenue = finances.find((r) => r.id === 'revenue');
      const payroll = finances.find((r) => r.id === 'payroll');
      const expenses = finances.find((r) => r.id === 'expenses');

      const monthRevenue = getRevenueMonth(revenue, yearMonth);
      const retainerTotal = calculateRetainerTotal(monthRevenue);
      const oneOff = Number(monthRevenue.oneOff) || 0;
      const totalRevenue = retainerTotal + oneOff;
      const payrollMonth = normalizePayrollMonth(payroll?.data?.[yearMonth]);
      const expensesMonth = normalizeExpensesMonth(expenses?.data?.[yearMonth]);
      const totalPayroll = payrollMonth.total;
      const totalExpenses = expensesMonth.total;
      const netProfit = totalRevenue - totalPayroll - totalExpenses;

      return {
        retainers: Object.fromEntries(getRetainerEntries(monthRevenue)),
        retainerTotal,
        oneOff,
        totalRevenue,
        payroll: totalPayroll,
        payrollStaff: payrollMonth.staff,
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
            if (k !== 'oneOff' && k !== 'retainerTotal') {
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
    setMonthlyRetainer,
    setOneOffRevenue,
    setPayroll,
    addPayrollStaff,
    updatePayrollStaff,
    deletePayrollStaff,
    setOwnerComp,
    setExpenses,
    addExpenseItem,
    updateExpenseItem,
    deleteExpenseItem,
    setOneTimeExpenses,
    getMonthlySnapshot,
    getAllMonths,
    getAllClientsWithRetainers,
    currentYearMonth,
  };
}