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
      <p className="mb-3 text-sm text-gray-400">{formatMonthYear(focusDate)} scheduled shoots</p>

      <div className="calendar-grid-shell">
        <div className="calendar-grid-head grid grid-cols-7">
          {DAY_NAMES.map((name) => (
            <div key={name} className="calendar-grid-head-cell">
              {name}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="calendar-grid-row grid grid-cols-7">
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
                  className={`calendar-grid-cell min-h-[120px] p-1.5 sm:min-h-[140px] sm:p-2 ${
                    !inMonth ? "bg-black/20 opacity-50" : ""
                  } ${today ? 'calendar-cell-today' : ''} ${
                    hasShoot ? "hover:ring-1 hover:ring-white/10" : ""
                  }`}
                  aria-current={today ? 'date' : undefined}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        today
                          ? 'calendar-day-number-today'
                          : inMonth
                            ? 'flex h-6 w-6 items-center justify-center text-[#f9f6f2]'
                            : 'flex h-6 w-6 items-center justify-center text-gray-600'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {hasShoot && (
                      <span className="rounded-full bg-[#a00000]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#fca5a5]">
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
