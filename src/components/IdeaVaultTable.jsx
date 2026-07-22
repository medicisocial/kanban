import { useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import ClientAvatar from './ClientAvatar';
import ReferenceVideoLink, { ReferenceMusicLink } from './clientPortal/ReferenceVideoLink';
import PostSlidesPanel from './PostSlidesPanel';
import TeamTaskCard from './TeamTaskCard';
import { getStructuredScript, hasStructuredScript } from '../utils/scriptFields';
import {
  surfacePanelClass,
  taskActionBtnClass,
  vaultRowActionsClass,
} from './clientPortal/clientPortalUi';

function contentReadyLabel(idea) {
  return idea.contentType === 'Carousel' || idea.contentType === 'Static Post'
    ? 'Post plan ready'
    : 'Script ready';
}

export default function IdeaVaultTable({
  ideas,
  onEdit,
  onSchedule,
  onMoveToReview,
  onOpenIdea,
  readOnly = false,
  hideClientColumn = false,
  emptyTitle,
  emptyDescription,
}) {
  const { getClientColor } = useClientsContext();
  const [expandedId, setExpandedId] = useState(null);

  const openIdea = (idea) => {
    if (onOpenIdea) {
      onOpenIdea(idea);
      return;
    }
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
          {emptyTitle ||
            (readOnly
              ? 'No approved concepts waiting for a shoot day.'
              : 'No approved concepts are waiting to be scheduled.')}
        </p>
        <p className="mt-2 text-xs text-white/35">
          {emptyDescription ||
            (readOnly
              ? 'When your team approves ideas, they appear here until scheduled on a shoot.'
              : 'When clients approve concepts, they stay here until you schedule them on a shoot.')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className={`${surfacePanelClass} mb-3 px-4 py-3`}>
        <p className="text-xs text-white/45">
          {sorted.length} concept{sorted.length === 1 ? '' : 's'}{' '}
          {readOnly ? 'ready to schedule' : 'approved and ready'}
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map((idea, index) => {
          const clientColor = getClientColor(idea.client);
          const typeStyle = getContentTypeStyle(idea.contentType);
          const expanded = expandedId === idea.id;
          const showScriptPanel =
            expanded &&
            hasStructuredScript(idea) &&
            (!(idea.contentType === 'Carousel' || idea.contentType === 'Static Post') || !readOnly);

          return (
            <TeamTaskCard
              key={idea.id}
              accentColor={clientColor}
              animationDelay={`${0.08 + index * 0.05}s`}
              onOpen={onOpenIdea || readOnly || onEdit ? () => openIdea(idea) : undefined}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="tesla-task-card-meta mb-2">
                      <span {...contentTypePipelinePillProps(typeStyle)}>
                        {idea.contentType || 'Reel'}
                      </span>
                      {!hideClientColumn && (
                        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
                          <ClientAvatar client={idea.client} size="xs" color={clientColor} />
                          <span className="truncate">{idea.client}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="truncate text-sm font-semibold text-white">
                      {idea.title || 'Untitled idea'}
                    </h3>
                    {idea.description?.trim() && (
                      <p className="mt-1 line-clamp-2 text-xs text-sky-200/70">
                        <span className="font-medium text-sky-200/90">Client notes: </span>
                        {idea.description}
                      </p>
                    )}
                    {hasStructuredScript(idea) && (
                      <span className="mt-1 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/45">
                        {contentReadyLabel(idea)}
                      </span>
                    )}
                    {(idea.referenceVideo?.trim() || idea.referenceMusic?.trim()) && (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {idea.referenceVideo?.trim() && (
                          <ReferenceVideoLink url={idea.referenceVideo} compact />
                        )}
                        {idea.referenceMusic?.trim() && (
                          <ReferenceMusicLink url={idea.referenceMusic} compact />
                        )}
                      </div>
                    )}
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
                  <div className={vaultRowActionsClass}>
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
                  </div>
                )}
              </div>
            </TeamTaskCard>
          );
        })}
      </div>
    </div>
  );
}
