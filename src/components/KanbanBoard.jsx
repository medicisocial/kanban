import { useState, useMemo, useCallback, memo } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { COLUMNS, BOARD_COLUMN_GROUPS } from '../constants';
import { filterCards, getBoardCards, getPipelineClientNames, sortPipelineCards } from '../utils';
import KanbanColumn from './KanbanColumn';
import CardPreview from './CardPreview';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';

const COLUMN_IDS = new Set(COLUMNS.map((c) => c.id));
const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

function resolveColumnId(over, cards) {
  if (!over) return null;

  const data = over.data.current;
  if (data?.type === 'column') return data.columnId;
  if (data?.type === 'card') return data.columnId;

  if (COLUMN_IDS.has(over.id)) return over.id;

  const overCard = cards.find((c) => c.id === over.id);
  if (overCard) return overCard.columnId;

  return null;
}

function collisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) {
    const columnHit = rectCollisions.find((c) => COLUMN_IDS.has(c.id));
    if (columnHit) return [columnHit];
    return rectCollisions;
  }

  return closestCenter(args);
}

function KanbanClientSectionHeader({ client, color }) {
  return (
    <div className="kanban-client-pipeline-header">
      <span className="kanban-client-pipeline-dot" style={{ backgroundColor: color }} aria-hidden />
      <h3 className="kanban-client-pipeline-title">{client}</h3>
    </div>
  );
}

