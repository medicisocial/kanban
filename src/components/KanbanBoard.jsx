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
import { COLUMNS } from '../constants';
import { filterCards, getBoardCards } from '../utils';
import KanbanColumn from './KanbanColumn';
import CardPreview from './CardPreview';

const COLUMN_IDS = new Set(COLUMNS.map((c) => c.id));

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
  search,
}) {
  const [activeCard, setActiveCard] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filteredCards = useMemo(
    () => filterCards(getBoardCards(cards), { client: clientFilter, search }),
    [cards, clientFilter, search],
  );

  const cardsByColumn = useMemo(() => {
    const map = {};
    COLUMNS.forEach((col) => {
      map[col.id] = filteredCards.filter((c) => c.columnId === col.id);
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
      <div className="flex gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={cardsByColumn[column.id]}
            onAddCard={onAddCard}
            onCardClick={onCardClick}
            onDeleteCard={onDeleteCard}
          />
        ))}
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
