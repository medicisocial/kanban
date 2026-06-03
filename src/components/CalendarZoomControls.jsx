import { useCallback, useEffect, useRef } from 'react';
import {
  CALENDAR_ZOOM_DEFAULT,
  CALENDAR_ZOOM_MAX,
  CALENDAR_ZOOM_MIN,
  clampCalendarZoom,
} from '../hooks/useCalendarZoom';
import { glassSegmentClass } from './clientPortal/clientPortalUi';

export function CalendarZoomViewport({ zoom, children, className = '' }) {
  return (
    <div className={`calendar-zoom-viewport overflow-x-auto ${className}`.trim()}>
      <div className="calendar-zoom-content min-w-0" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}

function zoomToPercent(zoom, minZoom, maxZoom) {
  return ((zoom - minZoom) / (maxZoom - minZoom)) * 100;
}

function percentToZoom(percent, minZoom, maxZoom) {
  return clampCalendarZoom(minZoom + (percent / 100) * (maxZoom - minZoom));
}

export default function CalendarZoomControls({
  zoom,
  onZoomChange,
  defaultZoom = CALENDAR_ZOOM_DEFAULT,
  embedded = false,
  showReset = true,
  minZoom = CALENDAR_ZOOM_MIN,
  maxZoom = CALENDAR_ZOOM_MAX,
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback(
    (clientX) => {
      const track = trackRef.current;
      if (!track) return;
      const { left, width } = track.getBoundingClientRect();
      if (width <= 0) return;
      const percent = Math.min(100, Math.max(0, ((clientX - left) / width) * 100));
      onZoomChange(percentToZoom(percent, minZoom, maxZoom));
    },
    [minZoom, maxZoom, onZoomChange],
  );

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!draggingRef.current) return;
      updateFromClientX(event.clientX);
    };

    const stopDragging = () => {
      draggingRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [updateFromClientX]);

  const handleTrackPointerDown = (event) => {
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const thumbPercent = zoomToPercent(zoom, minZoom, maxZoom);
  const atDefault = Math.abs(zoom - defaultZoom) < 0.005;
  const wrapClass = embedded
    ? `${glassSegmentClass} calendar-zoom-slider-wrap`
    : 'calendar-zoom-slider-wrap calendar-zoom-slider-wrap--agency';

  return (
    <div className={wrapClass} role="group" aria-label="Calendar zoom">
      <span className="calendar-zoom-slider-label" aria-hidden="true">
        −
      </span>
      <div
        ref={trackRef}
        className="calendar-zoom-slider-track"
        onPointerDown={handleTrackPointerDown}
        role="slider"
        aria-valuemin={Math.round(minZoom * 100)}
        aria-valuemax={Math.round(maxZoom * 100)}
        aria-valuenow={Math.round(zoom * 100)}
        aria-label="Drag to zoom calendar"
      >
        <div className="calendar-zoom-slider-fill" style={{ width: `${thumbPercent}%` }} />
        <div
          className="calendar-zoom-slider-thumb"
          style={{ left: `${thumbPercent}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="calendar-zoom-slider-label" aria-hidden="true">
        +
      </span>
      <span className="calendar-zoom-slider-value">{Math.round(zoom * 100)}%</span>
      {showReset && (
        <button
          type="button"
          onClick={() => onZoomChange(defaultZoom)}
          disabled={atDefault}
          className="calendar-zoom-slider-reset"
          title={`Reset to default (${Math.round(defaultZoom * 100)}%)`}
        >
          Reset
        </button>
      )}
    </div>
  );
}
