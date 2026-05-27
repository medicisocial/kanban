import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { buildWorkspaceHomeSummary, buildMyWorkGreeting } from '../utils/workspaceHome';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import { formatDate } from '../utils';

function StatCard({ label, value, onClick }) {
  const inner = (
    <>
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${surfacePanelClass} p-4 text-left transition-colors hover:border-white/15 hover:bg-white/[0.04]`}
      >
        {inner}
      </button>
    );
  }

  return <div className={`${surfacePanelClass} p-4`}>{inner}</div>;
}

export default function WorkspaceHomePage({
  cards,
  ideas,
  adminTasks,
  clientFilter,
  syncTotal,
  staffName = '',
  clientAccountManagers = {},
  myWorkOnly = false,
  onNavigate,
  onOpenCard,
  onOpenNotifications,
}) {
  const summary = buildWorkspaceHomeSummary({
    cards,
    ideas,
    adminTasks,
    clientFilter,
    syncTotal,
    staffName,
    clientAccountManagers,
    myWorkOnly,
  });

  const firstName = staffName.trim().split(/\s+/)[0] || '';

  const personalGreeting = myWorkOnly ? buildMyWorkGreeting(firstName, summary) : null;

  const title = personalGreeting?.title ?? 'Overview';

  const description =
    personalGreeting?.description ??
    (clientFilter === 'all'
      ? 'Company-wide production at a glance — pipeline, reviews, and schedules.'
      : `Production at a glance for ${clientFilter}.`);

  return (
    <section>
      <ClientPortalSectionHeader
        title={title}
        description={description}
        eyebrow={personalGreeting?.eyebrow}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        {summary.syncTotal > 0 && (
          <StatCard
            label="Client sync"
            value={summary.syncTotal}
            onClick={onOpenNotifications}
          />
        )}
        <StatCard label="To create" value={summary.toCreateCount} onClick={() => onNavigate('board')} />
        <StatCard label="Editing" value={summary.editingCount} onClick={() => onNavigate('board')} />
        <StatCard label="In review" value={summary.inReviewCount} onClick={() => onNavigate('board')} />
        <StatCard label="Pending ideas" value={summary.pendingIdeasCount} onClick={() => onNavigate('ideas')} />
        <StatCard label="Shoots today" value={summary.shootsTodayCount} onClick={() => onNavigate('shoot')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${surfacePanelClass} p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Today&apos;s production</h3>
            <button type="button" onClick={() => onNavigate('shoot')} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
              Production days
            </button>
          </div>
          {summary.shootsToday.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-white/40">No shoots scheduled for today.</p>
              <button type="button" onClick={() => onNavigate('shoot')} className={`${btnSecondaryClass} mt-3 py-1.5 text-[10px]`}>
                Open production days
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {summary.shootsToday.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCard?.(card)}
                    className="w-full border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/12"
                  >
                    <p className="text-sm font-medium text-white">{card.title}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {card.client} · {card.contentType}
                      {card.shootTime ? ` · ${card.shootTime}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${surfacePanelClass} p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Awaiting client review</h3>
            <button type="button" onClick={() => onNavigate('board')} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
              Pipeline
            </button>
          </div>
          {summary.inReview.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-white/40">Nothing in client review right now.</p>
              <button type="button" onClick={() => onNavigate('board')} className={`${btnSecondaryClass} mt-3 py-1.5 text-[10px]`}>
                Open pipeline
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {summary.inReview.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCard?.(card)}
                    className="w-full border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/12"
                  >
                    <p className="text-sm font-medium text-white">{card.title}</p>
                    <p className="mt-0.5 text-xs text-white/45">{card.client} · {card.contentType}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${surfacePanelClass} p-5 lg:col-span-2`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Scheduled this week</h3>
            <button type="button" onClick={() => onNavigate('calendars')} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
              Calendars
            </button>
          </div>
          {summary.scheduledThisWeek.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-white/40">No posts scheduled this week.</p>
              <button type="button" onClick={() => onNavigate('calendars')} className={`${btnSecondaryClass} mt-3 py-1.5 text-[10px]`}>
                Open calendars
              </button>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {summary.scheduledThisWeek.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCard?.(card)}
                    className="w-full border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/12"
                  >
                    <p className="text-sm font-medium text-white">{card.title}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {card.client} · {formatDate(card.dueDate)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" onClick={() => onNavigate('board')} className={btnPrimaryClass}>
          Open pipeline
        </button>
        <button type="button" onClick={() => onNavigate('todo')} className={btnSecondaryClass}>
          Team tasks
        </button>
        <button type="button" onClick={() => onNavigate('ideas')} className={btnSecondaryClass}>
          Ideas
        </button>
      </div>
    </section>
  );
}
