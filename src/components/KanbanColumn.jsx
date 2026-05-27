import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column, cards, onAddCard, onCardClick, onDeleteCard, embedded = false }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column-lane ${isOver ? 'kanban-column-lane-over' : ''}`}
      style={{ minHeight: embedded ? '480px' : 'calc(100vh - 220px)' }}
    >
      <div className="kanban-column-header">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="kanban-column-title">{column.title}</h4>
          <span className="kanban-column-count">{cards.length}</span>
        </div>
        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          className={`kanban-column-add ${
            column.id === 'finished' ? 'invisible pointer-events-none' : ''
          }`}
          aria-label={`Add card to ${column.title}`}
          tabIndex={column.id === 'finished' ? -1 : 0}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="kanban-column-cards">
        {cards.map((card) => (
          <KanbanCard key={card.id} card={card} onClick={onCardClick} onDelete={onDeleteCard} />
        ))}

        {cards.length === 0 && (
          <div className="kanban-column-empty">
            {column.id === 'finished' ? 'Approved one-off projects land here when done' : 'Drop cards here'}
          </div>
        )}
      </div>
    </div>
  );
}
