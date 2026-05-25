import { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { EDITOR_TODO_ORDER_KEY } from '../constants';

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
  const [taskOrder, setTaskOrder] = useState(loadTaskOrder);

  useEffect(() => {
    localStorage.setItem(EDITOR_TODO_ORDER_KEY, JSON.stringify(taskOrder));
  }, [taskOrder]);

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
    taskOrder,
    syncTaskOrder,
    setTaskOrderFromIds,
    reorderTasks,
    resetTaskOrder,
  };
}
