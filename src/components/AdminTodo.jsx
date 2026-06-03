import { useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';
import {
  buildAdminTodoTasks,
  filterAdminTasks,
  groupAdminTasksByDate,
} from '../utils/adminTodo';
import AddAdminTaskModal from './AddAdminTaskModal';
import TeamTaskCard, { TeamTaskClientLabel } from './TeamTaskCard';
import { btnPrimaryClass, selectClass } from './clientPortal/clientPortalUi';

export default function AdminTodo({
  embedded = false,
  adminTasks,
  clientFilter,
  onAddAdminTask,
  onToggleAdminTaskComplete,
  onDeleteAdminTask,
}) {
  const { getClientColor, getAllTeamMemberNames } = useClientsContext();
  const adminStaff = getAllTeamMemberNames();
  const todayKey = toDateKey(new Date());
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const allTasks = useMemo(() => buildAdminTodoTasks(adminTasks), [adminTasks]);

  const filteredTasks = useMemo(
    () =>
      filterAdminTasks(allTasks, {
        client: clientFilter,
        assignee: assigneeFilter,
        includeCompleted: showCompleted,
      }),
    [allTasks, clientFilter, assigneeFilter, showCompleted],
  );

  const groupedTasks = useMemo(
    () => groupAdminTasksByDate(filteredTasks, todayKey),
    [filteredTasks, todayKey],
  );

  const openCount = filteredTasks.filter((t) => !t.completed).length;

  return (
    <div className={embedded ? '' : 'mx-auto max-w-[900px] px-4 py-4 sm:px-6'}>
      <div className={`flex flex-wrap items-center justify-between gap-4 ${embedded ? 'mb-4' : 'mb-6'}`}>
        {!embedded && (
          <div>
            <h2 className="text-xl font-semibold text-white">Administrative tasks</h2>
            <p className="mt-1 text-sm text-white/45">
              Internal ops, billing, client admin, and other non-content work.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">
                {openCount} open
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className={`${btnPrimaryClass} ${embedded ? 'ml-auto py-1.5 text-[10px]' : ''}`}
        >
          + Add task
        </button>
      </div>

      <div className={`flex flex-wrap items-center gap-3 ${embedded ? 'mb-4' : 'mb-6'}`}>
        <label className="flex items-center gap-2 text-sm text-white/45">
          <span>Assigned to</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className={`${selectClass} py-1.5 text-xs`}
          >
            <option value="all">Everyone</option>
            {adminStaff.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-white/45">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/[0.04] text-white"
          />
          Show completed
        </label>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-white/45">No administrative tasks yet.</p>
          <p className="mt-1 text-xs text-white/35">
            Add billing, reporting, or client admin items here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map((group) => (
            <section key={group.key}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                {group.label}
                <span className="ml-2 font-normal normal-case text-white/30">
                  ({group.tasks.length})
                </span>
              </h3>
              <div className="space-y-3">
                {group.tasks.map((task, index) => {
                  const clientColor =
                    task.client === 'General' ? '#a78bfa' : getClientColor(task.client);

                  return (
                    <TeamTaskCard
                      key={task.id}
                      accentColor={clientColor}
                      completed={task.completed}
                      animationDelay={`${0.08 + index * 0.05}s`}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => onToggleAdminTaskComplete(task.id)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-[#1a1a1a] text-[#810100]"
                          aria-label={`Mark ${task.title} complete`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="tesla-task-card-meta mb-2">
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-200">
                              Admin
                            </span>
                            <TeamTaskClientLabel client={task.client} color={clientColor} />
                          </div>

                          <h3
                            className={`text-sm font-semibold text-white ${
                              task.completed ? 'line-through' : ''
                            }`}
                          >
                            {task.title}
                          </h3>

                          {task.notes && (
                            <p className="mt-2 line-clamp-3 text-xs text-gray-400">{task.notes}</p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                            <span>{task.assignedTo}</span>
                            {task.dueDate && <span>Due {task.dueDate}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteAdminTask(task.id)}
                          className="text-xs text-gray-500 hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </TeamTaskCard>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddAdminTaskModal
          onClose={() => setShowAddModal(false)}
          onAdd={onAddAdminTask}
        />
      )}
    </div>
  );
}
