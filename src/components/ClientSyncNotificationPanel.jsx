import { btnPrimaryClass, btnSecondaryClass } from './clientPortal/clientPortalUi';

export default function ClientSyncNotificationPanel({
  ideaCount,
  contentReviewCount,
  shootCount,
  onApplyIdeas,
  onApplyContentReview,
  onApplyShoot,
}) {
  const total = ideaCount + contentReviewCount + shootCount;

  if (!total) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-white/45">Notifications</p>
        <p className="mt-3 text-sm text-white/50">No client updates waiting.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-amber-200/90">
        {total} client update{total === 1 ? '' : 's'} pending
      </p>
      <p className="mt-1 text-xs text-white/45">Apply responses from client portal reviews.</p>
      <div className="mt-4 flex flex-col gap-2">
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
  );
}
