export function TeamTaskClientLabel({ client, color }) {
  if (!client) return null;

  return (
    <span className="tesla-task-card-client" style={{ color }}>
      {client}
    </span>
  );
}

/** Ignore clicks on interactive controls so row-open doesn't steal button/select actions. */
export function openFromTaskCard(event, open) {
  if (!open || event.target.closest('button, a, input, select, textarea, label')) return;
  open();
}

export default function TeamTaskCard({
  accentColor,
  completed = false,
  className = '',
  animationDelay,
  onOpen,
  children,
}) {
  const clickable = typeof onOpen === 'function';

  const handleKeyDown = (event) => {
    if (!clickable) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    onOpen();
  };

  return (
    <article
      className={`tesla-task-card ${completed ? 'opacity-60' : ''} ${
        clickable ? 'cursor-pointer transition hover:bg-white/[0.03]' : ''
      } ${className}`.trim()}
      style={{
        '--task-accent-color': accentColor,
        ...(animationDelay != null ? { animationDelay } : {}),
      }}
      onClick={clickable ? (event) => openFromTaskCard(event, onOpen) : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="tesla-task-card-body">{children}</div>
    </article>
  );
}
