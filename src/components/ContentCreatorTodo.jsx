import { useMemo } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAuth } from '../context/StaffAuthContext';
import { getContentTypeStyle } from '../constants';
import { formatDate, formatTime } from '../utils';
import { buildContentCreatorTasks } from '../utils/contentCreatorTodo';
import { resolveStaffMemberName } from '../utils/staffMembers';
import { usesPersonalWorkspaceView } from '../utils/staffAuth';
import { btnPrimaryClass, btnSecondaryClass } from './clientPortal/clientPortalUi';

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
      <div className="border border-dashed border-white/10 px-6 py-16 text-center">
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
      {tasks.map((task) => {
        const typeStyle = getContentTypeStyle(task.contentType);
        const clientColor = getClientColor(task.client);
        return (
          <article
            key={task.id}
            className="rounded-xl border border-white/8 bg-[#111111] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenCard?.(task.card)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeStyle.label}`}
                    style={{ backgroundColor: `${typeStyle.border}22` }}
                  >
                    {task.contentType}
                  </span>
                  <span className="text-[10px] font-semibold uppercase" style={{ color: clientColor }}>
                    {task.client}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{task.title}</h3>
                <p className="mt-1 text-xs text-white/45">
                  {task.shootDate
                    ? `Shoot ${formatDate(task.shootDate)}${task.shootTime ? ` · ${formatTime(task.shootTime)}` : ''}`
                    : 'No shoot date set'}
                  {task.assignedTo ? ` · Editor: ${task.assignedTo}` : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onHandoff?.(task.card)}
                className={`${btnPrimaryClass} shrink-0 px-3 py-2 text-[10px]`}
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
