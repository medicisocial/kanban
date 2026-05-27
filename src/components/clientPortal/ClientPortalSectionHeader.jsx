export default function ClientPortalSectionHeader({
  title,
  description,
  action,
  actionLabel,
  onAction,
  children,
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">{description}</p>
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
