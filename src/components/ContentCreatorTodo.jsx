import { useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import { formatDate, formatTime } from '../utils';
import { buildContentCreatorTasks } from '../utils/contentCreatorTodo';
import { canReturnCardToVault } from '../utils/videoIdeas';
import { useStaffWorkspaceScope } from '../hooks/useStaffWorkspaceScope';
import { btnPrimaryClass, btnSecondaryClass, taskActionBtnClass } from './clientPortal/clientPortalUi';
import { CardLinks } from './clientPortal/ReferenceVideoLink';
import TeamTaskCard, { TeamTaskClientLabel } from './TeamTaskCard';
import AddEditorTaskModal from './AddEditorTaskModal';

export default function ContentCreatorTodo({
  cards,
  ideas = [],
  clientFilter,
  onAddCard,
  onAddOneOffTask,
  onOpenCard,
  onOpenShoot,
  onHandoff,
  onReturnToVault,
  onNavigate,
}) {
  const { getClientColor } = useClientsContext();
  const { staffName, personalTaskScope } = useStaffWorkspaceScope();
  const [showAddOneOff, setShowAddOneOff] = useState(false);

  const tasks = useMemo(
    () =>
      buildContentCreatorTasks(cards, {
        client: clientFilter,
        staffName: personalTaskScope ? staffName : '',
      }),
    [cards, clientFilter, personalTaskScope, staffName],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onAddCard && (
          <button
            type="button"
            onClick={() => onAddCard()}
            className={`${btnPrimaryClass} py-1.5 text-[10px]`}
          >
            + Add card
          </button>
        )}
        {onAddOneOffTask && (
          <button
            type="button"
            onClick={() => setShowAddOneOff(true)}
            className={`${btnSecondaryClass} py-1.5 text-[10px]`}
          >
            + Add one-off project
          </button>
        )}
      </div>

      {personalTaskScope && staffName && (
        <p className="text-xs text-white/45">
          Showing To Create items assigned to {staffName}.
        </p>
      )}

      {tasks.length === 0 ? (
        <div className="tesla-task-empty px-6 py-16 text-center">
          <p className="text-sm text-white/45">No cards in To Create right now.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {onAddCard && (
              <button type="button" onClick={() => onAddCard()} className={btnPrimaryClass}>
                + Add card
              </button>
            )}
            {onAddOneOffTask && (
              <button
                type="button"
                onClick={() => setShowAddOneOff(true)}
                className={btnSecondaryClass}
              >
                + Add one-off project
              </button>
            )}
            <button type="button" onClick={() => onNavigate?.('ideas')} className={btnSecondaryClass}>
              Open vault
            </button>
          </div>
        </div>
      ) : (
        tasks.map((task, index) => {
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
                <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:min-w-[7.5rem]">
                  {onOpenShoot && (
                    <button
                      type="button"
                      onClick={() => onOpenShoot(task.card)}
                      className={taskActionBtnClass}
                    >
                      Go to shoot
                    </button>
                  )}
                  {onReturnToVault && canReturnCardToVault(task.card) && (
                    <button
                      type="button"
                      onClick={() => onReturnToVault(task.card)}
                      className={taskActionBtnClass}
                    >
                      Move back to Ready
                    </button>
                  )}
                  {onHandoff && (
                    <button
                      type="button"
                      onClick={() => onHandoff(task.card)}
                      className={taskActionBtnClass}
                    >
                      Hand off
                    </button>
                  )}
                </div>
              </div>
            </TeamTaskCard>
          );
        })
      )}

      {showAddOneOff && onAddOneOffTask && (
        <AddEditorTaskModal
          onClose={() => setShowAddOneOff(false)}
          onAdd={onAddOneOffTask}
          initialColumnId="shoot"
        />
      )}
    </div>
  );
}
