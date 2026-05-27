import { useState, useEffect, useCallback } from 'react';
import { EVENTS_STORAGE_KEY, createEvent } from '../constants';

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

  useEffect(() => {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const addEvent = useCallback((data) => {
    const event = createEvent(data);
    setEvents((prev) => [...prev, event]);
    return event.id;
  }, []);

  const updateEvent = useCallback((id, updates) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, ...updates, updatedAt: Date.now() } : event,
      ),
    );
  }, []);

  const deleteEvent = useCallback((id) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  }, []);

  return {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
  };
}
