import { useMemo, useState } from 'react';
import { TEAM_MEMBERS, getContentTypeStyle } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';
import {
  buildBoardEditorTasks,
  buildOneOffEditorTask,
  groupEditorTasksByDate,
  filterEditorTasks,
} from '../utils/editorTodo';
import AddEditorTaskModal from './AddEditorTaskModal';

const kindStyles = {
  edit: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  approve: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  oneoff: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
};

function EditorTodoItem({
  task,
  onOpenCard,
  onToggleComplete,
  onDeleteOneOff,
  getClientColor,
}) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const isOneOff = task.source === 'oneoff';
  const clientColor = isOneOff ? '#38bdf8' : getClientColor(task.client);

  return (
    <article
      className={`rounded-xl border border-white/8 bg-[#1a1d2e] p-4 transition ${
        task.completed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {isOneOff ? (
          <input
            type="checkbox"
            checked={Boolean(task.completed)}
            onChange={() => onToggleComplete(task.id)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-[#1e2130] text-violet-600"
            aria-label={`Mark ${task.title} complete`}
          />
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-400">
            →
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${kindStyles[task.kind]}`}>
              {task.label}
            </span>
            {task.contentType && typeStyle && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeStyle.label}`}
                style={{ backgroundColor: `${typeStyle.border}22` }}
              >
                {task.contentType}
              </span>
            )}
            {isOneOff && (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                One-off
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => !isOneOff && onOpenCard?.(task.card)}
            className={`text-left ${!isOneOff ? 'hover:text-violet-300' : ''}`}
            disabled={isOneOff}
          >
            <h3 className={`text-sm font-semibold text-white ${task.completed ? 'line-through' : ''}`}>
              {task.title}
            </h3>
          </button>

          <p className="mt-1 text-xs font-medium" style={{ color: clientColor }}>
            {isOneOff ? task.projectName : task.client}
          </p>

          {task.clientComment && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
              Client notes: {task.clientComment}
            </p>
          )}

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Assigned to {task.assignedTo}</span>}
            {!isOneOff && <span>On board · {task.columnId.replace('-', ' ')}</span>}
          </div>
        </div>

        {isOneOff && (
          <button
            type="button"
            onClick={() => onDeleteOneOff(task.id)}
            className="text-xs text-gray-500 hover:text-red-400"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

export default function EditorTodo({
  cards,
  oneOffTasks,
  search,
  clientFilter,
  onAddOneOffTask,
  onToggleOneOffComplete,
  onDeleteOneOffTask,
  onOpenCard,
}) {
  const { getClientColor } = useClientsContext();
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const todayKey = toDateKey(new Date());

  const allTasks = useMemo(() => {
    const boardTasks = buildBoardEditorTasks(cards);
    const customTasks = oneOffTasks.map(buildOneOffEditorTask);
    return [...boardTasks, ...customTasks];
  }, [cards, oneOffTasks]);

  const filteredTasks = useMemo(
    () =>
      filterEditorTasks(allTasks, {
        search,
        assignee: assigneeFilter,
        client: clientFilter,
        includeCompleted: showCompleted,
      }),
    [allTasks, search, assigneeFilter, clientFilter, showCompleted],
  );

  const groupedTasks = useMemo(
    () => groupEditorTasksByDate(filteredTasks, todayKey),
    [filteredTasks, todayKey],
  );

  const editCount = filteredTasks.filter((t) => t.kind === 'edit').length;
  const approveCount = filteredTasks.filter((t) => t.kind === 'approve').length;
  const oneOffCount = filteredTasks.filter((t) => t.kind === 'oneoff' && !t.completed).length;

  return (
    <div className="mx-auto max-w-[900px] px-4 py-4 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Editor To-Do</h2>
          <p className="mt-1 text-sm text-gray-400">
            Auto-generated from the board each day — editing and review tasks sorted by date.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              {editCount} to edit
            </span>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">
              {approveCount} to review
            </span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sky-200">
              {oneOffCount} one-off
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          + Add one-off task
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span>Editor</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="select-dark rounded-lg border border-white/10 bg-[#1e2130] px-3 py-1.5 text-sm text-gray-200 outline-none"
          >
            <option value="all">All editors</option>
            {TEAM_MEMBERS.map((member) => (
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
            className="h-4 w-4 rounded border-white/20 bg-[#1e2130] text-violet-600"
          />
          Show completed one-offs
        </label>
      </div>

      {groupedTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-gray-400">Nothing on the list right now.</p>
          <p className="mt-1 text-xs text-gray-500">
            Move cards to Editing, Not Approved, or In Review on the board — or add a one-off task.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTasks.map((group) => (
            <section key={group.key}>
              <h3
                className={`mb-3 text-sm font-semibold uppercase tracking-wider ${
                  group.key === 'overdue' ? 'text-red-300' : 'text-gray-400'
                }`}
              >
                {group.label}
              </h3>
              <div className="space-y-3">
                {group.tasks.map((task) => (
                  <EditorTodoItem
                    key={task.id}
                    task={task}
                    onOpenCard={onOpenCard}
                    onToggleComplete={onToggleOneOffComplete}
                    onDeleteOneOff={onDeleteOneOffTask}
                    getClientColor={getClientColor}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddEditorTaskModal
          onClose={() => setShowAddModal(false)}
          onAdd={onAddOneOffTask}
          defaultAssignee={assigneeFilter !== 'all' ? assigneeFilter : undefined}
        />
      )}
    </div>
  );
}
