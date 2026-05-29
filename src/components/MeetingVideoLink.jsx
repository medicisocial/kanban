import {
  getMeetingLinkLabel,
  getMeetingLinkShortLabel,
  getMeetingVideoLink,
  isHttpUrl,
} from '../utils/meetingLinks';

export default function MeetingVideoLink({
  meeting,
  url: urlProp,
  className = '',
  linkClassName = 'text-violet-300 underline-offset-2 hover:underline',
  compact = false,
}) {
  const url = urlProp || getMeetingVideoLink(meeting);
  const trimmed = String(url || '').trim();
  if (!trimmed || !isHttpUrl(trimmed)) return null;

  const label = compact
    ? getMeetingLinkShortLabel(trimmed) || 'Join'
    : getMeetingLinkLabel(trimmed) || 'Join meeting';

  return (
    <a
      href={trimmed}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClassName} ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </a>
  );
}
