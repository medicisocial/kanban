import { useCallback, useRef, useState } from 'react';
import { DEFAULT_LOGO_CROP, logoCropStyle, normalizeClientLogo } from '../../utils/clientLogo';

export default function LogoCropEditor({
  src,
  crop = DEFAULT_LOGO_CROP,
  onCropChange,
  previewSize = 160,
}) {
  const frameRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const normalized = normalizeClientLogo({ src, ...crop }) || { src, ...DEFAULT_LOGO_CROP };

  const updateCrop = useCallback(
    (updates) => {
      onCropChange?.({
        zoom: normalized.zoom,
        x: normalized.x,
        y: normalized.y,
        ...updates,
      });
    },
    [normalized.x, normalized.y, normalized.zoom, onCropChange],
  );

  const positionFromEvent = (event) => {
    const frame = frameRef.current;
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    };
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    frameRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
    const next = positionFromEvent(event);
    if (next) updateCrop(next);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    const next = positionFromEvent(event);
    if (next) updateCrop(next);
  };

  const handlePointerUp = (event) => {
    setDragging(false);
    frameRef.current?.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div
          ref={frameRef}
          className={`relative touch-none overflow-hidden rounded-full bg-black/50 ring-2 ring-white/15 ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ width: previewSize, height: previewSize }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            src={src}
            alt=""
            className="h-full w-full select-none"
            style={logoCropStyle(normalized)}
            draggable={false}
          />
        </div>
      </div>

      <label className="block">
        <span className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
          <span>Zoom</span>
          <span className="tabular-nums text-white/55">{normalized.zoom.toFixed(2)}×</span>
        </span>
        <input
          type="range"
          min="1"
          max="2.5"
          step="0.05"
          value={normalized.zoom}
          onChange={(e) => updateCrop({ zoom: Number(e.target.value) })}
          className="w-full accent-[#810100]"
        />
      </label>

      <p className="text-center text-[10px] text-white/35">
        Drag the photo to reposition · use zoom to resize how it fills the circle
      </p>
    </div>
  );
}
