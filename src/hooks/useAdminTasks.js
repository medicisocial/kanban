import { useState, useEffect, useCallback, useRef } from 'react';
import { ADMIN_TASKS_STORAGE_KEY } from '../constants';
import { getDefaultAssigneeForRole } from '../utils/teamMembers';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

const getAdminTaskId = (task) => task.id;

function createAdminTask(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    client: '',
    dueDate: '',
    assignedTo: getDefaultAssigneeForRole('Account Manager'),
    completed: false,
    completedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function loadAdminTasks() {
  try {
    const parsed = readOrgScopedJson(ADMIN_TASKS_STORAGE_KEY, null);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  return [];
}

export function useAdminTasks() {
  const [adminTasks, setAdminTasks] = useState(() =>
    initialSyncCollectionState(loadAdminTasks, { table: 'admin_tasks', getId: getAdminTaskId }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setAdminTasks(loadAdminTasks());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useCollectionSync({
    table: 'admin_tasks',
    items: adminTasks,
    setItems: setAdminTasks,
    getId: getAdminTaskId,
    loadLocal: loadAdminTasks,
  });

  // Debounce localStorage writes to avoid thrashing during rapid edits.
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeOrgScopedJson(ADMIN_TASKS_STORAGE_KEY, adminTasks);
    }, 400);
    return () => clearTimeout(persistTimerRef.current);
  }, [adminTasks, syncLoaded]);

  const replaceAdminTasks = useCallback((next) => {
    setAdminTasks(next);
  }, []);

  const addAdminTask = useCallback((data) => {
    notifyMutation();
    const task = createAdminTask(data);
    setAdminTasks((prev) => [...prev, task]);
    return task.id;
  }, []);

  const updateAdminTask = useCallback((id, updates) => {
    if (!id) return;
    notifyMutation();
    setAdminTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              ...updates,
              updatedAt: Date.now(),
            }
          : task,
      ),
    );
  }, []);

  const toggleAdminTaskComplete = useCallback((id) => {
    notifyMutation();
    setAdminTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const completed = !task.completed;
        return {
          ...task,
          completed,
          completedAt: completed ? Date.now() : null,
          updatedAt: Date.now(),
        };
      }),
    );
  }, []);

  const deleteAdminTask = useCallback((id) => {
    notifyMutation();
    tombstoneSyncedDeletes('admin_tasks', [id]);
    setAdminTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return {
    adminTasks,
    replaceAdminTasks,
    addAdminTask,
    updateAdminTask,
    toggleAdminTaskComplete,
    deleteAdminTask,
  };
}
