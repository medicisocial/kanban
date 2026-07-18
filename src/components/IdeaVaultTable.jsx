import { useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { normalizeLink } from '../utils/links';
import ClientAvatar from './ClientAvatar';
import ReferenceVideoLink, { ReferenceMusicLink } from './clientPortal/ReferenceVideoLink';
import DebouncedField from './DebouncedField';
import PostSlidesPanel from './PostSlidesPanel';
import { getStructuredScript, hasStructuredScript } from '../utils/scriptFields';
import {
  inputClass,
  selectClass,
  surfacePanelClass,
  taskActionBtnClass,
} from './clientPortal/clientPortalUi';

const referenceInputClass = `${inputClass} !py-1.5 !text-xs min-w-[140px]`;
const typeSelectClass = `${selectClass} w-auto min-w-[96px] !py-1.5 !text-xs uppercase tracking-wider`;

const BANK_TYPE_OPTIONS = [
  { value: 'Reel', label: 'Reel' },
  { value: 'Carousel', label: 'Carousel' },
  { value: 'Static Post', label: 'Static' },
];

function bankTypeLabel(value) {
  return BANK_TYPE_OPTIONS.find((option) => option.value === value)?.label || value || '—';
}

function contentReadyLabel(idea) {
  return idea.contentType === 'Carousel' || idea.contentType === 'Static Post'
    ? 'Post plan ready'
    : 'Script ready';
}

function IdeaReferenceField({ ideaId, value = '', onSave, readOnly = false, compact = false }) {
  const commitReference = (raw) => {
    const referenceVideo = normalizeLink(String(raw || '').trim()) || '';
    if (referenceVideo === (value || '')) return;
    onSave?.(ideaId, referenceVideo);
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData?.getData('text')?.trim();
    if (!pasted) return;
    const normalized = normalizeLink(pasted);
    if (normalized) {
      event.preventDefault();
      commitReference(normalized);
    }
  };

  if (readOnly) {
    return <ReferenceVideoLink url={value} compact={compact} />;
  }

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${compact ? 'flex-wrap' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <DebouncedField
        value={value || ''}
        resetKey={ideaId}
        onCommit={commitReference}
        commitOnBlur
        placeholder="Paste link…"
        className={`${referenceInputClass} min-w-0 flex-1`}
        onPaste={handlePaste}
      />
      {value?.trim() ? (
        <div className="shrink-0">
          <ReferenceVideoLink url={value} compact />
        </div>
      ) : null}
    </div>
  );
}

function IdeaContentTypeField({ ideaId, value = 'Reel', onSave, readOnly = false }) {
  const options =
    value && !BANK_TYPE_OPTIONS.some((option) => option.value === value)
      ? [{ value, label: value }, ...BANK_TYPE_OPTIONS]
      : BANK_TYPE_OPTIONS;

  if (readOnly) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {bankTypeLabel(value)}
      </span>
    );
  }

  return (
    <select
      value={value || 'Reel'}
      onChange={(event) => {
        const next = event.target.value;
        if (next !== value) onSave?.(ideaId, next);
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={typeSelectClass}
      aria-label="Content type"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function IdeaVaultTable({
  ideas,
  onEdit,
  onSchedule,
  onMoveToReview,
  onMakeOneOff,
  onUpdateReference,
  onUpdateContentType,
  readOnly = false,
  hideClientColumn = false,
}) {
  const { getClientColor } = useClientsContext();
  const [expandedId, setExpandedId] = useState(null);

  const openIdeaFromRow = (event, idea) => {
    if (event.target.closest('button, a, input, select, textarea, label')) return;
    if (readOnly) {
      setExpandedId((prev) => (prev === idea.id ? null : idea.id));
      return;
    }
    onEdit?.(idea);
  };

  const handleRowKeyDown = (event, idea) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (readOnly) {
      setExpandedId((prev) => (prev === idea.id ? null : idea.id));
      return;
    }
    onEdit?.(idea);
  };

  const sorted = useMemo(
    () =>
      [...ideas].sort((a, b) => {
        const clientCompare = (a.client || '').localeCompare(b.client || '');
        if (clientCompare !== 0) return clientCompare;
        return (b.reviewedAt || b.createdAt || 0) - (a.reviewedAt || a.createdAt || 0);
      }),
    [ideas],
  );

  if (sorted.length === 0) {
    return (
      <div className={`${surfacePanelClass} px-4 py-16 text-center`}>
        <p className="text-sm text-white/45">
          {readOnly
            ? 'No approved concepts waiting for a shoot day.'
            : 'No approved concepts are waiting to be scheduled.'}
        </p>
        <p className="mt-2 text-xs text-white/35">
          {readOnly
            ? 'When your team approves ideas, they appear here until scheduled on a shoot.'
            : 'When clients approve concepts, they stay here until you schedule them on a shoot.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`${surfacePanelClass} overflow-hidden`}>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-xs text-white/45">
          {sorted.length} concept{sorted.length === 1 ? '' : 's'}{' '}
          {readOnly ? 'ready to schedule' : 'approved and ready'}
        </p>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {sorted.map((idea) => {
          const clientColor = getClientColor(idea.client);
          const expanded = expandedId === idea.id;
          const showScriptPanel =
            expanded &&
            hasStructuredScript(idea) &&
            (!(idea.contentType === 'Carousel' || idea.contentType === 'Static Post') || !readOnly);

          return (
            <article
              key={idea.id}
              className={`flex flex-col gap-3 px-4 py-3 transition hover:bg-white/[0.04] sm:flex-row sm:items-center ${
                readOnly || onEdit ? 'cursor-pointer' : ''
              }`}
              onClick={(event) => openIdeaFromRow(event, idea)}
              onKeyDown={(event) => handleRowKeyDown(event, idea)}
              role="button"
              tabIndex={0}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <IdeaContentTypeField
                      ideaId={idea.id}
                      value={idea.contentType}
                      onSave={onUpdateContentType}
                      readOnly={readOnly}
                    />
                    {hasStructuredScript(idea) && (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/45">
                        {contentReadyLabel(idea)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 truncate text-sm font-semibold text-white">
                    {idea.title || 'Untitled idea'}
                  </h3>
                  {!hideClientColumn && (
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/45">
                      <ClientAvatar client={idea.client} size="xs" color={clientColor} />
                      <span className="truncate">{idea.client}</span>
                    </div>
                  )}
                  <div className="mt-2 space-y-1.5">
                    <IdeaReferenceField
                      ideaId={idea.id}
                      value={idea.referenceVideo}
                      onSave={onUpdateReference}
                      readOnly={readOnly}
                      compact
                    />
                    {idea.referenceMusic?.trim() && (
                      <ReferenceMusicLink url={idea.referenceMusic} compact />
                    )}
                  </div>
                  {showScriptPanel && (
                    <div className="mt-3 border border-white/10 bg-white/[0.02] p-3 text-sm text-white/70">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        {idea.contentType === 'Carousel' || idea.contentType === 'Static Post'
                          ? 'Post plan'
                          : 'Script'}
                      </p>
                      {idea.contentType === 'Carousel' || idea.contentType === 'Static Post' ? (
                        <div className="mt-2">
                          <PostSlidesPanel
                            contentType={idea.contentType}
                            caption={idea.caption || ''}
                            captionMode={idea.captionMode || 'shared'}
                            slides={idea.postSlides || []}
                            readOnly
                          />
                        </div>
                      ) : (
                        (() => {
                          const script = getStructuredScript(idea);
                          return (
                            <div className="mt-1 space-y-2 text-xs text-white/65">
                              {script.hook && (
                                <p>
                                  <span className="text-white/40">Hook: </span>
                                  {script.hook}
                                </p>
                              )}
                              {script.body && (
                                <p className="whitespace-pre-wrap">
                                  <span className="text-white/40">Body: </span>
                                  {script.body}
                                </p>
                              )}
                              {script.overlays && (
                                <p className="whitespace-pre-wrap">
                                  <span className="text-white/40">Overlays: </span>
                                  {script.overlays}
                                </p>
                              )}
                              {script.caption && (
                                <p className="whitespace-pre-wrap">
                                  <span className="text-white/40">Caption: </span>
                                  {script.caption}
                                </p>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!readOnly && (
                <div className="flex shrink-0 flex-col gap-1.5 sm:items-stretch">
                  <button
                    type="button"
                    onClick={() => onSchedule?.(idea)}
                    className={taskActionBtnClass}
                  >
                    Add to shoot
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveToReview?.(idea.id)}
                    className={taskActionBtnClass}
                  >
                    Move to Review
                  </button>
                  {onMakeOneOff && (
                    <button
                      type="button"
                      onClick={() => onMakeOneOff(idea)}
                      className={taskActionBtnClass}
                    >
                      Make one-off
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
