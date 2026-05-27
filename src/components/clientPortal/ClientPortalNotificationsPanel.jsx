import { buildClientPortalTasks } from '../../utils/clientPortalTasks';

export default function ClientPortalNotificationsPanel({
  brand,
  ideas = [],
  cards = [],
  contacts = [],
  socialLogins = {},
  clientLogo,
  clientColor = '#810100',
  onNavigate,
  onClose,
}) {
  const summary = buildClientPortalTasks({
    brand,
    ideas,
    cards,
    contacts,
    socialLogins,
    clientLogo,
  });

  const items = [
    ...summary.actionItems.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      meta: item.meta,
      tab: item.tab,
    })),
    ...summary.setupTasks.map((task) => ({
      id: task.id,
      title: task.label,
      detail: task.detail,
      meta: 'Setup',
      tab: task.tab,
    })),
  ];

  if (items.length === 0) {
    return (
      <div className="px-4 py-5">
        <p className="text-sm text-white/50">You&apos;re all caught up.</p>
        <p className="mt-1 text-xs text-white/35">No ideas, reviews, or profile items need attention.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="border-b border-white/[0.06] px-4 py-3 text-xs font-medium tracking-tight text-white/55">
        {items.length} open item{items.length === 1 ? '' : 's'}
      </p>
      <ul className="divide-y divide-white/[0.06]">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                onNavigate?.(item.tab);
                onClose?.();
              }}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-300 hover:bg-white/[0.04]"
            >
              <span
                className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: `${clientColor}22`,
                  color: clientColor,
                }}
              >
                {item.meta}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-white/90">{item.title}</span>
                <span className="mt-0.5 block text-xs text-white/45">{item.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
