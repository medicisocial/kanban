import { useMemo, useState } from 'react';
import { getContentTypeStyle, COLUMNS } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import TaskPostSchedule from './TaskPostSchedule';
import { formatStoryScheduleSummary, toDateKey } from '../utils/calendar';
import {
  applyAccountManagerTaskOrder,
  buildInReviewTasks,
  buildPostsTodoTasks,
  buildStoryTasksToday,
  buildSetPostDateTasks,
  filterAccountManagerTasks,
  formatAccountManagerDateLabel,
} from '../utils/accountManagerTodo';
import { getEditorTaskStatusOptions } from '../utils/editorTodo';
import NeedsEditsModal from './NeedsEditsModal';
import PlanPostDateModal from './PlanPostDateModal';
import { glassCardClass } from './clientPortal/clientPortalUi';

const taskActionBtnClass =
  'inline-flex items-center justify-center rounded-sm bg-white px-3 py-1.5 text-[10px] font-medium normal-case tracking-normal text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40';

const kindStyles = {
  'set-post-date': 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  schedule: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  publish: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'post-story': 'border-blue-500/30 bg-blue-500/10 text-blue-200',
};

const inReviewKindStyle = 'border-[#810100]/30 bg-[#a00000]/10 text-[#fecaca]';

function SetPostDateTaskCard({ task, getClientColor, onOpenCard, onPlanDate }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const clientColor = getClientColor(task.client);
  const pipelineStage = COLUMNS.find((col) => col.id === task.columnId)?.title;
  const openCard = () => onOpenCard(task.card);

  return (
    <article className={`${glassCardClass} border-amber-500/30 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${kindStyles['set-post-date']}`}
            >
              {task.label}
            </span>
            {pipelineStage && (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                {pipelineStage}
              </span>
            )}
            {task.contentType && typeStyle && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeStyle.label}`}
                style={{ backgroundColor: `${typeStyle.border}22` }}
              >
                {task.contentType}
              </span>
            )}
          </div>

          <button type="button" onClick={openCard} className="text-left hover:text-[#fca5a5]">
            <h3 className="text-sm font-semibold text-white">{task.title}</h3>
          </button>

          {task.client && (
            <p className="mt-1 text-xs font-medium" style={{ color: clientColor }}>
              {task.client}
            </p>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={() => onPlanDate?.(task.card)}
              className={taskActionBtnClass}
            >
              Set post date
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.contentCreator && <span>Creator: {task.contentCreator}</span>}
            {task.accountManager && <span>AM: {task.accountManager}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" onClick={openCard} className={taskActionBtnClass}>
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

function InReviewTaskCard({ task, getClientColor, onOpenCard, onMoveTask, onApproveReview, onRequestEdits }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const clientColor = getClientColor(task.client);
  const statusOptions = getEditorTaskStatusOptions(task.isOneOffProject);

  const openCard = () => onOpenCard(task.card);

  return (
    <article className={`${glassCardClass} p-4`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-400">
          →
        </span>

        <button
          type="button"
          onClick={openCard}
          className="min-w-0 flex-1 cursor-pointer rounded-lg text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#810100]/50"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${inReviewKindStyle}`}>
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

          <h3 className="text-sm font-semibold text-white">{task.title}</h3>
          {!task.isOneOffProject && task.dueDate && (
            <p className="mt-1">
              <TaskPostSchedule postDate={task.dueDate} dueTime={task.dueTime} />
            </p>
          )}

          <p className="mt-1 text-xs font-medium" style={{ color: clientColor }}>
            {task.client}
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
            <span>On board · {task.columnId.replace('-', ' ')}</span>
          </div>
        </button>

        <div className="flex shrink-0 flex-col gap-1.5">
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
          <button type="button" onClick={() => onApproveReview?.(task.cardId)} className={taskActionBtnClass}>
            Approve
          </button>
          <button type="button" onClick={() => onRequestEdits(task.card)} className={taskActionBtnClass}>
            Needs edits
          </button>
        </div>
      </div>
    </article>
  );
}

