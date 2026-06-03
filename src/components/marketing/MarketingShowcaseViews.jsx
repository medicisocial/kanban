import { useMemo, useState } from 'react';
import { buildShootTimeline } from '../../utils/shootDay';
import { getContentTypeStyle, COLUMNS } from '../../constants';
import { contentTypePillProps } from '../../utils/contentTypeColors';
import KanbanBoard from '../KanbanBoard';
import ClientPortalHome from '../ClientPortalHome';
import ClientIdeasTable from '../clientPortal/ClientIdeasTable';
import AdminIdeasTable from '../clientPortal/AdminIdeasTable';
import ClientShootSchedulePortal from '../ClientShootSchedulePortal';
import ClientCalendarPortal from '../ClientCalendarPortal';
import ContentReviewCard from '../ContentReviewCard';
import CalendarMonthView from '../CalendarMonthView';
import ClientCompanyFilesPage from '../ClientCompanyFilesPage';
import ShootDayTimeline from '../ShootDayTimeline';
import { PortalTaskSection } from '../clientPortal/PortalOverviewPanels';
import { glassInsetClass } from '../clientPortal/clientPortalUi';
import MarketingShowcaseClientsProvider from './MarketingShowcaseClientsProvider';
import {
  MARKETING_SHOWCASE_CALENDAR_CARDS,
  MARKETING_SHOWCASE_CARDS,
  MARKETING_SHOWCASE_CLIENT_CALENDAR_CARDS,
  MARKETING_SHOWCASE_CLIENT_CARDS,
  MARKETING_SHOWCASE_CLIENT_SHOOT_PLANS,
  MARKETING_SHOWCASE_COMPANY_FILES,
  MARKETING_SHOWCASE_IDEAS,
  MARKETING_SHOWCASE_REVIEW_CARD,
  MARKETING_SHOWCASE_SHOOT_CARDS,
  MARKETING_SHOWCASE_SHOOT_PLAN,
  SHOWCASE_BRAND,
  SHOWCASE_BRAND_COLOR,
  SHOWCASE_CLIENT_COLORS,
} from './marketingShowcaseData';

function noop() {}

function ShowcaseRoot({ children }) {
  return <MarketingShowcaseClientsProvider>{children}</MarketingShowcaseClientsProvider>;
}

export function ShowcasePipelineView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-board">
        <KanbanBoard
          cards={MARKETING_SHOWCASE_CARDS}
          onAddCard={noop}
          onCardClick={noop}
          onDeleteCard={noop}
          onMoveCard={noop}
          embedded
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseIdeasView() {
  const [statusFilter, setStatusFilter] = useState('pending');

  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-ideas">
        <AdminIdeasTable
          ideas={MARKETING_SHOWCASE_IDEAS}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onEdit={noop}
          onDelete={noop}
          onGoToBoard={noop}
          onApprove={noop}
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcasePortalView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-portal-review">
        <ContentReviewCard card={MARKETING_SHOWCASE_REVIEW_CARD} onApprove={noop} onDeny={noop} />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseClientHomeView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-client-home">
        <ClientPortalHome
          brand={SHOWCASE_BRAND}
          ideas={MARKETING_SHOWCASE_IDEAS}
          cards={MARKETING_SHOWCASE_CLIENT_CARDS}
          contacts={[]}
          socialLogins={{}}
          clientLogo={null}
          clientColor={SHOWCASE_BRAND_COLOR}
          onNavigate={noop}
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseClientIdeasView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-client-ideas">
        <ClientIdeasTable
          ideas={MARKETING_SHOWCASE_IDEAS}
          client={SHOWCASE_BRAND}
          clientColor={SHOWCASE_BRAND_COLOR}
          onApprove={noop}
          onDecline={noop}
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseClientShootsView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-client-shoots">
        <ClientShootSchedulePortal
          client={SHOWCASE_BRAND}
          cards={MARKETING_SHOWCASE_CLIENT_CARDS}
          plans={MARKETING_SHOWCASE_CLIENT_SHOOT_PLANS}
          clientColor={SHOWCASE_BRAND_COLOR}
          embedded
          upcomingOnly={false}
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseClientFilesView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-client-files">
        <ClientCompanyFilesPage
          client={SHOWCASE_BRAND}
          businessType=""
          companyFiles={MARKETING_SHOWCASE_COMPANY_FILES}
          readOnly
          embedded
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseClientCalendarView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-client-calendar">
        <ClientCalendarPortal
          client={SHOWCASE_BRAND}
          cards={MARKETING_SHOWCASE_CLIENT_CALENDAR_CARDS}
          embedded
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseShootsView() {
  const entries = useMemo(() => buildShootTimeline(MARKETING_SHOWCASE_SHOOT_CARDS), []);

  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-shoots">
        <ShootDayTimeline
          entries={entries}
          plan={MARKETING_SHOWCASE_SHOOT_PLAN}
          allCards={MARKETING_SHOWCASE_SHOOT_CARDS}
          client={SHOWCASE_BRAND}
          dateKey="2026-03-10"
        />
      </div>
    </ShowcaseRoot>
  );
}

