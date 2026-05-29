import { useState, useEffect, useRef, useCallback } from 'react';
import {
  registerUndo,
  unregisterUndo,
  undo as undoHistory,
  canUndo as canUndoHistory,
  clearUndoStack,
} from '../utils/undoHistory';
import { subscribeWorkspaceReload } from '../utils/workspaceReload';

export function useUndoHistory({
  cards,
  plans,
  ideas,
  adminTasks,
  events,
  meetings,
  replaceCards,
  replacePlans,
  replaceIdeas,
  replaceAdminTasks,
  replaceEvents,
  replaceMeetings,
}) {
  const [canUndo, setCanUndo] = useState(() => canUndoHistory());
  const stateRef = useRef({ cards, plans, ideas, adminTasks, events, meetings });
  stateRef.current = { cards, plans, ideas, adminTasks, events, meetings };

  useEffect(() => {
    registerUndo({
      getSnapshot: () => structuredClone(stateRef.current),
      applySnapshot: (snap) => {
        replaceCards(snap.cards);
        replacePlans(snap.plans);
        replaceIdeas(snap.ideas);
        replaceAdminTasks(snap.adminTasks);
        replaceEvents(snap.events);
        replaceMeetings(snap.meetings);
      },
      onStackChange: () => setCanUndo(canUndoHistory()),
    });
    return () => unregisterUndo();
  }, [
    replaceCards,
    replacePlans,
    replaceIdeas,
    replaceAdminTasks,
    replaceEvents,
    replaceMeetings,
  ]);

  const undo = useCallback(() => {
    undoHistory();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z' || e.shiftKey) return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      e.preventDefault();
      undoHistory();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => subscribeWorkspaceReload(clearUndoStack), []);

  return { canUndo, undo };
}
