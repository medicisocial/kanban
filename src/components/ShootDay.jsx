import { useState, useMemo } from "react";
import { filterCards } from "../utils";
import {
  getDefaultShootDate,
  getCardsForShootDate,
  groupShootDayClients,
  groupCardsByShootDate,
  getShootCards,
  getPlanClientsForDate,
  addDays,
  addMonths,
  toDateKey,
  dateKeyToInputValue,
  inputValueToDate,
} from "../utils/shootDay";
import { useClientsContext } from "../context/ClientsContext";
import ShootDayDetail from "./ShootDayDetail";
import ShootDayMonthView from "./ShootDayMonthView";
import AddShootDayModal from "./AddShootDayModal";

export default function ShootDay({
  cards,
  clientFilter,
  search,
  plans,
  onCardClick,
  onUpdateCard,
  onAddShootItem,
  getPlan,
  onUpdatePlan,
  onEnsurePlan,
  onRemoveFromSchedule,
  onRemoveClientShoot,
}) {
  const { clients } = useClientsContext();
  const [focusDate, setFocusDate] = useState(() => getDefaultShootDate());
  const [viewMode, setViewMode] = useState("month");
  const [shootModal, setShootModal] = useState(null);

  const dateKey = toDateKey(focusDate);

  const visibleShootCards = useMemo(
    () => filterCards(getShootCards(cards), { client: clientFilter, search }),
    [cards, clientFilter, search],
  );

  const shootsByDate = useMemo(
    () => groupCardsByShootDate(visibleShootCards),
    [visibleShootCards],
  );

  const shootCards = useMemo(
    () => getCardsForShootDate(visibleShootCards, dateKey),
    [visibleShootCards, dateKey],
  );

  const clientGroups = useMemo(
    () => groupShootDayClients(shootCards, dateKey, getPlan, plans, clients),
    [shootCards, dateKey, getPlan, plans, clients],
  );

  const planClientsForDay = useMemo(
    () => getPlanClientsForDate(plans, dateKey, clients),
    [plans, dateKey, clients],
  );

  const hasShootDay = shootCards.length > 0 || planClientsForDay.length > 0;

  const goPrev = () => {
    setFocusDate((d) => (viewMode === "day" ? addDays(d, -1) : addMonths(d, -1)));
  };

  const goNext = () => {
    setFocusDate((d) => (viewMode === "day" ? addDays(d, 1) : addMonths(d, 1)));
  };

  const goToday = () => setFocusDate(getDefaultShootDate());

  const handleDayClick = (day) => {
    setFocusDate(day);
    setViewMode("day");
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            ← {viewMode === "day" ? "Prev Day" : "Prev Month"}
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            {viewMode === "day" ? "Next Day" : "Next Month"} →
          </button>
          {viewMode === "day" && (
            <input
              type="date"
              value={dateKeyToInputValue(focusDate)}
              onChange={(e) => setFocusDate(inputValueToDate(e.target.value))}
              className="select-dark rounded-lg border border-white/10 bg-[#1e2130] px-3 py-1.5 text-sm text-gray-200 outline-none transition focus:border-violet-500/50"
            />
          )}
        </div>

        <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setShootModal({ mode: viewMode === "day" ? "item" : "day" })}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            + {viewMode === "day" ? "Add item" : "Add client shoot"}
          </button>
          <div className="mx-1 w-px bg-white/10" />
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              viewMode === "month"
                ? "bg-violet-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              viewMode === "day"
                ? "bg-violet-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Day
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-gray-500">
        {viewMode === "month"
          ? "Click any day to open it, or add a client shoot manually."
          : "Add items here or set a Shoot Date on any card."}
      </p>

      {viewMode === "day" ? (
        <ShootDayDetail
          focusDate={focusDate}
          dateKey={dateKey}
          clientGroups={clientGroups}
          shootCount={shootCards.length}
          hasShootDay={hasShootDay}
          onCardClick={onCardClick}
          onUpdateCard={onUpdateCard}
          onAddShootDay={() => setShootModal({ mode: "day" })}
          onAddShootItem={() => setShootModal({ mode: "item" })}
          onAddShootItemForClient={(client) => setShootModal({ mode: "item", client })}
          getPlan={getPlan}
          onUpdatePlan={onUpdatePlan}
          onRemoveFromSchedule={onRemoveFromSchedule}
          onRemoveClientShoot={onRemoveClientShoot}
        />
      ) : (
        <ShootDayMonthView
          focusDate={focusDate}
          shootsByDate={shootsByDate}
          plans={plans}
          onDayClick={handleDayClick}
          getPlan={getPlan}
        />
      )}

      {shootModal && (
        <AddShootDayModal
          mode={shootModal.mode}
          defaultDate={dateKey}
          defaultClient={shootModal.client || clientFilter}
          onClose={() => setShootModal(null)}
          onAddDay={({ client, shootDate }) => {
            onEnsurePlan(client, shootDate);
            setFocusDate(inputValueToDate(shootDate));
            setViewMode("day");
          }}
          onAddItem={(data) => {
            onAddShootItem(data);
            setFocusDate(inputValueToDate(data.shootDate));
            setViewMode("day");
          }}
        />
      )}
    </div>
  );
}
