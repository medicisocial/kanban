export const COLUMNS = [
  { id: 'shoot', title: 'To Create' },
  { id: 'editing', title: 'Editing' },
  { id: 'in-review', title: 'In Review' },
  { id: 'not-approved', title: 'Not Approved' },
  { id: 'approved', title: 'Approved' },
  { id: 'scheduled', title: 'Scheduled' },
  { id: 'finished', title: 'Finished' },
];

/** Visual groupings for the pipeline board (column ids unchanged). */
export const BOARD_COLUMN_GROUPS = [
  { id: 'create', label: 'Create', columnIds: ['shoot'] },
  { id: 'edit', label: 'Edit', columnIds: ['editing'] },
  { id: 'review', label: 'Review', columnIds: ['in-review', 'not-approved'] },
  { id: 'publish', label: 'Publish', columnIds: ['approved', 'scheduled'] },
  { id: 'archive', label: 'Archive', columnIds: ['finished'], collapsible: true },
];

export const DEFAULT_CLIENTS = [
  'Plume',
  'The Locker Room',
  'Arco Fit',
  'Ara Med Spa',
  'Fulshear Regional',
  'Medici Social',
];

/** @deprecated Use useClientsContext().clients */
export const CLIENTS = DEFAULT_CLIENTS;

export const DEFAULT_CLIENT_COLORS = {
  'Plume': '#22c55e',
  'The Locker Room': '#f59e0b',
  'Arco Fit': '#3b82f6',
  'Ara Med Spa': '#ec4899',
  'Fulshear Regional': '#ef4444',
  'Medici Social': '#810100',
};

/** @deprecated Use useClientsContext().clientColors */
export const CLIENT_COLORS = DEFAULT_CLIENT_COLORS;

export const CLIENT_COLOR_PALETTE = [
  '#22c55e',
  '#f59e0b',
  '#3b82f6',
  '#ec4899',
  '#ef4444',
  '#810100',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
];

export const CLIENTS_STORAGE_KEY = 'medici-social-clients';

export const INTERNAL_TEAM_CLIENT = 'Medici Social';

export const CONTENT_TYPES = [
  'Reel',
  'Story',
  'Carousel',
  'Static Post',
  'One-off Project',
];

/** Feed posts that require an explicit plan/publish date on the content calendar. */
export const SCHEDULED_POST_CONTENT_TYPES = ['Reel', 'Carousel', 'Static Post'];

export function isScheduledPostType(contentType) {
  return SCHEDULED_POST_CONTENT_TYPES.includes(contentType);
}

export const DEFAULT_SHOOT_DURATIONS = {
  Reel: 45,
  Story: 20,
  Carousel: 60,
  'Static Post': 30,
};

export const CONTENT_TYPE_COLORS = {
  Reel: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', label: 'text-amber-300' },
  Story: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)', label: 'text-blue-300' },
  Carousel: { border: '#f472b6', bg: 'rgba(244, 114, 182, 0.14)', label: 'text-pink-300' },
  'Static Post': { border: '#810100', bg: 'rgba(129, 1, 0, 0.14)', label: 'text-[#fca5a5]' },
  'One-off Project': { border: '#a78bfa', bg: 'rgba(167, 139, 250, 0.14)', label: 'text-violet-300' },
  Shoot: { border: '#810100', bg: 'rgba(129, 1, 0, 0.18)', label: 'text-[#fca5a5]' },
};

export function getContentTypeStyle(contentType) {
  return CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS['Static Post'];
}

export function needsShootSchedule(contentType) {
  return contentType !== 'Story' && contentType !== 'One-off Project';
}

export function isOneOffProjectCard(card) {
  return Boolean(card?.isOneOffProject) || card?.contentType === 'One-off Project';
}

/** Keep one-off due dates and shoot schedule fields aligned. */
export function syncOneOffScheduleFields(updates, card = {}) {
  const merged = { ...card, ...updates };
  if (!isOneOffProjectCard(merged)) return updates;

  const next = { ...updates };
  if (next.shootDate !== undefined) next.dueDate = next.shootDate;
  if (next.shootTime !== undefined) next.dueTime = next.shootTime;
  if (next.dueDate !== undefined && next.shootDate === undefined) next.shootDate = next.dueDate;
  if (next.dueTime !== undefined && next.shootTime === undefined) next.shootTime = next.dueTime;
  if (next.isOneOffProject === undefined && merged.contentType === 'One-off Project') {
    next.isOneOffProject = true;
  }
  return next;
}

export const PLATFORM = 'Instagram';
export const PLATFORM_ICON = '📸';

export const DEFAULT_EDITOR = 'Jordan Nguyen';
export const DEFAULT_ACCOUNT_MANAGER = 'Valerie Landeros';

/** @deprecated Use team members from context / storage */
export const TEAM_MEMBERS = [DEFAULT_EDITOR];

