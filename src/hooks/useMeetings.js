import { useState, useEffect, useCallback } from 'react';
import { MEETINGS_STORAGE_KEY, createMeeting } from '../constants';
import { notifyMutation } from '../utils/undoHistory';

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
    return meeting.id;
  }, []);

  const updateMeeting = useCallback((id, updates) => {
    notifyMutation();
    setMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === id ? { ...meeting, ...updates, updatedAt: Date.now() } : meeting,
      ),
    );
  }, []);

  const deleteMeeting = useCallback((id) => {
    notifyMutation();
    setMeetings((prev) => prev.filter((meeting) => meeting.id !== id));
  }, []);

  return {
    meetings,
    replaceMeetings,
    addMeeting,
    updateMeeting,
    deleteMeeting,
  };
}
