import { getContentTypeStyle } from '../constants';
import { getClientShootCards } from '../utils/clientPortalAuth';
import { formatTime } from '../utils';

export default function ClientShootSchedulePortal({ client, cards, plans, clientColor }) {
  const shootCards = getClientShootCards(cards);
  const grouped = shootCards.reduce((acc, card) => {
    const key = card.shootDate;
    if (!acc[key]) acc[key] = [];
    acc[key].push(card);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Shoot schedule</h2>
        <p className="mt-1 text-sm text-gray-400">Upcoming shoot days and content planned for each session.</p>
      </div>

      {dates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No upcoming shoots scheduled.</p>
        </div>
      ) : (
        <div className="space-y-6">
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
              <section key={dateKey} className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5">
                <h3 className="text-base font-semibold text-white">{label}</h3>
                {plan?.location && (
                  <p className="mt-1 text-sm text-gray-400">Location: {plan.location}</p>
                )}
                {plan?.callTime && (
                  <p className="text-sm text-gray-400">Call time: {formatTime(plan.callTime)}</p>
                )}
                <div className="mt-4 space-y-3">
                  {grouped[dateKey].map((card) => {
                    const typeStyle = getContentTypeStyle(card.contentType);
                    return (
                      <article
                        key={card.id}
                        className="rounded-xl border border-white/8 bg-[#111111] p-3"
                        style={{ borderLeftColor: typeStyle.border, borderLeftWidth: '3px' }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: clientColor }}>
                            {card.contentType}
                          </span>
                          {card.shootTime && (
                            <span className="text-xs text-gray-500">{formatTime(card.shootTime)}</span>
                          )}
                        </div>
                        <h4 className="mt-1 text-sm font-medium text-white">{card.title}</h4>
                        {card.shootModels && (
                          <p className="mt-1 text-xs text-gray-400">Talent: {card.shootModels}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
