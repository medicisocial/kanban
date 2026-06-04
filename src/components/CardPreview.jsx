import {
  PLATFORM_ICON,
  getContentTypeStyle,
} from '../constants';
import { contentTypePipelinePillProps, contentTypeCardStyle } from '../utils/contentTypeColors';
import { formatScheduledDateTime } from '../utils';

export default function CardPreview({ card }) {
  const typeStyle = getContentTypeStyle(card.contentType);

  return (
    <div
      className="w-[280px] rounded-xl border border-white/8 p-3 shadow-xl shadow-black/40 sm:w-[300px]"
      style={contentTypeCardStyle(typeStyle)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-gray-400">{card.client}</span>
      </div>
      <p className="mb-2 line-clamp-2 text-sm font-medium text-white">{card.title}</p>
      <div className="flex items-center gap-2 text-xs">
        <span {...contentTypePipelinePillProps(typeStyle)}>
          {PLATFORM_ICON} {card.contentType}
        </span>
        {card.dueDate && (
          <span className="text-gray-400">{formatScheduledDateTime(card.dueDate, card.dueTime)}</span>
        )}
      </div>
    </div>
  );
}
