import { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { EDITOR_TODO_STORAGE_KEY, EDITOR_TODO_ORDER_KEY, TEAM_MEMBERS } from '../constants';

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

function loadTaskOrder() {
  try {
    const stored = localStorage.getItem(EDITOR_TODO_ORDER_KEY);
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
  const [taskOrder, setTaskOrder] = useState(loadTaskOrder);

  useEffect(() => {
    localStorage.setItem(EDITOR_TODO_STORAGE_KEY, JSON.stringify(oneOffTasks));
  }, [oneOffTasks]);

  useEffect(() => {
    localStorage.setItem(EDITOR_TODO_ORDER_KEY, JSON.stringify(taskOrder));
  }, [taskOrder]);

  const addOneOffTask = useCallback((data) => {
    const task = createOneOffTask(data);
    setOneOffTasks((prev) => [...prev, task]);
    setTaskOrder((prev) => [...prev, task.id]);
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
    setTaskOrder((prev) => prev.filter((taskId) => taskId !== id));
  }, []);

  const syncTaskOrder = useCallback((taskIds) => {
    setTaskOrder((prev) => {
      const next = prev.filter((id) => taskIds.includes(id));
      for (const id of taskIds) {
        if (!next.includes(id)) next.push(id);
      }
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, []);

  const setTaskOrderFromIds = useCallback((orderIds) => {
    setTaskOrder(orderIds);
  }, []);

  const reorderTasks = useCallback((activeId, overId) => {
    if (!overId || activeId === overId) return;
    setTaskOrder((prev) => {
      const oldIndex = prev.indexOf(activeId);
      const newIndex = prev.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const resetTaskOrder = useCallback(() => {
    setTaskOrder([]);
  }, []);

  return {
    oneOffTasks,
    taskOrder,
    addOneOffTask,
    updateOneOffTask,
    toggleOneOffComplete,
    deleteOneOffTask,
    syncTaskOrder,
    setTaskOrderFromIds,
    reorderTasks,
    resetTaskOrder,
  };
}
