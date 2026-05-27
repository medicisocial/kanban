import { useState, useMemo, useCallback } from 'react';
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
import { filterCards, getBoardCards } from '../utils';
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

export default function KanbanBoard({
  cards,
  onAddCard,
  onCardClick,
  onDeleteCard,
  onMoveCard,
  clientFilter,
  embedded = false,
}) {
  const [activeCard, setActiveCard] = useState(null);
  const [finishedExpanded, setFinishedExpanded] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filteredCards = useMemo(
    () => filterCards(getBoardCards(cards), { client: clientFilter }),
    [cards, clientFilter],
  );

  const visibleGroups = BOARD_COLUMN_GROUPS;

  const cardsByColumn = useMemo(() => {
    const map = {};
    COLUMNS.forEach((col) => {
      map[col.id] = filteredCards.filter((c) => {
        if (c.columnId !== col.id) return false;
        if (col.id === 'finished') return c.isOneOffProject;
        if (c.isOneOffProject) {
          return ['editing', 'in-review', 'approved'].includes(col.id);
        }
        return true;
      });
    });
    return map;
  }, [filteredCards]);


  const handleDragStart = useCallback((event) => {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card || null);
  }, [cards]);

  const handleDragOver = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    if (activeData?.type !== 'card') return;

    const targetColumnId = resolveColumnId(over, cards);
    if (!targetColumnId) return;

    const activeCardData = cards.find((c) => c.id === active.id);
    if (!activeCardData || activeCardData.columnId === targetColumnId) return;

    onMoveCard(active.id, targetColumnId);
  }, [cards, onMoveCard]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const targetColumnId = resolveColumnId(over, cards);
    if (!targetColumnId) return;

    const card = cards.find((c) => c.id === active.id);
    if (card && card.columnId !== targetColumnId) {
      onMoveCard(active.id, targetColumnId);
    }
  }, [cards, onMoveCard]);

  const handleDragCancel = useCallback(() => {
    setActiveCard(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {embedded && <ClientPortalSectionHeader title="Pipeline" compact />}

      {embedded && filteredCards.length === 0 && (
        <div className="mb-4 border border-dashed border-white/10 px-6 py-10 text-center">
          <p className="text-sm text-white/45">No cards match the current filters.</p>
        </div>
      )}

      <div className={`flex w-full justify-center overflow-x-auto ${embedded ? 'pb-2' : 'scroll-px-4 pb-6 sm:scroll-px-6'}`}>
        <div className="flex w-max gap-3 px-1">
          {visibleGroups.map((group) => {
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
                <section key={group.id} className={`kanban-stage glass-surface ${solo ? '' : 'kanban-stage-wide'}`}>
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
                          onClick={() => onAddCard(primaryColumn.id)}
                          className="kanban-stage-add"
                          aria-label={`Add card to ${group.label}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
                          onAddCard={onAddCard}
                          onCardClick={onCardClick}
                          onDeleteCard={onDeleteCard}
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

      <DragOverlay
        style={{ cursor: 'grabbing' }}
        dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}
      >
        {activeCard ? <CardPreview card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
