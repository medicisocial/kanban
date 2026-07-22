import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isSlidePostType } from '../utils/postSlides';
import ScriptPanel from './ScriptPanel';
import PostSlidesPanel from './PostSlidesPanel';
import ReferenceVideoLink, { ReferenceMusicLink } from './clientPortal/ReferenceVideoLink';
import {
  btnPrimaryClass,
  btnSecondaryClass,
  glassSegmentClass,
  inputClass,
} from './clientPortal/clientPortalUi';
import { IconClose } from './clientPortal/ClientPortalIcons';

const TABS = [
  { id: 'notes', label: 'Notes' },
  { id: 'script', label: 'Script' },
];

export default function ClientIdeaDetailModal({
  idea,
  onClose,
  onSave,
  onApprove,
  onDecline,
  canDecide = false,
  saving = false,
}) {
  const [activeTab, setActiveTab] = useState('notes');
  const [notes, setNotes] = useState(idea?.description || '');
  const [declineComment, setDeclineComment] = useState('');
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNotes(idea?.description || '');
    setActiveTab('notes');
    setDeclineComment('');
    setDeclining(false);
    setError('');
  }, [idea?.id]);

  useEffect(() => {
    if (!idea) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [idea, onClose]);

  if (!idea) return null;

  const slideType = isSlidePostType(idea.contentType);
  const dirty = notes.trim() !== String(idea.description || '').trim();

  const buildUpdates = () => ({
    description: notes.trim(),
  });

  const handleSave = async () => {
    setError('');
    try {
      await onSave?.(idea.id, buildUpdates());
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not save your notes.');
    }
  };

  const handleApprove = async () => {
    setError('');
    try {
      if (dirty) await onSave?.(idea.id, buildUpdates());
      await onApprove?.(idea.id, '');
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not approve this idea.');
    }
  };

  const handleDecline = async () => {
    const trimmed = declineComment.trim();
    if (!trimmed) {
      setError('Please explain why you are passing on this idea.');
      return;
    }
    setError('');
    try {
      if (dirty) await onSave?.(idea.id, buildUpdates());
      await onDecline?.(idea.id, trimmed);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not submit your response.');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden border border-white/10 bg-[#111111] shadow-2xl sm:rounded-lg">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
              {idea.contentType || 'Idea'}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-white">
              {idea.title || 'Untitled idea'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white/45 transition hover:text-white"
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>

        <div className={`${glassSegmentClass} mx-5 mt-4 flex w-fit gap-0.5 p-0.5`}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                activeTab === tab.id
                  ? 'rounded-sm bg-[#810100] text-white'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/45">
                  Your notes
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={8}
                  placeholder="Add context, talking points, or anything your production team should know…"
                  className={`${inputClass} resize-y`}
                />
              </label>
              {(idea.referenceVideo || idea.referenceMusic) && (
                <div className="flex flex-wrap gap-3">
                  {idea.referenceMusic && <ReferenceMusicLink url={idea.referenceMusic} />}
                  {idea.referenceVideo && <ReferenceVideoLink url={idea.referenceVideo} />}
                </div>
              )}
              {idea.clientComment && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                    Review feedback
                  </p>
                  <p className="mt-1 text-sm text-white/70">&ldquo;{idea.clientComment}&rdquo;</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'script' && (
            <div>
              {slideType ? (
                <PostSlidesPanel
                  contentType={idea.contentType}
                  caption={idea.caption || ''}
                  captionMode={idea.captionMode || 'shared'}
                  slides={idea.postSlides || []}
                  readOnly
                />
              ) : (
                <ScriptPanel
                  hook={idea.scriptHook || ''}
                  body={idea.scriptBody || idea.script || ''}
                  overlays={idea.scriptOverlays || ''}
                  caption={idea.caption || ''}
                  readOnly
                />
              )}
              <p className="mt-3 text-[10px] text-white/35">
                Script is view-only. Edit notes on the Notes tab to send updates to your team.
              </p>
            </div>
          )}

          {canDecide && declining && (
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/45">
                  Why are you passing? (required)
                </span>
                <textarea
                  value={declineComment}
                  onChange={(event) => setDeclineComment(event.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </label>
            </div>
          )}

          {error && (
            <p className="mt-4 border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onClose} className={btnSecondaryClass} disabled={saving}>
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={btnPrimaryClass}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
          {canDecide && !declining && (
            <>
              <button
                type="button"
                onClick={handleApprove}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
                disabled={saving}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setDeclining(true)}
                className={btnSecondaryClass}
                disabled={saving}
              >
                Pass
              </button>
            </>
          )}
          {canDecide && declining && (
            <button
              type="button"
              onClick={handleDecline}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-40"
              disabled={saving}
            >
              Submit pass
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
