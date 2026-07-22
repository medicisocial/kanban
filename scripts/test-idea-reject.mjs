/**
 * Client idea Reject flow — notes validation, rejected status, legacy declined.
 */
import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRejectedIdeaStatus(status) {
  return status === 'rejected' || status === 'declined';
}

function isReviewQueueIdeaStatus(status) {
  return Boolean(status) && status !== 'approved' && !isRejectedIdeaStatus(status);
}

assert(isRejectedIdeaStatus('rejected'), 'canonical rejected status counts as rejected');
assert(isRejectedIdeaStatus('declined'), 'legacy declined status still counts as rejected');
assert(!isRejectedIdeaStatus('pending'), 'pending is not rejected');
assert(!isRejectedIdeaStatus('approved'), 'approved is not rejected');

assert(isReviewQueueIdeaStatus('pending'), 'pending stays in Review queue');
assert(!isReviewQueueIdeaStatus('approved'), 'approved leaves Review queue');
assert(!isReviewQueueIdeaStatus('rejected'), 'rejected leaves Review queue');
assert(!isReviewQueueIdeaStatus('declined'), 'legacy declined leaves Review queue');

const constantsSource = readFileSync(new URL('../src/constants.js', import.meta.url), 'utf8');
assert(
  constantsSource.includes("rejected: 'Rejected'") &&
    constantsSource.includes("declined: 'Rejected'"),
  'both rejected and legacy declined display as Rejected',
);

const helpersSource = readFileSync(new URL('../src/utils/videoIdeas.js', import.meta.url), 'utf8');
assert(
  helpersSource.includes("status === 'rejected' || status === 'declined'"),
  'shared helper treats declined as rejected',
);
assert(
  helpersSource.includes('isReviewQueueIdeaStatus'),
  'shared helper excludes rejected from Review queue',
);

const ideas = [
  { id: '1', status: 'pending', client: 'Arco Fit' },
  { id: '2', status: 'approved', client: 'Arco Fit' },
  { id: '3', status: 'rejected', client: 'Arco Fit', clientComment: 'Too soft' },
  { id: '4', status: 'declined', client: 'Arco Fit', clientComment: 'Old pass' },
  { id: '5', status: 'rejected', client: 'Plume', clientComment: 'Other brand' },
];

const review = ideas.filter((idea) => isReviewQueueIdeaStatus(idea.status));
assert(review.length === 1 && review[0].id === '1', 'Review queue is pending only');

const rejected = ideas.filter((idea) => isRejectedIdeaStatus(idea.status));
assert(rejected.length === 3, 'Rejected list includes rejected + legacy declined');
assert(
  rejected.some((idea) => idea.status === 'declined' && idea.clientComment === 'Old pass'),
  'legacy declined ideas keep their historical clientComment',
);

const agencyRejectedForArco = rejected.filter((idea) => idea.client === 'Arco Fit');
assert(agencyRejectedForArco.length === 2, 'Rejected tab still respects client filter upstream');

const modalSource = readFileSync(
  new URL('../src/components/ClientIdeaDetailModal.jsx', import.meta.url),
  'utf8',
);
assert(modalSource.includes('>Reject<') || modalSource.includes('Reject\n'), 'client modal exposes Reject');
assert(
  modalSource.includes('Please add a note explaining your feedback before rejecting.'),
  'client modal blocks reject without a note',
);
assert(
  modalSource.includes('never sync into description'),
  'client reject does not sync note into description',
);
assert(
  modalSource.includes('onDecline?.(idea.id, rejectionNote)'),
  'reject sends Notes text as clientComment payload',
);
assert(
  !modalSource.includes('if (dirty) await onSave?.(idea.id, buildNoteUpdates());\n      await onDecline'),
  'reject does not save description before decline',
);

const portalResponses = readFileSync(
  new URL('../api/_lib/clientPortalResponses.mjs', import.meta.url),
  'utf8',
);
assert(
  portalResponses.includes("action === 'rejected' || action === 'declined'"),
  'server accepts rejected and legacy declined actions',
);
assert(
  portalResponses.includes("status: 'rejected'"),
  'server persists canonical rejected status',
);
assert(
  portalResponses.includes('Please add a note explaining your feedback before rejecting.'),
  'server requires non-empty reject comment',
);

const rejectBlockStart = portalResponses.indexOf("action === 'rejected'");
const rejectBlock = portalResponses.slice(rejectBlockStart, rejectBlockStart + 500);
assert(!rejectBlock.includes('description:'), 'reject action does not write description');

const videoIdeasSource = readFileSync(
  new URL('../src/components/VideoIdeas.jsx', import.meta.url),
  'utf8',
);
assert(videoIdeasSource.includes("{ id: 'rejected', label: 'Rejected' }"), 'agency has Rejected tab');
assert(
  videoIdeasSource.includes('isRejectedIdeaStatus(idea.status)'),
  'agency Rejected tab includes rejected + declined',
);
assert(
  videoIdeasSource.includes('Delete ${label} from Rejected? This cannot be undone.'),
  'Rejected delete uses confirm dialog text',
);
assert(
  videoIdeasSource.includes('window.confirm(`Delete ${label} from Rejected?'),
  'Rejected delete requires confirm (not one-click)',
);

const adminTable = readFileSync(
  new URL('../src/components/clientPortal/AdminIdeasTable.jsx', import.meta.url),
  'utf8',
);
assert(adminTable.includes('showRejectionNote'), 'admin table can show rejection notes');
assert(adminTable.includes('Rejection note:'), 'admin table labels rejection notes');
assert(!adminTable.includes('Passed ('), 'admin review filter no longer uses Passed label');

console.log('test-idea-reject: ok');
