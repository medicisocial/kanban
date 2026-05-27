export function buildAppleMapsUrl(location) {
  const trimmed = (location || "").trim();
  if (!trimmed) return "";

  if (/^https?:\/\/maps\.apple\.com\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^maps:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const [, lat, lng] = coordMatch;
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}`;
  }

  return `https://maps.apple.com/?q=${encodeURIComponent(trimmed)}`;
}
