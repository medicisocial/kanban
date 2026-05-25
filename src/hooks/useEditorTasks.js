import { useState, useEffect, useCallback } from 'react';
import { EDITOR_TODO_STORAGE_KEY, TEAM_MEMBERS } from '../constants';

function createOneOffTask(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    projectName: '',
    title: '',
    description: '',
    dueDate: '',
    assignedTo: TEAM_MEMBERS[0],
    completed: false,
    completedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function loadOneOffTasks() {
  try {
    const stored = localStorage.getItem(EDITOR_TODO_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  return [];
}

export function useEditorTasks() {
  const [oneOffTasks, setOneOffTasks] = useState(loadOneOffTasks);

  useEffect(() => {
    localStorage.setItem(EDITOR_TODO_STORAGE_KEY, JSON.stringify(oneOffTasks));
  }, [oneOffTasks]);

  const addOneOffTask = useCallback((data) => {
    const task = createOneOffTask(data);
    setOneOffTasks((prev) => [...prev, task]);
    return task.id;
  }, []);

  const updateOneOffTask = useCallback((id, updates) => {
    setOneOffTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task)),
    );
  }, []);

  const toggleOneOffComplete = useCallback((id) => {
    setOneOffTasks((prev) =>
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

  const deleteOneOffTask = useCallback((id) => {
    setOneOffTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return {
    oneOffTasks,
    addOneOffTask,
    updateOneOffTask,
    toggleOneOffComplete,
    deleteOneOffTask,
  };
}
