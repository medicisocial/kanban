import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import {
  PortalPipelineMetric,
  PortalRolePanel,
} from './clientPortal/PortalOverviewPanels';
import { buildWorkspaceHomeSummary, buildMyWorkGreeting } from '../utils/workspaceHome';
import { buildTodayTimeline, buildTodayHeadline } from '../utils/todayTimeline';
import { useClientsContext } from '../context/ClientsContext';
import { btnSecondaryClass } from './clientPortal/clientPortalUi';
import { formatTime } from '../utils';

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
  const handleClick = () => {
    if (item.kind === 'meeting') onOpenMeeting?.(item.meeting);
    else if (item.kind === 'shoot') onOpenShoot?.(item.shootDay);
  };

  return (
    <button type="button" onClick={handleClick} className="overview-timeline-item">
      <div className="overview-timeline-time">{formatTimelineTime(item.time, item.endTime)}</div>
      <div className="overview-timeline-marker" aria-hidden>
        <span className={`overview-timeline-dot overview-timeline-dot-${item.kind}`} />
      </div>
      <div className="overview-timeline-content">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-white">{item.title}</p>
          <span className={`overview-timeline-kind overview-timeline-kind-${item.kind}`}>
            {item.kind === 'meeting' ? 'Meeting' : 'Shoot'}
          </span>
        </div>
        {item.subtitle && <p className="mt-0.5 text-xs text-white/45">{item.subtitle}</p>}
      </div>
    </button>
  );
}

function OverviewTodayPanel({ timeline, onOpenMeeting, onOpenShoot, onNavigate }) {
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
          {timeline.meetingCount > 0 && (
            <PanelHeaderAction
              label={`Meetings (${timeline.meetingCount})`}
              onClick={() => onNavigate('calendars', { calendarsTab: 'meetings' })}
            />
          )}
          {timeline.shootCount > 0 && (
            <PanelHeaderAction
              label={`Shoots (${timeline.shootDayCount ?? timeline.shootCount})`}
              prominent={timeline.meetingCount === 0}
              onClick={() => onNavigate('shoot')}
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

export default function WorkspaceHomePage({
  cards,
  ideas,
  adminTasks,
  meetings = [],
  plans = {},
  getPlan,
  clientFilter,
  syncTotal,
  staffName = '',
  clientAccountManagers = {},
  myWorkOnly = false,
  companyWideView = false,
  showAccountManagerQueue = true,
  onNavigate,
  onOpenMeeting,
  onOpenShoot,
  onOpenNotifications,
}) {
  const { clients } = useClientsContext();

  const summary = buildWorkspaceHomeSummary({
    cards,
    ideas,
    adminTasks,
    clientFilter,
    syncTotal,
    staffName,
    clientAccountManagers,
    myWorkOnly,
    companyWideView,
    showAccountManagerQueue,
  });

  const todayTimeline = buildTodayTimeline({
    meetings,
    cards,
    plans,
    getPlan,
    clientFilter,
    clientOrder: clients,
    staffName,
    clientAccountManagers,
    personalScope: myWorkOnly && !companyWideView,
    includePlanOnlyDays: companyWideView || !myWorkOnly,
  });

  const summaryWithToday = {
    ...summary,
    meetingsTodayCount: todayTimeline.meetingCount,
    shootsTodayCount: todayTimeline.shootDayCount ?? todayTimeline.shootCount,
  };

  const firstName = staffName.trim().split(/\s+/)[0] || '';

  const personalGreeting = myWorkOnly ? buildMyWorkGreeting(firstName, summaryWithToday) : null;

  const title = personalGreeting?.title ?? 'Overview';

  const description =
    personalGreeting?.description ??
    (clientFilter === 'all'
      ? 'Company-wide production at a glance — pipeline, reviews, and schedules.'
      : `Production at a glance for ${clientFilter}.`);

  const showAmQueue = !myWorkOnly || summaryWithToday.showAccountManagerQueue;

  const pipelineGroups = [
    {
      label: 'Content creator',
      items: [
        {
          label: 'To create',
          value: summary.toCreateCount,
          onClick: () => onNavigate('todo', { tasksRole: 'creator' }),
        },
      ],
    },
    {
      label: 'Editor',
      items: [
        {
          label: 'Editing',
          value: summary.editingCount,
          onClick: () => onNavigate('todo', { tasksRole: 'editor' }),
        },
      ],
    },
  ];

  if (showAmQueue) {
    pipelineGroups.push({
      label: 'Account manager',
      items: [
        {
          label: 'In review',
          value: summary.inReviewCount,
          onClick: () => onNavigate('todo', { tasksRole: 'account' }),
        },
        {
          label: 'Scheduling',
          value: summary.needsSchedulingCount,
          onClick: () => onNavigate('todo', { tasksRole: 'account' }),
        },
        {
          label: 'Post date',
          value: summary.needPostDateCount,
          onClick: () => onNavigate('todo', { tasksRole: 'account' }),
        },
      ],
    });
  }

  const corePipelineGroups = pipelineGroups.filter((group) => group.label !== 'Account manager');
  const accountManagerGroup = pipelineGroups.find((group) => group.label === 'Account manager');

  const showTodayPanel = todayTimeline.items.length > 0;

  return (
    <section>
      <ClientPortalSectionHeader
        title={title}
        description={description}
        eyebrow={personalGreeting?.eyebrow}
      />

      {summary.syncTotal > 0 && (
        <button
          type="button"
          onClick={onOpenNotifications}
          className="overview-sync-banner glass-surface mb-6 flex w-full items-center justify-between gap-3 text-left transition-colors hover:border-white/16"
        >
          <span className="text-sm text-white/75">
            {summary.syncTotal} client portal response{summary.syncTotal === 1 ? '' : 's'} ready to apply
          </span>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
            Review
          </span>
        </button>
      )}

      <div className="mb-8 space-y-4">
        <div className="overview-pipeline-grid">
          {corePipelineGroups.map((group) => (
            <PortalRolePanel key={group.label} label={group.label}>
              {group.items.map((item) => (
                <PortalPipelineMetric
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  onClick={item.onClick}
                />
              ))}
            </PortalRolePanel>
          ))}
        </div>

        {accountManagerGroup && (
          <PortalRolePanel label={accountManagerGroup.label} wide grid>
            {accountManagerGroup.items.map((item) => (
              <PortalPipelineMetric
                key={item.label}
                label={item.label}
                value={item.value}
                onClick={item.onClick}
              />
            ))}
          </PortalRolePanel>
        )}
      </div>

      {showTodayPanel && (
        <OverviewTodayPanel
          timeline={todayTimeline}
          onOpenMeeting={onOpenMeeting}
          onOpenShoot={onOpenShoot}
          onNavigate={onNavigate}
        />
      )}
    </section>
  );
}
