export default function ModelScheduleSummary({ schedules, title, titleClassName, titleStyle }) {
  if (!schedules?.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h5
        className={titleClassName ?? "text-xs font-semibold uppercase tracking-wider text-gray-500"}
        style={titleStyle}
      >
        {title}
      </h5>
      <ul className="mt-2 space-y-2">
        {schedules.map(({ name, slots }) => (
          <li
            key={name}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <p className="text-sm font-medium text-gray-200">{name}</p>
            <ul className="mt-1 space-y-0.5">
              {slots.map((slot, index) => (
                <li key={`${slot.timeLabel}-${index}`} className="text-xs text-gray-400">
                  {slot.timeLabel}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
