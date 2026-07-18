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
import SharePortalShell from "./clientPortal/SharePortalShell";
import { btnPrimaryClass, surfacePanelClass } from "./clientPortal/clientPortalUi";
import { isSlidePostType } from "../utils/postSlides";

function planToUpdates(plan) {
  return {
    location: plan.location || "",
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
        shootEndTime: card.shootEndTime || "",
        shootDuration: card.shootDuration || "",
        shootModels: card.shootModels || "",
        shootNeeds: card.shootNeeds || "",
        shootScript: card.shootScript || "",
        shootScriptHook: card.shootScriptHook || "",
        shootScriptBody: card.shootScriptBody || "",
        shootTextOverlays: card.shootTextOverlays || "",
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
      <SharePortalShell title="Shoot schedule submitted" client={client} clientColor={clientColor}>
        <p className="-mt-2 mb-6 text-sm text-white/45">{formatShootDayLabel(focusDate)}</p>
        <div className={`${surfacePanelClass} px-6 py-12 text-center`}>
          <h2 className="text-lg font-semibold text-white">Thanks</h2>
          {syncedLocally ? (
            <p className="mt-2 text-sm text-white/45">
              Your shoot schedule is saved. It will appear on the Shoot Schedule calendar right away.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-white/45">
                Your schedule is ready. Send the link below to Medici Social so it updates on their Shoot Schedule calendar.
              </p>
              <p className="mt-2 text-xs text-emerald-300/80">
                {copied ? "Link copied to clipboard!" : "Copy the link if it wasn't copied automatically."}
              </p>
              <button
                type="button"
                onClick={() => copyImportLink()}
                className={`${btnPrimaryClass} mt-6 py-2 text-[11px]`}
              >
                {copied ? "Link copied!" : "Copy schedule link for Medici Social"}
              </button>
            </>
          )}
        </div>
      </SharePortalShell>
    );
  }

  return (
    <SharePortalShell title="Plan your shoot schedule" client={client} clientColor={clientColor}>
      <p className="-mt-2 mb-6 text-sm text-white/45">{formatShootDayLabel(focusDate)}</p>

      <div className="space-y-6">
        <section className={`${surfacePanelClass} p-4 sm:p-5`}>
          <h2 className="mb-3 text-sm font-semibold text-white">Session details</h2>
          <ShootDaySessionFields plan={localPlan} onUpdatePlan={handleUpdatePlan} />
        </section>

        <section className={`${surfacePanelClass} p-4 sm:p-5`}>
          <h2 className="mb-1 text-sm font-semibold text-white">Content schedule</h2>
          <p className="mb-4 text-xs text-white/40">
            Assign a shoot time for each piece of content. Click a card or use Write script to add the full script.
          </p>
          <div className="space-y-3">
            {sortedCards.map((card) => (
              <ShootDayPlanningRow
                key={card.id}
                card={card}
                onUpdate={handleUpdateCard}
                shootWindow={localPlan}
                onOpenScript={isSlidePostType(card.contentType) ? undefined : setScriptCard}
              />
            ))}
          </div>
        </section>

        <section className={`${surfacePanelClass} p-4 sm:p-5`}>
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
            hideSlidePostPlans
          />
        </section>

        {allNeeds.length > 0 && (
          <section className={`${surfacePanelClass} p-4 sm:p-5`}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Equipment & needs</h3>
            <ul className="mt-2 space-y-1">
              {allNeeds.map((item) => (
                <li key={item} className="text-sm text-white/85">{item}</li>
              ))}
            </ul>
          </section>
        )}

        <section className={`${surfacePanelClass} p-4 sm:p-5`}>
          <h2 className="mb-1 text-sm font-semibold text-white">Model call times</h2>
          <p className="mb-4 text-xs text-white/40">
            Add models to each content item — call times are generated from shoot start/end times.
          </p>
          {modelSchedules.length > 0 ? (
            <ModelScheduleSummary schedules={modelSchedules} title="Who needs to be there when" />
          ) : (
            <p className="py-8 text-center text-sm text-white/35">No models added yet.</p>
          )}
        </section>

        <section className={`${surfacePanelClass} p-4 sm:p-5`}>
          <h2 className="mb-3 text-sm font-semibold text-white">Session extras</h2>
          <ShootDaySessionExtras plan={localPlan} onUpdatePlan={handleUpdatePlan} />
        </section>

        <button
          type="button"
          onClick={handleSubmit}
          className={`${btnPrimaryClass} w-full py-3 text-[11px] sm:w-auto sm:px-8`}
        >
          Submit shoot schedule
        </button>
      </div>

      {scriptCard && (
        <ShootScriptModal
          card={scriptCard}
          onClose={() => setScriptCard(null)}
          onSave={handleUpdateCard}
        />
      )}
    </SharePortalShell>
  );
}
