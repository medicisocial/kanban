const WORKSPACE_VIEWS = new Set([
  'home',
  'ideas',
  'board',
  'shoot',
  'todo',
  'calendars',
  'deliverables',
  'metrics',
  'clients',
  'team',
  'finances',
  'settings',
  'client-files',
]);

const VIEW_TABS = {
  calendars: new Set(['content', 'events', 'meetings']),
  todo: new Set(['creator', 'editor', 'account', 'admin']),
  clients: new Set(['profile', 'files', 'contacts', 'social', 'share', 'users']),
};

const VIEW_TAB_DEFAULTS = {
  calendars: 'content',
  todo: 'creator',
  clients: 'profile',
};

export function readWorkspaceViewFromUrl() {
  if (typeof window === 'undefined') return null;
  const view = new URLSearchParams(window.location.search).get('view');
  return WORKSPACE_VIEWS.has(view) ? view : null;
}

export function readViewTabFromUrl(view) {
  if (typeof window === 'undefined' || !view || !VIEW_TABS[view]) return null;
  const tab = new URLSearchParams(window.location.search).get('tab');
  return VIEW_TABS[view].has(tab) ? tab : null;
}

function tabForUrl(view, tab) {
  if (!view || !VIEW_TABS[view]) return null;
  const defaultTab = VIEW_TAB_DEFAULTS[view];
  if (!tab || tab === defaultTab) return null;
  return VIEW_TABS[view].has(tab) ? tab : null;
}

/** Keep the current workspace view (and sub-tab) in the URL so refresh restores it. */
export function syncWorkspaceViewUrl(view, { tab } = {}) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);

  if (view && view !== 'home') {
    params.set('view', view);
  } else {
    params.delete('view');
  }

  const tabToWrite = tabForUrl(view, tab);
  if (tabToWrite) {
    params.set('tab', tabToWrite);
  } else {
    params.delete('tab');
  }

  const qs = params.toString();
  const next = qs
    ? `${window.location.pathname}?${qs}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;

  window.history.replaceState({}, '', next);
}

/** @deprecated use readViewTabFromUrl('calendars') */
export function readCalendarsTabFromUrl() {
  return readViewTabFromUrl('calendars');
}
