import { useMemo, useState } from 'react';
import { ACCOUNT_MANAGERS, getContentTypeStyle } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { formatTime } from '../utils';
import { formatStoryScheduleSummary, toDateKey } from '../utils/calendar';
import {
  buildInReviewTasks,
  buildPostsTodoTasks,
  buildStoryTasksToday,
  filterAccountManagerTasks,
  formatAccountManagerDateLabel,
  groupAccountManagerTasksByClient,
  groupAccountManagerTasksByDate,
} from '../utils/accountManagerTodo';
import { getEditorTaskStatusOptions, groupEditorTasksByDate } from '../utils/editorTodo';
import NeedsEditsModal from './NeedsEditsModal';

const kindStyles = {
  schedule: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  publish: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'post-story': 'border-blue-500/30 bg-blue-500/10 text-blue-200',
};

const inReviewKindStyle = 'border-[#810100]/30 bg-[#a00000]/10 text-[#fecaca]';

function InReviewTaskCard({ task, getClientColor, onOpenCard, onMoveTask, onRequestEdits }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const clientColor = getClientColor(task.client);
  const statusOptions = getEditorTaskStatusOptions(task.isOneOffProject);

  const openCard = () => onOpenCard(task.card);

  return (
    <article className="rounded-xl border border-white/8 bg-[#111111] p-4">
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
          <button
            type="button"
            onClick={() => onRequestEdits(task.card)}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
          >
            Needs edits
          </button>
        </div>
      </div>
    </article>
  );
}

