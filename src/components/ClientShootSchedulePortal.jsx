import { useMemo } from 'react';
import {
  getClientShootCards,
  resolveShootCardReferenceVideo,
  stripInternalCardsForClientPortal,
} from '../utils/clientPortalAuth';
import { clientMatchesBrand } from '../utils/clients';
import {
  buildShootTimeline,
  formatShootDayLabel,
  getShootDayTitle,
  getShootPlanKey,
  parseDateKey,
  sortCardsByShootTime,
} from '../utils/shootDay';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ShootLocationLink from './ShootLocationLink';
import ShootDayTimeline from './ShootDayTimeline';
import { surfacePanelClass } from './clientPortal/clientPortalUi';

function resolvePlanForClient(plans, client, dateKey) {
  const direct = plans?.[getShootPlanKey(client, dateKey)];
  if (direct) return direct;
  return (
    Object.values(plans || {}).find(
      (entry) => clientMatchesBrand(entry?.client, client) && entry?.dateKey === dateKey,
    ) || {}
  );
}

function enrichShootCardsForPortal(cards, ideas) {
  return cards.map((card) => {
    const referenceVideo = resolveShootCardReferenceVideo(card, ideas);
    if (!referenceVideo || referenceVideo === card.referenceVideo) return card;
    return { ...card, referenceVideo };
  });
}

function ClientShootDaySection({ client, dateKey, cards, plan, clientColor, ideas }) {
  const enrichedCards = useMemo(
    () => enrichShootCardsForPortal(sortCardsByShootTime(cards), ideas),
    [cards, ideas],
  );
  const timeline = useMemo(() => buildShootTimeline(enrichedCards), [enrichedCards]);
  const focusDate = parseDateKey(dateKey);

  return (
    <section className="overflow-hidden rounded-xl border border-white/5 bg-[#111111]">
      <header className="border-b border-white/5 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{getShootDayTitle(plan, client)}</h3>
            <p className="text-xs text-gray-500">
              <span style={{ color: clientColor }}>{client}</span>
              {' · '}
              {formatShootDayLabel(focusDate)}
              {' · '}
              {enrichedCards.length} item{enrichedCards.length === 1 ? '' : 's'}
              {timeline.length > 0 &&
                ` · ${timeline.length} timed slot${timeline.length === 1 ? '' : 's'}`}
            </p>
            {plan?.location?.trim() && (
              <p className="mt-2 text-xs">
                <ShootLocationLink location={plan.location} showIcon />
              </p>
            )}
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${clientColor}22`, color: clientColor }}
          >
            {enrichedCards.length}
          </span>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {enrichedCards.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No content scheduled for this shoot.</p>
        ) : (
          <ShootDayTimeline
            entries={timeline}
            plan={plan}
            allCards={enrichedCards}
            client={client}
            dateKey={dateKey}
          />
        )}
      </div>
    </section>
  );
}

export default function ClientShootSchedulePortal({
  client,
  cards,
  ideas = [],
  plans,
  clientColor,
  embedded = false,
  upcomingOnly = true,
}) {
  const shootCards = useMemo(
    () => getClientShootCards(stripInternalCardsForClientPortal(cards), { upcomingOnly }),
    [cards, upcomingOnly],
  );

  const grouped = useMemo(() => {
    return shootCards.reduce((acc, card) => {
      const key = card.shootDate;
      if (!acc[key]) acc[key] = [];
      acc[key].push(card);
      return acc;
    }, {});
  }, [shootCards]);

  const dates = Object.keys(grouped).sort();

  const content =
    dates.length === 0 ? (
      <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
        <p className="text-sm text-white/45">No upcoming shoots scheduled.</p>
      </div>
    ) : (
      <div className="space-y-10">
        {dates.map((dateKey) => (
          <ClientShootDaySection
            key={dateKey}
            client={client}
            dateKey={dateKey}
            cards={grouped[dateKey]}
            plan={resolvePlanForClient(plans, client, dateKey)}
            clientColor={clientColor}
            ideas={ideas}
          />
        ))}
      </div>
    );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Shoot Schedule"
          description="Your upcoming shoot days with times, locations, and reference videos — the same view your production team uses."
        />
        {content}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Shoot Schedule</h2>
        <p className="mt-1 text-sm text-gray-400">
          Upcoming shoot days with timeline, locations, and reference videos.
        </p>
      </div>
      {content}
    </div>
  );
}
