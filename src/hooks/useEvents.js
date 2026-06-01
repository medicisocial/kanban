import { useState, useEffect, useCallback } from 'react';
import { EVENTS_STORAGE_KEY, createEvent } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { pushStaffSync, pushStaffSyncRecords } from '../lib/staffSyncApi';

function persistEventUpsert(event) {
  if (!SUPABASE_ENABLED || !event) return;
  void pushStaffSyncRecords('events', [event]);
}

function persistEventDelete(id) {
  if (!SUPABASE_ENABLED || !id) return;
  void pushStaffSync({ table: 'events', changed: [], removed: [id] });
}

const getEventId = (event) => event.id;

function loadEvents() {
  try {
    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  return [];
}

export function useEvents() {
  const [events, setEvents] = useState(loadEvents);

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setEvents(loadEvents());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  useCollectionSync({
    table: 'events',
    items: events,
    setItems: setEvents,
    getId: getEventId,
    loadLocal: loadEvents,
  });

  useEffect(() => {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const replaceEvents = useCallback((next) => {
    setEvents(next);
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
