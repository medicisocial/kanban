export const SHARED_CAPTION_MODE = 'shared';
export const PER_SLIDE_CAPTION_MODE = 'per-slide';

export function isSlidePostType(contentType) {
  return contentType === 'Carousel' || contentType === 'Static Post';
}

export function normalizeCaptionMode(value, contentType) {
  if (contentType === 'Carousel' && value === PER_SLIDE_CAPTION_MODE) {
    return PER_SLIDE_CAPTION_MODE;
  }
  return SHARED_CAPTION_MODE;
}

export function createEmptyPostSlide(mediaType = 'photo') {
  return {
    mediaType: mediaType === 'video' ? 'video' : 'photo',
    description: '',
    textOverlay: '',
    caption: '',
  };
}

function normalizeSlide(slide, { forcePhoto = false } = {}) {
  return {
    mediaType: forcePhoto ? 'photo' : slide?.mediaType === 'video' ? 'video' : 'photo',
    description: String(slide?.description || '').trim(),
    textOverlay: String(slide?.textOverlay || '').trim(),
    caption: String(slide?.caption || '').trim(),
  };
}

export function normalizePostSlides(
  slides,
  contentType,
  { fallbackDescription = '', fallbackTextOverlay = '' } = {},
) {
  if (!isSlidePostType(contentType)) return [];

  const normalized = Array.isArray(slides)
    ? slides.filter((slide) => slide && typeof slide === 'object').map((slide) =>
        normalizeSlide(slide, { forcePhoto: contentType === 'Static Post' }),
      )
    : [];

  if (!normalized.length) {
    normalized.push({
      ...createEmptyPostSlide('photo'),
      description: String(fallbackDescription || '').trim(),
      textOverlay: String(fallbackTextOverlay || '').trim(),
    });
  }

  return contentType === 'Static Post' ? [normalized[0]] : normalized;
}

export function hasPostSlideContent(slides) {
  return Array.isArray(slides) && slides.some((slide) =>
    Boolean(
      String(slide?.description || '').trim() ||
        String(slide?.textOverlay || '').trim() ||
        String(slide?.caption || '').trim(),
    ),
  );
}

export function hasPostSlidePlan(slides) {
  return Boolean(
    Array.isArray(slides) &&
      (slides.length > 1 ||
        slides.some((slide) => slide?.mediaType === 'video') ||
        hasPostSlideContent(slides)),
  );
}
