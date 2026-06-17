import { decompressFromEncodedURIComponent } from 'lz-string';

function parseLegacyPayload(encoded) {
  try {
    return JSON.parse(decodeURIComponent(escape(Buffer.from(encoded, 'base64').toString('binary'))));
  } catch {
    return null;
  }
}

export function decodeSharePayload(encoded) {
  if (!encoded) return null;

  const decompressed = decompressFromEncodedURIComponent(encoded);
  if (decompressed) {
    try {
      return JSON.parse(decompressed);
    } catch {
      /* fall through */
    }
  }

  return parseLegacyPayload(encoded);
}
