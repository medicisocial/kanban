import { useCallback, useEffect, useState } from 'react';

export const CALENDAR_ZOOM_DEFAULT = 1;
export const CALENDAR_ZOOM_MIN = 0.75;
export const CALENDAR_ZOOM_MAX = 1.5;
export const CALENDAR_ZOOM_STEP = 0.1;

/** @deprecated Use CALENDAR_ZOOM_STORAGE_KEYS.content */
export const CALENDAR_ZOOM_KEY = 'medici-calendar-zoom';

export const CALENDAR_ZOOM_DEFAULT_KEY = 'medici-calendar-zoom-default';

export const CALENDAR_ZOOM_DEFAULT_CHANGED = 'calendar-zoom-default-changed';

export const CALENDAR_ZOOM_STORAGE_KEYS = {
  content: 'medici-calendar-zoom-content',
  meetings: 'medici-calendar-zoom-meetings',
  events: 'medici-calendar-zoom-events',
  shoots: 'medici-calendar-zoom-shoots',
};

export function clampCalendarZoom(value) {
  return Math.min(
    CALENDAR_ZOOM_MAX,
    Math.max(CALENDAR_ZOOM_MIN, Math.round(Number(value) * 100) / 100),
  );
}

export function getCalendarZoomDefault() {
  try {
    const stored = localStorage.getItem(CALENDAR_ZOOM_DEFAULT_KEY);
    if (stored != null && stored !== '') {
      return clampCalendarZoom(stored);
    }
  } catch {
    /* ignore */
  }
  return CALENDAR_ZOOM_DEFAULT;
}

export function setCalendarZoomDefault(value) {
  const clamped = clampCalendarZoom(value);
  try {
    localStorage.setItem(CALENDAR_ZOOM_DEFAULT_KEY, String(clamped));
    window.dispatchEvent(
      new CustomEvent(CALENDAR_ZOOM_DEFAULT_CHANGED, { detail: clamped }),
    );
  } catch {
    /* ignore */
  }
  return clamped;
}

function readStoredZoom(storageKey) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored != null && stored !== '') {
      return clampCalendarZoom(stored);
    }
    if (storageKey === CALENDAR_ZOOM_STORAGE_KEYS.content) {
      const legacy = localStorage.getItem(CALENDAR_ZOOM_KEY);
      if (legacy != null && legacy !== '') {
        return clampCalendarZoom(legacy);
      }
    }
  } catch {
    /* ignore */
  }
  return getCalendarZoomDefault();
}

export function useCalendarZoom(storageKey = CALENDAR_ZOOM_STORAGE_KEYS.content) {
  const [defaultZoom, setDefaultZoomState] = useState(getCalendarZoomDefault);
  const [zoom, setZoomState] = useState(() => readStoredZoom(storageKey));

  useEffect(() => {
    const syncDefault = () => setDefaultZoomState(getCalendarZoomDefault());
    window.addEventListener(CALENDAR_ZOOM_DEFAULT_CHANGED, syncDefault);
    return () => window.removeEventListener(CALENDAR_ZOOM_DEFAULT_CHANGED, syncDefault);
  }, []);

  const setZoom = useCallback(
    (next) => {
      setZoomState((current) => {
        const value = clampCalendarZoom(typeof next === 'function' ? next(current) : next);
        try {
          localStorage.setItem(storageKey, String(value));
        } catch {
          /* ignore */
        }
        return value;
      });
    },
    [storageKey],
  );

  const zoomIn = useCallback(
    () => setZoom((current) => current + CALENDAR_ZOOM_STEP),
    [setZoom],
  );

  const zoomOut = useCallback(
    () => setZoom((current) => current - CALENDAR_ZOOM_STEP),
    [setZoom],
  );

  const resetZoom = useCallback(() => setZoom(defaultZoom), [setZoom, defaultZoom]);

  return { zoom, defaultZoom, zoomIn, zoomOut, resetZoom, setZoom };
}

export function useCalendarZoomDefault() {
  const [defaultZoom, setDefaultZoomState] = useState(getCalendarZoomDefault);

  useEffect(() => {
    const syncDefault = () => setDefaultZoomState(getCalendarZoomDefault());
    window.addEventListener(CALENDAR_ZOOM_DEFAULT_CHANGED, syncDefault);
    return () => window.removeEventListener(CALENDAR_ZOOM_DEFAULT_CHANGED, syncDefault);
  }, []);

  const updateDefaultZoom = useCallback((next) => {
    const value = setCalendarZoomDefault(
      typeof next === 'function' ? next(getCalendarZoomDefault()) : next,
    );
    setDefaultZoomState(value);
    return value;
  }, []);

  return { defaultZoom, setDefaultZoom: updateDefaultZoom };
}
