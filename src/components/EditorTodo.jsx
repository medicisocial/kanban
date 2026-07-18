import { useEffect, useMemo, useState } from 'react';
import { getContentTypeStyle } from '../constants';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAssigneeFilter } from '../hooks/useStaffWorkspaceScope';
import TaskPostSchedule from './TaskPostSchedule';
import { CardLinks } from './clientPortal/ReferenceVideoLink';
import {
  applyEditorTaskOrder,
  buildBoardEditorTasks,
  getEditorTaskStatusOptions,
  filterEditorTasks,
  splitEditorTasksByQueue,
} from '../utils/editorTodo';
import AddEditorTaskModal from './AddEditorTaskModal';
import NeedsEditsModal from './NeedsEditsModal';
import TeamTaskCard, { TeamTaskClientLabel } from './TeamTaskCard';
import {
  btnPrimaryClass,
  btnSecondaryClass,
  glassSegmentClass,
  selectClass,
} from './clientPortal/clientPortalUi';
import { PortalTaskSection } from './clientPortal/PortalOverviewPanels';

const taskActionBtnClass =
  'inline-flex items-center justify-center rounded-sm bg-white px-3 py-1.5 text-[10px] font-medium normal-case tracking-normal text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40';

const kindStyles = {
  edit: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  approve: 'border-[#810100]/30 bg-[#a00000]/10 text-[#fecaca]',
  oneoff: 'border-white/20 bg-white/5 text-[#f9f6f2]',
};

const interactiveProps = {
  onPointerDown: (e) => e.stopPropagation(),
  onClick: (e) => e.stopPropagation(),
};

function EditorTodoItem({
  task,
  onOpenCard,
  onDeleteOneOff,
  onSubmitForReview,
  onApproveReview,
  onRequestEdits,
  onSendBackForEditing,
  onMoveTask,
  onShareWithClient,
  getClientColor,
  animationDelay,
}) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const isOneOff = task.isOneOffProject;
  const clientColor = getClientColor(task.client);
  const statusOptions = getEditorTaskStatusOptions(isOneOff);

  const openCard = () => {
    if (task.card) onOpenCard?.(task.card);
  };

  return (
    <TeamTaskCard
      accentColor={clientColor}
      completed={task.completed}
      animationDelay={animationDelay}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-400">
          →
        </span>

        <button
          type="button"
          onClick={openCard}
          className="min-w-0 flex-1 cursor-pointer rounded-lg text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#810100]/50"
        >
          <div className="tesla-task-card-meta mb-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${kindStyles[task.kind]}`}>
              {task.label}
            </span>
            {task.contentType && typeStyle && (
              <span {...contentTypePipelinePillProps(typeStyle)}>
                {task.contentType}
              </span>
            )}
            <TeamTaskClientLabel client={task.client} color={clientColor} />
          </div>

          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className={`text-sm font-semibold text-white group-hover:text-[#fca5a5] ${task.completed ? 'line-through' : ''}`}>
              {task.title}
            </h3>
            {!isOneOff && task.postDate && (
              <TaskPostSchedule postDate={task.postDate} dueTime={task.dueTime} />
            )}
          </div>

          {task.clientComment && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
              {task.columnId === 'editing' ? 'Revision notes' : 'Client notes'}: {task.clientComment}
            </p>
          )}

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <CardLinks card={task.card} compact />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Assigned to {task.assignedTo}</span>}
            <span>On board · {task.columnId.replace('-', ' ')}</span>
            {isOneOff && !task.postDate && <span>No posting date</span>}
          </div>
        </button>

        <div className="flex shrink-0 flex-col gap-1.5" {...interactiveProps}>
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
          <button type="button" onClick={openCard} className={taskActionBtnClass}>
            Edit
          </button>
          {task.kind === 'edit' && (
            <button
              type="button"
              onClick={() => onSubmitForReview?.(task.cardId)}
              className={taskActionBtnClass}
            >
              Mark done
            </button>
          )}
          {task.kind === 'approve' && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShareWithClient?.(task);
                }}
                className={taskActionBtnClass}
              >
                Share with client
              </button>
              <button
                type="button"
                onClick={() => onApproveReview?.(task.cardId)}
                className={taskActionBtnClass}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onRequestEdits?.(task.card)}
                className={taskActionBtnClass}
              >
                Needs edits
              </button>
            </>
          )}
          {isOneOff && task.columnId === 'approved' && (
            <button
              type="button"
              onClick={() => onMoveTask?.(task.cardId, 'finished')}
              className={taskActionBtnClass}
            >
              Mark posted
            </button>
          )}
          {isOneOff && task.completed && (
            <button
              type="button"
              onClick={() => onSendBackForEditing?.(task.cardId)}
              className={taskActionBtnClass}
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
    </TeamTaskCard>
  );
}

