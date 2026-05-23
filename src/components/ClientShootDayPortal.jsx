import { useState, useEffect, useMemo, useCallback } from "react";
import { useClientsContext } from "../context/ClientsContext";
import {
  parseShootShareHash,
  mergeShootPortalCards,
  buildShootImportUrl,
  buildShootSubmission,
  queueShootResponse,
} from "../utils/shootShare";
import {
  formatShootDayLabel,
  buildShootTimeline,
  aggregateModelsWithSlots,
  aggregateNeeds,
  parseDateKey,
  sortCardsByShootTime,
} from "../utils/shootDay";
import ShootDayPlanningRow, { ShootDaySessionFields, ShootDaySessionExtras } from "./ShootDayPlanningRow";
import ShootDayTimeline from "./ShootDayTimeline";
import ShootDayPrintButton from "./ShootDayPrintButton";
import ShootScriptModal from "./ShootScriptModal";
import ModelScheduleSummary from "./ModelScheduleSummary";

function planToUpdates(plan) {
  return {
    location: plan.location || "",
    callTime: plan.callTime || "",
    shootStartTime: plan.shootStartTime || "",
    shootEndTime: plan.shootEndTime || "",
    sessionModels: plan.sessionModels || "",
    sessionNeeds: plan.sessionNeeds || "",
    notes: plan.notes || "",
  };
}

