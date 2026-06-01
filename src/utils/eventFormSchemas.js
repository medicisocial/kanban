export const BUSINESS_TYPES = [
  'Gym',
  'Hospitality',
  'Med Spa',
  'Chamber of Commerce',
];

export const LEGACY_BUSINESS_TYPE_MAP = {
  'Cocktail Lounge': 'Hospitality',
  'Sports Bar': 'Hospitality',
};

export const DEFAULT_CLIENT_BUSINESS_TYPES = {
  Plume: 'Hospitality',
  'The Locker Room': 'Hospitality',
  'Arco Fit': 'Gym',
  'Ara Med Spa': 'Med Spa',
  'Fulshear Regional': 'Chamber of Commerce',
};

export const EVENT_FORM_SCHEMAS = {
  Gym: [
    { id: 'eventName', label: 'Event name', type: 'text', required: true, mapsToTitle: true },
    {
      id: 'eventType',
      label: 'Event type',
      type: 'select',
      required: true,
      options: ['Class Launch', 'Open House', 'Competition', 'Member Appreciation', 'Demo', 'Other'],
    },
    {
      id: 'eventDocument',
      label: 'Event PDF',
      type: 'pdf',
      description: 'Upload a PDF — schedule, flyer, registration info, etc.',
    },
    {
      id: 'eventTypeOther',
      label: 'What type of event is it?',
      type: 'text',
      required: true,
      showWhen: { field: 'eventType', equals: 'Other' },
    },
    { id: 'eventDescription', label: 'Event description', type: 'textarea', rows: 3 },
    { id: 'hasGiveaway', label: 'Will there be a giveaway?', type: 'toggle' },
    {
      id: 'giveawayDetails',
      label: 'What is the giveaway?',
      type: 'text',
      showWhen: { field: 'hasGiveaway', equals: true },
    },
    { id: 'trainerFeatured', label: 'Trainer or instructor featured?', type: 'text' },
    { id: 'registrationRequired', label: 'Registration required?', type: 'toggle' },
  ],
  Hospitality: [
    { id: 'eventName', label: 'Event name', type: 'text', required: true, mapsToTitle: true },
    { id: 'occasion', label: 'Occasion or holiday', type: 'text' },
    {
      id: 'eventType',
      label: 'Event type',
      type: 'choice',
      required: true,
      options: ['Special Event', 'General Holiday Promotion', 'Watch Party / Game Day'],
    },
    {
      id: 'menus',
      type: 'menuGroup',
      drinkEnableField: 'hasDrinkMenu',
      drinkContentField: 'drinkMenuDetails',
      drinkPdfField: 'drinkMenuPdf',
      foodEnableField: 'hasFoodMenu',
      foodContentField: 'foodMenuDetails',
      foodPdfField: 'foodMenuPdf',
    },
    { id: 'gameFeatured', label: 'Game or sporting event featured', type: 'text' },
    {
      id: 'watchPartySpecials',
      label: 'Watch party specials',
      type: 'textarea',
      rows: 2,
      placeholder: 'Food and drink deals…',
    },
    {
      id: 'specialOfferings',
      label: 'Special offerings',
      type: 'textarea',
      placeholder: 'Packages, themed menu, giveaways, entertainment, dress code…',
    },
  ],
  'Med Spa': [
    { id: 'eventName', label: 'Event name', type: 'text', required: true, mapsToTitle: true },
    {
      id: 'eventType',
      label: 'Event type',
      type: 'select',
      required: true,
      options: ['Promotion', 'New Service Launch', 'Open House', 'Seasonal Offer'],
    },
    {
      id: 'eventDocument',
      label: 'Event PDF',
      type: 'pdf',
      description: 'Upload a PDF — promotion flyer, service menu, pricing sheet, etc.',
    },
    { id: 'servicesHighlight', label: 'Services or treatments to highlight', type: 'textarea' },
    { id: 'beforeAfterAvailable', label: 'Any before/after content available?', type: 'toggle' },
    { id: 'specialOffer', label: 'Special offer or discount to promote?', type: 'text' },
  ],
  'Chamber of Commerce': [
    { id: 'eventName', label: 'Event name', type: 'text', required: true, mapsToTitle: true },
    {
      id: 'eventType',
      label: 'Event type',
      type: 'select',
      required: true,
      options: [
        'Networking',
        'Ribbon Cutting',
        'Community Event',
        'Fundraiser',
        'Meeting',
        'Business Highlight',
      ],
    },
    {
      id: 'eventDocument',
      label: 'Event PDF',
      type: 'pdf',
      description: 'Upload a PDF — agenda, speaker bios, sponsorship details, registration info, etc.',
    },
    {
      id: 'highlightBusinessName',
      label: 'Business being highlighted',
      type: 'text',
      required: true,
      showWhen: { field: 'eventType', equals: 'Business Highlight' },
      placeholder: 'Member business featured in the branding video',
    },
    {
      id: 'highlightOwnerNames',
      label: 'Owner name(s)',
      type: 'text',
      showWhen: { field: 'eventType', equals: 'Business Highlight' },
      placeholder: 'e.g. Jane Smith, John Smith',
    },
    {
      id: 'brandingVideoNotes',
      label: 'Branding video details',
      type: 'textarea',
      rows: 3,
      showWhen: { field: 'eventType', equals: 'Business Highlight' },
      placeholder: 'Shoot location, key messages, on-site contact, timing, special shots…',
    },
    {
      id: 'featuredBusinesses',
      label: 'Featured businesses or speakers',
      type: 'text',
      showWhen: { field: 'eventType', notEquals: 'Business Highlight' },
    },
    {
      id: 'audience',
      label: 'Open to public or members only?',
      type: 'choice',
      required: true,
      options: ['Open to public', 'Members only'],
      showWhen: { field: 'eventType', notEquals: 'Business Highlight' },
    },
    {
      id: 'sponsorships',
      label: 'Any sponsorships to highlight?',
      type: 'textarea',
      showWhen: { field: 'eventType', notEquals: 'Business Highlight' },
    },
  ],
};

