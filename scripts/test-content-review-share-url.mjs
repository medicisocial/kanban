import lzString from 'lz-string';
import { decodeSharePayload } from '../api/_lib/sharePayload.mjs';

const { compressToEncodedURIComponent } = lzString;

function buildContentReviewShareUrl(client, reviewCards) {
  const payload = compressToEncodedURIComponent(JSON.stringify({
    v: 2,
    i: reviewCards.map((card) => [
      card.id,
      card.title,
      card.contentType,
      card.dropboxLink || '',
      card.notes || '',
    ]),
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
}]);

assert(url.includes('content=Plume'), 'share url includes client query param');
assert(url.includes('#'), 'share url includes encoded card snapshot hash');
assert(!url.includes('undefined'), 'share url does not contain undefined tokens');
const decoded = decodeSharePayload(url.split('#')[1]);
assert(decoded?.i?.[0]?.[0] === 'card-1', 'server share payload decoder can read compressed share URL');

console.log('test-content-review-share-url: ok');
