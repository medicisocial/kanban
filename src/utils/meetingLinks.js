export function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function looksLikeMeetingUrl(value) {
  const lower = String(value || '').trim().toLowerCase();
  if (!lower) return false;
  return (
    lower.includes('zoom.us')
    || lower.includes('zoom.com')
    || lower.includes('meet.google.com')
    || lower.includes('google.com/meet')
    || lower.includes('teams.microsoft.com')
    || lower.includes('teams.live.com')
  );
}

export function normalizeMeetingUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (isHttpUrl(trimmed)) return trimmed;
  if (looksLikeMeetingUrl(trimmed) || /^[\w.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

/** Zoom, Google Meet, Teams, or any https link saved on the meeting. */
export function getMeetingVideoLink(meeting) {
  const video = normalizeMeetingUrl(meeting?.videoLink);
  if (video && isHttpUrl(video)) return video;

  const location = normalizeMeetingUrl(meeting?.location);
  if (isHttpUrl(location)) return location;

  return '';
}

export function getMeetingLinkProvider(url) {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('zoom.us') || value.includes('zoom.com')) return 'zoom';
  if (value.includes('meet.google.com') || value.includes('google.com/meet')) return 'meet';
  if (value.includes('teams.microsoft.com') || value.includes('teams.live.com')) return 'teams';
  if (isHttpUrl(value)) return 'link';
  return null;
}

export function getMeetingLinkLabel(url) {
  const provider = getMeetingLinkProvider(url);
  if (provider === 'zoom') return 'Join Zoom';
  if (provider === 'meet') return 'Join Google Meet';
  if (provider === 'teams') return 'Join Teams';
  if (provider === 'link') return 'Join meeting';
  return '';
}

export function getMeetingLinkShortLabel(url) {
  const provider = getMeetingLinkProvider(url);
  if (provider === 'zoom') return 'Zoom';
  if (provider === 'meet') return 'Google Meet';
  if (provider === 'teams') return 'Teams';
  if (provider === 'link') return 'Video link';
  return '';
}
