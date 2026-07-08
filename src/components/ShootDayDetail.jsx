import { useMemo, useState } from "react";
import { useClientsContext } from "../context/ClientsContext";
import {
  formatShootDayLabel,
  aggregateModelsWithSlots,
  aggregateNeeds,
  getShootDayTitle,
} from "../utils/shootDay";
import ShootDayUnifiedSchedule from "./ShootDayUnifiedSchedule";
import { ShootDaySessionFields, ShootDaySessionExtras } from "./ShootDayPlanningRow";
import ShootDaySharePanel from "./ShootDaySharePanel";
import ShootDayPrintButton from "./ShootDayPrintButton";
import ModelScheduleSummary from "./ModelScheduleSummary";

export default function ShootDayDetail({
  focusDate,
  dateKey,
  clientGroups,
  shootCount,
  hasShootDay,
  onCardClick,
  onUpdateCard,
  onAddShootDay,
  onAddShootItem,
  onAddShootItemForClient,
  onAddCardsToShoot,
  getPlan,
  onUpdatePlan,
  onRemoveFromSchedule,
  onReturnToVault,
  onRemoveClientShoot,
  onMoveClientShootDay,
  onHandoff,
  ideas = [],
}) {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Shoot Schedule</h2>
        <p className="mt-1 text-sm text-gray-400">{formatShootDayLabel(focusDate)}</p>
        <p className="mt-1 text-xs text-gray-500">
          {shootCount} item{shootCount === 1 ? "" : "s"} to shoot
          {clientGroups.length > 0
            ? ` across ${clientGroups.length} client${clientGroups.length === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>

      {!hasShootDay ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#111111] px-6 py-16 text-center">
          <p className="text-sm text-gray-400">Nothing scheduled to shoot on this day.</p>
          <p className="mt-2 text-xs text-gray-500">
            Add a client shoot, or set a Shoot Date on any board card.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onAddShootDay}
              className="rounded-lg bg-[#810100] px-4 py-2 text-sm font-medium text-white hover:bg-[#a00000]"
            >
              Add client shoot
            </button>
            <button
              type="button"
              onClick={onAddShootItem}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              Add shoot item
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {clientGroups.map(({ client, cards: clientCards }) => (
            <ClientShootSection
              key={client}
              client={client}
              dateKey={dateKey}
              clientCards={clientCards}
              ideas={ideas}
              onCardClick={onCardClick}
              onUpdateCard={onUpdateCard}
              onAddShootItemForClient={onAddShootItemForClient}
              onAddCardsToShoot={onAddCardsToShoot}
              plan={getPlan(client, dateKey)}
              onUpdatePlan={(updates, options) => onUpdatePlan(client, dateKey, updates, options)}
              onRemoveFromSchedule={onRemoveFromSchedule}
              onReturnToVault={onReturnToVault}
              onRemoveClientShoot={() => onRemoveClientShoot(client, dateKey, clientCards)}
              onMoveShootDay={onMoveClientShootDay}
              onHandoff={onHandoff}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ClientShootSection({
  client,
  dateKey,
  clientCards,
  ideas = [],
  onCardClick,
  onUpdateCard,
  onAddShootItemForClient,
  onAddCardsToShoot,
  plan,
  onUpdatePlan,
  onRemoveFromSchedule,
  onReturnToVault,
  onRemoveClientShoot,
  onMoveShootDay,
  onHandoff,
}) {
  const { getClientColor } = useClientsContext();
  const [extrasOpen, setExtrasOpen] = useState(false);
  const color = getClientColor(client);
  const modelSchedules = useMemo(
    () => aggregateModelsWithSlots(clientCards, plan.sessionModels, plan),
    [clientCards, plan],
  );
  const allNeeds = useMemo(
    () => aggregateNeeds(clientCards, plan.sessionNeeds),
    [clientCards, plan.sessionNeeds],
  );

  return (
    <section className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]">
      <header className="border-b border-white/5 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              {getShootDayTitle(plan, client)}
            </h3>
            <p className="text-xs text-gray-500">
              <span style={{ color }}>{client}</span>
              {" · "}
              {clientCards.length} item{clientCards.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShootDayPrintButton
              client={client}
              dateKey={dateKey}
              plan={plan}
              cards={clientCards}
            />
            {onRemoveClientShoot && (
              <button
                type="button"
                onClick={onRemoveClientShoot}
                className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
              >
                Delete shoot
              </button>
            )}
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: color + "22", color }}
            >
              {clientCards.length}
            </span>
          </div>
        </div>
        <div className="mt-4">
          <ShootDaySharePanel
            client={client}
            dateKey={dateKey}
            cards={clientCards}
            plan={plan}
          />
        </div>
      </header>

      <div className="space-y-6 p-4 sm:p-5">
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Session details
          </h4>
          <label className="mb-4 block max-w-xs">
            <span className="mb-1 block text-xs font-medium text-gray-400">Shoot date</span>
            <input
              type="date"
              value={dateKey}
              onChange={(e) => {
                const nextDateKey = e.target.value;
                if (nextDateKey && nextDateKey !== dateKey) {
                  onMoveShootDay?.(client, dateKey, nextDateKey);
                }
              }}
              className="select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50"
            />
          </label>
          <ShootDaySessionFields plan={plan} onUpdatePlan={onUpdatePlan} />
        </div>

        <ShootDayUnifiedSchedule
          cards={clientCards}
          ideas={ideas}
          client={client}
          dateKey={dateKey}
          plan={plan}
          onUpdateCard={onUpdateCard}
          onCardClick={onCardClick}
          onRemoveFromSchedule={onRemoveFromSchedule}
          onReturnToVault={onReturnToVault}
          onHandoff={onHandoff}
          onAddCardsToShoot={onAddCardsToShoot}
          onAddShootItemForClient={onAddShootItemForClient}
        />

        {allNeeds.length > 0 && (
          <SummaryList title="Equipment & needs" items={allNeeds} color={color} />
        )}

        {modelSchedules.length > 0 && (
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Model call times
            </h4>
            <ModelScheduleSummary
              schedules={modelSchedules}
              title="Who needs to be there when"
              titleClassName="text-xs font-semibold uppercase tracking-wider"
              titleStyle={{ color }}
            />
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setExtrasOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg border border-white/8 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 transition hover:bg-white/[0.02]"
          >
            <span>Notes & gear</span>
            <span className="text-gray-600">{extrasOpen ? "−" : "+"}</span>
          </button>
          {extrasOpen && (
            <div className="mt-3">
              <ShootDaySessionExtras plan={plan} onUpdatePlan={onUpdatePlan} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryList({ title, items, color }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h5 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {title}
      </h5>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#f9f6f2]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
