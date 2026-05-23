import { useClientsContext } from "../context/ClientsContext";
import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from "../utils/calendar";
import { getUniqueClientsForDay, getPlanClientsForDate } from "../utils/shootDay";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ShootDayMonthView({
  focusDate,
  shootsByDate,
  plans,
  onDayClick,
  getPlan,
}) {
  const { clients: clientOrder, getClientColor } = useClientsContext();
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const weeks = getMonthWeeks(year, month);

  return (
    <div className="flex flex-col">
      <p className="mb-3 text-sm text-gray-400">{formatMonthYear(focusDate)} shoot schedule</p>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#1a1d2e]">
        <div className="grid grid-cols-7 border-b border-white/5">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
              {name}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-white/5 last:border-b-0">
            {week.map((day) => {
              const key = toDateKey(day);
              const dayShoots = shootsByDate[key] || [];
              const planClients = getPlanClientsForDate(plans, key, clientOrder);
              const clients = getUniqueClientsForDay(dayShoots, {
                getPlan,
                dateKey: key,
                plans,
                clientOrder,
              });
              const shootCount = dayShoots.length;
              const hasShoot = shootCount > 0 || planClients.length > 0;

              const inMonth = day.getMonth() === month;
              const today = isToday(day);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onDayClick(day)}
                  className={`min-h-[120px] border-r border-white/5 p-1.5 text-left transition last:border-r-0 hover:bg-white/5 sm:min-h-[140px] sm:p-2 ${
                    !inMonth ? "bg-black/20 opacity-50" : ""
                  } ${today ? "bg-violet-500/10 ring-1 ring-inset ring-violet-500/30" : ""} ${
                    hasShoot ? "hover:ring-1 hover:ring-violet-500/20" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        today
                          ? "bg-violet-500 text-white"
                          : inMonth
                            ? "text-gray-200"
                            : "text-gray-600"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {hasShoot && (
                      <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                        {shootCount > 0 ? shootCount : "•"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {clients.slice(0, 3).map((client) => {
                      const color = getClientColor(client);
                      return (
                      <div
                        key={client}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: color + "33",
                          color,
                        }}
                      >
                        {client}
                      </div>
                      );
                    })}
                    {clients.length > 3 && (
                      <p className="px-1 text-[10px] text-gray-500">+{clients.length - 3} clients</p>
                    )}
                    {dayShoots.length === 0 && planClients.length > 0 && inMonth && (
                      <p className="px-1 text-[10px] text-gray-500">Schedule planned</p>
                    )}
                    {!hasShoot && inMonth && (
                      <p className="px-1 text-[10px] text-gray-600">No shoots</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
