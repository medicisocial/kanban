import { btnPrimaryClass, btnSecondaryClass } from './clientPortal/clientPortalUi';

export default function ClientSyncBanner({
  ideaCount,
  contentReviewCount,
  shootCount,
  onApplyIdeas,
  onApplyContentReview,
  onApplyShoot,
  embedded = false,
}) {
  const total = ideaCount + contentReviewCount + shootCount;
  if (!total) return null;

  if (embedded) {
    return (
      <div className="shrink-0 border-b border-amber-500/15 bg-amber-500/[0.06] px-4 py-3 backdrop-blur-sm md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-200/90">
            {total} client update{total === 1 ? '' : 's'} pending sync
          </p>
          <div className="flex flex-wrap gap-2">
            {ideaCount > 0 && (
              <button type="button" onClick={onApplyIdeas} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
                Apply {ideaCount} idea{ideaCount === 1 ? '' : 's'}
              </button>
            )}
            {contentReviewCount > 0 && (
              <button type="button" onClick={onApplyContentReview} className={`${btnPrimaryClass} py-1.5 text-[10px]`}>
                Apply {contentReviewCount} review{contentReviewCount === 1 ? '' : 's'}
              </button>
            )}
            {shootCount > 0 && (
              <button type="button" onClick={onApplyShoot} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
                Apply {shootCount} shoot{shootCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <p className="text-sm font-medium text-amber-100">
          {total} client update{total === 1 ? '' : 's'} waiting to sync
        </p>

        <div className="flex flex-wrap gap-2">
          {ideaCount > 0 && (
            <button
              type="button"
              onClick={onApplyIdeas}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
            >
              Apply {ideaCount} idea response{ideaCount === 1 ? '' : 's'}
            </button>
          )}
          {contentReviewCount > 0 && (
            <button
              type="button"
              onClick={onApplyContentReview}
              className="rounded-lg bg-[#810100] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#a00000]"
            >
              Apply {contentReviewCount} content review{contentReviewCount === 1 ? '' : 's'}
            </button>
          )}
          {shootCount > 0 && (
            <button
              type="button"
              onClick={onApplyShoot}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Apply {shootCount} shoot schedule{shootCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
