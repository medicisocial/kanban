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
      <ul className="mt-3 space-y-3">
        {schedules.map(({ name, slots }) => (
          <li
            key={name}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
          >
            <p className="text-sm font-semibold text-[#f9f6f2]">{name}</p>
            <ul className="mt-2 space-y-1.5">
              {slots.map((slot, index) => (
                <li
                  key={`${slot.timeLabel}-${slot.contentTitle}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-2 text-xs"
                >
                  <span className="font-medium text-[#fecaca]">{slot.timeLabel}</span>
                  {slot.contentTitle && (
                    <span className="text-gray-400">
                      {slot.contentTitle}
                      {slot.contentType ? ` · ${slot.contentType}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
