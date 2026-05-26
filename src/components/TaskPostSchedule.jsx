import { formatScheduledDateTime, isPostingTomorrow } from '../utils';

export default function TaskPostSchedule({
  postDate,
  dueTime,
  className = 'text-xs font-medium text-gray-400',
}) {
  if (!postDate) return null;

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span>{formatScheduledDateTime(postDate, dueTime)}</span>
      {isPostingTomorrow(postDate) && (
        <span className="font-semibold uppercase tracking-wide text-amber-300">
          Complete by end of day
        </span>
      )}
    </span>
  );
}
