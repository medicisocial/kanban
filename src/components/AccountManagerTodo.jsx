import { useMemo, useState } from 'react';
import { ACCOUNT_MANAGERS, getContentTypeStyle } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { addDays, formatStoryScheduleSummary, toDateKey } from '../utils/calendar';
import {
  buildAccountManagerTasks,
  filterAccountManagerTasks,
  formatAccountManagerDateLabel,
  groupAccountManagerTasksByClient,
  splitAccountManagerTasksByContentType,
} from '../utils/accountManagerTodo';
import SchedulePostModal from './SchedulePostModal';

const kindStyles = {
  schedule: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  publish: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  'post-story': 'border-blue-500/30 bg-blue-500/10 text-blue-200',
};

function TaskList({ tasks, getClientColor, onOpenCard, onScheduleClick }) {
  const groupedTasks = useMemo(() => groupAccountManagerTasksByClient(tasks), [tasks]);

  if (!tasks.length) {
    return null;
  }

  return (
    <div className="space-y-8">
      {groupedTasks.map((group) => (
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
            {group.tasks.map((task) => {
              const typeStyle = task.contentType ? getContentTypeStyle(task.contentType) : null;
              const badgeStyle = kindStyles[task.kind] || kindStyles.schedule;

              return (
                <article key={task.id} className="rounded-xl border border-white/8 bg-[#111111] p-4">
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
                        {task.contentType === 'Story' && task.kind !== 'schedule' && (
                          <span>{formatStoryScheduleSummary(task.card)}</span>
                        )}
                        {task.kind === 'schedule' && (
                          <span>Approved · ready for calendar</span>
                        )}
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
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskSection({
  title,
  description,
  countBadge,
  dailyTasks,
  scheduleTasks,
  dateLabel,
  getClientColor,
  onOpenCard,
  onScheduleClick,
  emptyDailyMessage,
  emptyScheduleMessage,
  accentClass = 'border-white/10',
}) {
  return (
    <section className={`rounded-2xl border ${accentClass} bg-[#0d0d0d] p-5 sm:p-6`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
        {countBadge}
      </div>

      <div className="mb-8">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
          {dateLabel}
        </h4>
        {dailyTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-6 py-8 text-center">
            <p className="text-sm text-gray-400">{emptyDailyMessage}</p>
          </div>
        ) : (
          <TaskList
            tasks={dailyTasks}
            getClientColor={getClientColor}
            onOpenCard={onOpenCard}
            onScheduleClick={onScheduleClick}
          />
        )}
      </div>

      <div>
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Needs scheduling
        </h4>
        {scheduleTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-6 py-8 text-center">
            <p className="text-sm text-gray-400">{emptyScheduleMessage}</p>
          </div>
        ) : (
          <TaskList
            tasks={scheduleTasks}
            getClientColor={getClientColor}
            onOpenCard={onOpenCard}
            onScheduleClick={onScheduleClick}
          />
        )}
      </div>
    </section>
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
  const [focusDate, setFocusDate] = useState(todayKey);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [scheduleCard, setScheduleCard] = useState(null);

  const { scheduleTasks, dailyTasks } = useMemo(
    () => buildAccountManagerTasks(cards, focusDate),
    [cards, focusDate],
  );

  const filterOptions = useMemo(
    () => ({ search, client: clientFilter, assignee: assigneeFilter }),
    [search, clientFilter, assigneeFilter],
  );

  const filteredDailyTasks = useMemo(
    () => filterAccountManagerTasks(dailyTasks, filterOptions),
    [dailyTasks, filterOptions],
  );

  const filteredScheduleTasks = useMemo(
    () => filterAccountManagerTasks(scheduleTasks, filterOptions),
    [scheduleTasks, filterOptions],
  );

  const dailyByType = useMemo(
    () => splitAccountManagerTasksByContentType(filteredDailyTasks),
    [filteredDailyTasks],
  );

  const scheduleByType = useMemo(
    () => splitAccountManagerTasksByContentType(filteredScheduleTasks),
    [filteredScheduleTasks],
  );

  const handleSchedule = (cardId, schedule) => {
    onSchedulePost(cardId, schedule);
    setScheduleCard(null);
  };

  const shiftFocusDate = (days) => {
    setFocusDate(toDateKey(addDays(new Date(`${focusDate}T12:00:00`), days)));
  };

  const dateLabel = formatAccountManagerDateLabel(focusDate, todayKey);
  const dayLabel = focusDate === todayKey ? 'today' : 'selected day';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Account manager tasks</h2>
        <p className="mt-1 text-sm text-gray-400">
          Separate checklists for stories and all other content.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => shiftFocusDate(-1)}
            className="rounded-md px-2.5 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
            aria-label="Previous day"
          >
            ←
          </button>
          <input
            type="date"
            value={focusDate}
            onChange={(e) => setFocusDate(e.target.value)}
            className="select-dark rounded-md border-0 bg-transparent px-2 py-1.5 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={() => shiftFocusDate(1)}
            className="rounded-md px-2.5 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
            aria-label="Next day"
          >
            →
          </button>
          {focusDate !== todayKey && (
            <button
              type="button"
              onClick={() => setFocusDate(todayKey)}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-white/5"
            >
              Today
            </button>
          )}
        </div>

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

      <div className="space-y-8">
        <TaskSection
          title="Stories"
          description="Daily story posting plus approved stories waiting to be scheduled."
          countBadge={
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                {dailyByType.stories.length} for {dayLabel}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                {scheduleByType.stories.length} to schedule
              </span>
            </div>
          }
          dailyTasks={dailyByType.stories}
          scheduleTasks={scheduleByType.stories}
          dateLabel={dateLabel}
          getClientColor={getClientColor}
          onOpenCard={onOpenCard}
          onScheduleClick={setScheduleCard}
          emptyDailyMessage="No stories scheduled for this day."
          emptyScheduleMessage="No approved stories waiting to be scheduled."
          accentClass="border-blue-500/20"
        />

        <TaskSection
          title="Posts & other content"
          description="Reels, carousels, static posts, and everything that is not a story."
          countBadge={
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                {dailyByType.posts.length} for {dayLabel}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                {scheduleByType.posts.length} to schedule
              </span>
            </div>
          }
          dailyTasks={dailyByType.posts}
          scheduleTasks={scheduleByType.posts}
          dateLabel={dateLabel}
          getClientColor={getClientColor}
          onOpenCard={onOpenCard}
          onScheduleClick={setScheduleCard}
          emptyDailyMessage="No posts scheduled for this day."
          emptyScheduleMessage="No approved posts waiting to be scheduled."
          accentClass="border-amber-500/20"
        />
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