export function normalizeBusinessType(businessType) {
  return LEGACY_BUSINESS_TYPE_MAP[businessType] || businessType;
}

export function getEstimatedAttendanceLabel(businessType) {
  switch (normalizeBusinessType(businessType)) {
    case 'Gym':
      return 'Estimated participants';
    case 'Hospitality':
      return 'Estimated covers';
    case 'Med Spa':
      return 'Expected guests';
    case 'Chamber of Commerce':
      return 'Estimated attendees';
    default:
      return 'Estimated attendance';
  }
}

export function getEstimatedAttendancePlaceholder(businessType) {
  switch (normalizeBusinessType(businessType)) {
    case 'Gym':
      return 'e.g. 50';
    case 'Chamber of Commerce':
      return 'e.g. 200';
    case 'Med Spa':
      return 'e.g. 30';
    default:
      return 'e.g. 120';
  }
}

export function getDisplayEventType(fields) {
  if (!fields) return '';
  if (fields.eventType === 'Other') {
    return String(fields.eventTypeOther || '').trim() || 'Other';
  }
  return fields.eventType || '';
}

export function getSchemaForBusinessType(businessType) {
  return EVENT_FORM_SCHEMAS[normalizeBusinessType(businessType)] || null;
}

export function getDefaultFieldValues(schema) {
  const values = {};
  if (!schema) return values;
  for (const field of schema) {
    if (field.type === 'toggle' || field.type === 'addSection') values[field.id] = false;
    else if (field.type === 'menuGroup') {
      values[field.drinkEnableField] = false;
      values[field.drinkContentField] = '';
      values[field.drinkPdfField] = null;
      values[field.foodEnableField] = false;
      values[field.foodContentField] = '';
      values[field.foodPdfField] = null;
    } else if (field.type === 'choice' && field.options?.length) values[field.id] = field.options[0];
    else if (field.type === 'pdf') values[field.id] = null;
    else values[field.id] = '';
  }
  return values;
}