function InReviewTaskList({ tasks, getClientColor, onOpenCard, onMoveTask, onRequestEdits, todayKey }) {
  if (tasks.length === 0) {
    return null;
  }

  const groupedTasks = groupEditorTasksByDate(tasks, todayKey);

  return (
    <div className="space-y-6">
      {groupedTasks.map((group) => (
        <section key={group.key}>
          <h4
            className={`mb-3 text-center text-xs font-semibold uppercase tracking-wider ${
              group.key === 'overdue' ? 'text-red-300' : 'text-gray-500'
            }`}
          >
            {group.label}
          </h4>
          <div className="space-y-3">
            {group.tasks.map((task) => (
              <InReviewTaskCard
                key={task.id}
                task={task}
                getClientColor={getClientColor}
                onOpenCard={onOpenCard}
                onMoveTask={onMoveTask}
                onRequestEdits={onRequestEdits}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskCard({ task, getClientColor, onOpenCard, onMarkScheduled, onMarkPosted }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const badgeStyle = kindStyles[task.kind] || kindStyles.schedule;
  const canMarkPosted = task.kind === 'publish' || task.kind === 'post-story';
  const clientColor = getClientColor(task.client);

  const openCard = () => onOpenCard(task.card);

  return (
    <article className="rounded-xl border border-white/8 bg-[#111111] p-4">
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
              {task.dueTime && (
                <span className="text-xs font-medium text-gray-400">{formatTime(task.dueTime)}</span>
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
            {task.kind === 'schedule' && <span>Approved · ready for calendar</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={openCard}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
          >
            Edit
          </button>
          {task.kind === 'schedule' && (
            <button
              type="button"
              onClick={() => onMarkScheduled(task.cardId)}
              className="rounded-lg bg-[#810100] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#a00000]"
            >
              Scheduled
            </button>
          )}
          {canMarkPosted && (
            <button
              type="button"
              onClick={() => onMarkPosted(task.cardId, task.taskDate || task.card.occurrenceDate)}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Mark posted
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ClientGroupedList({ tasks, getClientColor, onOpenCard, onMarkScheduled, onMarkPosted }) {
  const groups = useMemo(() => groupAccountManagerTasksByClient(tasks), [tasks]);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.client}>
          <h4 className="mb-3 flex items-center justify-center gap-2 text-center text-sm font-semibold uppercase tracking-wider text-gray-400">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: getClientColor(group.client) }}
            />
            {group.client}
            <span className="font-normal normal-case text-gray-500">({group.tasks.length})</span>
          </h4>
          <div className="space-y-3">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                getClientColor={getClientColor}
                onOpenCard={onOpenCard}
                onMarkScheduled={onMarkScheduled}
                onMarkPosted={onMarkPosted}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DateGroupedList({ tasks, getClientColor, onOpenCard, onMarkScheduled, onMarkPosted }) {
  const todayKey = toDateKey(new Date());
  const groups = useMemo(
    () => groupAccountManagerTasksByDate(tasks, todayKey),
    [tasks, todayKey],
  );

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <h4 className="mb-3 text-center text-sm font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
            <span className="ml-2 font-normal normal-case text-gray-500">
              ({group.tasks.length})
            </span>
          </h4>
          <div className="space-y-3">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                getClientColor={getClientColor}
                onOpenCard={onOpenCard}
                onMarkScheduled={onMarkScheduled}
                onMarkPosted={onMarkPosted}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AccountManagerTodo({
  cards,
  search,
  clientFilter,
  onOpenCard,
  onMarkScheduled,
  onMarkPosted,
  onMoveTask,
  onSendBackForEditing,
}) {
  const { getClientColor, clientAccountManagers } = useClientsContext();
  const todayKey = toDateKey(new Date());
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [needsEditsCard, setNeedsEditsCard] = useState(null);

  const storyTasksToday = useMemo(
    () => buildStoryTasksToday(cards, todayKey, clientAccountManagers),
    [cards, todayKey, clientAccountManagers],
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
    () => ({ search, client: clientFilter, assignee: assigneeFilter }),
    [search, clientFilter, assigneeFilter],
  );

  const filteredStoryTasks = useMemo(
    () => filterAccountManagerTasks(storyTasksToday, filterOptions),
    [storyTasksToday, filterOptions],
  );

  const filteredInReviewTasks = useMemo(
    () => filterAccountManagerTasks(inReviewTasks, filterOptions),
    [inReviewTasks, filterOptions],
  );

  const filteredPostsTasks = useMemo(
    () => filterAccountManagerTasks(postsTodoTasks, filterOptions),
    [postsTodoTasks, filterOptions],
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
          In-review content, stories to post today, and your overall scheduling to-do.
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
            {ACCOUNT_MANAGERS.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <section className="min-w-0 rounded-2xl border border-[#810100]/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="text-lg font-semibold text-white">In review</h3>
              <span className="rounded-full border border-[#810100]/30 bg-[#a00000]/10 px-2.5 py-1 text-xs text-[#fecaca]">
                {filteredInReviewTasks.length} in review
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Content in internal review before client approval.
            </p>
          </div>

          {filteredInReviewTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Nothing in review right now.</p>
              <p className="mt-1 text-xs text-gray-500">
                Cards moved to In Review on the board appear here.
              </p>
            </div>
          ) : (
            <InReviewTaskList
              tasks={filteredInReviewTasks}
              getClientColor={getClientColor}
              onOpenCard={onOpenCard}
              onMoveTask={onMoveTask}
              onRequestEdits={setNeedsEditsCard}
              todayKey={todayKey}
            />
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-blue-500/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="text-lg font-semibold text-white">Stories · post today</h3>
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200">
                {filteredStoryTasks.length} to post
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-400">{todayLabel}</p>
          </div>

          {filteredStoryTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">No stories to post today.</p>
              <p className="mt-1 text-xs text-gray-500">
                Daily campaigns and weekly stories appear here on their scheduled days.
              </p>
            </div>
          ) : (
            <ClientGroupedList
              tasks={filteredStoryTasks}
              getClientColor={getClientColor}
              onOpenCard={onOpenCard}
              onMarkScheduled={onMarkScheduled}
              onMarkPosted={onMarkPosted}
            />
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-amber-500/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h3 className="text-lg font-semibold text-white">Posts & other content · overall to-do</h3>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                {filteredPostsTasks.length} tasks
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Approved posts to schedule, plus upcoming and overdue publish dates.
            </p>
          </div>

          {filteredPostsTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Nothing on the to-do list right now.</p>
              <p className="mt-1 text-xs text-gray-500">
                Approved reels, carousels, and static posts will show up here.
              </p>
            </div>
          ) : (
            <DateGroupedList
              tasks={filteredPostsTasks}
              getClientColor={getClientColor}
              onOpenCard={onOpenCard}
              onMarkScheduled={onMarkScheduled}
              onMarkPosted={onMarkPosted}
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
    </div>
  );
}
