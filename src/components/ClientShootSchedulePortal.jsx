import { useCallback, useMemo, useState } from 'react';
import {
  getClientShootCards,
  resolveShootCardReferenceVideo,
  stripInternalCardsForClientPortal,
} from '../utils/clientPortalAuth';
import { clientMatchesBrand } from '../utils/clients';
import {
  addDays,
  addMonths,
  buildShootTimeline,
  formatShootDayLabel,
  getDefaultShootDate,
  getShootDayTitle,
  getShootPlanKey,
  groupCardsByShootDate,
  parseDateKey,
  sortCardsByShootTime,
  toDateKey,
} from '../utils/shootDay';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ShootLocationLink from './ShootLocationLink';
import ShootDayTimeline from './ShootDayTimeline';
import ShootDayMonthView from './ShootDayMonthView';
import { btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

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
  focusRequest = null,
}) {
  const shootCards = useMemo(
    () => getClientShootCards(stripInternalCardsForClientPortal(cards), { upcomingOnly }),
    [cards, upcomingOnly],
  );

  const shootsByDate = useMemo(() => groupCardsByShootDate(shootCards), [shootCards]);

  const visiblePlans = useMemo(() => {
    const filtered = {};
    for (const [key, plan] of Object.entries(plans || {})) {
      if (clientMatchesBrand(plan?.client, client)) filtered[key] = plan;
    }
    return filtered;
  }, [plans, client]);

  const getPlan = useCallback(
    (planClient, dateKey) => resolvePlanForClient(plans, planClient, dateKey),
    [plans],
  );

  const [focusDate, setFocusDate] = useState(() => {
    if (focusRequest?.dateKey) return parseDateKey(focusRequest.dateKey);
    return getDefaultShootDate();
  });
  const [viewMode, setViewMode] = useState(focusRequest?.dateKey ? 'day' : 'month');

  const dateKey = toDateKey(focusDate);
  const dayCards = shootsByDate[dateKey] || [];
  const dayPlan = resolvePlanForClient(plans, client, dateKey);

  const goPrev = () => {
    setFocusDate((current) => (viewMode === 'day' ? addDays(current, -1) : addMonths(current, -1)));
  };

  const goNext = () => {
    setFocusDate((current) => (viewMode === 'day' ? addDays(current, 1) : addMonths(current, 1)));
  };

  const goToday = () => setFocusDate(getDefaultShootDate());

  const handleDayClick = (day) => {
    setFocusDate(day);
    setViewMode('day');
  };

  const navBtnClass = `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`;

  const scheduleBody = (
    <>
      {viewMode === 'day' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={navBtnClass}
          >
            ← Month calendar
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={goPrev} className={navBtnClass}>
            ← {viewMode === 'day' ? 'Prev day' : 'Prev month'}
          </button>
          <button type="button" onClick={goToday} className={navBtnClass}>
            Today
          </button>
          <button type="button" onClick={goNext} className={navBtnClass}>
            {viewMode === 'day' ? 'Next day' : 'Next month'} →
          </button>
        </div>
      </div>

      {shootCards.length === 0 && viewMode === 'month' && (
        <p className="mb-4 text-sm text-white/45">No upcoming shoots scheduled.</p>
      )}

      {viewMode === 'month' && (
        <p className="mb-4 text-xs text-gray-500">Click a day to open your shoot schedule.</p>
      )}

      {viewMode === 'day' ? (
        <ClientShootDaySection
          client={client}
          dateKey={dateKey}
          cards={dayCards}
          plan={dayPlan}
          clientColor={clientColor}
          ideas={ideas}
        />
      ) : (
        <div className={`${surfacePanelClass} p-4`}>
          <ShootDayMonthView
            focusDate={focusDate}
            shootsByDate={shootsByDate}
            plans={visiblePlans}
            onDayClick={handleDayClick}
            getPlan={getPlan}
          />
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Shoot Schedule"
          description="Browse upcoming shoot days on the calendar, then open a day for times, locations, and reference videos."
        />
        {scheduleBody}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Shoot Schedule</h2>
        <p className="mt-1 text-sm text-gray-400">
          Browse shoot days on the calendar, then open a day for the full timeline.
        </p>
      </div>
      {scheduleBody}
    </div>
  );
}
