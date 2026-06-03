import { useState, useEffect, useCallback } from 'react';
import { MEETINGS_STORAGE_KEY, createMeeting } from '../constants';
import { notifyMutation } from '../utils/undoHistory';
import { useReloadFromStorage } from './useReloadFromStorage';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { useCollectionSync } from '../lib/useCollectionSync';
import { pushStaffSync, pushStaffSyncRecords } from '../lib/staffSyncApi';
import { markPendingRemoved } from '../lib/syncHelpers';
import { initialSyncCollectionState, shouldPersistSyncedState, tombstoneSyncedDeletes } from '../lib/syncInitialState';
import { getOrgId } from '../lib/orgSession';
import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage';

function persistMeetingUpsert(meeting) {
  if (!SUPABASE_ENABLED || !meeting) return;
  void pushStaffSyncRecords('meetings', [meeting]);
}

function persistMeetingDelete(id) {
  if (!SUPABASE_ENABLED || !id) return;
  markPendingRemoved(getOrgId(), 'meetings', [id]);
  void pushStaffSync({ table: 'meetings', changed: [], removed: [id] });
}

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

  useEffect(() => {
    if (!shouldPersistSyncedState(syncLoaded)) return;
    writeOrgScopedJson(MEETINGS_STORAGE_KEY, meetings);
  }, [meetings, syncLoaded]);

  const replaceMeetings = useCallback((next) => {
    setMeetings(next);
    if (SUPABASE_ENABLED && next.length) {
      void pushStaffSyncRecords('meetings', next);
    }
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
    if (!id) return;
    notifyMutation();
    tombstoneSyncedDeletes('meetings', [id]);
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
