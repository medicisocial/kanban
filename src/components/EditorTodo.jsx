import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TEAM_MEMBERS, getContentTypeStyle } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { toDateKey } from '../utils/calendar';
import {
  applyEditorTaskOrder,
  buildBoardEditorTasks,
  buildInitialTaskOrder,
  buildOneOffEditorTask,
  formatEditorDateLabel,
  groupEditorTasksByDate,
  filterEditorTasks,
} from '../utils/editorTodo';
import AddEditorTaskModal from './AddEditorTaskModal';

const kindStyles = {
  edit: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  approve: 'border-[#810100]/30 bg-[#a00000]/10 text-[#fecaca]',
  oneoff: 'border-white/20 bg-white/5 text-[#f9f6f2]',
};

function EditorTodoItem({
  task,
  sortable = false,
  dragHandleProps = null,
  onOpenCard,
  onToggleComplete,
  onDeleteOneOff,
  getClientColor,
  showDateBadge = false,
  todayKey,
}) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const isOneOff = task.source === 'oneoff';
  const clientColor = isOneOff ? '#f9f6f2' : getClientColor(task.client);

  return (
    <article
      className={`rounded-xl border border-white/8 bg-[#111111] p-4 transition ${
        task.completed ? 'opacity-60' : ''
      } ${sortable ? 'touch-none' : ''}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {sortable && dragHandleProps ? (
          <button
            type="button"
            className="mt-0.5 flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 active:cursor-grabbing hover:bg-white/10 hover:text-white"
            aria-label={`Drag to reorder ${task.title}`}
            {...dragHandleProps}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M7 4a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2zM7 9a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2zM7 14a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2z" />
            </svg>
          </button>
        ) : isOneOff ? (
          <input
            type="checkbox"
            checked={Boolean(task.completed)}
            onChange={() => onToggleComplete(task.id)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-[#1a1a1a] text-[#810100]"
            aria-label={`Mark ${task.title} complete`}
          />
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-400">
            →
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {showDateBadge && task.dueDate && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                {formatEditorDateLabel(task.dueDate, todayKey).replace('Today · ', '')}
              </span>
            )}
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
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#f9f6f2]">
                One-off
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => !isOneOff && onOpenCard?.(task.card)}
            className={`text-left ${!isOneOff ? 'hover:text-[#fca5a5]' : ''}`}
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

        {isOneOff && !sortable && (
          <button
            type="button"
            onClick={() => onDeleteOneOff(task.id)}
            className="text-xs text-gray-500 hover:text-red-400"
          >
            Delete
          </button>
        )}

        {isOneOff && sortable && (
          <div className="flex flex-col items-end gap-2">
            <input
              type="checkbox"
              checked={Boolean(task.completed)}
              onChange={() => onToggleComplete(task.id)}
              className="h-4 w-4 rounded border-white/20 bg-[#1a1a1a] text-[#810100]"
              aria-label={`Mark ${task.title} complete`}
            />
            <button
              type="button"
              onClick={() => onDeleteOneOff(task.id)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function SortableEditorTodoItem(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <EditorTodoItem
        {...props}
        sortable
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export default function EditorTodo({
  embedded = false,
  cards,
  oneOffTasks,
  taskOrder,
  search,
  clientFilter,
  onAddOneOffTask,
  onToggleOneOffComplete,
  onDeleteOneOffTask,
  onOpenCard,
  onSyncTaskOrder,
  onSetTaskOrder,
  onReorderTasks,
  onResetTaskOrder,
}) {
  const { getClientColor } = useClientsContext();
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortMode, setSortMode] = useState(() => taskOrder.length > 0 ? 'custom' : 'date');
  const todayKey = toDateKey(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  useEffect(() => {
    onSyncTaskOrder(filteredTasks.map((task) => task.id));
  }, [filteredTasks, onSyncTaskOrder]);

  const orderedTasks = useMemo(
    () => applyEditorTaskOrder(filteredTasks, sortMode === 'custom' ? taskOrder : []),
    [filteredTasks, sortMode, taskOrder],
  );

  const groupedTasks = useMemo(
    () => groupEditorTasksByDate(orderedTasks, todayKey),
    [orderedTasks, todayKey],
  );

  const editCount = filteredTasks.filter((t) => t.kind === 'edit').length;
  const approveCount = filteredTasks.filter((t) => t.kind === 'approve').length;
  const oneOffCount = filteredTasks.filter((t) => t.kind === 'oneoff' && !t.completed).length;

  const handleSortModeChange = (mode) => {
    if (mode === 'custom' && !taskOrder.length && filteredTasks.length) {
      onSetTaskOrder(buildInitialTaskOrder(filteredTasks));
    }
    if (mode === 'date') {
      onResetTaskOrder();
    }
    setSortMode(mode);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    onReorderTasks(active.id, over.id);
  };

  const sortModeClass = (mode) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      sortMode === mode ? 'bg-[#810100] text-white' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className={embedded ? '' : 'mx-auto max-w-[900px] px-4 py-4 sm:px-6'}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Editor tasks</h2>
          <p className="mt-1 text-sm text-gray-400">
            Auto-generated from the board — drag to set your own priority order.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              {editCount} to edit
            </span>
            <span className="rounded-full border border-[#810100]/30 bg-[#a00000]/10 px-2.5 py-1 text-[#fecaca]">
              {approveCount} to review
            </span>
            <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[#f9f6f2]">
              {oneOffCount} one-off
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-[#810100] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a00000]"
        >
          + Add one-off task
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button type="button" onClick={() => handleSortModeChange('date')} className={sortModeClass('date')}>
            By date
          </button>
          <button type="button" onClick={() => handleSortModeChange('custom')} className={sortModeClass('custom')}>
            Custom order
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span>Editor</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="select-dark rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-sm text-[#f9f6f2] outline-none"
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
            className="h-4 w-4 rounded border-white/20 bg-[#1a1a1a] text-[#810100]"
          />
          Show completed one-offs
        </label>
      </div>

      {sortMode === 'custom' && (
        <p className="mb-4 text-xs text-gray-500">Drag tasks using the grip handle to rearrange your list.</p>
      )}

      {orderedTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-gray-400">Nothing on the list right now.</p>
          <p className="mt-1 text-xs text-gray-500">
            Move cards to Editing, Not Approved, or In Review on the board — or add a one-off task.
          </p>
        </div>
      ) : sortMode === 'custom' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {orderedTasks.map((task) => (
                <SortableEditorTodoItem
                  key={task.id}
                  task={task}
                  onOpenCard={onOpenCard}
                  onToggleComplete={onToggleOneOffComplete}
                  onDeleteOneOff={onDeleteOneOffTask}
                  getClientColor={getClientColor}
                  showDateBadge
                  todayKey={todayKey}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
