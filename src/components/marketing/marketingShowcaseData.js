/** Fictional demo clients — not real workspace brands. */
export const SHOWCASE_CLIENTS = [
  'Northline Co.',
  'Harbor Studio',
  'Summit Goods',
  'Bright Field',
  'Oak Lane',
];

export const SHOWCASE_CLIENT_COLORS = {
  'Northline Co.': '#22c55e',
  'Harbor Studio': '#3b82f6',
  'Summit Goods': '#f59e0b',
  'Bright Field': '#ec4899',
  'Oak Lane': '#6366f1',
};

export const SHOWCASE_BRAND = 'Northline Co.';
export const SHOWCASE_BRAND_COLOR = SHOWCASE_CLIENT_COLORS[SHOWCASE_BRAND];
export const SHOWCASE_BRAND_INITIAL = 'N';

export const SHOWCASE_STAFF_PROFILE = {
  name: 'Morgan Ellis',
  avatar: '/showcase-staff-avatar.svg',
};

export const SHOWCASE_WORKSPACE_LOGO = '/showcase-workspace-logo.svg';

export const MARKETING_SHOWCASE_CARDS = [
  {
    id: 'showcase-1',
    client: 'Northline Co.',
    title: 'Spring launch reel',
    contentType: 'Reel',
    columnId: 'shoot',
    shootDate: '2026-03-10',
  },
  {
    id: 'showcase-2',
    client: 'Harbor Studio',
    title: 'Product spotlight carousel',
    contentType: 'Carousel',
    columnId: 'shoot',
    shootDate: '2026-03-12',
  },
  {
    id: 'showcase-3',
    client: 'Bright Field',
    title: 'Studio walkthrough',
    contentType: 'Reel',
    columnId: 'editing',
    dueDate: '2026-03-14',
  },
  {
    id: 'showcase-4',
    client: 'Summit Goods',
    title: 'Weekend promo stories',
    contentType: 'Story',
    columnId: 'in-review',
    dueDate: '2026-03-15',
  },
  {
    id: 'showcase-5',
    client: 'Northline Co.',
    title: 'Behind the scenes reel',
    contentType: 'Reel',
    columnId: 'not-approved',
    clientComment: 'Tighten the opening hook before we schedule.',
  },
  {
    id: 'showcase-6',
    client: 'Oak Lane',
    title: 'Community spotlight',
    contentType: 'Static Post',
    columnId: 'approved',
    dueDate: '2026-03-18',
  },
  {
    id: 'showcase-7',
    client: 'Harbor Studio',
    title: 'Customer story reel',
    contentType: 'Reel',
    columnId: 'scheduled',
    dueDate: '2026-03-20',
    dueTime: '10:00',
  },
  {
    id: 'showcase-8',
    client: 'Bright Field',
    title: 'Before & after carousel',
    contentType: 'Carousel',
    columnId: 'finished',
    isOneOffProject: true,
    dueDate: '2026-02-28',
  },
];

export const MARKETING_SHOWCASE_IDEAS = [
  {
    id: 'idea-1',
    title: 'Spring campaign reel concept',
    client: 'Northline Co.',
    contentType: 'Reel',
    status: 'pending',
    createdAt: Date.parse('2026-03-04'),
    description: 'Open on product texture, cut to team at work.',
  },
  {
    id: 'idea-1b',
    title: 'Product launch teaser',
    client: 'Northline Co.',
    contentType: 'Story',
    status: 'pending',
    createdAt: Date.parse('2026-03-05'),
    description: 'Short teaser ahead of the spring drop.',
  },
  {
    id: 'idea-2',
    title: 'Customer spotlight series',
    client: 'Harbor Studio',
    contentType: 'Carousel',
    status: 'approved',
    createdAt: Date.parse('2026-03-02'),
  },
  {
    id: 'idea-3',
    title: 'Studio tour hook options',
    client: 'Bright Field',
    contentType: 'Reel',
    status: 'pending',
    createdAt: Date.parse('2026-03-01'),
  },
  {
    id: 'idea-4',
    title: 'Weekend promo angles',
    client: 'Summit Goods',
    contentType: 'Story',
    status: 'declined',
    createdAt: Date.parse('2026-02-28'),
    clientComment: 'Prefer a tighter retail focus.',
  },
];

