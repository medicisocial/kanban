import React, { useEffect, useRef, useState } from 'react';
import {
  PER_SLIDE_CAPTION_MODE,
  SHARED_CAPTION_MODE,
  createEmptyPostSlide,
} from '../utils/postSlides';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

function editableSlides(slides, contentType) {
  const source = Array.isArray(slides) && slides.length ? slides : [createEmptyPostSlide()];
  if (contentType === 'Static Post') {
    return [{ ...createEmptyPostSlide(), ...source[0], mediaType: 'photo' }];
  }
  return source.map((slide) => ({ ...createEmptyPostSlide(), ...slide }));
}

export default function PostSlidesPanel({
  contentType,
  caption = '',
  captionMode = SHARED_CAPTION_MODE,
  slides = [],
  onChange = () => {},
  readOnly = false,
}) {
  const isCarousel = contentType === 'Carousel';
  const resolvedMode =
    isCarousel && captionMode === PER_SLIDE_CAPTION_MODE
      ? PER_SLIDE_CAPTION_MODE
      : SHARED_CAPTION_MODE;
  const resolvedSlides = editableSlides(slides, contentType);
  const [expandedSlides, setExpandedSlides] = useState(() => new Set([0]));
  const previousTypeRef = useRef(contentType);
  const previousCountRef = useRef(resolvedSlides.length);

  useEffect(() => {
    const typeChanged = previousTypeRef.current !== contentType;
    const previousCount = previousCountRef.current;
    if (typeChanged) {
      setExpandedSlides(new Set([0]));
    } else if (resolvedSlides.length > previousCount) {
      setExpandedSlides((current) => {
        const next = new Set(current);
        for (let index = previousCount; index < resolvedSlides.length; index += 1) {
          next.add(index);
        }
        return next;
      });
    }
    previousTypeRef.current = contentType;
    previousCountRef.current = resolvedSlides.length;
  }, [contentType, resolvedSlides.length]);

  const updateSlide = (index, patch) => {
    onChange({
      postSlides: resolvedSlides.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, ...patch } : slide,
      ),
    });
  };

  const toggleSlide = (index) => {
    setExpandedSlides((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const removeSlide = (index) => {
    onChange({ postSlides: resolvedSlides.filter((_, slideIndex) => slideIndex !== index) });
    setExpandedSlides((current) => {
      const next = new Set();
      for (const expandedIndex of current) {
        if (expandedIndex < index) next.add(expandedIndex);
        if (expandedIndex > index) next.add(expandedIndex - 1);
      }
      return next;
    });
  };

  const addSlide = () => {
    const nextIndex = resolvedSlides.length;
    setExpandedSlides((current) => new Set([...current, nextIndex]));
    onChange({ postSlides: [...resolvedSlides, createEmptyPostSlide()] });
  };

  if (readOnly) {
    const hasContent =
      caption.trim() ||
      resolvedSlides.some(
        (slide) => slide.description?.trim() || slide.textOverlay?.trim() || slide.caption?.trim(),
      );
    if (!hasContent) {
      return <p className="text-sm text-gray-500">No slide plan written yet.</p>;
    }
    return (
      <div className="space-y-4">
        {resolvedMode === SHARED_CAPTION_MODE && caption.trim() && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Caption for all slides
            </h4>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#f9f6f2]">
              {caption}
            </p>
          </section>
        )}
        {resolvedSlides.map((slide, index) => (
          <section key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Slide {index + 1} · {slide.mediaType === 'video' ? 'Video' : 'Photo'}
            </h4>
            {slide.description?.trim() && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#f9f6f2]">
                <span className="text-white/40">Description: </span>
                {slide.description}
              </p>
            )}
            {slide.textOverlay?.trim() && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#f9f6f2]">
                <span className="text-white/40">Text overlay: </span>
                {slide.textOverlay}
              </p>
            )}
            {resolvedMode === PER_SLIDE_CAPTION_MODE && slide.caption?.trim() && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#f9f6f2]">
                <span className="text-white/40">Caption: </span>
                {slide.caption}
              </p>
            )}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isCarousel && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-gray-400">Caption setup</legend>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {[
              [SHARED_CAPTION_MODE, 'One caption for all'],
              [PER_SLIDE_CAPTION_MODE, 'Caption each slide'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ captionMode: value })}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  resolvedMode === value
                    ? 'bg-[#810100] text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {resolvedMode === SHARED_CAPTION_MODE && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-400">
            {isCarousel ? 'Caption for all slides' : 'Post caption'}
          </span>
          <textarea
            value={caption}
            onChange={(event) => onChange({ caption: event.target.value })}
            rows={4}
            placeholder="Write the post caption..."
            className={`${inputClass} resize-y`}
          />
        </label>
      )}

      <div className="space-y-3">
        {resolvedSlides.map((slide, index) => {
          const expanded = expandedSlides.has(index);
          const completedFields = [
            slide.description?.trim() && 'description',
            slide.textOverlay?.trim() && 'overlay',
            resolvedMode === PER_SLIDE_CAPTION_MODE && slide.caption?.trim() && 'caption',
          ].filter(Boolean);
          return (
          <section key={index} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-2 px-3 py-3">
              <button
                type="button"
                onClick={() => toggleSlide(index)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                aria-expanded={expanded}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">
                    Slide {index + 1} · {slide.mediaType === 'video' ? 'Video' : 'Photo'}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-white/35">
                    {completedFields.length ? completedFields.join(' · ') : 'No details yet'}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-white/40" aria-hidden="true">
                  {expanded ? '−' : '+'}
                </span>
              </button>
              {isCarousel && resolvedSlides.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlide(index)}
                  className="text-xs text-rose-300/70 transition hover:text-rose-200"
                >
                  Remove
                </button>
              )}
            </div>

            {expanded && (
              <div className="border-t border-white/10 px-3 pb-3 pt-3">
            {isCarousel ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Media</span>
                <select
                  value={slide.mediaType}
                  onChange={(event) => updateSlide(index, { mediaType: event.target.value })}
                  className={inputClass}
                >
                  <option value="photo">Photo</option>
                  <option value="video">Video</option>
                </select>
              </label>
            ) : (
              <p className="text-xs text-white/45">Photo</p>
            )}

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Description</span>
              <textarea
                value={slide.description}
                onChange={(event) => updateSlide(index, { description: event.target.value })}
                rows={3}
                placeholder="Describe the visual or shot for this slide..."
                className={`${inputClass} resize-y`}
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Text overlay</span>
              <textarea
                value={slide.textOverlay}
                onChange={(event) => updateSlide(index, { textOverlay: event.target.value })}
                rows={2}
                placeholder="Text shown on this slide..."
                className={`${inputClass} resize-y`}
              />
            </label>

            {resolvedMode === PER_SLIDE_CAPTION_MODE && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">
                  Slide {index + 1} caption
                </span>
                <textarea
                  value={slide.caption}
                  onChange={(event) => updateSlide(index, { caption: event.target.value })}
                  rows={3}
                  placeholder="Write the caption for this slide..."
                  className={`${inputClass} resize-y`}
                />
              </label>
            )}
              </div>
            )}
          </section>
          );
        })}
      </div>

      {isCarousel && (
        <button
          type="button"
          onClick={addSlide}
          className="w-full rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-sm font-medium text-white/60 transition hover:border-white/30 hover:bg-white/5 hover:text-white"
        >
          + Add slide
        </button>
      )}
    </div>
  );
}