function EditorTaskList({ tasks, emptyMessage, itemProps }) {
  if (tasks.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-white/35">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-3 p-2">
      {tasks.map((task, index) => (
        <EditorTodoItem
          key={task.id}
          task={task}
          animationDelay={`${0.08 + index * 0.05}s`}
          {...itemProps}
        />
      ))}
    </div>
  );
}

function EditorTaskColumn({ title, description, count, accentClass, tasks, emptyMessage, itemProps }) {
  return (
    <PortalTaskSection
      title={title}
      subtitle={description}
      action={
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${accentClass}`}>
          {count}
        </span>
      }
    >
      <EditorTaskList tasks={tasks} emptyMessage={emptyMessage} itemProps={itemProps} />
    </PortalTaskSection>
  );
}

export default function EditorTodo({
  embedded = false,
  cards,
  clientFilter,
  onAddOneOffTask,
  onDeleteOneOffTask,
  onOpenCard,
  onSubmitForReview,
  onApproveReview,
  onSendBackForEditing,
  onMoveTask,
  onShareWithClient,
}) {
  const { getClientColor, getMemberNamesForRole } = useClientsContext();
  const editors = getMemberNamesForRole('Editor');
  const { assigneeFilter, setAssigneeFilter, restrictAssigneeFilter } = useStaffAssigneeFilter();
  const [showCompleted, setShowCompleted] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [needsEditsCard, setNeedsEditsCard] = useState(null);
  const [activeQueue, setActiveQueue] = useState('editing');

  const allTasks = useMemo(() => buildBoardEditorTasks(cards), [cards]);

  const filteredTasks = useMemo(
    () =>
      filterEditorTasks(allTasks, {
        assignee: assigneeFilter,
        client: clientFilter,
        includeCompleted: showCompleted,
      }),
    [allTasks, assigneeFilter, clientFilter, showCompleted],
  );

  const orderedTasks = useMemo(
    () => applyEditorTaskOrder(filteredTasks),
    [filteredTasks],
  );

  const { editing: editingTasks, inReview: reviewTasks, finished: finishedTasks } = useMemo(
    () => splitEditorTasksByQueue(orderedTasks),
    [orderedTasks],
  );

  const editCount = editingTasks.length;
  const approveCount = reviewTasks.length;
  const oneOffCount = filteredTasks.filter((t) => t.isOneOffProject && !t.completed).length;
  const finishedCount = finishedTasks.length;

  useEffect(() => {
    if (activeQueue === 'finished' && finishedCount === 0) {
      setActiveQueue('editing');
    }
  }, [activeQueue, finishedCount]);

  const itemProps = {
    onOpenCard,
    onDeleteOneOffTask,
    onSubmitForReview,
    onApproveReview,
    onRequestEdits: setNeedsEditsCard,
    onSendBackForEditing,
    onMoveTask,
    onShareWithClient,
    getClientColor,
  };

  const handleNeedsEditsSubmit = (cardId, comment) => {
    onSendBackForEditing?.(cardId, comment);
    setNeedsEditsCard(null);
  };

  return (
    <div className={embedded ? '' : 'mx-auto max-w-[1400px] px-4 py-4 sm:px-6'}>
      <div className={`flex flex-wrap items-center justify-between gap-4 ${embedded ? 'mb-4' : 'mb-6'}`}>
        {!embedded && (
          <div>
            <h2 className="text-xl font-semibold text-white">Editor tasks</h2>
            <p className="mt-1 text-sm text-white/45">
              Editing and review queues from the board — sorted by post date and time, earliest first.
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
              {finishedCount > 0 && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                  {finishedCount} finished
                </span>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className={`${btnPrimaryClass} ${embedded ? 'ml-auto py-1.5 text-[10px]' : ''}`}
        >
          + Add one-off project
        </button>
      </div>

      <div className={`flex flex-wrap items-center gap-3 ${embedded ? 'mb-4' : 'mb-6'}`}>
        <label className="flex items-center gap-2 text-sm text-white/45">
          <span>Editor</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            disabled={restrictAssigneeFilter}
            className={`${selectClass} py-1.5 text-xs disabled:opacity-60`}
          >
            {!restrictAssigneeFilter && <option value="all">All editors</option>}
            {editors.map((member) => (
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
          Show completed one-offs
        </label>
      </div>

      <div className={`${glassSegmentClass} mb-4 flex w-fit flex-wrap gap-0.5 p-0.5`}>
        {[
          ['editing', 'Needs editing', editCount],
          ['review', 'In review', approveCount],
          ...(finishedCount > 0 ? [['finished', 'Posted one-offs', finishedCount]] : []),
        ].map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveQueue(id)}
            className={
              activeQueue === id
                ? `${btnPrimaryClass} !px-4 !py-1.5 !text-xs !tracking-wider`
                : `${btnSecondaryClass} !border-transparent !px-4 !py-1.5 !text-xs !tracking-wider !text-white/45 hover:!text-white`
            }
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {orderedTasks.length === 0 ? (
        <div className="border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-white/45">Nothing on the list right now.</p>
          <p className="mt-1 text-xs text-white/35">
            Move cards to Editing, Not Approved, or In Review on the board — or add a one-off project.
          </p>
        </div>
      ) : (
        <>
          {activeQueue === 'editing' && (
          <EditorTaskColumn
            title="Needs editing"
            description="Cards in Editing or Not Approved — finish the cut and mark done when ready for review."
            count={editCount}
            accentClass="border-amber-500/30 bg-amber-500/10 text-amber-200"
            tasks={editingTasks}
            emptyMessage="No videos waiting for edits."
            itemProps={itemProps}
          />
          )}
          {activeQueue === 'review' && (
          <EditorTaskColumn
            title="In review"
            description="Cards in In Review — approve or send back with revision notes."
            count={approveCount}
            accentClass="border-[#810100]/30 bg-[#a00000]/10 text-[#fecaca]"
            tasks={reviewTasks}
            emptyMessage="No videos in review."
            itemProps={itemProps}
          />
          )}
          {activeQueue === 'finished' && finishedCount > 0 && (
            <EditorTaskColumn
              title="Posted one-offs"
              description="Completed one-off projects stay here instead of appearing in Needs editing."
              count={finishedCount}
              accentClass="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              tasks={finishedTasks}
              emptyMessage="No completed one-offs."
              itemProps={itemProps}
            />
          )}
        </>
      )}

      {showAddModal && (
        <AddEditorTaskModal
          onClose={() => setShowAddModal(false)}
          onAdd={onAddOneOffTask}
          defaultAssignee={assigneeFilter !== 'all' ? assigneeFilter : undefined}
        />
      )}

      {needsEditsCard && (
        <NeedsEditsModal
          card={needsEditsCard}
          onClose={() => setNeedsEditsCard(null)}
          onSubmit={handleNeedsEditsSubmit}
        />
      )}

    </div>
  );
}
