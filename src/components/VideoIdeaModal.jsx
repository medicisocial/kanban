import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CONTENT_TYPES, IDEA_STATUSES } from "../constants";
import { useClientsContext } from "../context/ClientsContext";
import { normalizeLink } from "../utils/links";
import { isSlidePostType, normalizeCaptionMode, normalizePostSlides } from "../utils/postSlides";
import { btnPrimaryClass, btnSecondaryClass } from "./clientPortal/clientPortalUi";
import ReferenceVideoLink, { ReferenceMusicLink } from "./clientPortal/ReferenceVideoLink";
import ScriptPanel from "./ScriptPanel";
import PostSlidesPanel from "./PostSlidesPanel";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30";

export default function VideoIdeaModal({ onClose, onSave, onDelete, idea = null, defaultClient }) {
  const isEdit = Boolean(idea);
  const { clients, defaultClient: firstClient } = useClientsContext();

  const [form, setForm] = useState({
    client: idea?.client || (defaultClient && defaultClient !== "all" ? defaultClient : firstClient),
    title: idea?.title || "",
    referenceVideo: idea?.referenceVideo || "",
    referenceMusic: idea?.referenceMusic || "",
    description: idea?.description || "",
    scriptHook: idea?.scriptHook || "",
    scriptBody: idea?.scriptBody || idea?.script || "",
    scriptOverlays: idea?.scriptOverlays || "",
    caption: idea?.caption || "",
    captionMode: idea?.captionMode || "shared",
    postSlides: idea?.postSlides || [],
    contentType: idea?.contentType || "Reel",
  });
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const title = form.title.trim();
    const referenceVideo = normalizeLink(form.referenceVideo);
    const referenceMusic = normalizeLink(form.referenceMusic);

    if (!title) {
      setError("Please enter an idea title.");
      return;
    }

    onSave({
      ...form,
      title,
      referenceVideo: referenceVideo || "",
      referenceMusic: referenceMusic || "",
      description: form.description.trim(),
      scriptHook: form.scriptHook.trim(),
      scriptBody: form.scriptBody.trim(),
      scriptOverlays: form.scriptOverlays.trim(),
      caption: form.caption.trim(),
      captionMode: normalizeCaptionMode(form.captionMode, form.contentType),
      postSlides: normalizePostSlides(form.postSlides, form.contentType),
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[500]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-idea-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div className="pointer-events-none relative flex min-h-full items-center justify-center p-4 sm:p-6">
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
          style={{ maxHeight: "min(720px, calc(100dvh - 2rem))" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div className="min-w-0">
              {isEdit && idea?.status && idea.status !== "pending" && (
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {IDEA_STATUSES[idea.status]}
                </p>
              )}
              {!isEdit && (
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">New idea</p>
              )}
              <h2 id="video-idea-modal-title" className="text-lg font-semibold text-white">
                {isEdit ? "Edit Video Idea" : "Add Video Idea"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-lg text-gray-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="flex gap-1 border-b border-white/5 px-5 py-2">
            {[
              ["details", "Details"],
              ["script", "Script"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === id
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                }`}
              >
                {id === "script" && isSlidePostType(form.contentType) ? "Slides" : label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
            {activeTab === "details" && (
              <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Idea Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Summer launch reel concept"
                className={inputClass}
                autoFocus
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Client</span>
              <select
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                className={inputClass}
              >
                {clients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Content Type</span>
              <select
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                className={inputClass}
              >
                {CONTENT_TYPES.filter((t) => t !== "Story").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">
                Reference Video Link (optional)
              </span>
              <input
                type="text"
                value={form.referenceVideo}
                onChange={(e) => setForm({ ...form, referenceVideo: e.target.value })}
                placeholder="Paste Instagram, TikTok, or YouTube link..."
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-500">
                Paste any video URL — https:// is added automatically if needed.
              </p>
              {form.referenceVideo?.trim() && (
                <div className="mt-2">
                  <ReferenceVideoLink url={form.referenceVideo} />
                </div>
              )}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">
                Reference Music Link (optional)
              </span>
              <input
                type="text"
                value={form.referenceMusic}
                onChange={(e) => setForm({ ...form, referenceMusic: e.target.value })}
                placeholder="Paste Spotify, YouTube, or audio link..."
                className={inputClass}
              />
              {form.referenceMusic?.trim() && (
                <div className="mt-2">
                  <ReferenceMusicLink url={form.referenceMusic} />
                </div>
              )}
            </label>

            {/* Hide Notes for Client when editing an approved bank idea */}
            {!(isEdit && idea?.status === 'approved') && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Notes for Client</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Why this reference works, creative direction..."
                  className={`${inputClass} resize-y`}
                />
              </label>
            )}

              </>
            )}

            {activeTab === "script" && (
              <div>
                {form.contentType === "Carousel" || form.contentType === "Static Post" ? (
                  <PostSlidesPanel
                    contentType={form.contentType}
                    caption={form.caption}
                    captionMode={form.captionMode}
                    slides={form.postSlides}
                    onChange={(next) => setForm((current) => ({ ...current, ...next }))}
                  />
                ) : (
                  <ScriptPanel
                    hook={form.scriptHook}
                    body={form.scriptBody}
                    overlays={form.scriptOverlays}
                    caption={form.caption}
                    onChange={(next) =>
                      setForm((current) => ({
                        ...current,
                        ...(next.hook !== undefined ? { scriptHook: next.hook } : {}),
                        ...(next.body !== undefined ? { scriptBody: next.body } : {}),
                        ...(next.overlays !== undefined ? { scriptOverlays: next.overlays } : {}),
                        ...(next.caption !== undefined ? { caption: next.caption } : {}),
                      }))
                    }
                  />
                )}
                <p className="mt-2 text-[10px] text-gray-500">
                  Carries over to the card when this idea is scheduled.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/5 px-5 py-4">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(idea)}
                className={`${btnSecondaryClass} text-rose-300/80 hover:text-rose-200`}
              >
                Delete
              </button>
            )}
            <button type="button" onClick={onClose} className={`${btnSecondaryClass} min-w-0 flex-1`}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimaryClass} min-w-0 flex-1`}>
              {isEdit ? "Save Changes" : "Share with Client"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
