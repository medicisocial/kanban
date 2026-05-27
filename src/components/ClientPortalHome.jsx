import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import {
  PortalPipelineMetric,
  PortalRolePanel,
  PortalTaskSection,
} from './clientPortal/PortalOverviewPanels';
import { buildClientPortalTasks } from '../utils/clientPortalTasks';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

const taskActionBtnClass =
  'inline-flex shrink-0 items-center justify-center rounded-sm bg-white px-3 py-1.5 text-[10px] font-medium normal-case tracking-normal text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40';

const panelActionBtnClass = taskActionBtnClass;

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

      <div className="mb-8">
        <PortalRolePanel label="At a glance" quad>
          <PortalPipelineMetric
            label="Open tasks"
            value={summary.totalOpen}
            onClick={
              summary.totalOpen > 0
                ? () => onNavigate(summary.actionItems[0]?.tab || summary.setupTasks[0]?.tab || 'review')
                : undefined
            }
          />
          <PortalPipelineMetric
            label="Ideas to review"
            value={summary.pendingIdeasCount}
            onClick={summary.pendingIdeasCount > 0 ? () => onNavigate('ideas') : undefined}
          />
          <PortalPipelineMetric
            label="Content to approve"
            value={summary.reviewCount}
            onClick={summary.reviewCount > 0 ? () => onNavigate('review') : undefined}
          />
          <PortalPipelineMetric
            label="Profile setup"
            value={summary.setupCount}
            onClick={summary.setupCount > 0 ? () => onNavigate('profile') : undefined}
          />
        </PortalRolePanel>
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
              Calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {summary.actionItems.length > 0 && (
            <PortalTaskSection
              title="Needs your review"
              action={
                <button
                  type="button"
                  onClick={() => onNavigate(summary.actionItems[0]?.tab || 'review')}
                  className={panelActionBtnClass}
                >
                  Review ({summary.actionItems.length})
                </button>
              }
            >
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
            </PortalTaskSection>
          )}

          {summary.setupTasks.length > 0 && (
            <PortalTaskSection
              title="Complete your profile"
              subtitle="These help your production team work smoothly with your brand."
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className={panelActionBtnClass}
                >
                  Finish setup ({summary.setupCount})
                </button>
              }
            >
              <ul className="divide-y divide-white/[0.06]">
                {summary.setupTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/[0.03]"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate(task.tab)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block text-sm font-medium text-white">{task.label}</span>
                      <span className="mt-0.5 block text-xs text-white/45">{task.detail}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate(task.tab)}
                      className={taskActionBtnClass}
                    >
                      Set up
                    </button>
                  </li>
                ))}
              </ul>
            </PortalTaskSection>
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
