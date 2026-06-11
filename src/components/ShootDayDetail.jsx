import { useMemo, useState } from "react";
import { useClientsContext } from "../context/ClientsContext";
import {
  formatShootDayLabel,
  buildShootTimeline,
  aggregateModelsWithSlots,
  aggregateNeeds,
  getShootDayTitle,
  resolveShootDayTime,
  resolveShootDayEndTime,
} from "../utils/shootDay";
import ShootDayItem from "./ShootDayItem";
import ShootDayTimeline from "./ShootDayTimeline";
import ShootDayPlanningRow, { ShootDaySessionFields, ShootDaySessionExtras } from "./ShootDayPlanningRow";
import ShootDaySharePanel from "./ShootDaySharePanel";
import ShootDayPrintButton from "./ShootDayPrintButton";
import ShootScriptModal from "./ShootScriptModal";
import ModelScheduleSummary from "./ModelScheduleSummary";

export default function ShootDayDetail({
  focusDate,
  dateKey,
  clientGroups,
  shootCount,
  hasShootDay,
  cards,
  ideas = [],
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
              onAddShootItem={onAddShootItem}
              onAddShootItemForClient={onAddShootItemForClient}
              onAddCardsToShoot={onAddCardsToShoot}
              plan={getPlan(client, dateKey)}
              onUpdatePlan={(updates, options) => onUpdatePlan(client, dateKey, updates, options)}
              onRemoveFromSchedule={onRemoveFromSchedule}
              onReturnToVault={onReturnToVault}
              onRemoveClientShoot={() => onRemoveClientShoot(client, dateKey, clientCards)}
              onMoveShootDay={onMoveClientShootDay}
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
  onAddShootItem,
  onAddShootItemForClient,
  onAddCardsToShoot,
  plan,
  onUpdatePlan,
  onRemoveFromSchedule,
  onReturnToVault,
  onRemoveClientShoot,
  onMoveShootDay,
}) {
  const { getClientColor } = useClientsContext();
  const [scriptCard, setScriptCard] = useState(null);
  const color = getClientColor(client);
  const timeline = useMemo(() => buildShootTimeline(clientCards), [clientCards]);
  const modelSchedules = useMemo(
    () => aggregateModelsWithSlots(clientCards, plan.sessionModels, plan),
    [clientCards, plan],
  );
  const allNeeds = useMemo(
    () => aggregateNeeds(clientCards, plan.sessionNeeds),
    [clientCards, plan.sessionNeeds],
  );

  return (
    <section
      className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]"
    >
      <header className="border-b border-white/5 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              {getShootDayTitle(plan, client)}
            </h3>
            <p className="text-xs text-gray-500">
              <span style={{ color }}>{client}</span>
              {' · '}
              {clientCards.length} item{clientCards.length === 1 ? "" : "s"}
              {timeline.length > 0 &&
                ` · ${timeline.length} timed slot${timeline.length === 1 ? "" : "s"}`}
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

      <div className="space-y-8 p-4 sm:p-5">
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

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Content schedule
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  onAddCardsToShoot?.(client, dateKey, {
                    shootTime: resolveShootDayTime(plan, clientCards),
                    shootEndTime: resolveShootDayEndTime(plan, clientCards),
                  })
                }
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/5"
              >
                + From board
              </button>
              <button
                type="button"
                onClick={() => onAddShootItemForClient(client)}
                className="rounded-lg border border-[#810100]/30 bg-[#810100]/10 px-2.5 py-1 text-xs font-medium text-[#fca5a5] hover:bg-[#810100]/20"
              >
                + New item
              </button>
            </div>
          </div>
          {clientCards.length > 1 && (
            <p className="mb-3 text-xs text-gray-500">
              {clientCards.length} items on this shoot — add more reels or posts with the buttons above.
            </p>
          )}
          {clientCards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">No content scheduled yet.</p>
              <p className="mt-1 text-xs text-gray-600">
                Add multiple reels or posts to this shoot day.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onAddCardsToShoot?.(client, dateKey, {
                      shootTime: resolveShootDayTime(plan, clientCards),
                      shootEndTime: resolveShootDayEndTime(plan, clientCards),
                    })
                  }
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5"
                >
                  Add from board / bank
                </button>
                <button
                  type="button"
                  onClick={() => onAddShootItemForClient(client)}
                  className="rounded-lg bg-[#810100]/20 px-3 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-[#810100]/30"
                >
                  Create new item
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {clientCards.map((card) => (
                <ShootDayPlanningRow
                  key={card.id}
                  card={card}
                  ideas={ideas}
                  onUpdate={onUpdateCard}
                  onRemove={onRemoveFromSchedule}
                  onReturnToVault={onReturnToVault}
                  onCardClick={onCardClick}
                  shootWindow={plan}
                  onOpenScript={setScriptCard}
                />
              ))}
            </div>
          )}
        </div>

        {clientCards.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Timeline
          </h4>
          <ShootDayTimeline
            entries={timeline}
            plan={plan}
            allCards={clientCards}
            ideas={ideas}
            client={client}
            dateKey={dateKey}
            onUpdateCard={onUpdateCard}
            onCardClick={onCardClick}
            onReturnToVault={onReturnToVault}
          />
        </div>
        )}

        {(modelSchedules.length > 0 || allNeeds.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {allNeeds.length > 0 && (
              <SummaryList title="Equipment & needs" items={allNeeds} color={color} />
            )}
          </div>
        )}

        {clientCards.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Model call times
            </h4>
            <p className="mb-3 text-xs text-gray-500">
              Based on models added to each content item and full-session models above.
            </p>
            {modelSchedules.length > 0 ? (
              <ModelScheduleSummary
                schedules={modelSchedules}
                title="Who needs to be there when"
                titleClassName="text-xs font-semibold uppercase tracking-wider"
                titleStyle={{ color }}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
                <p className="text-sm text-gray-400">No models added yet.</p>
                <p className="mt-1 text-xs text-gray-500">
                  Add models to each content item — their call times will appear here automatically.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Session extras
          </h4>
          <ShootDaySessionExtras plan={plan} onUpdatePlan={onUpdatePlan} />
        </div>

        {clientCards.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Quick view
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientCards.map((card) => (
              <ShootDayItem key={card.id} card={card} onClick={onCardClick} />
            ))}
          </div>
        </div>
        )}
      </div>

      {scriptCard && (
        <ShootScriptModal
          card={scriptCard}
          onClose={() => setScriptCard(null)}
          onSave={onUpdateCard}
        />
      )}
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
