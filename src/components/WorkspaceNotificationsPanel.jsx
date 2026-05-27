import { btnPrimaryClass, btnSecondaryClass } from './clientPortal/clientPortalUi';

const toneClass = {
  warning: 'text-amber-200/90',
  info: 'text-sky-200/80',
};

export default function WorkspaceNotificationsPanel({
  ideaCount,
  contentReviewCount,
  shootCount,
  alerts = [],
  onApplyIdeas,
  onApplyContentReview,
  onApplyShoot,
  onNavigate,
}) {
  const syncTotal = ideaCount + contentReviewCount + shootCount;
  const total = syncTotal + alerts.length;

  if (!total) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-white/45">Notifications</p>
        <p className="mt-3 text-sm text-white/50">You&apos;re all caught up.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[min(70vh,480px)] overflow-y-auto">
      <p className="text-xs font-medium uppercase tracking-wider text-white/45">
        {total} notification{total === 1 ? '' : 's'}
      </p>

      {syncTotal > 0 && (
        <div className="mt-4 border-b border-white/[0.06] pb-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-amber-200/90">
            Client portal sync
          </p>
          <p className="mt-1 text-xs text-white/45">Apply responses from client reviews.</p>
          <div className="mt-3 flex flex-col gap-2">
            {ideaCount > 0 && (
              <button type="button" onClick={onApplyIdeas} className={`${btnSecondaryClass} w-full py-2 text-[11px]`}>
                Apply {ideaCount} idea response{ideaCount === 1 ? '' : 's'}
              </button>
            )}
            {contentReviewCount > 0 && (
              <button type="button" onClick={onApplyContentReview} className={`${btnPrimaryClass} w-full py-2 text-[11px]`}>
                Apply {contentReviewCount} content review{contentReviewCount === 1 ? '' : 's'}
              </button>
            )}
            {shootCount > 0 && (
              <button type="button" onClick={onApplyShoot} className={`${btnSecondaryClass} w-full py-2 text-[11px]`}>
                Apply {shootCount} shoot update{shootCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <ul className={`space-y-3 ${syncTotal > 0 ? 'mt-4' : 'mt-3'}`}>
          {alerts.map((alert) => (
            <li key={alert.id} className="border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <p className={`text-xs font-medium ${toneClass[alert.tone] || 'text-white/70'}`}>
                {alert.title}
              </p>
              <p className="mt-0.5 text-[11px] text-white/45">{alert.detail}</p>
              {alert.view && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate(alert.view)}
                  className={`${btnSecondaryClass} mt-2 w-full py-2 text-[11px]`}
                >
                  Open {alert.view === 'board' ? 'pipeline' : alert.view}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
