import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

function parseLegacyPayload(encoded) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

export function encodeSharePayload(data) {
  return compressToEncodedURIComponent(JSON.stringify(data));
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

export function decodeShareQueryParam(param) {
  if (!param) return null;

  const decompressed = decompressFromEncodedURIComponent(param);
  if (decompressed) {
    try {
      return JSON.parse(decompressed);
    } catch {
      /* fall through */
    }
  }

  return parseLegacyPayload(param);
}
