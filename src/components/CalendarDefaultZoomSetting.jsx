import CalendarZoomControls from './CalendarZoomControls';
import { useCalendarZoomDefault } from '../hooks/useCalendarZoom';
import { surfacePanelClass } from './clientPortal/clientPortalUi';

export default function CalendarDefaultZoomSetting() {
  const { defaultZoom, setDefaultZoom } = useCalendarZoomDefault();

  return (
    <div className={`${surfacePanelClass} p-5`}>
      <h3 className="text-sm font-semibold text-white">Calendar zoom</h3>
      <p className="mt-1 text-sm text-white/45">
        Default zoom for all calendars. New sessions start here; use Reset on any calendar toolbar to
        snap back to this level.
      </p>
      <div className="mt-4">
        <CalendarZoomControls
          zoom={defaultZoom}
          onZoomChange={setDefaultZoom}
          embedded
          showReset={false}
        />
      </div>
    </div>
  );
}
