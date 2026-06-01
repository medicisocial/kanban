import { formatTime } from '../../utils';
import { buildTodayHeadline } from '../../utils/todayTimeline';
import MeetingVideoLink from '../MeetingVideoLink';
import { getMeetingVideoLink } from '../../utils/meetingLinks';
import { btnSecondaryClass } from './clientPortalUi';

const panelActionBtnClass =
  'inline-flex shrink-0 items-center justify-center rounded-sm bg-white px-3 py-1.5 text-[10px] font-medium normal-case tracking-normal text-black transition-opacity duration-300 hover:opacity-75';

function PanelHeaderAction({ label, onClick, prominent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        prominent
          ? panelActionBtnClass
          : `${btnSecondaryClass} py-1.5 text-[10px] normal-case tracking-normal`
      }
    >
      {label}
    </button>
  );
}

function formatTimelineTime(time, endTime) {
  if (!time) return 'Any time';
  if (endTime) return `${formatTime(time)} – ${formatTime(endTime)}`;
  return formatTime(time);
}

function TodayTimelineItem({ item, onOpenMeeting, onOpenShoot }) {
  const handleOpen = () => {
    if (item.kind === 'meeting') onOpenMeeting?.(item.meeting);
    else if (item.kind === 'shoot') onOpenShoot?.(item.shootDay);
  };

  return (
    <div className="overview-timeline-item">
      <div className="overview-timeline-time">{formatTimelineTime(item.time, item.endTime)}</div>
      <div className="overview-timeline-marker" aria-hidden>
        <span className={`overview-timeline-dot overview-timeline-dot-${item.kind}`} />
      </div>
      <div className="overview-timeline-content">
        <button type="button" onClick={handleOpen} className="block w-full text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{item.title}</p>
            <span className={`overview-timeline-kind overview-timeline-kind-${item.kind}`}>
              {item.kind === 'meeting' ? 'Meeting' : 'Shoot'}
            </span>
          </div>
          {item.subtitle && <p className="mt-0.5 text-xs text-white/45">{item.subtitle}</p>}
        </button>
        {item.kind === 'meeting' && getMeetingVideoLink(item.meeting) && (
          <p className="mt-1">
            <MeetingVideoLink
              meeting={item.meeting}
              compact
              linkClassName="text-xs font-medium text-violet-300"
            />
          </p>
        )}
      </div>
    </div>
  );
}

export default function OverviewTodayPanel({
  timeline,
  onOpenMeeting,
  onOpenShoot,
  onNavigateMeetings,
  onNavigateShoots,
}) {
  const todayLabel = new Date(`${timeline.today}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="overview-today-panel glass-surface mb-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/38">Today</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-white">{todayLabel}</h3>
          <p className="mt-1 text-sm text-white/55">
            {buildTodayHeadline(timeline.meetingCount, timeline.shootCount)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {timeline.meetingCount > 0 && onNavigateMeetings && (
            <PanelHeaderAction
              label={`Meetings (${timeline.meetingCount})`}
              onClick={onNavigateMeetings}
            />
          )}
          {timeline.shootCount > 0 && onNavigateShoots && (
            <PanelHeaderAction
              label={`Shoots (${timeline.shootDayCount ?? timeline.shootCount})`}
              prominent={timeline.meetingCount === 0}
              onClick={onNavigateShoots}
            />
          )}
        </div>
      </div>

      <div className="overview-timeline">
        {timeline.items.map((item) => (
          <TodayTimelineItem
            key={item.id}
            item={item}
            onOpenMeeting={onOpenMeeting}
            onOpenShoot={onOpenShoot}
          />
        ))}
      </div>
    </div>
  );
}
