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
import { btnPrimaryClass, btnSecondaryClass, glassSegmentClass } from './clientPortal/clientPortalUi';

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
  staffName = '',
  clientAccountManagers = {},
}) {
  const [activeCard, setActiveCard] = useState(null);
  const [finishedExpanded, setFinishedExpanded] = useState(false);
  const [myCardsOnly, setMyCardsOnly] = useState(false);
  const [focusGroup, setFocusGroup] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filteredCards = useMemo(
    () =>
      filterCards(getBoardCards(cards), {
        client: clientFilter,
        assigneeFilter: myCardsOnly,
        staffName,
        clientAccountManagers,
      }),
    [cards, clientFilter, myCardsOnly, staffName, clientAccountManagers],
  );

  const visibleGroups = useMemo(() => {
    if (!focusGroup) return BOARD_COLUMN_GROUPS;
    return BOARD_COLUMN_GROUPS.filter((group) => group.id === focusGroup || group.collapsible);
  }, [focusGroup]);

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

  const finishedCount = cardsByColumn.finished?.length || 0;

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
      {embedded && (
        <ClientPortalSectionHeader
          title="Pipeline"
          description="Drag cards through create → edit → review → publish. Finished one-off projects stay in archive."
        />
      )}

      {embedded && (
        <div className={`${glassSegmentClass} mb-4 flex w-fit flex-wrap gap-0.5 p-0.5`}>
          {staffName && (
            <button
              type="button"
              onClick={() => setMyCardsOnly((value) => !value)}
              className={myCardsOnly ? `${btnPrimaryClass} py-1.5 text-[10px]` : `${btnSecondaryClass} py-1.5 text-[10px] border-0 bg-transparent`}
            >
              My cards
            </button>
          )}
          {BOARD_COLUMN_GROUPS.filter((group) => !group.collapsible).map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setFocusGroup((current) => (current === group.id ? null : group.id))}
              className={
                focusGroup === group.id
                  ? `${btnPrimaryClass} py-1.5 text-[10px]`
                  : `${btnSecondaryClass} py-1.5 text-[10px] border-0 bg-transparent`
              }
            >
              {group.label}
            </button>
          ))}
          {(myCardsOnly || focusGroup) && (
            <button
              type="button"
              onClick={() => {
                setMyCardsOnly(false);
                setFocusGroup(null);
              }}
              className={`${btnSecondaryClass} py-1.5 text-[10px] border-0 bg-transparent text-white/45`}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {embedded && filteredCards.length === 0 && (
        <div className="overview-role-panel glass-surface mb-4 px-6 py-10 text-center">
          <p className="text-sm text-white/45">No cards match the current filters.</p>
          {(myCardsOnly || focusGroup) && (
            <button
              type="button"
              onClick={() => {
                setMyCardsOnly(false);
                setFocusGroup(null);
              }}
              className={`${btnSecondaryClass} mt-3 py-1.5 text-[10px]`}
            >
              Show all cards
            </button>
          )}
        </div>
      )}

      <div className={`w-full overflow-x-auto ${embedded ? 'pb-2' : 'scroll-px-4 pb-6 sm:scroll-px-6'}`}>
        <div className={embedded ? 'flex w-max gap-4' : 'flex justify-center px-4 sm:px-6'}>
          <div className="flex w-max gap-4">
            {visibleGroups.map((group) => {
              const isArchive = group.collapsible;
              const groupCount = group.columnIds.reduce(
                (sum, id) => sum + (cardsByColumn[id]?.length || 0),
                0,
              );

              if (isArchive && !finishedExpanded) {
                return (
                  <div key={group.id} className="overview-role-panel glass-surface flex w-[160px] shrink-0 flex-col">
                    <div className="overview-role-panel-header">
                      <h3 className="overview-role-title">{group.label}</h3>
                    </div>
                    <div className="overview-role-panel-body overview-role-panel-body-single mx-4 mb-4">
                      <button
                        type="button"
                        onClick={() => setFinishedExpanded(true)}
                        className="overview-pipeline-metric overview-pipeline-metric-interactive w-full text-left"
                      >
                        <p className="overview-pipeline-metric-label">Finished projects</p>
                        <p className="overview-pipeline-metric-value">{groupCount}</p>
                        <p className="mt-1 text-[11px] text-white/40">Tap to expand</p>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={group.id} className="overview-role-panel glass-surface flex shrink-0 flex-col">
                  <div className="overview-role-panel-header-row">
                    <h3 className="overview-role-title">{group.label}</h3>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-white/45">{groupCount}</span>
                      {isArchive && (
                        <button
                          type="button"
                          onClick={() => setFinishedExpanded(false)}
                          className="text-[11px] text-white/40 transition hover:text-white/75"
                        >
                          Collapse
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overview-role-panel-body overview-role-panel-body-kanban mx-4 mb-4">
                    <div className="kanban-group-columns">
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
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {finishedCount > 0 && !finishedExpanded && embedded && (
        <p className="mt-2 text-xs text-white/35">
          {finishedCount} finished one-off project{finishedCount === 1 ? '' : 's'} in archive.
        </p>
      )}

      <DragOverlay
        style={{ cursor: 'grabbing' }}
        dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}
      >
        {activeCard ? <CardPreview card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
