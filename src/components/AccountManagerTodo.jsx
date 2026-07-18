import { useMemo, useState } from 'react';
import { getContentTypeStyle, COLUMNS } from '../constants';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import { useClientsContext } from '../context/ClientsContext';
import { useStaffAssigneeFilter } from '../hooks/useStaffWorkspaceScope';
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
import TeamTaskCard, { TeamTaskClientLabel } from './TeamTaskCard';
import {
  btnPrimaryClass,
  btnSecondaryClass,
  glassSegmentClass,
  selectClass,
} from './clientPortal/clientPortalUi';
import { CardLinks } from './clientPortal/ReferenceVideoLink';
import { PortalTaskSection } from './clientPortal/PortalOverviewPanels';

const taskActionBtnClass =
  'inline-flex items-center justify-center rounded-sm bg-white px-3 py-1.5 text-[10px] font-medium normal-case tracking-normal text-black transition-opacity duration-300 hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40';

const kindStyles = {
  'set-post-date': 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  schedule: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  publish: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'post-story': 'border-blue-500/30 bg-blue-500/10 text-blue-200',
};

const inReviewKindStyle = 'border-[#810100]/30 bg-[#a00000]/10 text-[#fecaca]';

function SetPostDateTaskCard({ task, getClientColor, onOpenCard, onPlanDate, animationDelay }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const clientColor = getClientColor(task.client);
  const pipelineStage = COLUMNS.find((col) => col.id === task.columnId)?.title;
  const openCard = () => onOpenCard?.(task.card);

  return (
    <TeamTaskCard accentColor={clientColor} animationDelay={animationDelay} onOpen={openCard}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="tesla-task-card-meta mb-2">
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
              <span {...contentTypePipelinePillProps(typeStyle)}>
                {task.contentType}
              </span>
            )}
            <TeamTaskClientLabel client={task.client} color={clientColor} />
          </div>

          <h3 className="text-sm font-semibold text-white">{task.title}</h3>

          <CardLinks card={task.card} compact />

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
      </div>
    </TeamTaskCard>
  );
}

function InReviewTaskCard({
  task,
  getClientColor,
  onOpenCard,
  onMoveTask,
  onApproveReview,
  onRequestEdits,
  onShareWithClient,
  animationDelay,
}) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const clientColor = getClientColor(task.client);
  const statusOptions = getEditorTaskStatusOptions(task.isOneOffProject);

  const openCard = () => onOpenCard?.(task.card);

  return (
    <TeamTaskCard accentColor={clientColor} animationDelay={animationDelay} onOpen={openCard}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-400">
          →
        </span>

        <div className="min-w-0 flex-1 text-left">
          <div className="tesla-task-card-meta mb-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${inReviewKindStyle}`}>
              {task.label}
            </span>
            {task.contentType && typeStyle && (
              <span {...contentTypePipelinePillProps(typeStyle)}>
                {task.contentType}
              </span>
            )}
            <TeamTaskClientLabel client={task.client} color={clientColor} />
          </div>

          <h3 className="text-sm font-semibold text-white">{task.title}</h3>
          {!task.isOneOffProject && task.dueDate && (
            <p className="mt-1">
              <TaskPostSchedule postDate={task.dueDate} dueTime={task.dueTime} />
            </p>
          )}

          {task.clientComment && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
              Client notes: {task.clientComment}
            </p>
          )}

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <CardLinks card={task.card} compact />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Assigned to {task.assignedTo}</span>}
            <span>On board · {task.columnId.replace('-', ' ')}</span>
          </div>
        </div>

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
          <button type="button" onClick={() => onApproveReview?.(task.cardId)} className={taskActionBtnClass}>
            Approve
          </button>
          <button type="button" onClick={() => onRequestEdits(task.card)} className={taskActionBtnClass}>
            Needs edits
          </button>
        </div>
      </div>
    </TeamTaskCard>
  );
}

function ApprovedScheduleTaskCard({
  task,
  getClientColor,
  onOpenCard,
  onMarkScheduled,
  animationDelay,
}) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const clientColor = getClientColor(task.client);
  const openCard = () => onOpenCard?.(task.card);

  return (
    <TeamTaskCard accentColor={clientColor} animationDelay={animationDelay} onOpen={openCard}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="tesla-task-card-meta mb-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${kindStyles.schedule}`}
            >
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
            <h3 className="text-sm font-semibold text-white">{task.title}</h3>
            {task.dueDate && (
              <TaskPostSchedule postDate={task.dueDate} dueTime={task.dueTime} />
            )}
          </div>

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <CardLinks card={task.card} compact />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Editor: {task.assignedTo}</span>}
            {task.accountManager && <span>AM: {task.accountManager}</span>}
            <span>Approved · ready for calendar</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" onClick={() => onMarkScheduled(task.cardId)} className={taskActionBtnClass}>
            Scheduled
          </button>
        </div>
      </div>
    </TeamTaskCard>
  );
}

