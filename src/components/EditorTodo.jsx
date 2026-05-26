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
  formatEditorDateLabel,
  getEditorTaskStatusOptions,
  groupEditorTasksByDate,
  filterEditorTasks,
  splitEditorTasksByQueue,
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
  onDeleteOneOff,
  onSubmitForReview,
  onSendBackForEditing,
  onMoveTask,
  getClientColor,
  showDateBadge = false,
  todayKey,
}) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const isOneOff = task.isOneOffProject;
  const clientColor = getClientColor(task.client);
  const statusOptions = getEditorTaskStatusOptions(isOneOff);

  const openCard = () => {
    if (task.card) onOpenCard?.(task.card);
  };

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
            onClick={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M7 4a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2zM7 9a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2zM7 14a1 1 0 110 2 1 1 0 010-2zm6 0a1 1 0 110 2 1 1 0 010-2z" />
            </svg>
          </button>
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-400">
            →
          </span>
        )}

        <button
          type="button"
          onClick={openCard}
          className="min-w-0 flex-1 cursor-pointer rounded-lg text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#810100]/50"
        >
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
          </div>

          <h3 className={`text-sm font-semibold text-white group-hover:text-[#fca5a5] ${task.completed ? 'line-through' : ''}`}>
            {task.title}
          </h3>

          <p className="mt-1 text-xs font-medium" style={{ color: clientColor }}>
            {task.client}
          </p>

          {task.clientComment && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
              {task.columnId === 'editing' ? 'Revision notes' : 'Client notes'}: {task.clientComment}
            </p>
          )}

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Assigned to {task.assignedTo}</span>}
            <span>On board · {task.columnId.replace('-', ' ')}</span>
            {isOneOff && !task.dueDate && <span>No posting date</span>}
          </div>
        </button>

        <div className="flex shrink-0 flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Board status
            </span>
            <select
              value={task.columnId}
              onChange={(e) => onMoveTask?.(task.cardId, e.target.value)}
              className="select-dark w-full min-w-[130px] rounded-lg border border-white/10 bg-[#1a1a1a] px-2 py-1.5 text-xs text-[#f9f6f2] outline-none focus:border-[#810100]/50"
              aria-label={`Board status for ${task.title}`}
            >
              {statusOptions.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={openCard}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
          >
            Edit
          </button>
          {task.kind === 'edit' && (
            <button
              type="button"
              onClick={() => onSubmitForReview?.(task.cardId)}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Mark done
            </button>
          )}
          {task.kind === 'approve' && (
            <button
              type="button"
              onClick={() => onSendBackForEditing?.(task.cardId)}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
            >
              Needs edits
            </button>
          )}
          {isOneOff && task.columnId === 'approved' && (
            <button
              type="button"
              onClick={() => onMoveTask?.(task.cardId, 'finished')}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Mark finished
            </button>
          )}
          {isOneOff && task.completed && (
            <button
              type="button"
              onClick={() => onSendBackForEditing?.(task.cardId)}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
            >
              Back to editing
            </button>
          )}
          {isOneOff && (
            <button
              type="button"
              onClick={() => onDeleteOneOff?.(task.cardId)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
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

function EditorTaskList({
  tasks,
  sortMode,
  sensors,
  onDragEnd,
  onOpenCard,
  onDeleteOneOffTask,
  onSubmitForReview,
  onSendBackForEditing,
  onMoveTask,
  getClientColor,
  todayKey,
  emptyMessage,
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  if (sortMode === 'custom') {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map((task) => (
              <SortableEditorTodoItem
                key={task.id}
                task={task}
                onOpenCard={onOpenCard}
                onDeleteOneOff={onDeleteOneOffTask}
                onSubmitForReview={onSubmitForReview}
                onSendBackForEditing={onSendBackForEditing}
                onMoveTask={onMoveTask}
                getClientColor={getClientColor}
                showDateBadge
                todayKey={todayKey}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  const groupedTasks = groupEditorTasksByDate(tasks, todayKey);

  return (
    <div className="space-y-6">
      {groupedTasks.map((group) => (
        <section key={group.key}>
          <h4
            className={`mb-3 text-xs font-semibold uppercase tracking-wider ${
              group.key === 'overdue' ? 'text-red-300' : 'text-gray-500'
            }`}
          >
            {group.label}
          </h4>
          <div className="space-y-3">
            {group.tasks.map((task) => (
              <EditorTodoItem
                key={task.id}
                task={task}
                onOpenCard={onOpenCard}
                onDeleteOneOff={onDeleteOneOffTask}
                onSubmitForReview={onSubmitForReview}
                onSendBackForEditing={onSendBackForEditing}
                onMoveTask={onMoveTask}
                getClientColor={getClientColor}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EditorTaskColumn({
  title,
  description,
  count,
  accentClass,
  tasks,
  sortMode,
  sensors,
  onDragEnd,
  emptyMessage,
  itemProps,
  todayKey,
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0d0d0d] p-4 sm:p-5">
      <div className="mb-4 border-b border-white/8 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${accentClass}`}>
            {count}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>

      <EditorTaskList
        tasks={tasks}
        sortMode={sortMode}
        sensors={sensors}
        onDragEnd={onDragEnd}
        emptyMessage={emptyMessage}
        todayKey={todayKey}
        {...itemProps}
      />
    </section>
  );
}

export default function EditorTodo({
  embedded = false,
  cards,
  taskOrder,
  search,
  clientFilter,
  onAddOneOffTask,
  onDeleteOneOffTask,
  onOpenCard,
  onSubmitForReview,
  onSendBackForEditing,
  onMoveTask,
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

  const allTasks = useMemo(() => buildBoardEditorTasks(cards), [cards]);

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

  const { editing: editingTasks, inReview: reviewTasks } = useMemo(
    () => splitEditorTasksByQueue(orderedTasks),
    [orderedTasks],
  );

  const editCount = editingTasks.length;
  const approveCount = reviewTasks.length;
  const oneOffCount = filteredTasks.filter((t) => t.isOneOffProject && !t.completed).length;

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

  const itemProps = {
    onOpenCard,
    onDeleteOneOffTask,
    onSubmitForReview,
    onSendBackForEditing,
    onMoveTask,
    getClientColor,
  };

  return (
    <div className={embedded ? '' : 'mx-auto max-w-[1400px] px-4 py-4 sm:px-6'}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Editor tasks</h2>
          <p className="mt-1 text-sm text-gray-400">
            Editing and review queues from the board — drag within a column to set priority.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              {editCount} need editing
            </span>
            <span className="rounded-full border border-[#810100]/30 bg-[#a00000]/10 px-2.5 py-1 text-[#fecaca]">
              {approveCount} in review
            </span>
            {oneOffCount > 0 && (
              <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[#f9f6f2]">
                {oneOffCount} one-off
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-[#810100] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a00000]"
        >
          + Add one-off project
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
        <p className="mb-4 text-xs text-gray-500">Drag tasks using the grip handle to rearrange within each column.</p>
      )}

      {orderedTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-gray-400">Nothing on the list right now.</p>
          <p className="mt-1 text-xs text-gray-500">
            Move cards to Editing, Not Approved, or In Review on the board — or add a one-off project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <EditorTaskColumn
            title="Needs editing"
            description="Cards in Editing or Not Approved — finish the cut and mark done when ready for review."
            count={editCount}
            accentClass="border-amber-500/30 bg-amber-500/10 text-amber-200"
            tasks={editingTasks}
            sortMode={sortMode}
            sensors={sensors}
            onDragEnd={handleDragEnd}
            emptyMessage="No videos waiting for edits."
            itemProps={itemProps}
            todayKey={todayKey}
          />
          <EditorTaskColumn
            title="In review"
            description="Cards in In Review — internal QC before client approval."
            count={approveCount}
            accentClass="border-[#810100]/30 bg-[#a00000]/10 text-[#fecaca]"
            tasks={reviewTasks}
            sortMode={sortMode}
            sensors={sensors}
            onDragEnd={handleDragEnd}
            emptyMessage="No videos in review."
            itemProps={itemProps}
            todayKey={todayKey}
          />
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
