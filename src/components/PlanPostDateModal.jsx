import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getContentTypeStyle } from '../constants';
import {
  addMonths,
  getCalendarPosts,
  getDefaultCalendarDate,
  groupCardsByDate,
  parseDateKey,
  toDateKey,
} from '../utils/calendar';
import { formatDate, formatTime } from '../utils';
import CalendarMonthView from './CalendarMonthView';
import CalendarEvent from './CalendarEvent';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

function getClientPlanCalendarCards(cards, client, excludeCardId) {
  return getCalendarPosts(cards).filter(
    (c) => c.client === client && c.id !== excludeCardId,
  );
}

export default function PlanPostDateModal({ card, cards, onClose, onSave, onOpenCard }) {
  const initialDate = card.dueDate || '';
  const [focusDate, setFocusDate] = useState(() =>
    initialDate ? parseDateKey(initialDate) : getDefaultCalendarDate(),
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [dueTime, setDueTime] = useState(card.dueTime || '');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const clientCalendarCards = useMemo(
    () => getClientPlanCalendarCards(cards, card.client, card.id),
    [cards, card.client, card.id],
  );

  const cardsByDate = useMemo(() => groupCardsByDate(clientCalendarCards), [clientCalendarCards]);

  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return [];
    return cardsByDate[selectedDate] || [];
  }, [cardsByDate, selectedDate]);

  const typeStyle = getContentTypeStyle(card.contentType);

  const handleSelectDate = (day) => {
    setSelectedDate(toDateKey(day));
    setFocusDate(day);
    setError('');
  };

  const handleCardClick = (clickedCard) => {
    onOpenCard?.(clickedCard);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDate) {
      setError('Pick a date on the calendar.');
      return;
    }
    onSave(card.id, { dueDate: selectedDate, dueTime });
    onClose();
  };

  const navBtnClass = `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[96vh] w-full max-w-[min(1600px,98vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/5 px-5 py-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-300">Target post date</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{card.title}</h2>
          <p className="mt-1 text-sm text-gray-400">
            {card.client} · {card.contentType} content calendar · click a post to open it
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row">
          <div className="min-w-0 flex-1 border-b border-white/5 p-3 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFocusDate((d) => addMonths(d, -1))}
                className={navBtnClass}
              >
                ← Prev
              </button>
              <button type="button" onClick={() => setFocusDate(new Date())} className={navBtnClass}>
                Today
              </button>
              <button
                type="button"
                onClick={() => setFocusDate((d) => addMonths(d, 1))}
                className={navBtnClass}
              >
                Next →
              </button>
            </div>

            <p className="mb-3 text-xs text-gray-500">
              Click a day to set when this post should go live. Click any existing post to open its card.
            </p>

            <div className={`${surfacePanelClass} p-4`}>
              <CalendarMonthView
                focusDate={focusDate}
                cardsByDate={cardsByDate}
                selectedDateKey={selectedDate}
                onSelectDate={handleSelectDate}
                onCardClick={handleCardClick}
                overviewLabel="content"
              />
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col xl:w-[340px] 2xl:w-[380px]">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Selected date</p>
                <p className="mt-1 text-base font-semibold text-white">
                  {selectedDate ? formatDate(selectedDate) : 'None selected'}
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish time (optional)</span>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className={inputClass}
                />
              </label>

              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {selectedDate
                    ? `On ${formatDate(selectedDate)}`
                    : `${card.client} calendar`}
                </p>

                <div className="space-y-2">
                  {selectedDate && (
                    <div
                      className="rounded-lg border border-dashed border-violet-400/40 bg-violet-500/10 p-3"
                      style={{ borderLeftWidth: 3, borderLeftColor: typeStyle.border }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                        This card
                      </p>
                      <p className="mt-1 text-sm font-medium leading-snug text-white">{card.title}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {card.contentType}
                        {dueTime ? ` · ${formatTime(dueTime)}` : ''}
                      </p>
                    </div>
                  )}

                  {selectedDate && selectedDayPosts.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
                      No other posts scheduled for {card.client} on this day.
                    </p>
                  )}

                  {selectedDayPosts.map((entry) => (
                    <CalendarEvent
                      key={entry.id}
                      card={entry}
                      onClick={handleCardClick}
                      compact
                    />
                  ))}

                  {!selectedDate && clientCalendarCards.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
                      No other posts on {card.client}&apos;s content calendar yet.
                    </p>
                  )}

                  {!selectedDate && clientCalendarCards.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Select a date to see what else is scheduled that day for {card.client}.
                    </p>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="flex gap-2 border-t border-white/5 p-4 sm:p-5">
              <button type="button" onClick={onClose} className={`${btnSecondaryClass} flex-1`}>
                Cancel
              </button>
              <button type="submit" className={`${btnPrimaryClass} flex-1`}>
                Set post date
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
