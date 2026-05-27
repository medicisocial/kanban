import { buildAppleMapsUrl } from "../utils/mapLinks";

export default function ShootLocationLink({
  location,
  className = "",
  linkClassName = "text-[#c88] underline-offset-2 hover:underline",
  showIcon = false,
}) {
  const trimmed = (location || "").trim();
  if (!trimmed) return null;

  const href = buildAppleMapsUrl(trimmed);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClassName} ${className}`.trim()}
      title="Open in Apple Maps"
    >
      {showIcon && (
        <svg
          className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )}
      {trimmed}
    </a>
  );
}