export function isFieldVisible(field, values) {
  if (!field.showWhen) return true;
  const current = values[field.showWhen.field];
  if ('equals' in field.showWhen) return current === field.showWhen.equals;
  if ('notEquals' in field.showWhen) return current !== field.showWhen.notEquals;
  return true;
}

export function validateEventFields(schema, values) {
  if (!schema) return { ok: false, error: 'Business type is not configured for this client.' };
  for (const field of schema) {
    if (!field.required || !isFieldVisible(field, values)) continue;
    const value = values[field.id];
    if (field.type === 'toggle') continue;
    if (field.type === 'pdf') {
      if (field.required && !values[field.id]?.dataUrl) {
        return { ok: false, error: `${field.label} is required.` };
      }
      continue;
    }
    if (value === undefined || value === null || String(value).trim() === '') {
      return { ok: false, error: `${field.label} is required.` };
    }
  }
  const titleField = schema.find((f) => f.mapsToTitle);
  const title = titleField ? String(values[titleField.id] || '').trim() : '';
  if (!title) return { ok: false, error: 'Event name is required.' };
  return { ok: true, title };
}

export function buildEventPayload({
  schema,
  values,
  client,
  businessType,
  date,
  time,
  endTime = '',
  status,
  estimatedCovers = '',
}) {
  if (!schema) return { ok: false, error: 'Business type is not configured for this client.' };

  const titleField = schema.find((field) => field.mapsToTitle);
  const title = titleField ? String(values[titleField.id] || '').trim() : '';

  if (status === 'submitted') {
    const validation = validateEventFields(schema, values);
    if (!validation.ok) return validation;
    if (!date) return { ok: false, error: 'Event date is required.' };
  }

  const visibleFields = {};
  for (const field of schema) {
    if (field.type === 'menuGroup') {
      if (values[field.drinkEnableField]) {
        visibleFields[field.drinkEnableField] = true;
        visibleFields[field.drinkContentField] = values[field.drinkContentField] || '';
        if (values[field.drinkPdfField]?.dataUrl) {
          visibleFields[field.drinkPdfField] = values[field.drinkPdfField];
        }
      }
      if (values[field.foodEnableField]) {
        visibleFields[field.foodEnableField] = true;
        visibleFields[field.foodContentField] = values[field.foodContentField] || '';
        if (values[field.foodPdfField]?.dataUrl) {
          visibleFields[field.foodPdfField] = values[field.foodPdfField];
        }
      }
      continue;
    }
    if (field.type === 'addSection') continue;
    if (field.type === 'pdf') {
      if (values[field.id]?.dataUrl) visibleFields[field.id] = values[field.id];
      continue;
    }
    if (!isFieldVisible(field, values)) continue;
    visibleFields[field.id] = values[field.id];
  }

  return {
    ok: true,
    data: {
      title: title || 'Untitled draft',
      client,
      date: date || '',
      time: time?.trim() || '',
      endTime: endTime?.trim() || '',
      estimatedCovers: String(estimatedCovers || '').trim(),
      status,
      businessType,
      fields: visibleFields,
    },
  };
}

export function formatFieldValue(field, value) {
  if (field.type === 'toggle') return value ? 'Yes' : 'No';
  if (field.type === 'pdf') return value?.name || '—';
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

export function getEventDisplayFields(event) {
  const schema = getSchemaForBusinessType(event?.businessType);
  if (!schema || !event?.fields) return [];
  return schema
    .filter((field) => isFieldVisible(field, event.fields) && event.fields[field.id] !== undefined)
    .map((field) => ({
      label: field.label,
      value: formatFieldValue(field, event.fields[field.id]),
    }));
}