export default function ClientShootDayPortal({
  client,
  dateKey,
  cards,
  plan,
  onUpdateCard,
  onUpdatePlan,
}) {
  const { getClientColor } = useClientsContext();
  const [localCards, setLocalCards] = useState([]);
  const [localPlan, setLocalPlan] = useState(plan);
  const [submitted, setSubmitted] = useState(false);
  const [syncedLocally, setSyncedLocally] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scriptCard, setScriptCard] = useState(null);

  useEffect(() => {
    const snapshot = parseShootShareHash();
    const merged = mergeShootPortalCards(cards, client, dateKey, snapshot);
    setLocalCards(merged);
    if (snapshot?.plan) {
      setLocalPlan((prev) => ({ ...prev, ...snapshot.plan }));
    }
  }, [cards, client, dateKey]);

  const canSyncLocally = cards.some((c) => c.client === client && c.shootDate === dateKey);

  const handleUpdateCard = (id, updates) => {
    setLocalCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    if (canSyncLocally) onUpdateCard?.(id, updates);
  };

  const handleUpdatePlan = (updates) => {
    setLocalPlan((prev) => ({ ...prev, ...updates }));
    if (canSyncLocally) onUpdatePlan?.(updates);
  };

  const sortedCards = useMemo(() => sortCardsByShootTime(localCards), [localCards]);
  const timeline = useMemo(() => buildShootTimeline(sortedCards), [sortedCards]);
  const modelSchedules = useMemo(
    () => aggregateModelsWithSlots(localCards, localPlan.sessionModels, localPlan),
    [localCards, localPlan],
  );
  const allNeeds = useMemo(
    () => aggregateNeeds(localCards, localPlan.sessionNeeds),
    [localCards, localPlan.sessionNeeds],
  );

  const focusDate = parseDateKey(dateKey);
  const clientColor = getClientColor(client);

  const buildSubmission = useCallback(
    () => buildShootSubmission(client, dateKey, localPlan, localCards),
    [client, dateKey, localPlan, localCards],
  );

  const syncToAgency = useCallback(() => {
    onUpdatePlan?.(planToUpdates(localPlan));
    for (const card of localCards) {
      onUpdateCard?.(card.id, {
        shootTime: card.shootTime || "",
        shootDuration: card.shootDuration || "",
        shootModels: card.shootModels || "",
        shootNeeds: card.shootNeeds || "",
        shootScript: card.shootScript || "",
      });
    }
  }, [localCards, localPlan, onUpdateCard, onUpdatePlan]);

  const copyImportLink = async (submission = buildSubmission()) => {
    const url = buildShootImportUrl(submission);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      window.prompt("Copy this link and send it to Medici Social:", url);
      return false;
    }
  };

  const handleSubmit = async () => {
    const submission = buildSubmission();

    if (canSyncLocally) {
      syncToAgency();
      setSyncedLocally(true);
    } else {
      queueShootResponse(submission);
      await copyImportLink(submission);
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0f1117]">
        <header className="border-b border-white/5 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-[800px]">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Medici Social</p>
            <h1 className="text-lg font-semibold text-white">Shoot Schedule Submitted</h1>
            <p className="text-sm" style={{ color: clientColor }}>{client}</p>
            <p className="mt-1 text-xs text-gray-500">{formatShootDayLabel(focusDate)}</p>
          </div>
        </header>
        <main className="mx-auto max-w-[800px] px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-12 text-center">
            <p className="text-2xl">✓</p>
            <h2 className="mt-3 text-lg font-semibold text-white">Thanks!</h2>
            {syncedLocally ? (
              <p className="mt-2 text-sm text-gray-400">
                Your shoot schedule is saved. It will appear on the Shoot Schedule calendar right away.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-400">
                  Your schedule is ready. Send the link below to Medici Social so it updates on their Shoot Schedule calendar.
                </p>
                <p className="mt-2 text-xs text-emerald-300/80">
                  {copied ? "Link copied to clipboard!" : "Copy the link if it wasn't copied automatically."}
                </p>
                <button
                  type="button"
                  onClick={() => copyImportLink()}
                  className="mt-6 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  {copied ? "Link copied!" : "Copy schedule link for Medici Social"}
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <header className="border-b border-white/5 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[800px]">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Medici Social</p>
          <h1 className="text-lg font-semibold text-white">Plan Your Shoot Schedule</h1>
          <p className="text-sm" style={{ color: clientColor }}>{client}</p>
          <p className="mt-1 text-xs text-gray-500">{formatShootDayLabel(focusDate)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] space-y-8 px-4 py-8 sm:px-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-white">Session details</h2>
          <ShootDaySessionFields plan={localPlan} onUpdatePlan={handleUpdatePlan} />
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold text-white">Content schedule</h2>
          <p className="mb-4 text-xs text-gray-500">
            Assign a shoot time for each piece of content. Click a card or use Write script to add the full script.
          </p>
          <div className="space-y-3">
            {sortedCards.map((card) => (
              <ShootDayPlanningRow
                key={card.id}
                card={card}
                onUpdate={handleUpdateCard}
                shootWindow={localPlan}
                onOpenScript={setScriptCard}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Generated timeline</h2>
            <ShootDayPrintButton
              client={client}
              dateKey={dateKey}
              plan={localPlan}
              cards={sortedCards}
            />
          </div>
          <ShootDayTimeline
            entries={timeline}
            plan={localPlan}
            allCards={sortedCards}
            client={client}
            dateKey={dateKey}
            onUpdateCard={handleUpdateCard}
          />
        </section>

        {(modelSchedules.length > 0 || allNeeds.length > 0) && (
          <section className="grid gap-4 sm:grid-cols-2">
            {modelSchedules.length > 0 && (
              <ModelScheduleSummary schedules={modelSchedules} title="All models & talent" />
            )}
            {allNeeds.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Equipment & needs</h3>
                <ul className="mt-2 space-y-1">
                  {allNeeds.map((item) => (
                    <li key={item} className="text-sm text-gray-200">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-white">Session extras</h2>
          <ShootDaySessionExtras plan={localPlan} onUpdatePlan={handleUpdatePlan} />
        </section>

        <div className="pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500 sm:w-auto sm:px-8"
          >
            Submit shoot schedule
          </button>
        </div>
      </main>

      {scriptCard && (
        <ShootScriptModal
          card={scriptCard}
          onClose={() => setScriptCard(null)}
          onSave={handleUpdateCard}
        />
      )}
    </div>
  );
}
