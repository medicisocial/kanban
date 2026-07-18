import { readFileSync } from 'fs';
import {
  PER_SLIDE_CAPTION_MODE,
  SHARED_CAPTION_MODE,
  hasPostSlidePlan,
  normalizeCaptionMode,
  normalizePostSlides,
} from '../src/utils/postSlides.js';
import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const {
  buildBankIdeaData,
  buildIdeaReturnFromCard,
  resolveShootScriptsFromIdea,
} = await vite.ssrLoadModule('/src/utils/videoIdeas.js');
const { hasStructuredScript } = await vite.ssrLoadModule('/src/utils/scriptFields.js');

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

const cardModalSource = readFileSync(new URL('../src/components/CardModal.jsx', import.meta.url), 'utf8');
assert(cardModalSource.includes('<PostSlidesPanel'), 'card modal uses slide editor');
assert(cardModalSource.includes("? 'Slides' : tab.label"), 'card modal labels slide-post tab as Slides');
const ideaModalSource = readFileSync(new URL('../src/components/VideoIdeaModal.jsx', import.meta.url), 'utf8');
assert(ideaModalSource.includes('<PostSlidesPanel'), 'bank idea modal uses slide editor');
assert(ideaModalSource.includes('? "Slides" : label'), 'bank modal labels slide-post tab as Slides');
assert(ideaModalSource.includes('referenceMusic'), 'bank idea modal supports music references');
assert(
  ideaModalSource.includes('ReferenceVideoLink') && ideaModalSource.includes('ReferenceMusicLink'),
  'bank idea modal renders clickable reference video and music links',
);
assert(ideaModalSource.includes('MakeOneOffModal'), 'bank idea modal can make a one-off project');
const slidesPanelSource = readFileSync(
  new URL('../src/components/PostSlidesPanel.jsx', import.meta.url),
  'utf8',
);
assert(slidesPanelSource.includes('aria-expanded={expanded}'), 'slide cards expose collapse state');
assert(slidesPanelSource.includes('toggleSlide(index)'), 'slide cards have independent collapse controls');
assert(slidesPanelSource.includes('const addSlide = () =>'), 'new slides use expansion-aware add flow');
const portalSource = readFileSync(
  new URL('../src/components/ClientShootDayPortal.jsx', import.meta.url),
  'utf8',
);
assert(portalSource.includes('hideSlidePostPlans'), 'client shoot portal hides internal slide plans');
const shootShareSource = readFileSync(new URL('../src/utils/shootShare.js', import.meta.url), 'utf8');
assert(shootShareSource.includes('card.postSlides || []'), 'shoot share snapshot includes slides');
assert(
  shootShareSource.includes('postSlides: Array.isArray(item.postSlides) ? item.postSlides : []'),
  'shoot import applies slides',
);
assert(shootShareSource.includes('referenceMusic: item.referenceMusic ||'), 'shoot import applies music');

await vite.close();
console.log('test-post-slides: ok');
