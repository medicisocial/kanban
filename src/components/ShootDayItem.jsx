import {
  getContentTypeStyle,
  PLATFORM_ICON,
} from "../constants";
import { contentTypePillProps, contentTypeCardStyle } from "../utils/contentTypeColors";
import { formatTimeInput } from "../utils/shootDay";
import CardTitleLink from "./CardTitleLink";
import ReferenceVideoLink, { ReferenceMusicLink } from "./clientPortal/ReferenceVideoLink";

export default function ShootDayItem({ card, onClick }) {
  const typeStyle = getContentTypeStyle(card.contentType);

  return (
    <button
      type="button"
      onClick={() => onClick(card)}
      className="w-full rounded-lg border border-white/8 p-3 text-left transition hover:brightness-110"
      style={contentTypeCardStyle(typeStyle)}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {card.shootTime && (
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
            {card.shootEndTime
              ? `${formatTimeInput(card.shootTime)} – ${formatTimeInput(card.shootEndTime)}`
              : formatTimeInput(card.shootTime)}
          </span>
        )}
        <span {...contentTypePillProps(typeStyle, 'rounded-md px-2 py-0.5 text-[10px] font-semibold')}>
          {card.contentType}
        </span>
        <span className="text-[10px] text-gray-500">{card.status}</span>
      </div>

      <CardTitleLink
        title={card.title}
        dropboxLink={card.dropboxLink}
        className="mb-1 block text-sm font-semibold leading-snug text-white"
      />

      {card.notes && (
        <p className="mb-2 line-clamp-2 text-xs text-gray-400">{card.notes}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
        {card.contentCreator && <span>🎥 {card.contentCreator}</span>}
        {card.assignedTo && <span>{PLATFORM_ICON} {card.assignedTo}</span>}
        {card.referenceMusic && (
          <ReferenceMusicLink url={card.referenceMusic} compact />
        )}
        {card.referenceVideo && (
          <ReferenceVideoLink url={card.referenceVideo} compact />
        )}
        {card.dropboxLink && <span>📦 Dropbox</span>}
      </div>
    </button>
  );
}
