import { useState } from 'react';
import { CAROUSEL_PAY_RATE, EDITOR_POINT_PAY_RATE, STATIC_POST_PAY_RATE } from '../constants';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import {
  PortalRoleSummary,
} from './clientPortal/PortalOverviewPanels';
import OverviewCompletedContentSection from './OverviewCompletedContentSection';
import OverviewTodayPanel from './clientPortal/OverviewTodayPanel';
import { buildWorkspaceHomeSummary, buildMyWorkGreeting } from '../utils/workspaceHome';
import { buildTodayTimeline } from '../utils/todayTimeline';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffWorkspaceScope } from '../hooks/useStaffWorkspaceScope';
import { surfacePanelClass } from './clientPortal/clientPortalUi';
import { useWorkspaceSync } from '../context/WorkspaceSyncContext';

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
  workspaceDataLoading = false,
  onNavigate,
  onOpenMeeting,
  onOpenShoot,
  onOpenNotifications,
  onOpenCard,
}) {
  const { clients, teamMembers, getClientColor } = useClientsContext();
  const { syncIssue } = useWorkspaceSync();
  const { visibleCompanyTaskTabs } = useStaffWorkspaceScope();
  const [expandedCompletedEditor, setExpandedCompletedEditor] = useState('');

  const isCompanyWideOverview = !myWorkOnly || companyWideView;

  const toggleCompletedEditor = (name) => {
    setExpandedCompletedEditor((current) => (current === name ? '' : name));
  };

  const summary = buildWorkspaceHomeSummary({
    cards,
    ideas,
    adminTasks,
    clientFilter,
    syncTotal,
    staffName,
    clientAccountManagers,
    teamMembers,
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
  const completedContentMonthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const completedContentSubtitle = `Reels ($${EDITOR_POINT_PAY_RATE}/pt), carousels ($${CAROUSEL_PAY_RATE}), and statics ($${STATIC_POST_PAY_RATE}) scheduled for ${completedContentMonthLabel}.`;

  const pipelineRoles = [];

  if (visibleCompanyTaskTabs.includes('creator')) {
    pipelineRoles.push({
      label: 'Content creator',
      count: summary.toCreateCount + summary.shootsTodayCount,
      details: [
        { label: 'To create', value: summary.toCreateCount },
        { label: 'Shoots today', value: summary.shootsTodayCount },
      ],
      onClick: () => onNavigate('todo', { tasksRole: 'creator' }),
    });
  }

  if (visibleCompanyTaskTabs.includes('editor')) {
    const editorTotal = summary.editingCount + (summary.editorInReviewCount || 0);
    pipelineRoles.push({
      label: 'Editor',
      count: editorTotal,
      details: [
        { label: 'Editing', value: summary.editingCount },
        { label: 'In review', value: summary.editorInReviewCount || 0 },
      ],
      onClick: () => onNavigate('todo', { tasksRole: 'editor' }),
    });
  }

  if (showAmQueue && visibleCompanyTaskTabs.includes('account')) {
    const amTotal =
      summary.accountManagerTaskCount ??
      summary.inReviewCount + summary.needsSchedulingCount + summary.needPostDateCount;
    pipelineRoles.push({
      label: 'Account manager',
      count: amTotal,
      details: [
        { label: 'In review', value: summary.inReviewCount },
        { label: 'Post date', value: summary.needPostDateCount },
        { label: 'To schedule', value: summary.needsSchedulingCount },
        ...(summary.storiesTodayCount > 0
          ? [{ label: 'Stories today', value: summary.storiesTodayCount }]
          : []),
      ],
      onClick: () => onNavigate('todo', { tasksRole: 'account' }),
    });
  }

  const showTodayPanel = todayTimeline.items.length > 0;
  const showCompletedContentRoster =
    isCompanyWideOverview &&
    visibleCompanyTaskTabs.includes('editor') &&
    summary.editorCompletedByAssignee?.some(
      (entry) => (entry.count || 0) > 0 || (entry.points || 0) > 0,
    );
  const showPersonalCompletedRoster =
    !isCompanyWideOverview &&
    visibleCompanyTaskTabs.includes('editor') &&
    staffName &&
    ((summary.editorCompletedCount || 0) > 0 || (summary.editorCompletedPoints || 0) > 0);
  const workspaceLooksEmpty =
    !workspaceDataLoading && cards.length === 0 && ideas.length === 0 && meetings.length === 0;

  if (workspaceDataLoading) {
    return (
      <section>
        <ClientPortalSectionHeader
          title={title}
          description="Loading your workspace from the cloud…"
          eyebrow={personalGreeting?.eyebrow}
        />
        <div className="overview-pipeline-row">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="overview-role-summary glass-surface h-[7.5rem] animate-pulse opacity-60"
              aria-hidden="true"
            />
          ))}
        </div>
        <p className="text-center text-sm text-white/45">First load on a new device can take a moment.</p>
      </section>
    );
  }

  return (
    <section>
      <ClientPortalSectionHeader
        title={title}
        description={description}
        eyebrow={personalGreeting?.eyebrow}
      />

      {workspaceLooksEmpty && (
        <div className={`${surfacePanelClass} mb-6 px-5 py-4 text-sm text-white/60`}>
          <p className="font-medium text-white/85">No workspace data loaded yet</p>
          <p className="mt-1.5 leading-relaxed">
            {syncIssue?.message ||
              'Open the app on desktop while signed in so your cards upload to the cloud, then reload here. The banner at the top will show sync progress or errors.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-sm bg-white px-4 py-2 text-xs font-medium text-black transition hover:opacity-80"
          >
            Reload workspace
          </button>
        </div>
      )}

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

      {showCompletedContentRoster && (
        <OverviewCompletedContentSection
          title="Completed content"
          subtitle={completedContentSubtitle}
          entries={summary.editorCompletedByAssignee}
          cards={cards}
          clientFilter={clientFilter}
          expandedEditorName={expandedCompletedEditor}
          onToggleEditor={toggleCompletedEditor}
          onOpenCard={onOpenCard}
          getClientColor={getClientColor}
        />
      )}

      {showPersonalCompletedRoster && (
        <OverviewCompletedContentSection
          title="Completed content"
          subtitle={completedContentSubtitle}
          entries={[
            {
              name: staffName,
              count: summary.editorCompletedCount,
              points: summary.editorCompletedPoints || 0,
              pay: summary.editorCompletedPay || 0,
            },
          ]}
          cards={cards}
          clientFilter={clientFilter}
          expandedEditorName={expandedCompletedEditor}
          onToggleEditor={toggleCompletedEditor}
          onOpenCard={onOpenCard}
          getClientColor={getClientColor}
        />
      )}

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