export const MARKETING_SHOWCASE_REVIEW_CARD = {
  id: 'review-1',
  client: SHOWCASE_BRAND,
  title: 'Behind the scenes reel',
  contentType: 'Reel',
  columnId: 'in-review',
  dropboxLink: 'https://example.com/preview',
  notes: 'Final cut with updated color grade.',
};

export const MARKETING_SHOWCASE_SHOOT_PLAN = {
  shootStartTime: '10:00',
  shootEndTime: '13:00',
};

export const MARKETING_SHOWCASE_SHOOT_CARDS = [
  {
    id: 'shoot-card-1',
    client: SHOWCASE_BRAND,
    title: 'B-roll — workspace',
    contentType: 'Reel',
    shootTime: '10:00',
    shootEndTime: '10:40',
  },
  {
    id: 'shoot-card-2',
    client: SHOWCASE_BRAND,
    title: 'Founder interview',
    contentType: 'Reel',
    shootTime: '10:45',
    shootEndTime: '11:30',
  },
  {
    id: 'shoot-card-3',
    client: SHOWCASE_BRAND,
    title: 'Product hero shots',
    contentType: 'Carousel',
    shootTime: '11:45',
    shootEndTime: '12:30',
  },
];

export const MARKETING_SHOWCASE_COMPANY_FILES = [
  {
    id: 'file-1',
    name: 'Logo primary.svg',
    folder: 'branding',
    mimeType: 'image/svg+xml',
    size: 48000,
    createdAt: Date.parse('2026-01-10'),
    updatedAt: Date.parse('2026-01-10'),
  },
  {
    id: 'file-2',
    name: 'Brand guidelines 2026.pdf',
    folder: 'branding',
    mimeType: 'application/pdf',
    size: 2400000,
    createdAt: Date.parse('2026-01-15'),
    updatedAt: Date.parse('2026-01-15'),
  },
  {
    id: 'file-3',
    name: 'Product catalog.pdf',
    folder: 'general',
    mimeType: 'application/pdf',
    size: 890000,
    createdAt: Date.parse('2026-02-01'),
    updatedAt: Date.parse('2026-02-01'),
  },
];

export const MARKETING_SHOWCASE_CALENDAR_CARDS = {
  '2026-03-03': [
    {
      id: 'cal-1',
      client: 'Northline Co.',
      title: 'Launch reel',
      contentType: 'Reel',
      columnId: 'scheduled',
      dueDate: '2026-03-03',
      dueTime: '10:00',
    },
  ],
  '2026-03-08': [
    {
      id: 'cal-2',
      client: 'Harbor Studio',
      title: 'Spotlight post',
      contentType: 'Carousel',
      columnId: 'scheduled',
      dueDate: '2026-03-08',
      dueTime: '14:00',
    },
  ],
  '2026-03-12': [
    {
      id: 'cal-3',
      client: 'Northline Co.',
      title: 'Shoot day',
      contentType: 'Reel',
      columnId: 'shoot',
      dueDate: '2026-03-12',
      isShootSession: true,
      dueTime: '10:00',
      shootEndTime: '13:00',
    },
    {
      id: 'cal-4',
      client: 'Bright Field',
      title: 'Studio tour',
      contentType: 'Reel',
      columnId: 'scheduled',
      dueDate: '2026-03-12',
      dueTime: '16:00',
    },
  ],
  '2026-03-18': [
    {
      id: 'cal-5',
      client: 'Oak Lane',
      title: 'Community post',
      contentType: 'Static Post',
      columnId: 'scheduled',
      dueDate: '2026-03-18',
      dueTime: '11:00',
    },
  ],
};

export const MARKETING_SHOWCASE_CLIENT_CARDS = [
  MARKETING_SHOWCASE_REVIEW_CARD,
  ...MARKETING_SHOWCASE_SHOOT_CARDS.map((card) => ({
    ...card,
    shootDate: '2026-03-10',
  })),
  ...MARKETING_SHOWCASE_CARDS.filter((card) => card.client === SHOWCASE_BRAND),
];

export const MARKETING_SHOWCASE_CLIENT_SHOOT_PLANS = {
  '2026-03-10': {
    client: SHOWCASE_BRAND,
    dateKey: '2026-03-10',
    location: 'Studio A · 220 Market St',
  },
};

export const MARKETING_SHOWCASE_CLIENT_CALENDAR_CARDS = Object.values(
  MARKETING_SHOWCASE_CALENDAR_CARDS,
)
  .flat()
  .filter((card) => card.client === SHOWCASE_BRAND);