function ApprovedScheduleTaskCard({ task, getClientColor, onOpenCard, onMarkScheduled }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const clientColor = getClientColor(task.client);
  const openCard = () => onOpenCard(task.card);

  return (
    <article className={`${glassCardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${kindStyles.schedule}`}
            >
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

          <button type="button" onClick={openCard} className="text-left hover:text-[#fca5a5]">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-sm font-semibold text-white">{task.title}</h3>
              {task.dueDate && (
                <TaskPostSchedule postDate={task.dueDate} dueTime={task.dueTime} />
              )}
            </div>
          </button>

          {task.client && (
            <p className="mt-1 text-xs font-medium" style={{ color: clientColor }}>
              {task.client}
            </p>
          )}

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Editor: {task.assignedTo}</span>}
            {task.accountManager && <span>AM: {task.accountManager}</span>}
            <span>Approved · ready for calendar</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" onClick={openCard} className={taskActionBtnClass}>
            Edit
          </button>
          <button type="button" onClick={() => onMarkScheduled(task.cardId)} className={taskActionBtnClass}>
            Scheduled
          </button>
        </div>
      </div>
    </article>
  );
}

function TaskCard({ task, getClientColor, onOpenCard, onMarkPosted }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const badgeStyle = kindStyles[task.kind] || kindStyles.schedule;
  const canMarkPosted = task.kind === 'publish' || task.kind === 'post-story';
  const clientColor = getClientColor(task.client);

  const openCard = () => onOpenCard(task.card);

  return (
    <article className={`${glassCardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeStyle}`}
            >
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

          <button
            type="button"
            onClick={openCard}
            className="text-left hover:text-[#fca5a5]"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-sm font-semibold text-white">{task.title}</h3>
              {task.dueDate && (
                <TaskPostSchedule postDate={task.dueDate} dueTime={task.dueTime} />
              )}
            </div>
          </button>

          {task.client && (
            <p className="mt-1 text-xs font-medium" style={{ color: clientColor }}>
              {task.client}
            </p>
          )}

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Editor: {task.assignedTo}</span>}
            {task.accountManager && <span>AM: {task.accountManager}</span>}
            {task.contentType === 'Story' && (
              <span>{formatStoryScheduleSummary(task.card)}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" onClick={openCard} className={taskActionBtnClass}>
            Edit
          </button>
          {canMarkPosted && (
            <button
              type="button"
              onClick={() => onMarkPosted(task.cardId, task.taskDate || task.card.occurrenceDate)}
              className={taskActionBtnClass}
            >
              Mark posted
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function TaskList({ tasks, renderItem }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => renderItem(task))}
    </div>
  );
}

export default function AccountManagerTodo({
  cards,
  clientFilter,
  onOpenCard,
  onUpdateCard,
  onMarkScheduled,
  onMarkPosted,
  onApproveReview,
  onMoveTask,
  onSendBackForEditing,
}) {
  const { getClientColor, clientAccountManagers, getMemberNamesForRole } = useClientsContext();
  const accountManagers = getMemberNamesForRole('Account Manager');
  const todayKey = toDateKey(new Date());
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [needsEditsCard, setNeedsEditsCard] = useState(null);
  const [planDateCard, setPlanDateCard] = useState(null);

  const storyTasksToday = useMemo(
    () => buildStoryTasksToday(cards, todayKey, clientAccountManagers),
    [cards, todayKey, clientAccountManagers],
  );
  const setPostDateTasks = useMemo(
    () => buildSetPostDateTasks(cards, clientAccountManagers),
    [cards, clientAccountManagers],
  );
  const inReviewTasks = useMemo(
    () => buildInReviewTasks(cards, clientAccountManagers),
    [cards, clientAccountManagers],
  );
  const postsTodoTasks = useMemo(
    () => buildPostsTodoTasks(cards, clientAccountManagers),
    [cards, clientAccountManagers],
  );

  const filterOptions = useMemo(
    () => ({ client: clientFilter, assignee: assigneeFilter }),
    [clientFilter, assigneeFilter],
  );

  const orderedSetPostDateTasks = useMemo(
    () => applyAccountManagerTaskOrder(filterAccountManagerTasks(setPostDateTasks, filterOptions)),
    [setPostDateTasks, filterOptions],
  );

  const orderedInReviewTasks = useMemo(
    () => applyAccountManagerTaskOrder(filterAccountManagerTasks(inReviewTasks, filterOptions)),
    [inReviewTasks, filterOptions],
  );

  const orderedStoryTasks = useMemo(
    () => applyAccountManagerTaskOrder(filterAccountManagerTasks(storyTasksToday, filterOptions)),
    [storyTasksToday, filterOptions],
  );

  const orderedPostsTasks = useMemo(
    () => applyAccountManagerTaskOrder(filterAccountManagerTasks(postsTodoTasks, filterOptions)),
    [postsTodoTasks, filterOptions],
  );

  const visiblePostsTasks = useMemo(
    () =>
      orderedPostsTasks.filter((task) => {
        const card = cards.find((c) => c.id === task.cardId);
        return card?.columnId === 'approved';
      }),
    [orderedPostsTasks, cards],
  );

  const todayLabel = formatAccountManagerDateLabel(todayKey, todayKey);

  const handleNeedsEditsSubmit = (cardId, comment) => {
    onSendBackForEditing?.(cardId, comment);
    setNeedsEditsCard(null);
  };


  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-white">Account manager tasks</h2>
        <p className="mt-1 text-sm text-gray-400">
          Set post dates on pipeline cards, review client content, post stories, and schedule approved work.
        </p>
      </div>

      <div className="mb-8 flex justify-center">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span>Account manager</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="select-dark rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-sm text-[#f9f6f2] outline-none"
          >
            <option value="all">All</option>
            {accountManagers.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mx-auto grid max-w-[2200px] grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-4 xl:items-start">
        <section className="min-w-0 rounded-2xl border border-violet-500/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="text-lg font-semibold text-white">Set post date</h3>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
                {orderedSetPostDateTasks.length} waiting
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Pipeline cards missing a target publish date — pick a date on the content calendar.
            </p>
          </div>

          {orderedSetPostDateTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Every pipeline card has a post date.</p>
              <p className="mt-1 text-xs text-gray-500">
                New cards appear here until an account manager sets when they should go live.
              </p>
            </div>
          ) : (
            <TaskList
              tasks={orderedSetPostDateTasks}
              renderItem={(task) => (
                <SetPostDateTaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onPlanDate={setPlanDateCard}
                />
              )}
            />
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-[#810100]/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="text-lg font-semibold text-white">In review</h3>
              <span className="rounded-full border border-[#810100]/30 bg-[#a00000]/10 px-2.5 py-1 text-xs text-[#fecaca]">
                {orderedInReviewTasks.length} in review
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Approve content or send it back to the editor with revision notes.
            </p>
          </div>

          {orderedInReviewTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Nothing in review right now.</p>
              <p className="mt-1 text-xs text-gray-500">
                Cards moved to In Review on the board appear here.
              </p>
            </div>
          ) : (
            <TaskList
              tasks={orderedInReviewTasks}
              renderItem={(task) => (
                <InReviewTaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onMoveTask={onMoveTask}
                  onApproveReview={onApproveReview}
                  onRequestEdits={setNeedsEditsCard}
                />
              )}
            />
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-blue-500/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="text-lg font-semibold text-white">Stories · post today</h3>
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200">
                {orderedStoryTasks.length} to post
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-400">{todayLabel}</p>
          </div>

          {orderedStoryTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">No stories to post today.</p>
              <p className="mt-1 text-xs text-gray-500">
                Daily campaigns and weekly stories appear here on their scheduled days.
              </p>
            </div>
          ) : (
            <TaskList
              tasks={orderedStoryTasks}
              renderItem={(task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onMarkPosted={onMarkPosted}
                />
              )}
            />
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-amber-500/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="text-lg font-semibold text-white">Posts & other content · overall to-do</h3>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                {visiblePostsTasks.length} tasks
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Approved posts ready to mark scheduled — they leave this list and move to the Scheduled column on the board.
            </p>
          </div>

          {visiblePostsTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Nothing on the to-do list right now.</p>
              <p className="mt-1 text-xs text-gray-500">
                Approved reels, carousels, and static posts will show up here.
              </p>
            </div>
          ) : (
            <TaskList
              tasks={visiblePostsTasks}
              renderItem={(task) => (
                <ApprovedScheduleTaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onMarkScheduled={onMarkScheduled}
                />
              )}
            />
          )}
        </section>
      </div>

      {needsEditsCard && (
        <NeedsEditsModal
          card={needsEditsCard}
          onClose={() => setNeedsEditsCard(null)}
          onSubmit={handleNeedsEditsSubmit}
        />
      )}

      {planDateCard && (
        <PlanPostDateModal
          card={planDateCard}
          cards={cards}
          onClose={() => setPlanDateCard(null)}
          onSave={(cardId, updates) => onUpdateCard?.(cardId, updates)}
          onOpenCard={onOpenCard}
        />
      )}
    </div>
  );
}
