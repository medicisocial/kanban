import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({
  column,
  cards,
  onAddCard,
  onCardClick,
  onDeleteCard,
  onReturnToVault,
  embedded = false,
  solo = false,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  const canAdd = column.id !== 'finished';

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column-lane ${solo ? 'kanban-column-lane-solo' : ''} ${
        embedded ? 'kanban-column-lane-embedded' : ''
      } ${isOver ? 'kanban-column-lane-over' : ''}`}
      style={embedded ? undefined : { minHeight: 'calc(100vh - 240px)' }}
    >
      {!solo && (
        <div className="kanban-column-sublabel">
          <span>{column.title}</span>
          {canAdd && (
            <button
              type="button"
              onClick={() => onAddCard(column.id)}
              className="kanban-column-sublabel-add"
              aria-label={`Add card to ${column.title}`}
            >
              +
            </button>
          )}
        </div>
      )}

      <div className="kanban-column-cards">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onClick={onCardClick}
            onDelete={onDeleteCard}
            onReturnToVault={column.id === 'shoot' ? onReturnToVault : undefined}
          />
        ))}

        {cards.length === 0 && (
          <div className="kanban-column-empty">
            {column.id === 'finished' ? 'Finished one-offs land here' : 'Drop cards here'}
          </div>
        )}
      </div>
    </div>
  );
}
