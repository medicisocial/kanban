import { useMemo } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { getContentTypeStyle } from '../constants';
import { contentTypePillProps } from '../utils/contentTypeColors';
import { formatDate, formatTime } from '../utils';
import { buildContentCreatorTasks } from '../utils/contentCreatorTodo';
import { resolveStaffMemberName } from '../utils/staffMembers';
import { usesPersonalWorkspaceView } from '../utils/staffAuth';
import { btnSecondaryClass } from './clientPortal/clientPortalUi';
import { CardLinks } from './clientPortal/ReferenceVideoLink';

export default function ContentCreatorTodo({
  cards,
  clientFilter,
  onOpenCard,
  onHandoff,
  onNavigate,
}) {
  const { getClientColor, teamMembers } = useClientsContext();
  const { session } = useStaffAuth();
  const staffName = resolveStaffMemberName(session, teamMembers);
  const myWorkOnly = usesPersonalWorkspaceView(session);

  const tasks = useMemo(
    () =>
      buildContentCreatorTasks(cards, {
        client: clientFilter,
        staffName: myWorkOnly ? staffName : '',
      }),
    [cards, clientFilter, myWorkOnly, staffName],
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
      {myWorkOnly && staffName && (
        <p className="text-xs text-white/45">
          Showing To Create items assigned to {staffName}.
        </p>
      )}
      {tasks.map((task, index) => {
        const typeStyle = getContentTypeStyle(task.contentType);
        const clientColor = getClientColor(task.client);
        return (
          <article
            key={task.id}
            className="tesla-task-card"
            style={{
              '--task-accent-color': clientColor,
              animationDelay: `${0.08 + index * 0.05}s`,
            }}
          >
            <div className="tesla-task-card-body flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenCard?.(task.card)}
                className="min-w-0 flex-1 text-left transition-opacity duration-300 hover:opacity-90"
              >
                <div className="tesla-task-card-meta mb-2">
                  <span {...contentTypePillProps(typeStyle)}>
                    {task.contentType}
                  </span>
                  <span className="tesla-task-card-client" style={{ color: clientColor }}>
                    <span
                      className="client-filter-dot client-filter-dot-active"
                      style={{ '--client-filter-color': clientColor }}
                    />
                    {task.client}
                  </span>
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
              <button
                type="button"
                onClick={() => onHandoff?.(task.card)}
                className="tesla-task-card-action shrink-0"
              >
                Hand off
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
