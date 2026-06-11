import { useMemo } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import { formatDate, formatTime } from '../utils';
import { buildContentCreatorTasks } from '../utils/contentCreatorTodo';
import { canReturnCardToVault } from '../utils/videoIdeas';
import { useStaffWorkspaceScope } from '../hooks/useStaffWorkspaceScope';
import { btnSecondaryClass } from './clientPortal/clientPortalUi';
import { CardLinks } from './clientPortal/ReferenceVideoLink';
import TeamTaskCard, { TeamTaskClientLabel } from './TeamTaskCard';

export default function ContentCreatorTodo({
  cards,
  ideas = [],
  clientFilter,
  onOpenCard,
  onHandoff,
  onReturnToVault,
  onNavigate,
}) {
  const { getClientColor } = useClientsContext();
  const { staffName, personalTaskScope } = useStaffWorkspaceScope();

  const tasks = useMemo(
    () =>
      buildContentCreatorTasks(cards, {
        client: clientFilter,
        staffName: personalTaskScope ? staffName : '',
      }),
    [cards, clientFilter, personalTaskScope, staffName],
  );

  if (tasks.length === 0) {
    return (
      <div className="tesla-task-empty px-6 py-16 text-center">
        <p className="text-sm text-white/45">No cards in To Create right now.</p>
        <button type="button" onClick={() => onNavigate?.('board')} className={`${btnSecondaryClass} mt-4`}>
          Open pipeline
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {personalTaskScope && staffName && (
        <p className="text-xs text-white/45">
          Showing To Create items assigned to {staffName}.
        </p>
      )}
      {tasks.map((task, index) => {
        const typeStyle = getContentTypeStyle(task.contentType);
        const clientColor = getClientColor(task.client);
        return (
          <TeamTaskCard
            key={task.id}
            accentColor={clientColor}
            animationDelay={0.08 + index * 0.05}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenCard?.(task.card)}
                className="min-w-0 flex-1 text-left transition-opacity duration-300 hover:opacity-90"
              >
                <div className="tesla-task-card-meta mb-2">
                  <span {...contentTypePipelinePillProps(typeStyle)}>
                    {task.contentType}
                  </span>
                  <TeamTaskClientLabel client={task.client} color={clientColor} />
                </div>
                <h3 className="text-sm font-semibold tracking-tight text-white">{task.title}</h3>
                <p className="mt-1 text-xs text-white/45">
                  {task.shootDate
                    ? `Shoot ${formatDate(task.shootDate)}${task.shootTime ? ` · ${formatTime(task.shootTime)}` : ''}`
                    : 'No shoot date set'}
                  {task.assignedTo ? ` · Editor: ${task.assignedTo}` : ''}
                </p>
                <CardLinks card={task.card} compact />
              </button>
              <div className="flex shrink-0 flex-col gap-1.5">
                {onReturnToVault && canReturnCardToVault(task.card, ideas) && (
                  <button
                    type="button"
                    onClick={() => onReturnToVault(task.card)}
                    className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/15"
                  >
                    Return to bank
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onHandoff?.(task.card)}
                  className="tesla-task-card-action"
                >
                  Hand off
                </button>
              </div>
            </div>
          </TeamTaskCard>
        );
      })}
    </div>
  );
}
