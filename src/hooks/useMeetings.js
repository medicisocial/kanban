import { useState, useEffect, useCallback, useRef } from 'react';
import { MEETINGS_STORAGE_KEY, createMeeting } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

const getMeetingId = (meeting) => meeting.id;

function loadMeetings() {
  try {
    const parsed = readOrgScopedJson(MEETINGS_STORAGE_KEY, null);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  return [];
}

export function useMeetings() {
  const [meetings, setMeetings] = useState(() =>
    initialSyncCollectionState(loadMeetings, { table: 'meetings', getId: getMeetingId }),
  );

  const reloadFromStorage = useCallback(() => {
    if (SUPABASE_ENABLED) return;
    setMeetings(loadMeetings());
  }, []);
  useReloadFromStorage(reloadFromStorage);

  const syncLoaded = useCollectionSync({
    table: 'meetings',
    items: meetings,
    setItems: setMeetings,
    getId: getMeetingId,
    loadLocal: loadMeetings,
  });

  // Debounce localStorage writes to avoid thrashing during rapid edits.
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeOrgScopedJson(MEETINGS_STORAGE_KEY, meetings);
    }, 400);
    return () => clearTimeout(persistTimerRef.current);
  }, [meetings, syncLoaded]);

  const replaceMeetings = useCallback((next) => {
    setMeetings(next);
  }, []);

  const addMeeting = useCallback((data) => {
    notifyMutation();
    const meeting = createMeeting(data);
    setMeetings((prev) => [...prev, meeting]);
    return meeting.id;
  }, []);

  const updateMeeting = useCallback((id, updates, options = {}) => {
    notifyMutation(options);
    setMeetings((prev) =>
      prev.map((meeting) => {
        if (meeting.id !== id) return meeting;
        return { ...meeting, ...updates, updatedAt: Date.now() };
      }),
    );
  }, []);

  const deleteMeeting = useCallback((id) => {
    if (!id) return;
    notifyMutation();
    tombstoneSyncedDeletes('meetings', [id]);
    setMeetings((prev) => prev.filter((meeting) => meeting.id !== id));
  }, []);

  return {
    meetings,
    meetingsSyncLoaded: syncLoaded,
    replaceMeetings,
    addMeeting,
    updateMeeting,
    deleteMeeting,
  };
}