const TEAM_TASK = {
  label: 'Set post date',
  title: 'Customer story reel',
  client: 'Harbor Studio',
  columnId: 'approved',
  contentType: 'Reel',
};

export function ShowcaseTeamView() {
  const typeStyle = getContentTypeStyle(TEAM_TASK.contentType);
  const clientColor = SHOWCASE_CLIENT_COLORS[TEAM_TASK.client];
  const pipelineStage = COLUMNS.find((col) => col.id === TEAM_TASK.columnId)?.title;

  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-team">
        <PortalTaskSection
          title="Set post date"
          subtitle="Pipeline cards missing a target publish date."
          action={
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-200">
              3
            </span>
          }
        >
          <article className={`${glassInsetClass} border-amber-500/30 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-200">
                    {TEAM_TASK.label}
                  </span>
                  {pipelineStage && (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                      {pipelineStage}
                    </span>
                  )}
                  <span {...contentTypePillProps(typeStyle)}>
                    {TEAM_TASK.contentType}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{TEAM_TASK.title}</h3>
                <p className="mt-1 text-xs font-medium" style={{ color: clientColor }}>
                  {TEAM_TASK.client}
                </p>
              </div>
            </div>
          </article>
        </PortalTaskSection>
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseAssetsView() {
  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-assets">
        <ClientCompanyFilesPage
          client={SHOWCASE_BRAND}
          businessType=""
          companyFiles={MARKETING_SHOWCASE_COMPANY_FILES}
          readOnly
          embedded
        />
      </div>
    </ShowcaseRoot>
  );
}

export function ShowcaseCalendarView() {
  const focusDate = useMemo(() => new Date('2026-03-01T12:00:00'), []);

  return (
    <ShowcaseRoot>
      <div className="marketing-showcase-embedded marketing-showcase-calendar">
        <CalendarMonthView
          focusDate={focusDate}
          cardsByDate={MARKETING_SHOWCASE_CALENDAR_CARDS}
          onCardClick={noop}
          onDayClick={noop}
          overviewLabel="content calendar"
        />
      </div>
    </ShowcaseRoot>
  );
}

const OVERVIEW_ROLES = [
  {
    label: 'Content creator',
    count: 8,
    details: [
      { label: 'To create', value: 6 },
      { label: 'Shoots today', value: 2 },
    ],
    liftContent: true,
  },
  {
    label: 'Editor',
    count: 5,
    details: [{ label: 'Editing', value: 5 }],
    liftContent: true,
  },
  {
    label: 'Account manager',
    count: 11,
    details: [
      { label: 'In review', value: 4 },
      { label: 'Scheduling', value: 5 },
      { label: 'Post date', value: 2 },
    ],
    centerCount: true,
  },
];

const OVERVIEW_ITEMS = [
  { time: '9:30 AM', kind: 'meeting', title: 'Campaign kickoff', sub: 'Alex Rivera · Zoom' },
  { time: '10:00 AM', kind: 'shoot', title: 'Studio shoot day', sub: '4 cards · Studio A' },
];

function ShowcaseRoleSummary({ label, count, details, centerCount, liftContent }) {
  return (
    <div className="overview-role-summary glass-surface">
      <div
        className={`overview-role-summary-body${liftContent ? ' overview-role-summary-body-lift' : ''}`}
      >
        <div className="overview-role-summary-copy">
          <h3 className="overview-role-summary-title">{label}</h3>
          <div className="overview-role-summary-details">
            {details.map((item) => (
              <span key={item.label} className="overview-role-summary-chip">
                {item.label}
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </div>
        <div
          className={`overview-role-summary-count-well${
            centerCount ? ' overview-role-summary-count-well-centered' : ''
          }`}
        >
          <span className="overview-role-summary-count">{count}</span>
        </div>
      </div>
    </div>
  );
}

function ShowcaseTimelineItem({ item }) {
  return (
    <div className="overview-timeline-item">
      <div className="overview-timeline-time">{item.time}</div>
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
        {item.sub ? <p className="mt-0.5 text-xs text-white/45">{item.sub}</p> : null}
      </div>
    </div>
  );
}

export function ShowcaseOverviewView() {
  return (
    <div className="marketing-mock-overview">
      <div className="overview-pipeline-row marketing-mock-overview-roles">
        {OVERVIEW_ROLES.map((role) => (
          <ShowcaseRoleSummary key={role.label} {...role} />
        ))}
      </div>

      <div className="overview-today-panel glass-surface marketing-mock-overview-today">
        <div className="marketing-mock-overview-today-head">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/38">Today</p>
            <h3 className="mt-1 text-base font-semibold tracking-tight text-white">Friday, March 6</h3>
            <p className="mt-1 text-sm text-white/55">2 meetings · 1 shoot day</p>
          </div>
          <div className="marketing-mock-overview-actions">
            <span className="marketing-mock-btn-white">Meetings (2)</span>
            <span className="marketing-mock-btn-outline">Shoots (1)</span>
          </div>
        </div>

        <div className="overview-timeline">
          {OVERVIEW_ITEMS.map((item) => (
            <ShowcaseTimelineItem key={item.title} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
