import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTENT_TYPES, IDEA_STATUSES } from "../constants";
import { useClientsContext } from "../context/ClientsContext";
import { normalizeLink } from "../utils/links";
import { btnPrimaryClass } from "./clientPortal/clientPortalUi";

const inputClass =
  "select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30";

export default function VideoIdeaModal({ onClose, onSave, idea = null, defaultClient }) {
  const overlayRef = useRef(null);
  const isEdit = Boolean(idea);
  const { clients, defaultClient: firstClient } = useClientsContext();

  const [form, setForm] = useState({
    client: idea?.client || (defaultClient && defaultClient !== "all" ? defaultClient : firstClient),
    title: idea?.title || "",
    referenceVideo: idea?.referenceVideo || "",
    description: idea?.description || "",
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
      clientComment: form.clientComment.trim(),
    });
    onClose();
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[270] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="my-4 flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            {isEdit && idea?.status && idea.status !== "pending" && (
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {IDEA_STATUSES[idea.status]}
              </p>
            )}
            {!isEdit && (
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">New idea</p>
            )}
            <h2 className="text-lg font-semibold text-white">
              {isEdit ? "Edit Video Idea" : "Add Video Idea"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
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

        <div className="shrink-0 border-t border-white/5 px-5 py-4">
          <button
            type="submit"
            className={`${btnPrimaryClass} w-full`}
          >
            {isEdit ? "Save Changes" : "Share with Client"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
