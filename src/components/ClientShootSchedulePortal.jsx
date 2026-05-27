import { getContentTypeStyle } from '../constants';
import { getClientShootCards, stripInternalCardsForClientPortal } from '../utils/clientPortalAuth';
import { formatTime } from '../utils';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ShootLocationLink from './ShootLocationLink';
import { surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ClientShootSchedulePortal({
  client,
  cards,
  plans,
  clientColor,
  embedded = false,
}) {
  const shootCards = getClientShootCards(stripInternalCardsForClientPortal(cards));
  const filteredCards = shootCards;

  const grouped = filteredCards.reduce((acc, card) => {
    const key = card.shootDate;
    if (!acc[key]) acc[key] = [];
    acc[key].push(card);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();

  const content = (
    <>
      {dates.length === 0 ? (
        <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
          <p className="text-sm text-white/45">No upcoming shoots scheduled.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((dateKey) => {
            const label = new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });
            const plan = Object.values(plans || {}).find(
              (entry) => entry?.client === client && entry?.dateKey === dateKey,
            );

            return (
              <section key={dateKey} className={`${surfacePanelClass} overflow-hidden`}>
                <div className="border-b border-white/10 px-4 py-3">
                  <h3 className="text-sm font-semibold text-white">{label}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-white/45">
                    {plan?.location && (
                      <span>
                        Location: <ShootLocationLink location={plan.location} linkClassName="text-[#c88] underline-offset-2 hover:underline" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {grouped[dateKey].map((card) => {
                    const typeStyle = getContentTypeStyle(card.contentType);
                    return (
                      <article
                        key={card.id}
                        className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                        style={{ borderLeftColor: typeStyle.border, borderLeftWidth: '2px' }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="text-[10px] font-medium uppercase tracking-wider"
                              style={{ color: clientColor }}
                            >
                              {card.contentType}
                            </span>
                            {card.shootTime && (
                              <span className="text-[11px] tabular-nums text-white/40">
                                {formatTime(card.shootTime)}
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1 text-sm font-medium text-white">{card.title}</h4>
                          {card.shootModels && (
                            <p className="mt-1 text-xs text-white/45">Talent: {card.shootModels}</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
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
          description="Upcoming scheduled shoots, locations, and content planned for each session."
        />
        {content}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Shoot schedule</h2>
        <p className="mt-1 text-sm text-gray-400">Upcoming shoot days and content planned for each session.</p>
      </div>
      {content}
    </div>
  );
}
