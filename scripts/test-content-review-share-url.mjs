import lzString from 'lz-string';
import { decodeSharePayload } from '../api/_lib/sharePayload.mjs';

const { compressToEncodedURIComponent } = lzString;

/** Keep in sync with getStructuredScript fields used by buildContentReviewShareUrl. */
function scriptFieldsForShare(card) {
  const hook = String(card?.shootScriptHook || card?.scriptHook || '').trim();
  const body = String(
    card?.shootScriptBody || card?.scriptBody || card?.shootScript || card?.script || '',
  ).trim();
  const overlays = String(card?.shootTextOverlays || card?.scriptOverlays || '').trim();
  const caption = String(card?.caption || '').trim();
  return { hook, body, overlays, caption };
}

function buildContentReviewShareUrl(client, reviewCards) {
  const payload = compressToEncodedURIComponent(JSON.stringify({
    v: 2,
    i: reviewCards.map((card) => {
      const script = scriptFieldsForShare(card);
      return [
        card.id,
        card.title,
        card.contentType,
        card.dropboxLink || '',
        card.notes || '',
        script.hook,
        script.body,
        script.overlays,
        script.caption,
      ];
    }),
  }));
  const base = 'https://example.com/';
  return `${base}?content=${encodeURIComponent(client)}#${payload}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const url = buildContentReviewShareUrl('Plume', [{
  id: 'card-1',
  title: 'Test reel',
  contentType: 'Reel',
  shootScriptHook: 'Stop scrolling',
  shootScriptBody: 'Here is the pitch',
  caption: 'Shop now',
}]);

assert(url.includes('content=Plume'), 'share url includes client query param');
assert(url.includes('#'), 'share url includes encoded card snapshot hash');
assert(!url.includes('undefined'), 'share url does not contain undefined tokens');
const decoded = decodeSharePayload(url.split('#')[1]);
assert(decoded?.i?.[0]?.[0] === 'card-1', 'server share payload decoder can read compressed share URL');
assert(decoded?.i?.[0]?.[5] === 'Stop scrolling', 'share payload includes script hook');
assert(decoded?.i?.[0]?.[6] === 'Here is the pitch', 'share payload includes script body');
assert(decoded?.i?.[0]?.[8] === 'Shop now', 'share payload includes caption');

console.log('test-content-review-share-url: ok');