/** @deprecated Use team members from context / storage */
export const ACCOUNT_MANAGERS = [DEFAULT_ACCOUNT_MANAGER];

/** @deprecated Use team members from context / storage */
export const COMPANY_STAFF = [DEFAULT_EDITOR, DEFAULT_ACCOUNT_MANAGER];

export const TEAM_OPERATIONAL_ROLES = ['Account Manager', 'Editor', 'Content Creator'];
export const TEAM_LEADERSHIP_ROLES = ['Owner', 'Creative Director'];
export const TEAM_ROLES = [...TEAM_LEADERSHIP_ROLES, ...TEAM_OPERATIONAL_ROLES];

/** Leadership roles implicitly include all operational roles for assignments. */
export const TEAM_ROLE_COVERAGE = {
  Owner: TEAM_OPERATIONAL_ROLES,
  'Creative Director': TEAM_OPERATIONAL_ROLES,
};

export const TEAM_ROLE_DESCRIPTIONS = {
  Owner: 'Leadership — covers all operational roles in assignment dropdowns.',
  'Creative Director': 'Leadership — covers all operational roles in assignment dropdowns.',
  'Account Manager': 'Client assignments and account manager task queues.',
  Editor: 'Post-production — receives raw assets after the content creator hands off.',
  'Content Creator':
    'Creates content — reels, carousels, photos, and videos — on To Create cards and shoot days.',
};

export const DEFAULT_TEAM_MEMBERS = [
  { id: 'team-jordan-nguyen', name: DEFAULT_EDITOR, roles: ['Editor'] },
  { id: 'team-valerie-landeros', name: DEFAULT_ACCOUNT_MANAGER, roles: ['Account Manager'] },
];

export const TEAM_STORAGE_KEY = 'medici-social-team';

export const COLUMN_BG = {
  shoot: 'bg-[#111111]',
  editing: 'bg-[#121212]',
  'in-review': 'bg-[#141414]',
  'not-approved': 'bg-[#1a1212]',
  approved: 'bg-[#161616]',
  scheduled: 'bg-[#181818]',
  finished: 'bg-[#131318]',
};

export const DEFAULT_CLIENT_ACCOUNT_MANAGERS = {
  Plume: DEFAULT_ACCOUNT_MANAGER,
  'The Locker Room': DEFAULT_ACCOUNT_MANAGER,
  'Arco Fit': DEFAULT_ACCOUNT_MANAGER,
  'Ara Med Spa': DEFAULT_ACCOUNT_MANAGER,
  'Fulshear Regional': DEFAULT_ACCOUNT_MANAGER,
  'Medici Social': DEFAULT_ACCOUNT_MANAGER,
};

export const STORAGE_KEY = 'medici-social-kanban';
export const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';
export const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';
export const SHOOT_PLANS_STORAGE_KEY = 'medici-social-shoot-plans';
export const EDITOR_TODO_STORAGE_KEY = 'medici-social-editor-todo';
export const EDITOR_TODO_ORDER_KEY = 'medici-social-editor-todo-order';
export const AM_TODO_ORDER_KEY = 'medici-social-am-todo-order';
export const ADMIN_TASKS_STORAGE_KEY = 'medici-social-admin-tasks';
export const EVENTS_STORAGE_KEY = 'medici-social-events';
export const MEETINGS_STORAGE_KEY = 'medici-social-meetings';
export const CLIENT_PORTAL_AUTH_STORAGE_KEY = 'medici-client-portal-auth';
export const CLIENT_PORTAL_PASSWORD_VAULT_KEY = 'medici-client-portal-password-vault';

export const IDEA_STATUSES = {
  pending: 'Pending Review',
  approved: 'Approved',
  declined: 'Declined',
};

