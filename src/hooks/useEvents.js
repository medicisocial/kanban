import { useState, useEffect, useCallback } from 'react';
import { EVENTS_STORAGE_KEY, createEvent } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { pushStaffSync, pushStaffSyncRecords } from '../lib/staffSyncApi';
import { markPendingRemoved } from '../lib/syncHelpers';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { getOrgId } from '../lib/orgSession';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

function persistEventUpsert(event) {
  if (!SUPABASE_ENABLED || !event) return;
  void pushStaffSyncRecords('events', [event]);
}

function persistEventDelete(id) {
  if (!SUPABASE_ENABLED || !id) return;
  markPendingRemoved(getOrgId(), 'events', [id]);
  void pushStaffSync({ table: 'events', changed: [], removed: [id] });
}

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

  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    writeOrgScopedJson(EVENTS_STORAGE_KEY, events);
  }, [events, syncLoaded]);

  const replaceEvents = useCallback((next) => {
    setEvents(next);
    if (SUPABASE_ENABLED && next.length) {
      void pushStaffSyncRecords('events', next);
    }
  }, []);

  const addEvent = useCallback((data) => {
    notifyMutation();
    const event = createEvent(data);
    setEvents((prev) => [...prev, event]);
    persistEventUpsert(event);
    return event.id;
  }, []);

  const updateEvent = useCallback((id, updates) => {
    notifyMutation();
    let persisted = null;
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== id) return event;
        persisted = { ...event, ...updates, updatedAt: Date.now() };
        return persisted;
      }),
    );
    if (persisted) persistEventUpsert(persisted);
  }, []);

  const deleteEvent = useCallback((id) => {
    notifyMutation();
    tombstoneSyncedDeletes('events', [id]);
    setEvents((prev) => prev.filter((event) => event.id !== id));
    persistEventDelete(id);
  }, []);

  return {
    events,
    replaceEvents,
    addEvent,
    updateEvent,
    deleteEvent,
  };
}
