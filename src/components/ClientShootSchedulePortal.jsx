import { useMemo } from 'react';
import { getContentTypeStyle } from '../constants';
import { contentTypePillProps } from '../utils/contentTypeColors';
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
import { glassInsetClass, surfacePanelClass } from './clientPortal/clientPortalUi';

function ShootScheduleCard({ card, ideas, clientColor }) {
  const referenceVideo = resolveShootCardReferenceVideo(card, ideas);
  const typeStyle = getContentTypeStyle(card.contentType);

  return (
    <article
      className={`${glassInsetClass} flex flex-col overflow-hidden`}
      style={{ borderTopColor: clientColor, borderTopWidth: '3px' }}
    >
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {card.shootTime && (
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                {formatTime(card.shootTime)}
              </p>
            )}
            <h3 className="mt-1 text-base font-semibold text-white">{card.title}</h3>
          </div>
          <span
            {...contentTypePillProps(
              typeStyle,
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
            )}
          >
            {card.contentType}
          </span>
        </div>

        {card.shootModels && (
          <p className="mb-3 text-sm text-white/45">Talent: {card.shootModels}</p>
        )}

        {referenceVideo ? (
          <div className="rounded-lg bg-white/5 px-3 py-2.5 transition hover:bg-white/[0.07]">
            <ReferenceVideoLink url={referenceVideo} />
          </div>
        ) : (
          <p className="text-xs text-white/35">No reference video</p>
        )}
      </div>
    </article>
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

  const content = (
    <>
      {dates.length === 0 ? (
        <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
          <p className="text-sm text-white/45">No upcoming shoots scheduled.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((dateKey) => {
            const label = new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });
            const plan = Object.values(plans || {}).find(
              (entry) => clientMatchesBrand(entry?.client, client) && entry?.dateKey === dateKey,
            );

            return (
              <section key={dateKey} className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
                    {label}
                  </h3>
                  {plan?.location && (
                    <p className="mt-1.5 text-xs text-white/45">
                      Location:{' '}
                      <ShootLocationLink
                        location={plan.location}
                        linkClassName="text-[#c88] underline-offset-2 hover:underline"
                      />
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {grouped[dateKey].map((card) => (
                    <ShootScheduleCard
                      key={card.id}
                      card={card}
                      ideas={ideas}
                      clientColor={clientColor}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
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
