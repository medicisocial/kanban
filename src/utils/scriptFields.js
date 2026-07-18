import {
  hasPostSlidePlan,
  normalizeCaptionMode,
  normalizePostSlides,
} from './postSlides';

export function hasStructuredScript(value) {
  return Boolean(
    String(value?.shootScriptHook || value?.scriptHook || '').trim() ||
      String(value?.shootScriptBody || value?.scriptBody || '').trim() ||
      String(value?.shootTextOverlays || value?.scriptOverlays || '').trim() ||
      String(value?.caption || '').trim() ||
      hasPostSlidePlan(value?.postSlides) ||
      String(value?.shootScript || value?.script || '').trim(),
  );
}

export function getStructuredScript(value) {
  const hook = String(value?.shootScriptHook || value?.scriptHook || '').trim();
  const structuredBody = String(value?.shootScriptBody || value?.scriptBody || '').trim();
  const legacyBody = String(value?.shootScript || value?.script || '').trim();
  const overlays = String(value?.shootTextOverlays || value?.scriptOverlays || '').trim();
  const caption = String(value?.caption || '').trim();
  const postSlides = normalizePostSlides(value?.postSlides, value?.contentType, {
    fallbackDescription: structuredBody || legacyBody,
    fallbackTextOverlay: overlays,
  });
  return {
    hook,
    body: structuredBody || legacyBody,
    overlays,
    caption,
    captionMode: normalizeCaptionMode(value?.captionMode, value?.contentType),
    postSlides,
  };
}
