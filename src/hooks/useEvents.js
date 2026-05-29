import { useState, useEffect, useCallback } from 'react';
import { EVENTS_STORAGE_KEY, createEvent } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';

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
    if (SUPABASE_ENABLED) return;
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  }, [events]);

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
      prev.map((event) =>
        event.id === id ? { ...event, ...updates, updatedAt: Date.now() } : event,
      ),
    );
  }, []);

  const deleteEvent = useCallback((id) => {
    notifyMutation();
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
