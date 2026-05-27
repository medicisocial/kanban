import { useState, useEffect, useCallback } from 'react';
import { ADMIN_TASKS_STORAGE_KEY } from '../constants';
import { getDefaultAssigneeForRole } from '../utils/teamMembers';

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
    const stored = localStorage.getItem(ADMIN_TASKS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  return [];
}

export function useAdminTasks() {
  const [adminTasks, setAdminTasks] = useState(loadAdminTasks);

  useEffect(() => {
    localStorage.setItem(ADMIN_TASKS_STORAGE_KEY, JSON.stringify(adminTasks));
  }, [adminTasks]);

  const addAdminTask = useCallback((data) => {
    const task = createAdminTask(data);
    setAdminTasks((prev) => [...prev, task]);
    return task.id;
  }, []);

  const toggleAdminTaskComplete = useCallback((id) => {
    setAdminTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const completed = !task.completed;
        return {
          ...task,
          completed,
          completedAt: completed ? Date.now() : null,
        };
      }),
    );
  }, []);

  const deleteAdminTask = useCallback((id) => {
    setAdminTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return {
    adminTasks,
    addAdminTask,
    toggleAdminTaskComplete,
    deleteAdminTask,
  };
}
