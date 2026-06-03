import { useState, useEffect, useCallback } from 'react';
import { ADMIN_TASKS_STORAGE_KEY } from '../constants';
import { getDefaultAssigneeForRole } from '../utils/teamMembers';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { pushStaffSync, pushStaffSyncRecords } from '../lib/staffSyncApi';
import { markPendingRemoved } from '../lib/syncHelpers';
import { initialSyncCollectionState, shouldPersistSyncedState } from '../lib/syncInitialState';
import { getOrgId } from '../lib/orgSession';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

function persistAdminTaskUpsert(task) {
  if (!SUPABASE_ENABLED || !task) return;
  void pushStaffSyncRecords('admin_tasks', [task]);
}

function persistAdminTaskDelete(id) {
  if (!SUPABASE_ENABLED || !id) return;
  markPendingRemoved(getOrgId(), 'admin_tasks', [id]);
  void pushStaffSync({ table: 'admin_tasks', changed: [], removed: [id] });
}

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
  const [adminTasks, setAdminTasks] = useState(() => initialSyncCollectionState(loadAdminTasks));

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

  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    writeOrgScopedJson(ADMIN_TASKS_STORAGE_KEY, adminTasks);
  }, [adminTasks, syncLoaded]);

  const replaceAdminTasks = useCallback((next) => {
    setAdminTasks(next);
    if (!SUPABASE_ENABLED || !next?.length) return;
    void pushStaffSyncRecords('admin_tasks', next);
  }, []);

  const addAdminTask = useCallback((data) => {
    notifyMutation();
    const task = createAdminTask(data);
    setAdminTasks((prev) => [...prev, task]);
    persistAdminTaskUpsert(task);
    return task.id;
  }, []);

  const toggleAdminTaskComplete = useCallback((id) => {
    notifyMutation();
    let persisted = null;
    setAdminTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const completed = !task.completed;
        persisted = {
          ...task,
          completed,
          completedAt: completed ? Date.now() : null,
          updatedAt: Date.now(),
        };
        return persisted;
      }),
    );
    if (persisted) persistAdminTaskUpsert(persisted);
  }, []);

  const deleteAdminTask = useCallback((id) => {
    notifyMutation();
    setAdminTasks((prev) => prev.filter((task) => task.id !== id));
    persistAdminTaskDelete(id);
  }, []);

  return {
    adminTasks,
    replaceAdminTasks,
    addAdminTask,
    toggleAdminTaskComplete,
    deleteAdminTask,
  };
}
