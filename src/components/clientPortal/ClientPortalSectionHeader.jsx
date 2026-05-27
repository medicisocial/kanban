export default function ClientPortalSectionHeader({
  title,
  description,
  action,
  actionLabel,
  onAction,
  children,
}) {
  return (
    <div className="portal-section-header mb-8 flex flex-col gap-4 border-b border-white/[0.06] pb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45 md:text-[15px]">{description}</p>
        )}
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
        {children}
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className={action}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