function TaskCard({ task, getClientColor, onOpenCard, onMarkPosted, animationDelay }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const badgeStyle = kindStyles[task.kind] || kindStyles.schedule;
  const canMarkPosted = task.kind === 'publish' || task.kind === 'post-story';
  const clientColor = getClientColor(task.client);

  const openCard = () => onOpenCard?.(task.card);

  return (
    <TeamTaskCard accentColor={clientColor} animationDelay={animationDelay} onOpen={openCard}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="tesla-task-card-meta mb-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeStyle}`}
            >
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
            <h3 className="text-sm font-semibold text-white">{task.title}</h3>
            {task.dueDate && (
              <TaskPostSchedule postDate={task.dueDate} dueTime={task.dueTime} />
            )}
          </div>

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <CardLinks card={task.card} compact />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Editor: {task.assignedTo}</span>}
            {task.accountManager && <span>AM: {task.accountManager}</span>}
            {task.contentType === 'Story' && (
              <span>{formatStoryScheduleSummary(task.card)}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
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
    </TeamTaskCard>
  );
}

function TaskList({ tasks, renderItem }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-2">
      {tasks.map((task, index) => renderItem(task, index))}
    </div>
  );
}

export default function AccountManagerTodo({
  cards,
  clientFilter,
  embedded = false,
  onOpenCard,
  onUpdateCard,
  onMarkScheduled,
  onMarkPosted,
  onApproveReview,
  onMoveTask,
  onSendBackForEditing,
  onPlanPostDate,
  onShareWithClient,
}) {
  const { getClientColor, clientAccountManagers, getMemberNamesForRole } = useClientsContext();
  const accountManagers = getMemberNamesForRole('Account Manager');
  const todayKey = toDateKey(new Date());
  const { assigneeFilter, setAssigneeFilter, restrictAssigneeFilter } = useStaffAssigneeFilter();
  const [needsEditsCard, setNeedsEditsCard] = useState(null);
  const [activeQueue, setActiveQueue] = useState('post-date');

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
      {!embedded && (
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-white">Account manager tasks</h2>
          <p className="mt-1 text-sm text-white/45">
            Set post dates on pipeline cards, review client content, post stories, and schedule approved work.
          </p>
        </div>
      )}

      <div className={`flex justify-center ${embedded ? 'mb-4' : 'mb-8'}`}>
        <label className="flex items-center gap-2 text-sm text-white/45">
          <span>Account manager</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            disabled={restrictAssigneeFilter}
            className={`${selectClass} py-1.5 text-xs disabled:opacity-60`}
          >
            {!restrictAssigneeFilter && <option value="all">All</option>}
            {accountManagers.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`${glassSegmentClass} mb-4 flex w-fit flex-wrap gap-0.5 p-0.5`}>
        {[
          ['post-date', 'Set post date', orderedSetPostDateTasks.length],
          ['review', 'In review', orderedInReviewTasks.length],
          ['stories', 'Stories to post', orderedStoryTasks.length],
          ['posts', 'Posts & content', visiblePostsTasks.length],
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

      <div>
        {activeQueue === 'post-date' && (
        <PortalTaskSection
          title="Set post date"
          subtitle="To Create and Editing cards (plus review stages) missing a target publish date."
          action={
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-200">
              {orderedSetPostDateTasks.length}
            </span>
          }
        >
          {orderedSetPostDateTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-white/35">Every pipeline card has a post date.</p>
          ) : (
            <TaskList
              tasks={orderedSetPostDateTasks}
              renderItem={(task, index) => (
                <SetPostDateTaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onPlanDate={onPlanPostDate}
                  animationDelay={`${0.08 + index * 0.05}s`}
                />
              )}
            />
          )}
        </PortalTaskSection>
        )}

        {activeQueue === 'review' && (
        <PortalTaskSection
          title="In review"
          subtitle="Approve content or send it back with revision notes."
          action={
            <span className="rounded-full border border-[#810100]/30 bg-[#a00000]/10 px-2.5 py-0.5 text-xs text-[#fecaca]">
              {orderedInReviewTasks.length}
            </span>
          }
        >
          {orderedInReviewTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-white/35">Nothing in review right now.</p>
          ) : (
            <TaskList
              tasks={orderedInReviewTasks}
              renderItem={(task, index) => (
                <InReviewTaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onMoveTask={onMoveTask}
                  onApproveReview={onApproveReview}
                  onRequestEdits={setNeedsEditsCard}
                  onShareWithClient={onShareWithClient}
                  animationDelay={`${0.08 + index * 0.05}s`}
                />
              )}
            />
          )}
        </PortalTaskSection>
        )}

        {activeQueue === 'stories' && (
        <PortalTaskSection
          title="Stories · post today"
          subtitle={todayLabel}
          action={
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-200">
              {orderedStoryTasks.length}
            </span>
          }
        >
          {orderedStoryTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-white/35">No stories to post today.</p>
          ) : (
            <TaskList
              tasks={orderedStoryTasks}
              renderItem={(task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onMarkPosted={onMarkPosted}
                  animationDelay={`${0.08 + index * 0.05}s`}
                />
              )}
            />
          )}
        </PortalTaskSection>
        )}

        {activeQueue === 'posts' && (
        <PortalTaskSection
          title="Posts & content"
          subtitle="Approved posts ready to mark scheduled."
          action={
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-200">
              {visiblePostsTasks.length}
            </span>
          }
        >
          {visiblePostsTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-white/35">Nothing on the to-do list right now.</p>
          ) : (
            <TaskList
              tasks={visiblePostsTasks}
              renderItem={(task, index) => (
                <ApprovedScheduleTaskCard
                  key={task.id}
                  task={task}
                  getClientColor={getClientColor}
                  onOpenCard={onOpenCard}
                  onMarkScheduled={onMarkScheduled}
                  animationDelay={`${0.08 + index * 0.05}s`}
                />
              )}
            />
          )}
        </PortalTaskSection>
        )}
      </div>

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
