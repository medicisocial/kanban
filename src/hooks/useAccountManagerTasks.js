import { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { AM_TODO_ORDER_KEY } from '../constants';

export const AM_TASK_QUEUES = ['inReview', 'stories', 'posts'];

const EMPTY_ORDER = {
  inReview: [],
  stories: [],
  posts: [],
};

function loadTaskOrder() {
  try {
    const stored = localStorage.getItem(AM_TODO_ORDER_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return {
          inReview: Array.isArray(parsed.inReview) ? parsed.inReview : [],
          stories: Array.isArray(parsed.stories) ? parsed.stories : [],
          posts: Array.isArray(parsed.posts) ? parsed.posts : [],
        };
      }
    }
  } catch {
    /* fall through */
  }
  return { ...EMPTY_ORDER };
}

function hasSavedOrder(order) {
  return AM_TASK_QUEUES.some((queue) => order[queue]?.length > 0);
}

export function useAccountManagerTasks() {
  const [taskOrder, setTaskOrder] = useState(loadTaskOrder);

  useEffect(() => {
    localStorage.setItem(AM_TODO_ORDER_KEY, JSON.stringify(taskOrder));
  }, [taskOrder]);

  const syncQueueOrder = useCallback((queue, taskIds) => {
    if (!AM_TASK_QUEUES.includes(queue)) return;
    setTaskOrder((prev) => {
      const current = prev[queue] || [];
      const next = current.filter((id) => taskIds.includes(id));
      for (const id of taskIds) {
        if (!next.includes(id)) next.push(id);
      }
      if (
        next.length === current.length &&
        next.every((id, index) => id === current[index])
      ) {
        return prev;
      }
      return { ...prev, [queue]: next };
    });
  }, []);

  const setQueueOrderFromIds = useCallback((queue, orderIds) => {
    if (!AM_TASK_QUEUES.includes(queue)) return;
    setTaskOrder((prev) => ({ ...prev, [queue]: orderIds }));
  }, []);

  const reorderQueueTasks = useCallback((queue, activeId, overId) => {
    if (!overId || activeId === overId || !AM_TASK_QUEUES.includes(queue)) return;
    setTaskOrder((prev) => {
      const current = prev[queue] || [];
      const oldIndex = current.indexOf(activeId);
      const newIndex = current.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return { ...prev, [queue]: arrayMove(current, oldIndex, newIndex) };
    });
  }, []);

  const resetQueueOrder = useCallback((queue) => {
    if (!AM_TASK_QUEUES.includes(queue)) return;
    setTaskOrder((prev) => ({ ...prev, [queue]: [] }));
  }, []);

  const resetAllQueueOrders = useCallback(() => {
    setTaskOrder({ ...EMPTY_ORDER });
  }, []);

  return {
    taskOrder,
    hasSavedOrder: hasSavedOrder(taskOrder),
    syncQueueOrder,
    setQueueOrderFromIds,
    reorderQueueTasks,
    resetQueueOrder,
    resetAllQueueOrders,
  };
}
