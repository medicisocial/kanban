import { useState, useEffect, useCallback } from 'react';
import { MEETINGS_STORAGE_KEY, createMeeting } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { pushStaffSync, pushStaffSyncRecords } from '../lib/staffSyncApi';

function persistMeetingUpsert(meeting) {
  if (!SUPABASE_ENABLED || !meeting) return;
  void pushStaffSyncRecords('meetings', [meeting]);
}

function persistMeetingDelete(id) {
  if (!SUPABASE_ENABLED || !id) return;
  void pushStaffSync({ table: 'meetings', changed: [], removed: [id] });
}

const getMeetingId = (meeting) => meeting.id;

function loadMeetings() {
  try {
    const stored = localStorage.getItem(MEETINGS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  return [];
}

export function useMeetings() {
  const [meetings, setMeetings] = useState(loadMeetings);

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setMeetings(loadMeetings());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  useCollectionSync({
    table: 'meetings',
    items: meetings,
    setItems: setMeetings,
    getId: getMeetingId,
    loadLocal: loadMeetings,
  });

  useEffect(() => {
    localStorage.setItem(MEETINGS_STORAGE_KEY, JSON.stringify(meetings));
  }, [meetings]);

  const replaceMeetings = useCallback((next) => {
    setMeetings(next);
  }, []);

  const addMeeting = useCallback((data) => {
    notifyMutation();
    const meeting = createMeeting(data);
    setMeetings((prev) => [...prev, meeting]);
    persistMeetingUpsert(meeting);
    return meeting.id;
  }, []);

  const updateMeeting = useCallback((id, updates) => {
    notifyMutation();
    let persisted = null;
    setMeetings((prev) =>
      prev.map((meeting) => {
        if (meeting.id !== id) return meeting;
        persisted = { ...meeting, ...updates, updatedAt: Date.now() };
        return persisted;
      }),
    );
    if (persisted) persistMeetingUpsert(persisted);
  }, []);

  const deleteMeeting = useCallback((id) => {
    notifyMutation();
    setMeetings((prev) => prev.filter((meeting) => meeting.id !== id));
    persistMeetingDelete(id);
  }, []);

  return {
    meetings,
    replaceMeetings,
    addMeeting,
    updateMeeting,
    deleteMeeting,
  };
}
