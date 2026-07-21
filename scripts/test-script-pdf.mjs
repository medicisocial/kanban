/**
 * Card script PDF sections + filename helpers.
 */
import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const {
  buildScriptPdfFilename,
  buildScriptPdfSections,
  downloadScriptPdf,
} = await vite.ssrLoadModule('/src/utils/scriptPdf.js');

assert(
  buildScriptPdfFilename({ client: 'Plume Co!', title: 'Summer Reel' }) ===
    'script-plume-co-summer-reel.pdf',
  'filename slugs client and title',
);
assert(
  buildScriptPdfFilename({}) === 'script-client-script.pdf',
  'filename falls back when empty',
);

const reelSections = buildScriptPdfSections({
  contentType: 'Reel',
  shootScriptHook: 'Stop scrolling',
  shootScriptBody: 'Here is why',
  shootTextOverlays: 'STOP',
  caption: 'Shop now #plume',
});
assert(reelSections.length === 4, 'reel has hook/body/overlays/caption sections');
assert(reelSections[0].title === 'Hook' && reelSections[0].body === 'Stop scrolling', 'reel hook');
assert(reelSections[1].body === 'Here is why', 'reel body');
assert(reelSections[2].body === 'STOP', 'reel overlays');
assert(reelSections[3].body === 'Shop now #plume', 'reel caption');

const emptyReel = buildScriptPdfSections({ contentType: 'Reel' });
assert(emptyReel.every((section) => section.body === '—'), 'empty reel sections show dash');

const carousel = buildScriptPdfSections({
  contentType: 'Carousel',
  caption: 'Shared caption',
  captionMode: 'shared',
  postSlides: [
    { mediaType: 'photo', description: 'Hero shot', textOverlay: 'New drop' },
    { mediaType: 'video', description: 'B-roll', textOverlay: '' },
  ],
});
assert(carousel.length === 3, 'carousel shared caption adds slide sections + caption');
assert(carousel[0].title === 'Slide 1' && carousel[0].body.includes('Hero shot'), 'slide 1 body');
assert(carousel[0].body.includes('Media: Photo'), 'slide 1 media');
assert(carousel[1].body.includes('Media: Video'), 'slide 2 media');
assert(carousel[2].title === 'Caption' && carousel[2].body === 'Shared caption', 'shared caption');

const perSlide = buildScriptPdfSections({
  contentType: 'Carousel',
  captionMode: 'per-slide',
  postSlides: [
    {
      mediaType: 'photo',
      description: 'Look 1',
      textOverlay: 'One',
      caption: 'Cap 1',
    },
  ],
});
assert(perSlide.length === 1, 'per-slide mode does not add shared caption section');
assert(perSlide[0].body.includes('Cap 1'), 'per-slide caption in slide block');

const staticPost = buildScriptPdfSections({
  contentType: 'Static Post',
  caption: 'Still caption',
  postSlides: [{ mediaType: 'photo', description: 'Product still', textOverlay: 'Sale' }],
});
assert(staticPost.length === 2, 'static has one slide + caption');
assert(staticPost[0].title === 'Slide 1', 'static slide title');

assert(typeof downloadScriptPdf === 'function', 'downloadScriptPdf exported');

await vite.close();
console.log('Script PDF tests passed.');
