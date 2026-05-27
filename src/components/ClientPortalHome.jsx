import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { buildClientPortalTasks } from '../utils/clientPortalTasks';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

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

export default function ClientPortalHome({
  brand,
  ideas,
  cards,
  contacts,
  socialLogins,
  clientLogo,
  clientColor,
  onNavigate,
}) {
  const summary = buildClientPortalTasks({
    brand,
    ideas,
    cards,
    contacts,
    socialLogins,
    clientLogo,
  });

  return (
    <section>
      <ClientPortalSectionHeader
        title="Your tasks"
        description="Everything waiting on you — idea approvals, content reviews, and profile setup."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open tasks"
          value={summary.totalOpen}
          onClick={summary.totalOpen > 0 ? () => onNavigate(summary.actionItems[0]?.tab || summary.setupTasks[0]?.tab || 'review') : undefined}
        />
        <StatCard
          label="Ideas to review"
          value={summary.pendingIdeasCount}
          onClick={summary.pendingIdeasCount > 0 ? () => onNavigate('ideas') : undefined}
        />
        <StatCard
          label="Content to approve"
          value={summary.reviewCount}
          onClick={summary.reviewCount > 0 ? () => onNavigate('review') : undefined}
        />
        <StatCard
          label="Profile setup"
          value={summary.setupCount}
          onClick={summary.setupCount > 0 ? () => onNavigate('profile') : undefined}
        />
      </div>

      {summary.totalOpen === 0 ? (
        <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
          <h3 className="text-base font-semibold text-white">You&apos;re all caught up</h3>
          <p className="mt-2 text-sm text-white/50">
            No ideas, content reviews, or profile items need your attention right now.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => onNavigate('pipeline')} className={btnSecondaryClass}>
              View board
            </button>
            <button type="button" onClick={() => onNavigate('calendar')} className={btnSecondaryClass}>
              Content calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {summary.actionItems.length > 0 && (
            <div className={`${surfacePanelClass} overflow-hidden`}>
              <div className="border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Needs your review</h3>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {summary.actionItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.tab)}
                      className="flex w-full items-start gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                    >
                      <span
                        className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                        style={{
                          backgroundColor: `${clientColor}22`,
                          color: clientColor,
                        }}
                      >
                        {item.meta}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-white/45">{item.detail}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.setupTasks.length > 0 && (
            <div className={`${surfacePanelClass} overflow-hidden`}>
              <div className="border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Complete your profile</h3>
                <p className="mt-1 text-xs text-white/45">
                  These help your production team work smoothly with your brand.
                </p>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {summary.setupTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(task.tab)}
                      className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-white">{task.label}</span>
                        <span className="mt-0.5 block text-xs text-white/45">{task.detail}</span>
                      </span>
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-[#c88]">
                        Set up
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {summary.totalOpen > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {summary.pendingIdeasCount > 0 && (
            <button type="button" onClick={() => onNavigate('ideas')} className={btnPrimaryClass}>
              Review ideas
            </button>
          )}
          {summary.reviewCount > 0 && (
            <button type="button" onClick={() => onNavigate('review')} className={btnPrimaryClass}>
              Approve content
            </button>
          )}
          {summary.setupCount > 0 && summary.pendingIdeasCount === 0 && summary.reviewCount === 0 && (
            <button type="button" onClick={() => onNavigate('profile')} className={btnPrimaryClass}>
              Finish profile
            </button>
          )}
        </div>
      )}
    </section>
  );
}