const KanbanBoardView = memo(function KanbanBoardView({
  cards,
  onAddCard,
  onCardClick,
  onDeleteCard,
  onReturnToVault,
  onMoveCard,
  boardClient,
  embedded = false,
  nested = false,
}) {
  const [activeCard, setActiveCard] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [finishedExpanded, setFinishedExpanded] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filteredCards = useMemo(
    () => filterCards(getBoardCards(cards), { client: boardClient }),
    [cards, boardClient],
  );

  const boardCards = useMemo(() => {
    if (!dragPreview) return filteredCards;
    return filteredCards.map((card) =>
      card.id === dragPreview.cardId
        ? { ...card, columnId: dragPreview.previewColumnId }
        : card,
    );
  }, [filteredCards, dragPreview]);

  const cardsByColumn = useMemo(() => {
    const map = {};
    COLUMNS.forEach((col) => {
      map[col.id] = sortPipelineCards(
        boardCards.filter((c) => {
          if (c.columnId !== col.id) return false;
          if (col.id === 'finished') return c.isOneOffProject;
          if (c.isOneOffProject) {
            return ['shoot', 'editing', 'in-review', 'approved'].includes(col.id);
          }
          return true;
        }),
      );
    });
    return map;
  }, [boardCards]);

  const handleAddCard = useCallback(
    (columnId) => {
      onAddCard(columnId, { client: boardClient });
    },
    [boardClient, onAddCard],
  );

  const handleDragStart = useCallback(
    (event) => {
      const card = cards.find((c) => c.id === event.active.id);
      if (card) {
        setDragPreview({
          cardId: card.id,
          originColumnId: card.columnId,
          previewColumnId: card.columnId,
        });
      }
      setActiveCard(card || null);
    },
    [cards],
  );

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeData = active.data.current;
      if (activeData?.type !== 'card') return;

      const targetColumnId = resolveColumnId(over, cards);
      if (!targetColumnId) return;

      setDragPreview((prev) => {
        if (!prev || prev.cardId !== active.id) return prev;
        if (prev.previewColumnId === targetColumnId) return prev;
        return { ...prev, previewColumnId: targetColumnId };
      });
    },
    [cards],
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      const originColumnId = dragPreview?.originColumnId;
      setActiveCard(null);
      setDragPreview(null);

      if (!over) return;

      const targetColumnId = resolveColumnId(over, cards);
      if (!targetColumnId) return;

      if (originColumnId && originColumnId !== targetColumnId) {
        onMoveCard(active.id, targetColumnId);
      }
    },
    [cards, dragPreview, onMoveCard],
  );

  const handleDragCancel = useCallback(() => {
    setActiveCard(null);
    setDragPreview(null);
  }, []);

  const showEmptyState = embedded && !nested && filteredCards.length === 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {embedded && !nested && <ClientPortalSectionHeader title="Pipeline" compact />}

      {showEmptyState && (
        <div className="mb-4 border border-dashed border-white/10 px-6 py-10 text-center">
          <p className="text-sm text-white/45">No cards match the current filters.</p>
        </div>
      )}

      {!showEmptyState && (
        <div
          className={`kanban-board-scroll flex w-full overflow-x-auto overscroll-x-contain ${
            embedded
              ? nested
                ? 'pb-1 md:-mx-8 md:scroll-px-8 md:px-8 lg:-mx-10 lg:scroll-px-10 lg:px-10'
                : 'pb-2 md:-mx-8 md:scroll-px-8 md:px-8 lg:-mx-10 lg:scroll-px-10 lg:px-10'
              : 'scroll-px-4 pb-6 sm:scroll-px-6'
          }`}
        >
          <div className="flex w-max gap-3 px-1">
            {BOARD_COLUMN_GROUPS.map((group) => {
              const isArchive = group.collapsible;
              const solo = group.columnIds.length === 1;
              const primaryColumn = COLUMN_BY_ID[group.columnIds[0]];
              const groupCount = group.columnIds.reduce(
                (sum, id) => sum + (cardsByColumn[id]?.length || 0),
                0,
              );
              const canAdd = primaryColumn && primaryColumn.id !== 'finished';

              if (isArchive && !finishedExpanded) {
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setFinishedExpanded(true)}
                    className="kanban-archive-collapsed glass-surface"
                    aria-label={`Expand archive, ${groupCount} finished projects`}
                  >
                    <span className="kanban-archive-collapsed-label">Archive</span>
                    <span className="kanban-archive-collapsed-count">{groupCount}</span>
                  </button>
                );
              }

              return (
                <section
                  key={group.id}
                  className={`kanban-stage glass-surface ${solo ? '' : 'kanban-stage-wide'}`}
                >
                  <div className="kanban-stage-header">
                    <h3 className="kanban-stage-title">{group.label}</h3>
                    <div className="kanban-stage-actions">
                      {isArchive && (
                        <button
                          type="button"
                          onClick={() => setFinishedExpanded(false)}
                          className="kanban-stage-action"
                        >
                          Collapse
                        </button>
                      )}
                      {solo && canAdd && (
                        <button
                          type="button"
                          onClick={() => handleAddCard(primaryColumn.id)}
                          className="kanban-stage-add"
                          aria-label={`Add card to ${group.label}`}
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`kanban-stage-columns ${solo ? 'kanban-stage-columns-solo' : ''}`}>
                    {group.columnIds.map((columnId) => {
                      const column = COLUMN_BY_ID[columnId];
                      if (!column) return null;
                      return (
                        <KanbanColumn
                          key={column.id}
                          column={column}
                          cards={cardsByColumn[column.id]}
                          onAddCard={handleAddCard}
                          onCardClick={onCardClick}
                          onDeleteCard={onDeleteCard}
                          onReturnToVault={onReturnToVault}
                          embedded={embedded}
                          solo={solo}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <DragOverlay
        style={{ cursor: 'grabbing' }}
        dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}
      >
        {activeCard ? <CardPreview card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
});

function KanbanBoard({
  cards,
  onAddCard,
  onCardClick,
  onDeleteCard,
  onReturnToVault,
  onMoveCard,
  clientFilter,
  getClientColor,
  embedded = false,
}) {
  const pipelineClients = useMemo(() => getPipelineClientNames(cards), [cards]);
  const showAllClients = !clientFilter || clientFilter === 'all';
  const resolveClientColor = useCallback(
    (client) => getClientColor?.(client) || '#9ca3af',
    [getClientColor],
  );

  if (showAllClients && pipelineClients.length === 0) {
    return (
      <>
        {embedded && <ClientPortalSectionHeader title="Pipeline" compact />}
        <div className="mb-4 border border-dashed border-white/10 px-6 py-10 text-center">
          <p className="text-sm text-white/45">No pipeline cards yet.</p>
        </div>
      </>
    );
  }

  if (!showAllClients || pipelineClients.length === 1) {
    const boardClient = showAllClients ? pipelineClients[0] : clientFilter;
    return (
      <KanbanBoardView
        cards={cards}
        onAddCard={onAddCard}
        onCardClick={onCardClick}
        onDeleteCard={onDeleteCard}
        onReturnToVault={onReturnToVault}
        onMoveCard={onMoveCard}
        boardClient={boardClient}
        embedded={embedded}
      />
    );
  }

  return (
    <div className="kanban-pipeline-by-client">
      {embedded && <ClientPortalSectionHeader title="Pipeline" compact />}
      {pipelineClients.map((client) => (
        <section key={client} className="kanban-client-pipeline">
          <KanbanClientSectionHeader client={client} color={resolveClientColor(client)} />
          <KanbanBoardView
            cards={cards}
            onAddCard={onAddCard}
            onCardClick={onCardClick}
            onDeleteCard={onDeleteCard}
            onReturnToVault={onReturnToVault}
            onMoveCard={onMoveCard}
            boardClient={client}
            embedded={embedded}
            nested
          />
        </section>
      ))}
    </div>
  );
}

export default memo(KanbanBoard);
