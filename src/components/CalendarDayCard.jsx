import CardTitleLink from './CardTitleLink';
import CalendarDropboxLink from './CalendarDropboxLink';
import { accentCardStyle } from '../utils/contentTypeColors';

function withoutLeftAccentLine(style) {
  if (!style) return style;
  const { boxShadow, ...rest } = style;
  return rest;
}

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
  relaxed = false,
  clientPortal = false,
}) {
  const handleClick = (event) => {
    event.stopPropagation();
    onClick?.(event);
  };

  const shellClass = clientPortal
    ? 'group/event relative mb-1.5 w-full cursor-pointer rounded-lg border border-white/10 px-2.5 py-2 text-left leading-snug transition hover:brightness-110'
    : relaxed
      ? 'group/event relative mb-1.5 w-full cursor-pointer rounded-xl border border-white/8 px-3 py-2.5 text-left leading-snug transition hover:brightness-110'
      : dense
        ? 'group/event relative mb-1 w-full cursor-pointer rounded-lg border border-white/8 px-2 py-1.5 text-left leading-snug transition hover:brightness-110'
        : 'group/event relative mb-1 w-full cursor-pointer rounded-lg border border-white/8 px-1.5 py-1 text-left transition hover:brightness-110';

  const clientMetaClass = relaxed ? 'text-xs' : 'text-[10px]';
  const clientTitleClass = relaxed ? 'text-[13px]' : 'text-[11px]';

  const clientPortalBody = clientPortal && (
    <>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {timeLabel && (
            <p className={`font-semibold tabular-nums text-white/70 ${clientMetaClass}`}>{timeLabel}</p>
          )}
          {badgeLabel && (
            <p className={`mt-0.5 font-semibold ${badgeClassName} ${clientMetaClass}`.trim()}>{badgeLabel}</p>
          )}
        </div>
        {typeLabel && typeLabelProps && (
          <span
            className={`shrink-0 uppercase tracking-wide ${clientMetaClass} ${typeLabelProps.className || ''}`.trim()}
            style={typeLabelProps.style}
          >
            {typeLabel}
          </span>
        )}
      </div>
      <p className={`whitespace-normal font-medium leading-snug text-[#f9f6f2] ${clientTitleClass}`}>{title}</p>
      <CalendarDropboxLink href={titleLink} size={relaxed ? 'md' : 'sm'} />
    </>
  );

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

  const categoryRow = (dense || relaxed) && (badgeLabel || (typeLabel && typeLabelProps)) && (
    <div className={`flex items-center justify-between gap-1.5 ${relaxed ? 'mb-1.5' : 'mb-1'}`}>
      {badgeLabel ? (
        <span
          className={`min-w-0 truncate font-semibold ${relaxed ? 'text-[11px]' : 'text-[10px]'} ${badgeClassName}`.trim()}
        >
          {badgeLabel}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      {typeLabel && typeLabelProps && (
        <span
          className={`shrink-0 font-semibold uppercase tracking-wide ${
            relaxed ? 'text-[11px]' : 'text-[10px]'
          } ${typeLabelProps.className || ''}`.trim()}
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
        ...withoutLeftAccentLine(surfaceStyle || accentCardStyle(accentColor)),
        opacity,
      }}
      title={titleAttr}
    >
      {clientPortal ? (
        clientPortalBody
      ) : dense || relaxed ? (
        <>
          {((!hideClient && clientLabel) || timeLabel) && (
            <div className={`flex items-center justify-between gap-1.5 ${relaxed ? 'mb-1.5' : 'mb-1'}`}>
              {!hideClient && clientLabel && (
                <span
                  className={`min-w-0 truncate font-semibold uppercase tracking-wide ${
                    relaxed ? 'text-xs' : 'text-[10px]'
                  }`}
                  style={{ color: accentColor }}
                >
                  {clientLabel}
                </span>
              )}
              {timeLabel && (
                <span className={`shrink-0 font-medium text-gray-400 ${relaxed ? 'text-xs' : 'text-[10px]'}`}>
                  {timeLabel}
                </span>
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
