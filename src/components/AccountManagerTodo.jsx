import { useMemo, useState } from 'react';
import { ACCOUNT_MANAGERS, getContentTypeStyle } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { formatStoryScheduleSummary, toDateKey } from '../utils/calendar';
import {
  buildPostsTodoTasks,
  buildStoryTasksToday,
  filterAccountManagerTasks,
  formatAccountManagerDateLabel,
  groupAccountManagerTasksByClient,
  groupAccountManagerTasksByDate,
} from '../utils/accountManagerTodo';
import SchedulePostModal from './SchedulePostModal';

const kindStyles = {
  schedule: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  publish: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'post-story': 'border-blue-500/30 bg-blue-500/10 text-blue-200',
};

function TaskCard({ task, getClientColor, onOpenCard, onScheduleClick }) {
  const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
  const badgeStyle = kindStyles[task.kind] || kindStyles.schedule;

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
            onClick={() => onOpenCard(task.card)}
            className="text-left hover:text-[#fca5a5]"
          >
            <h3 className="text-sm font-semibold text-white">{task.title}</h3>
          </button>

          {task.notes && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{task.notes}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {task.assignedTo && <span>Editor: {task.assignedTo}</span>}
            {task.dueTime && <span>{task.dueTime}</span>}
            {task.contentType === 'Story' && (
              <span>{formatStoryScheduleSummary(task.card)}</span>
            )}
            {task.kind === 'schedule' && <span>Approved · ready for calendar</span>}
          </div>
        </div>

        {task.kind === 'schedule' && (
          <button
            type="button"
            onClick={() => onScheduleClick(task.card)}
            className="shrink-0 rounded-lg bg-[#810100] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#a00000]"
          >
            Schedule
          </button>
        )}
      </div>
    </article>
  );
}

function ClientGroupedList({ tasks, getClientColor, onOpenCard, onScheduleClick }) {
  const groups = useMemo(() => groupAccountManagerTasksByClient(tasks), [tasks]);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.client}>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
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
                onScheduleClick={onScheduleClick}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DateGroupedList({ tasks, getClientColor, onOpenCard, onScheduleClick }) {
  const todayKey = toDateKey(new Date());
  const groups = useMemo(
    () => groupAccountManagerTasksByDate(tasks, todayKey),
    [tasks, todayKey],
  );

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
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
                onScheduleClick={onScheduleClick}
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
  onSchedulePost,
}) {
  const { getClientColor } = useClientsContext();
  const todayKey = toDateKey(new Date());
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [scheduleCard, setScheduleCard] = useState(null);

  const storyTasksToday = useMemo(() => buildStoryTasksToday(cards, todayKey), [cards, todayKey]);
  const postsTodoTasks = useMemo(() => buildPostsTodoTasks(cards), [cards]);

  const filterOptions = useMemo(
    () => ({ search, client: clientFilter, assignee: assigneeFilter }),
    [search, clientFilter, assigneeFilter],
  );

  const filteredStoryTasks = useMemo(
    () => filterAccountManagerTasks(storyTasksToday, filterOptions),
    [storyTasksToday, filterOptions],
  );

  const filteredPostsTasks = useMemo(
    () => filterAccountManagerTasks(postsTodoTasks, filterOptions),
    [postsTodoTasks, filterOptions],
  );

  const handleSchedule = (cardId, schedule) => {
    onSchedulePost(cardId, schedule);
    setScheduleCard(null);
  };

  const todayLabel = formatAccountManagerDateLabel(todayKey, todayKey);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Account manager tasks</h2>
        <p className="mt-1 text-sm text-gray-400">
          Stories to post today, plus your overall to-do for everything else.
        </p>
      </div>

      <div className="mb-8">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section className="min-w-0 rounded-2xl border border-blue-500/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Stories · post today</h3>
              <p className="mt-1 text-sm text-gray-400">{todayLabel}</p>
            </div>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200">
              {filteredStoryTasks.length} to post
            </span>
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
              onScheduleClick={setScheduleCard}
            />
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-amber-500/20 bg-[#0d0d0d] p-5 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Posts & other content · overall to-do</h3>
              <p className="mt-1 text-sm text-gray-400">
                Approved posts to schedule, plus upcoming and overdue publish dates.
              </p>
            </div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
              {filteredPostsTasks.length} tasks
            </span>
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
              onScheduleClick={setScheduleCard}
            />
          )}
        </section>
      </div>

      {scheduleCard && (
        <SchedulePostModal
          card={scheduleCard}
          onClose={() => setScheduleCard(null)}
          onSchedule={handleSchedule}
        />
      )}
    </div>
  );
}
