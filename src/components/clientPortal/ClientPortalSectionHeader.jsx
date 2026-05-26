export default function ClientPortalSectionHeader({
  title,
  description,
  action,
  actionLabel,
  onAction,
  children,
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
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
