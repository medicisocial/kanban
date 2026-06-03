import CardTitleLink from './CardTitleLink';
import { accentCardStyle } from '../utils/contentTypeColors';

export default function CalendarDayCard({
  accentColor = '#810100',
  surfaceStyle,
  clientLabel,
  hideClient = false,
  timeLabel,
  badgeLabel,
  badgeClassName = 'text-[9px] font-semibold text-gray-300',
  typeLabel,
  typeLabelProps,
  typePill,
  typePillProps,
  title,
  titleLink,
  titleClassName = 'block truncate text-[10px] font-medium text-[#f9f6f2]',
  onClick,
  titleAttr,
  opacity = 1,
  className = '',
  dragProps = {},
  dense = false,
}) {
  const handleClick = (event) => {
    event.stopPropagation();
    onClick?.(event);
  };

  const shellClass = dense
    ? 'group/event relative mb-1 w-full cursor-pointer rounded-lg border border-white/8 px-2 py-1.5 text-left leading-snug transition hover:brightness-110'
    : 'group/event relative mb-1 w-full cursor-pointer rounded-lg border border-white/8 px-1.5 py-1 text-left transition hover:brightness-110';

  const metaRow = !dense && (badgeLabel || (typePill && typePillProps)) && (
    <div className="mb-1 flex flex-wrap items-center gap-1.5">
      {badgeLabel && (
        <span className={`truncate text-[11px] ${badgeClassName}`.trim()}>{badgeLabel}</span>
      )}
      {typePill && typePillProps && (
        <span className={typePillProps.className} style={typePillProps.style}>
          {typePill}
        </span>
      )}
    </div>
  );

  const categoryRow = dense && (badgeLabel || (typeLabel && typeLabelProps)) && (
    <div className="mb-1 flex items-center justify-between gap-1.5">
      {badgeLabel ? (
        <span className={`min-w-0 truncate text-[10px] font-semibold ${badgeClassName}`.trim()}>
          {badgeLabel}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      {typeLabel && typeLabelProps && (
        <span
          className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${typeLabelProps.className || ''}`.trim()}
          style={typeLabelProps.style}
        >
          {typeLabel}
        </span>
      )}
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      {...dragProps}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.(event);
        }
      }}
      className={`${shellClass} ${className}`.trim()}
      style={{
        ...(surfaceStyle || accentCardStyle(accentColor)),
        opacity,
      }}
      title={titleAttr}
    >
      {dense ? (
        <>
          {((!hideClient && clientLabel) || timeLabel) && (
            <div className="mb-1 flex items-center justify-between gap-1.5">
              {!hideClient && clientLabel && (
                <span
                  className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: accentColor }}
                >
                  {clientLabel}
                </span>
              )}
              {timeLabel && (
                <span className="shrink-0 text-[10px] font-medium text-gray-400">{timeLabel}</span>
              )}
            </div>
          )}
          {categoryRow}
          {titleLink ? (
            <CardTitleLink title={title} dropboxLink={titleLink} className={titleClassName} />
          ) : (
            <span className={titleClassName}>{title}</span>
          )}
        </>
      ) : (
        <>
          {!hideClient && clientLabel && (
            <span
              className="mb-0.5 block truncate text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: accentColor }}
            >
              {clientLabel}
            </span>
          )}
          {timeLabel && (
            <span className="mb-0.5 block text-[9px] font-medium text-gray-400">{timeLabel}</span>
          )}
          {metaRow}
          {titleLink ? (
            <CardTitleLink title={title} dropboxLink={titleLink} className={titleClassName} />
          ) : (
            <span className={titleClassName}>{title}</span>
          )}
        </>
      )}
    </div>
  );
}
