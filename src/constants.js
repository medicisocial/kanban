export const COLUMNS = [
  { id: 'shoot', title: 'To Shoot' },
  { id: 'editing', title: 'Editing' },
  { id: 'in-review', title: 'In Review' },
  { id: 'not-approved', title: 'Not Approved' },
  { id: 'approved', title: 'Approved' },
  { id: 'scheduled', title: 'Scheduled' },
  { id: 'posted', title: 'Posted' },
];

export const DEFAULT_CLIENTS = [
  'Plume',
  'The Locker Room',
  'Arco Fit',
  'Ara Med Spa',
  'Fulshear Regional',
];

/** @deprecated Use useClientsContext().clients */
export const CLIENTS = DEFAULT_CLIENTS;

export const DEFAULT_CLIENT_COLORS = {
  'Plume': '#22c55e',
  'The Locker Room': '#f59e0b',
  'Arco Fit': '#3b82f6',
  'Ara Med Spa': '#ec4899',
  'Fulshear Regional': '#ef4444',
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

export const CONTENT_TYPES = [
  'Reel',
  'Story',
  'Carousel',
  'Static Post',
];

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
};

export function getContentTypeStyle(contentType) {
  return CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS['Static Post'];
}

export function needsShootSchedule(contentType) {
  return contentType !== 'Story';
}

export const PLATFORM = 'Instagram';
export const PLATFORM_ICON = '📸';

export const DEFAULT_EDITOR = 'Jordan Nguyen';
export const DEFAULT_ACCOUNT_MANAGER = 'Valerie Landeros';

export const TEAM_MEMBERS = [DEFAULT_EDITOR];

export const ACCOUNT_MANAGERS = [DEFAULT_ACCOUNT_MANAGER];

export const COMPANY_STAFF = [DEFAULT_EDITOR, DEFAULT_ACCOUNT_MANAGER];

export const COLUMN_BG = {
  shoot: 'bg-[#111111]',
  editing: 'bg-[#121212]',
  'in-review': 'bg-[#141414]',
  'not-approved': 'bg-[#1a1212]',
  approved: 'bg-[#161616]',
  scheduled: 'bg-[#181818]',
  posted: 'bg-[#141414]',
};

export const DEFAULT_CLIENT_ACCOUNT_MANAGERS = {
  Plume: DEFAULT_ACCOUNT_MANAGER,
  'The Locker Room': DEFAULT_ACCOUNT_MANAGER,
  'Arco Fit': DEFAULT_ACCOUNT_MANAGER,
  'Ara Med Spa': DEFAULT_ACCOUNT_MANAGER,
  'Fulshear Regional': DEFAULT_ACCOUNT_MANAGER,
};

export const STORAGE_KEY = 'medici-social-kanban';
export const VIDEO_IDEAS_STORAGE_KEY = 'medici-social-video-ideas';
export const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';
export const SHOOT_PLANS_STORAGE_KEY = 'medici-social-shoot-plans';
export const EDITOR_TODO_STORAGE_KEY = 'medici-social-editor-todo';
export const EDITOR_TODO_ORDER_KEY = 'medici-social-editor-todo-order';
export const ADMIN_TASKS_STORAGE_KEY = 'medici-social-admin-tasks';

export const IDEA_STATUSES = {
  pending: 'Pending Review',
  approved: 'Approved',
  declined: 'Declined',
};

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
    accountManager: '',
    notes: '',
    referenceMusic: '',
    referenceVideo: '',
    dropboxLink: '',
    shootDate: '',
    shootTime: '',
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
    status: 'To Shoot',
    columnId: 'shoot',
    createdAt: Date.now(),
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
      status: 'To Shoot',
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
      status: 'To Shoot',
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
      status: 'To Shoot',
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
