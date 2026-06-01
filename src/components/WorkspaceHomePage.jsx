import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import {
  PortalRoleSummary,
} from './clientPortal/PortalOverviewPanels';
import OverviewTodayPanel from './clientPortal/OverviewTodayPanel';
import { buildWorkspaceHomeSummary, buildMyWorkGreeting } from '../utils/workspaceHome';
import { buildTodayTimeline } from '../utils/todayTimeline';
import { useClientsContext } from '../context/ClientsContext';

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

  const firstName =
    staffName.trim().split(/\s+/)[0] && !staffName.includes('@')
      ? staffName.trim().split(/\s+/)[0]
      : '';

  const personalGreeting = myWorkOnly ? buildMyWorkGreeting(firstName, summaryWithToday) : null;

  const title = personalGreeting?.title ?? 'Overview';

  const description =
    personalGreeting?.description ??
    (clientFilter === 'all'
      ? 'Company-wide production at a glance — pipeline, reviews, and schedules.'
      : `Production at a glance for ${clientFilter}.`);

  const showAmQueue = !myWorkOnly || summaryWithToday.showAccountManagerQueue;

  const pipelineRoles = [
    {
      label: 'Content creator',
      count: summary.toCreateCount + summary.shootsTodayCount,
      details: [
        { label: 'To create', value: summary.toCreateCount },
        { label: 'Shoots today', value: summary.shootsTodayCount },
      ],
      onClick: () => onNavigate('todo', { tasksRole: 'creator' }),
    },
    {
      label: 'Editor',
      count: summary.editingCount,
      details: [{ label: 'Editing', value: summary.editingCount }],
      onClick: () => onNavigate('todo', { tasksRole: 'editor' }),
    },
  ];

  if (showAmQueue) {
    const amTotal =
      summary.inReviewCount + summary.needsSchedulingCount + summary.needPostDateCount;
    pipelineRoles.push({
      label: 'Account manager',
      count: amTotal,
      details: [
        { label: 'In review', value: summary.inReviewCount },
        { label: 'Scheduling', value: summary.needsSchedulingCount },
        { label: 'Post date', value: summary.needPostDateCount },
      ],
      onClick: () => onNavigate('todo', { tasksRole: 'account' }),
    });
  }

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

      <div className="overview-pipeline-row">
        {pipelineRoles.map((role) => (
          <PortalRoleSummary
            key={role.label}
            label={role.label}
            count={role.count}
            details={role.details}
            onClick={role.onClick}
            centerCount={role.label === 'Account manager'}
            liftContent={role.label === 'Content creator' || role.label === 'Editor'}
          />
        ))}
      </div>

      {showTodayPanel && (
        <OverviewTodayPanel
          timeline={todayTimeline}
          onOpenMeeting={onOpenMeeting}
          onOpenShoot={onOpenShoot}
          onNavigateMeetings={() => onNavigate('calendars', { calendarsTab: 'meetings' })}
          onNavigateShoots={() => onNavigate('shoot')}
        />
      )}
    </section>
  );
}
