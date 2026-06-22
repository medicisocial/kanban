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
      // Recalculate retainer total
      const clientKeys = Object.keys(month).filter((k) => k !== 'oneOff');
      month.retainerTotal = clientKeys.reduce((sum, k) => sum + (Number(month[k]) || 0), 0);
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

  /** Get all data for a given month across revenue/payroll/expenses. */
  const getMonthlySnapshot = useCallback(
    (yearMonth) => {
      const revenue = finances.find((r) => r.id === 'revenue');
      const payroll = finances.find((r) => r.id === 'payroll');
      const expenses = finances.find((r) => r.id === 'expenses');

      const monthRevenue = revenue?.data?.[yearMonth] || {};
      const retainerTotal = Number(monthRevenue.retainerTotal) || 0;
      const oneOff = Number(monthRevenue.oneOff) || 0;
      const totalRevenue = retainerTotal + oneOff;
      const totalPayroll = Number(payroll?.data?.[yearMonth]) || 0;
      const totalExpenses = Number(expenses?.data?.[yearMonth]) || 0;
      const netProfit = totalRevenue - totalPayroll - totalExpenses;

      return {
        retainers: { ...monthRevenue },
        retainerTotal,
        oneOff,
        totalRevenue,
        payroll: totalPayroll,
        expenses: totalExpenses,
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
    setExpenses,
    getMonthlySnapshot,
    getAllMonths,
    getAllClientsWithRetainers,
    currentYearMonth,
  };
}