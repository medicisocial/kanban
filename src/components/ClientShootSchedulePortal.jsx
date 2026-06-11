import { useMemo } from 'react';
import { getContentTypeStyle } from '../constants';
import {
  getClientShootCards,
  resolveShootCardReferenceVideo,
  stripInternalCardsForClientPortal,
} from '../utils/clientPortalAuth';
import { clientMatchesBrand } from '../utils/clients';
import { formatTime } from '../utils';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ReferenceVideoLink from './clientPortal/ReferenceVideoLink';
import ShootLocationLink from './ShootLocationLink';
import {
  glassInsetClass,
  statusBadgeClass,
  statusDotClass,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';

function ShootScheduleCard({ card, ideas }) {
  const referenceVideo = resolveShootCardReferenceVideo(card, ideas);
  const typeStyle = getContentTypeStyle(card.contentType);

  return (
    <article
      className={`${glassInsetClass} mb-2 p-3 transition-colors last:mb-0 hover:border-white/12`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: typeStyle.border }}
        >
          {card.contentType}
        </p>
        <span className={statusBadgeClass('scheduled')}>
          <span className={statusDotClass('scheduled')} />
          Shoot
        </span>
      </div>
      <h4 className="mt-1.5 text-sm font-medium text-white">{card.title}</h4>
      {card.shootTime && (
        <p className="mt-1 text-[11px] tabular-nums text-white/45">{formatTime(card.shootTime)}</p>
      )}
      {card.shootModels && (
        <p className="mt-1 text-[11px] text-white/45">Talent: {card.shootModels}</p>
      )}
      {referenceVideo ? (
        <p className="mt-1.5">
          <ReferenceVideoLink url={referenceVideo} compact />
        </p>
      ) : null}
    </article>
  );
}

function formatShootDayTitle(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ClientShootSchedulePortal({
  client,
  cards,
  ideas = [],
  plans,
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
      <div className="kanban-board-scroll flex w-full overflow-x-auto overscroll-x-contain pb-2 md:-mx-8 md:scroll-px-8 md:px-8 lg:-mx-10 lg:scroll-px-10 lg:px-10">
        <div className="flex w-max gap-3 px-1">
          {dates.map((dateKey) => {
            const dayCards = grouped[dateKey];
            const plan = Object.values(plans || {}).find(
              (entry) => clientMatchesBrand(entry?.client, client) && entry?.dateKey === dateKey,
            );

            return (
              <section key={dateKey} className="kanban-stage glass-surface flex flex-col">
                <div className="kanban-stage-header">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={statusDotClass('scheduled')} />
                    <h3 className="kanban-stage-title">{formatShootDayTitle(dateKey)}</h3>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-white/40">
                    {dayCards.length}
                  </span>
                </div>
                {plan?.location && (
                  <p className="mb-2 text-[11px] leading-snug text-white/45">
                    Location:{' '}
                    <ShootLocationLink
                      location={plan.location}
                      linkClassName="text-[#c88] underline-offset-2 hover:underline"
                    />
                  </p>
                )}
                <div className="kanban-stage-columns kanban-stage-columns-solo">
                  <div className="kanban-column-cards">
                    {dayCards.map((card) => (
                      <ShootScheduleCard key={card.id} card={card} ideas={ideas} />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Shoot Schedule"
          description="Upcoming scheduled shoots, locations, and reference videos for each reel."
        />
        {content}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Shoot schedule</h2>
        <p className="mt-1 text-sm text-gray-400">
          Upcoming scheduled shoots and reference videos for each reel.
        </p>
      </div>
      {content}
    </div>
  );
}
