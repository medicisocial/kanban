import { getLogoSrc } from '../utils/clientLogo';
import { btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ClientPortalHealthChecklist({
  client,
  getClientUsers,
  getClientContacts,
  getClientSocialLogins,
  getClientBusinessType,
  getClientLogo,
  onGoToTab,
}) {
  const users = getClientUsers(client) || [];
  const contacts = getClientContacts(client) || [];
  const social = getClientSocialLogins(client) || {};
  const businessType = getClientBusinessType(client);
  const logo = getClientLogo(client);

  const hasSocial = Object.values(social).some((value) => String(value || '').trim());

  const checks = [
    {
      id: 'users',
      label: 'Portal login (email)',
      ok: users.length > 0,
      hint: 'Add a work email and password under Portal users.',
      tab: 'users',
    },
    {
      id: 'contacts',
      label: 'Primary contact',
      ok: contacts.some((entry) => entry.name?.trim()),
      hint: 'Add a named contact.',
      tab: 'contacts',
    },
    {
      id: 'social',
      label: 'Social login',
      ok: hasSocial,
      hint: 'Add platform credentials.',
      tab: 'social',
    },
    {
      id: 'business',
      label: 'Business type',
      ok: !!businessType,
      hint: 'Set on Profile for event forms.',
      tab: 'profile',
    },
    {
      id: 'logo',
      label: 'Brand photo',
      ok: !!getLogoSrc(logo),
      hint: 'Upload a profile photo.',
      tab: 'profile',
    },
  ];

  const complete = checks.filter((check) => check.ok).length;
  const allGood = complete === checks.length;

  return (
    <div className={`${surfacePanelClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            Portal readiness
          </p>
          <p className="mt-1 text-sm text-white/70">
            {allGood
              ? `${client} is ready for portal access.`
              : `${complete} of ${checks.length} setup items complete.`}
          </p>
        </div>
        {!allGood && onGoToTab && (
          <button
            type="button"
            onClick={() => onGoToTab(checks.find((check) => !check.ok)?.tab || 'profile')}
            className={`${btnSecondaryClass} py-1.5 text-[10px]`}
          >
            Fix next item
          </button>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold ${
                check.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'
              }`}
              aria-hidden
            >
              {check.ok ? '✓' : '·'}
            </span>
            <div className="min-w-0">
              <p className={check.ok ? 'text-white/75' : 'text-white/55'}>{check.label}</p>
              {!check.ok && <p className="text-xs text-white/35">{check.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
