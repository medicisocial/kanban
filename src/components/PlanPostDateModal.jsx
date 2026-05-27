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
import { formatDate, formatTime, formatScheduledDateTime } from '../utils';
import CalendarMonthView from './CalendarMonthView';
import CalendarEvent from './CalendarEvent';
import TimeInput from './TimeInput';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

const modalInputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

function getClientPlanCalendarCards(cards, client) {
  return getCalendarPosts(cards).filter((c) => c.client === client);
}

function sortCalendarCards(a, b) {
  const dateCmp = (a.dueDate || '').localeCompare(b.dueDate || '');
  if (dateCmp !== 0) return dateCmp;
  return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
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
    () => getClientPlanCalendarCards(cards, card.client),
    [cards, card.client],
  );

  const cardsByDate = useMemo(() => {
    const map = groupCardsByDate(
      clientCalendarCards.filter((entry) => entry.id !== card.id),
    );

    if (selectedDate) {
      const previewCard = { ...card, dueDate: selectedDate, dueTime };
      const dayCards = [...(map[selectedDate] || []), previewCard];
      dayCards.sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));
      map[selectedDate] = dayCards;
    }

    return map;
  }, [clientCalendarCards, card, selectedDate, dueTime]);

  const allClientPosts = useMemo(
    () =>
      clientCalendarCards
        .filter((entry) => entry.id !== card.id && entry.dueDate)
        .sort(sortCalendarCards),
    [clientCalendarCards, card.id],
  );

  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return [];
    return (cardsByDate[selectedDate] || []).filter((entry) => entry.id !== card.id);
  }, [cardsByDate, selectedDate, card.id]);

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
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[96vh] w-full max-w-[min(1600px,98vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-violet-300">Target post date</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-400">
              {card.client} content calendar · {allClientPosts.length} scheduled post
              {allClientPosts.length === 1 ? '' : 's'} · click a day or post to review
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
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
                hideClient
              />
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col xl:w-[340px] 2xl:w-[380px]">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className={`${surfacePanelClass} space-y-4 p-4`}>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Publish schedule</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {selectedDate
                      ? formatScheduledDateTime(selectedDate, dueTime)
                      : 'Pick a date on the calendar'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-400">Date</p>
                    <p className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2]">
                      {selectedDate ? formatDate(selectedDate) : 'Not selected'}
                    </p>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-400">Publish time</span>
                    <TimeInput
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      inputClassName={modalInputClass}
                    />
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {selectedDate
                    ? `On ${formatDate(selectedDate)}`
                    : `${card.client} scheduled posts`}
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

                  {!selectedDate && allClientPosts.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
                      No other posts on {card.client}&apos;s content calendar yet.
                    </p>
                  )}

                  {!selectedDate &&
                    allClientPosts.map((entry) => (
                      <CalendarEvent
                        key={entry.id}
                        card={entry}
                        onClick={handleCardClick}
                        compact
                        hideClient
                      />
                    ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="flex gap-2 border-t border-white/5 p-4 sm:p-5">
              <button type="button" onClick={onClose} className={`${btnSecondaryClass} flex-1`}>
                Cancel
              </button>
              <button type="submit" className={`${btnPrimaryClass} flex-1`}>
                Set post date & time
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
