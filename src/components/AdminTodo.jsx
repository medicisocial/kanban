import { useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';
import {
  buildAdminTodoTasks,
  filterAdminTasks,
  groupAdminTasksByDate,
} from '../utils/adminTodo';
import AddAdminTaskModal from './AddAdminTaskModal';

export default function AdminTodo({
  embedded = false,
  adminTasks,
  search,
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
        search,
        client: clientFilter,
        assignee: assigneeFilter,
        includeCompleted: showCompleted,
      }),
    [allTasks, search, clientFilter, assigneeFilter, showCompleted],
  );

  const groupedTasks = useMemo(
    () => groupAdminTasksByDate(filteredTasks, todayKey),
    [filteredTasks, todayKey],
  );

  const openCount = filteredTasks.filter((t) => !t.completed).length;

  return (
    <div className={embedded ? '' : 'mx-auto max-w-[900px] px-4 py-4 sm:px-6'}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Administrative tasks</h2>
          <p className="mt-1 text-sm text-gray-400">
            Internal ops, billing, client admin, and other non-content work.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">
              {openCount} open
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-[#810100] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a00000]"
        >
          + Add task
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span>Assigned to</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="select-dark rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-sm text-[#f9f6f2] outline-none"
          >
            <option value="all">Everyone</option>
            {adminStaff.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-[#1a1a1a] text-[#810100]"
          />
          Show completed
        </label>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-gray-400">No administrative tasks yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            Add billing, reporting, or client admin items here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTasks.map((group) => (
            <section key={group.key}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
                <span className="ml-2 font-normal normal-case text-gray-500">
                  ({group.tasks.length})
                </span>
              </h3>
              <div className="space-y-3">
                {group.tasks.map((task) => {
                  const clientColor =
                    task.client === 'General' ? '#a78bfa' : getClientColor(task.client);

                  return (
                    <article
                      key={task.id}
                      className={`rounded-xl border border-white/8 bg-[#111111] p-4 transition ${
                        task.completed ? 'opacity-60' : ''
                      }`}
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
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-200">
                              Admin
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-gray-300"
                              style={{ backgroundColor: `${clientColor}22` }}
                            >
                              {task.client}
                            </span>
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
                    </article>
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
