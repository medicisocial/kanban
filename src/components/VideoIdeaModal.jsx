import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CONTENT_TYPES, IDEA_STATUSES } from "../constants";
import { useClientsContext } from "../context/ClientsContext";
import { normalizeLink } from "../utils/links";
import { btnPrimaryClass, btnSecondaryClass } from "./clientPortal/clientPortalUi";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30";

export default function VideoIdeaModal({ onClose, onSave, idea = null, defaultClient }) {
  const isEdit = Boolean(idea);
  const { clients, defaultClient: firstClient } = useClientsContext();

  const [form, setForm] = useState({
    client: idea?.client || (defaultClient && defaultClient !== "all" ? defaultClient : firstClient),
    title: idea?.title || "",
    referenceVideo: idea?.referenceVideo || "",
    description: idea?.description || "",
    scriptHook: idea?.scriptHook || "",
    scriptBody: idea?.scriptBody || "",
    scriptOverlays: idea?.scriptOverlays || "",
    contentType: idea?.contentType || "Reel",
    clientComment: idea?.clientComment || "",
  });
  const [error, setError] = useState("");

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

    if (!title) {
      setError("Please enter an idea title.");
      return;
    }

    onSave({
      ...form,
      title,
      referenceVideo: referenceVideo || "",
      description: form.description.trim(),
      scriptHook: form.scriptHook.trim(),
      scriptBody: form.scriptBody.trim(),
      scriptOverlays: form.scriptOverlays.trim(),
      clientComment: form.clientComment.trim(),
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

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
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

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Hook</span>
                <textarea
                  value={form.scriptHook}
                  onChange={(e) => setForm({ ...form, scriptHook: e.target.value })}
                  rows={3}
                  placeholder="First 1–3 seconds — opening line / hook"
                  className={`${inputClass} resize-y`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Body</span>
                <textarea
                  value={form.scriptBody}
                  onChange={(e) => setForm({ ...form, scriptBody: e.target.value })}
                  rows={6}
                  placeholder="Main beats, dialogue, B-roll notes"
                  className={`${inputClass} resize-y`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Text overlays</span>
                <textarea
                  value={form.scriptOverlays}
                  onChange={(e) => setForm({ ...form, scriptOverlays: e.target.value })}
                  rows={4}
                  placeholder="On-screen copy, line by line"
                  className={`${inputClass} resize-y`}
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Carries over to the shoot script when this idea is scheduled.
                </p>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-400">Client Comment</span>
              <textarea
                value={form.clientComment}
                onChange={(e) => setForm({ ...form, clientComment: e.target.value })}
                rows={2}
                placeholder="Client feedback on this idea..."
                className={`${inputClass} resize-y`}
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-white/5 px-5 py-4">
            <button type="button" onClick={onClose} className={`${btnSecondaryClass} flex-1`}>
              Cancel
            </button>
            <button type="submit" className={`${btnPrimaryClass} flex-1`}>
              {isEdit ? "Save Changes" : "Share with Client"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
