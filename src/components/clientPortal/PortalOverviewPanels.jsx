export function PortalPipelineMetric({ label, value, onClick }) {
  const className = `overview-pipeline-metric text-left${
    onClick ? ' overview-pipeline-metric-interactive' : ''
  }`;

  const inner = (
    <>
      <p className="overview-pipeline-metric-label">{label}</p>
      <p className="overview-pipeline-metric-value">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function PortalRoleSummary({ label, count, subtitle, onClick }) {
  const className = `overview-role-summary glass-surface${
    onClick ? ' overview-role-summary-interactive' : ''
  }`;

  const inner = (
    <>
      <h3 className="overview-role-summary-title">{label}</h3>
      <p className="overview-role-summary-count">
        <span className="overview-role-summary-count-value">{count}</span>
        <span className="overview-role-summary-count-label">
          {count === 1 ? 'item' : 'items'}
        </span>
      </p>
      {subtitle && <p className="overview-role-summary-subtitle">{subtitle}</p>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function PortalRolePanel({ label, children, wide = false, grid = false, quad = false }) {
  const bodyClass = quad
    ? 'overview-role-panel-body-quad'
    : grid
      ? 'overview-role-panel-body-grid'
      : 'overview-role-panel-body-single';

  return (
    <div className={`overview-role-panel glass-surface ${wide ? 'overview-role-panel-wide' : ''}`}>
      <div className="overview-role-panel-header">
        <h3 className="overview-role-title">{label}</h3>
      </div>
      <div className={`overview-role-panel-body ${bodyClass}`}>{children}</div>
    </div>
  );
}

export function PortalTaskSection({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`overview-role-panel glass-surface overflow-hidden ${className}`}>
      <div className="overview-role-panel-header overview-role-panel-header-row">
        <div className="min-w-0 flex-1">
          <h3 className="overview-role-title">{title}</h3>
          {subtitle && <p className="overview-role-subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="overview-role-panel-body overview-role-panel-body-list">{children}</div>
    </div>
  );
}
