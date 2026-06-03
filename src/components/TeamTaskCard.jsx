export function TeamTaskClientLabel({ client, color }) {
  if (!client) return null;

  return (
    <span className="tesla-task-card-client" style={{ color }}>
      {client}
    </span>
  );
}

export default function TeamTaskCard({
  accentColor,
  completed = false,
  className = '',
  animationDelay,
  children,
}) {
  return (
    <article
      className={`tesla-task-card ${completed ? 'opacity-60' : ''} ${className}`.trim()}
      style={{
        '--task-accent-color': accentColor,
        ...(animationDelay != null ? { animationDelay } : {}),
      }}
    >
      <div className="tesla-task-card-body">{children}</div>
    </article>
  );
}