export function createEvent(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    client: DEFAULT_CLIENTS[0],
    title: '',
    date: '',
    time: '',
    endTime: '',
    estimatedCovers: '',
    status: 'submitted',
    businessType: '',
    fields: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function createMeeting(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    date: '',
    time: '',
    endTime: '',
    client: '',
    prospectName: '',
    location: '',
    videoLink: '',
    notes: '',
    recurrence: 'none',
    recurrenceEndDate: '',
    occurrenceOverrides: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export const MEETING_RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export function createCard(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    client: DEFAULT_CLIENTS[0],
    contentType: 'Reel',
    platform: PLATFORM,
    title: '',
    dueDate: '',
    dueTime: '',
    assignedTo: DEFAULT_EDITOR,
    contentCreator: '',
    accountManager: '',
    notes: '',
    referenceMusic: '',
    referenceVideo: '',
    dropboxLink: '',
    shootDate: '',
    shootTime: '',
    shootEndTime: '',
    shootDuration: 45,
    shootModels: '',
    shootNeeds: '',
    shootScript: '',
    storyRecurrenceDays: [],
    storyEndDate: '',
    storyOccurrenceNotes: {},
    storyPostedDates: [],
    postedAt: null,
    clientComment: '',
    isOneOffProject: false,
    status: 'To Create',
    columnId: 'shoot',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function getSampleData() {
  return [
    createCard({
      client: 'Plume',
      contentType: 'Reel',
      title: 'Spring collection launch teaser',
      dueDate: '2026-05-28',
      assignedTo: DEFAULT_EDITOR,
      priority: 'High',
      notes: 'Focus on the new pastel palette. Hook: "Your spring glow starts here."',
      status: 'To Create',
      columnId: 'shoot',
    }),
    createCard({
      client: 'The Locker Room',
      contentType: 'Carousel',
      title: 'Game day hype — 5 slide carousel',
      dueDate: '2026-05-25',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Urgent',
      notes: 'Include player stats from last week. CTA: shop new jerseys.',
      status: 'To Create',
      columnId: 'shoot',
    }),
    createCard({
      client: 'Ara Med Spa',
      contentType: 'Story',
      title: "Mother's Day promo story series",
      dueDate: '2026-05-30',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Medium',
      notes: '3-part story: offer reveal, treatment showcase, booking link.',
      status: 'To Create',
      columnId: 'shoot',
    }),
    createCard({
      client: 'Arco Fit',
      contentType: 'Reel',
      title: '30-day challenge kickoff video',
      dueDate: '2026-05-27',
      assignedTo: DEFAULT_EDITOR,
      priority: 'High',
      notes: 'Trending audio TBD. Show before/after transformations from last cohort.',
      shootDate: '2026-05-22',
      status: 'Editing',
      columnId: 'editing',
    }),
    createCard({
      client: 'Plume',
      contentType: 'Static Post',
      title: 'Brand sustainability report highlight',
      dueDate: '2026-05-26',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Low',
      notes: 'Pull key stats from the 2025 report. Professional tone for B2B audience.',
      status: 'Editing',
      columnId: 'editing',
    }),
    createCard({
      client: 'The Locker Room',
      contentType: 'Reel',
      title: 'Behind the scenes — warehouse restock',
      dueDate: '2026-05-24',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Medium',
      notes: 'Raw, authentic vibe. No heavy editing.',
      shootDate: '2026-05-22',
      status: 'Editing',
      columnId: 'editing',
    }),
    createCard({
      client: 'Ara Med Spa',
      contentType: 'Reel',
      title: 'Hydrafacial treatment walkthrough',
      dueDate: '2026-05-23',
      assignedTo: DEFAULT_EDITOR,
      priority: 'High',
      notes: 'Draft v2 ready for client sign-off.',
      shootDate: '2026-05-22',
      dropboxLink: 'https://www.dropbox.com/s/example-hydrafacial',
      status: 'In Review',
      columnId: 'in-review',
    }),
    createCard({
      client: 'Arco Fit',
      contentType: 'Carousel',
      title: 'Nutrition tips — macro breakdown',
      dueDate: '2026-05-22',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Medium',
      notes: 'Dietitian reviewed copy. Waiting on client approval for slide 4 layout.',
      dropboxLink: 'https://www.dropbox.com/s/example-nutrition-carousel',
      status: 'In Review',
      columnId: 'in-review',
    }),
    createCard({
      client: 'Plume',
      contentType: 'Story',
      title: 'Customer unboxing UGC repost',
      dueDate: '2026-05-21',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Low',
      notes: 'Got permission from @stylebyjade. Branded sticker overlay applied.',
      dropboxLink: 'https://www.dropbox.com/s/example-unboxing-story',
      status: 'In Review',
      columnId: 'in-review',
    }),
    createCard({
      client: 'The Locker Room',
      contentType: 'Static Post',
      title: 'Weekend sale announcement',
      dueDate: '2026-05-24',
      dueTime: '09:00',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Urgent',
      notes: 'Scheduled for Saturday 9 AM EST. 20% off sitewide.',
      status: 'Scheduled',
      columnId: 'scheduled',
    }),
    createCard({
      client: 'Arco Fit',
      contentType: 'Reel',
      title: 'Trainer spotlight — Coach Mike',
      dueDate: '2026-05-23',
      dueTime: '07:00',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Medium',
      notes: 'Auto-publish Monday 7 AM. Cross-post to Stories.',
      status: 'Scheduled',
      columnId: 'scheduled',
    }),
    createCard({
      client: 'Ara Med Spa',
      contentType: 'Carousel',
      title: 'Skincare routine — AM vs PM',
      dueDate: '2026-05-22',
      dueTime: '11:00',
      assignedTo: DEFAULT_EDITOR,
      priority: 'Low',
      notes: 'Queued in Later for Wednesday 11 AM.',
      status: 'Scheduled',
      columnId: 'scheduled',
    }),
  ];
}
