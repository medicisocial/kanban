import { useState, useEffect, useCallback, useRef } from 'react';
import { EVENTS_STORAGE_KEY, createEvent } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

const getEventId = (event) => event.id;

function loadEvents() {
  try {
    const parsed = readOrgScopedJson(EVENTS_STORAGE_KEY, null);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  return [];
}

export function useEvents() {
  const [events, setEvents] = useState(() =>
    initialSyncCollectionState(loadEvents, { table: 'events', getId: getEventId }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setEvents(loadEvents());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useCollectionSync({
    table: 'events',
    items: events,
    setItems: setEvents,
    getId: getEventId,
    loadLocal: loadEvents,
  });

  // Debounce localStorage writes to avoid thrashing during rapid edits.
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeOrgScopedJson(EVENTS_STORAGE_KEY, events);
    }, 400);
    return () => clearTimeout(persistTimerRef.current);
  }, [events, syncLoaded]);

  const replaceEvents = useCallback((next) => {
    setEvents(next);
  }, []);

  const addEvent = useCallback((data) => {
    notifyMutation();
    const event = createEvent(data);
    setEvents((prev) => [...prev, event]);
    return event.id;
  }, []);

  const updateEvent = useCallback((id, updates) => {
    notifyMutation();
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== id) return event;
        return { ...event, ...updates, updatedAt: Date.now() };
      }),
    );
  }, []);

  const deleteEvent = useCallback((id) => {
    notifyMutation();
    tombstoneSyncedDeletes('events', [id]);
    setEvents((prev) => prev.filter((event) => event.id !== id));
  }, []);

  return {
    events,
    replaceEvents,
    addEvent,
    updateEvent,
    deleteEvent,
  };
}
