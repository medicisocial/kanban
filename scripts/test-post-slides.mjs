import { readFileSync } from 'fs';
import {
  PER_SLIDE_CAPTION_MODE,
  SHARED_CAPTION_MODE,
  hasPostSlidePlan,
  normalizeCaptionMode,
  normalizePostSlides,
} from '../src/utils/postSlides.js';
import {
  buildBankIdeaData,
  buildIdeaReturnFromCard,
  resolveShootScriptsFromIdea,
} from '../src/utils/videoIdeas.js';
import { hasStructuredScript } from '../src/utils/scriptFields.js';
import {
  applyShootSubmission,
  buildShootShareUrl,
  buildShootSubmission,
  parseShootShareHash,
} from '../src/utils/shootShare.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const carouselSlides = normalizePostSlides(
  [
    {
      mediaType: 'video',
      description: '  Opening clip  ',
      textOverlay: '  Meet the team  ',
      caption: '  First caption  ',
    },
    {
      mediaType: 'photo',
      description: '  Team photo  ',
      textOverlay: '',
      caption: '  Second caption  ',
    },
  ],
  'Carousel',
);
assert(carouselSlides.length === 2, 'carousel keeps multiple slides');
assert(carouselSlides[0].mediaType === 'video', 'carousel keeps video slides');
assert(carouselSlides[0].description === 'Opening clip', 'slide descriptions are trimmed');
assert(carouselSlides[0].textOverlay === 'Meet the team', 'slide overlays are trimmed');
assert(carouselSlides[1].caption === 'Second caption', 'per-slide captions are trimmed');
assert(hasPostSlidePlan(carouselSlides), 'populated carousel is a structured post plan');

const staticSlides = normalizePostSlides(
  [
    { mediaType: 'video', description: 'Hero image' },
    { mediaType: 'photo', description: 'Should be removed' },
  ],
  'Static Post',
);
assert(staticSlides.length === 1, 'static posts keep exactly one slide');
assert(staticSlides[0].mediaType === 'photo', 'static post slide is always a photo');
assert(
  normalizeCaptionMode(PER_SLIDE_CAPTION_MODE, 'Static Post') === SHARED_CAPTION_MODE,
  'static posts always use one shared caption',
);

const bankIdea = buildBankIdeaData({
  contentType: 'Carousel',
  caption: '  Shared caption  ',
  captionMode: PER_SLIDE_CAPTION_MODE,
  postSlides: carouselSlides,
  referenceMusic: '  https://example.com/music  ',
});
assert(bankIdea.caption === 'Shared caption', 'bank idea trims shared caption');
assert(bankIdea.captionMode === PER_SLIDE_CAPTION_MODE, 'bank idea keeps per-slide caption mode');
assert(bankIdea.postSlides.length === 2, 'bank idea keeps carousel slides');
assert(bankIdea.referenceMusic === 'https://example.com/music', 'bank idea keeps music reference');

const scheduled = resolveShootScriptsFromIdea(bankIdea);
assert(scheduled.postSlides.length === 2, 'bank slides carry onto a new card');
assert(scheduled.captionMode === PER_SLIDE_CAPTION_MODE, 'caption mode carries onto a new card');

const ideaSlides = [{ mediaType: 'photo', description: 'Idea version' }];
const preserved = resolveShootScriptsFromIdea(
  { contentType: 'Carousel', postSlides: ideaSlides },
  {
    contentType: 'Carousel',
    postSlides: [
      { mediaType: 'video', description: 'Card edit' },
      { mediaType: 'photo', description: 'Second card slide' },
    ],
    captionMode: PER_SLIDE_CAPTION_MODE,
  },
);
assert(preserved.postSlides[0].description === 'Card edit', 'existing card slide edits win');
assert(preserved.postSlides.length === 2, 'existing card slide count is preserved');

const returned = buildIdeaReturnFromCard(
  {
    contentType: 'Carousel',
    captionMode: PER_SLIDE_CAPTION_MODE,
    postSlides: carouselSlides,
    referenceMusic: 'https://example.com/music',
  },
  {
    contentType: 'Carousel',
    postSlides: [{ mediaType: 'photo', description: 'Old idea slide' }],
  },
);
assert(returned.postSlides[0].description === 'Opening clip', 'card slides return to the bank');
assert(returned.captionMode === PER_SLIDE_CAPTION_MODE, 'caption mode returns to the bank');
assert(returned.referenceMusic === 'https://example.com/music', 'music reference returns to the bank');
assert(hasStructuredScript({ contentType: 'Carousel', postSlides: carouselSlides }), 'slide plan is ready');

globalThis.window = {
  location: {
    origin: 'https://portal.example.com',
    pathname: '/',
    search: '',
    hash: '',
  },
};
const shareUrl = buildShootShareUrl(
  'Plume',
  '2026-07-18',
  [
    {
      id: 'card-1',
      title: 'Carousel',
      contentType: 'Carousel',
      captionMode: PER_SLIDE_CAPTION_MODE,
      postSlides: carouselSlides,
      referenceMusic: 'https://example.com/music',
    },
  ],
  {},
);
const parsedUrl = new URL(shareUrl);
window.location.search = parsedUrl.search;
window.location.hash = parsedUrl.hash;
const snapshot = parseShootShareHash();
assert(snapshot.cards[0].postSlides.length === 2, 'shoot share preserves slides');
assert(snapshot.cards[0].captionMode === PER_SLIDE_CAPTION_MODE, 'shoot share preserves caption mode');
assert(snapshot.cards[0].referenceMusic === 'https://example.com/music', 'shoot share preserves music');

const submission = buildShootSubmission('Plume', '2026-07-18', {}, snapshot.cards);
let appliedPatch = null;
const applied = applyShootSubmission(submission, [{ id: 'card-1' }], {
  updateCard: (_id, patch) => {
    appliedPatch = patch;
  },
  updatePlan: () => {},
});
assert(applied === 1, 'shoot submission applies matching card');
assert(appliedPatch.postSlides.length === 2, 'shoot import preserves slides');

const cardModalSource = readFileSync(new URL('../src/components/CardModal.jsx', import.meta.url), 'utf8');
assert(cardModalSource.includes('<PostSlidesPanel'), 'card modal uses slide editor');
const ideaModalSource = readFileSync(new URL('../src/components/VideoIdeaModal.jsx', import.meta.url), 'utf8');
assert(ideaModalSource.includes('<PostSlidesPanel'), 'bank idea modal uses slide editor');
assert(ideaModalSource.includes('referenceMusic'), 'bank idea modal supports music references');
const portalSource = readFileSync(
  new URL('../src/components/ClientShootDayPortal.jsx', import.meta.url),
  'utf8',
);
assert(portalSource.includes('hideSlidePostPlans'), 'client shoot portal hides internal slide plans');

console.log('test-post-slides: ok');
