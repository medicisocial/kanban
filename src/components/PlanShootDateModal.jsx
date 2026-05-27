import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getContentTypeStyle, isOneOffProjectCard } from '../constants';
import {
  addMonths,
  getDefaultCalendarDate,
  groupCalendarCardsByDate,
  parseDateKey,
  toDateKey,
} from '../utils/calendar';
import { formatDate, formatTime } from '../utils';
import { getDefaultShootEndTime, getShootCards, parseTimeToMinutes, resolveShootDayTime, resolveShootDayEndTime } from '../utils/shootDay';
import CalendarMonthView from './CalendarMonthView';
import CalendarEvent from './CalendarEvent';
import TimeInput from './TimeInput';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

const modalInputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30';

function getClientShootCalendarCards(cards, client) {
  return getShootCards(cards).filter((entry) => entry.client === client);
}

function toCalendarDisplay(card) {
  return {
    ...card,
    dueDate: card.shootDate,
    dueTime: card.shootTime,
  };
}


export default function PlanShootDateModal({ card, cards, plans, getPlan, onClose, onSave, onOpenCard, onAddItemToDay, onAddCardsToShoot }) {
  const initialDate = card.shootDate || '';
  const isOneOff = isOneOffProjectCard(card);
  const showAllShoots = isOneOff;
  const [focusDate, setFocusDate] = useState(() =>
    initialDate ? parseDateKey(initialDate) : getDefaultCalendarDate(),
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [shootTime, setShootTime] = useState(card.shootTime || '');
  const [shootEndTime, setShootEndTime] = useState(card.shootEndTime || '');
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

  const clientShootCards = useMemo(
    () => getClientShootCalendarCards(cards, card.client),
    [cards, card.client],
  );

  const calendarShootCards = useMemo(
    () => (showAllShoots ? getShootCards(cards) : clientShootCards),
    [showAllShoots, cards, clientShootCards],
  );

  const markedDates = useMemo(() => {
    if (!plans) return {};
    const marks = {};
    for (const plan of Object.values(plans)) {
      if (!plan.manual || !plan.dateKey) continue;
      if (showAllShoots || plan.client === card.client) {
        marks[plan.dateKey] = showAllShoots ? 'Shoot planned' : 'Shoot planned';
      }
    }
    return marks;
  }, [plans, card.client, showAllShoots]);

  const cardsByDate = useMemo(
    () => groupCalendarCardsByDate(calendarShootCards.map(toCalendarDisplay), getPlan),
    [calendarShootCards, getPlan],
  );

  const allVisibleSessions = useMemo(() => {
    const list = [];
    for (const [dateKey, dayCards] of Object.entries(cardsByDate)) {
      for (const entry of dayCards) {
        list.push({ ...entry, sortDate: dateKey });
      }
    }
    return list.sort((a, b) => {
      const dateCmp = (a.sortDate || '').localeCompare(b.sortDate || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
    });
  }, [cardsByDate]);

  const selectedDayShoots = useMemo(() => {
    if (!selectedDate) return [];
    return (cardsByDate[selectedDate] || []).filter(
      (entry) => entry.isShootSession || entry.id !== card.id,
    );
  }, [cardsByDate, selectedDate, card.id]);

  const selectedDayPlan = useMemo(
    () => (selectedDate && getPlan ? getPlan(card.client, selectedDate) : null),
    [getPlan, card.client, selectedDate],
  );

  const selectedSessionTime = useMemo(() => {
    if (!selectedDate) return { shootTime: '', shootEndTime: '' };
    const dayCards = clientShootCards.filter(
      (entry) => entry.shootDate === selectedDate && entry.id !== card.id,
    );
    return {
      shootTime: resolveShootDayTime(selectedDayPlan, dayCards),
      shootEndTime: resolveShootDayEndTime(selectedDayPlan, dayCards),
    };
  }, [selectedDate, selectedDayPlan, clientShootCards, card.id]);

  const typeStyle = getContentTypeStyle(card.contentType);

  const inheritSessionTime = (dateKey) => {
    const plan = getPlan?.(card.client, dateKey);
    const dayCards = clientShootCards.filter(
      (entry) => entry.shootDate === dateKey && entry.id !== card.id,
    );
    const sessionTime = resolveShootDayTime(plan, dayCards);
    const sessionEnd = resolveShootDayEndTime(plan, dayCards);
    if (sessionTime) {
      setShootTime(sessionTime);
      setShootEndTime(sessionEnd || getDefaultShootEndTime(sessionTime, card.contentType));
    }
  };

  const handleSelectDate = (day) => {
    const dateKey = toDateKey(day);
    setSelectedDate(dateKey);
    setFocusDate(day);
    setError('');
    inheritSessionTime(dateKey);
  };

  const handleCalendarEventClick = (clickedCard) => {
    const dateKey = clickedCard.dueDate || clickedCard.shootDate;
    if (!dateKey) return;
    setSelectedDate(dateKey);
    setFocusDate(parseDateKey(dateKey));
    setError('');

    if (clickedCard.isShootSession) {
      if (clickedCard.dueTime) {
        setShootTime(clickedCard.dueTime);
        setShootEndTime(
          clickedCard.shootEndTime ||
            getDefaultShootEndTime(clickedCard.dueTime, card.contentType),
        );
      }
      return;
    }

    if (showAllShoots && clickedCard.client !== card.client) {
      return;
    }

    const time = clickedCard.dueTime || clickedCard.shootTime;
    const endTime = clickedCard.shootEndTime;
    if (time) {
      setShootTime(time);
      setShootEndTime(endTime || getDefaultShootEndTime(time, card.contentType));
      return;
    }
    inheritSessionTime(dateKey);
  };

  const handleStartTimeChange = (e) => {
    const value = e.target.value;
    setShootTime(value);
    const start = parseTimeToMinutes(value);
    const end = parseTimeToMinutes(shootEndTime);
    if (start != null && (end == null || end <= start)) {
      setShootEndTime(getDefaultShootEndTime(value, card.contentType));
    }
    if (!value) setShootEndTime('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDate) {
      setError('Pick a date on the shoot calendar.');
      return;
    }
    if (shootTime && shootEndTime && shootEndTime <= shootTime) {
      setError('End time must be after start time.');
      return;
    }
    onSave(card.id, {
      shootDate: selectedDate,
      shootTime,
      shootEndTime,
    });
    onClose();
  };

  const navBtnClass = `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`;

  const scheduleSummary = selectedDate
    ? `${formatDate(selectedDate)}${shootTime ? ` · ${formatTime(shootTime)}` : ''}${
        shootEndTime ? ` – ${formatTime(shootEndTime)}` : ''
      }`
    : 'Pick a date on the calendar';

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
            <p className="text-xs font-medium uppercase tracking-wider text-[#fca5a5]">Shoot schedule</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-400">
              {showAllShoots
                ? `All shoots · ${allVisibleSessions.length} scheduled · click a day or shoot to select it`
                : `${card.client} shoot calendar · ${allVisibleSessions.length} scheduled shoot${
                    allVisibleSessions.length === 1 ? '' : 's'
                  } · click a day or shoot to select it`}
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
              {showAllShoots
                ? 'All agency shoots are shown so you can pick a day without conflicts. Click a day or existing shoot to select it.'
                : 'Click a day or an existing shoot to select it. Multiple reels or posts can share the same shoot day.'}
            </p>

            <div className={`${surfacePanelClass} p-4`}>
              <CalendarMonthView
                focusDate={focusDate}
                cardsByDate={cardsByDate}
                selectedDateKey={selectedDate}
                onSelectDate={handleSelectDate}
                onCardClick={handleCalendarEventClick}
                markedDates={markedDates}
                overviewLabel="shoots"
                hideClient={!showAllShoots}
              />
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col xl:w-[340px] 2xl:w-[380px]">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className={`${surfacePanelClass} space-y-4 p-4`}>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Shoot schedule</p>
                  <p className="mt-1 text-base font-semibold text-white">{scheduleSummary}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-400">Date</p>
                    <p className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2]">
                      {selectedDate ? formatDate(selectedDate) : 'Not selected'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-400">Content type</p>
                    <p className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-[#f9f6f2]">
                      {card.contentType}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-400">Start time</span>
                    <TimeInput
                      value={shootTime}
                      onChange={handleStartTimeChange}
                      placeholder="Start time"
                      inputClassName={modalInputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-400">End time</span>
                    <TimeInput
                      value={shootEndTime}
                      onChange={(e) => setShootEndTime(e.target.value)}
                      placeholder="End time"
                      inputClassName={modalInputClass}
                    />
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {selectedDate
                    ? `On ${formatDate(selectedDate)}`
                    : showAllShoots
                      ? 'All scheduled shoots'
                      : `${card.client} scheduled shoots`}
                </p>

                <div className="space-y-2">
                  {selectedDate && (
                    <div
                      className="rounded-lg border border-dashed border-[#810100]/40 bg-[#a00000]/10 p-3"
                      style={{ borderLeftWidth: 3, borderLeftColor: typeStyle.border }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#fca5a5]">
                        This card
                      </p>
                      <p className="mt-1 text-sm font-medium leading-snug text-white">{card.title}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {card.contentType}
                        {shootTime ? ` · ${formatTime(shootTime)}` : ''}
                        {shootEndTime ? ` – ${formatTime(shootEndTime)}` : ''}
                      </p>
                    </div>
                  )}

                  {selectedDate && selectedDayShoots.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
                      {showAllShoots
                        ? 'No other shoots scheduled on this day.'
                        : `No other content scheduled to shoot for ${card.client} on this day yet.`}
                    </p>
                  )}

                  {selectedDate && selectedSessionTime.shootTime && !showAllShoots && (
                    <p className="rounded-lg border border-[#810100]/20 bg-[#810100]/5 px-3 py-2 text-xs text-[#fca5a5]">
                      Existing shoot at {formatTime(selectedSessionTime.shootTime)}
                      {selectedSessionTime.shootEndTime
                        ? ` – ${formatTime(selectedSessionTime.shootEndTime)}`
                        : ''}
                      . New cards will join this session.
                    </p>
                  )}

                  {selectedDate && (onAddItemToDay || onAddCardsToShoot) && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {onAddCardsToShoot && (
                        <button
                          type="button"
                          onClick={() =>
                            onAddCardsToShoot(card.client, selectedDate, {
                              excludeCardIds: [card.id],
                              shootTime: selectedSessionTime.shootTime,
                              shootEndTime: selectedSessionTime.shootEndTime,
                            })
                          }
                          className="rounded-lg border border-white/10 px-3 py-2.5 text-xs font-medium text-gray-300 transition hover:bg-white/5"
                        >
                          + Add cards from board
                        </button>
                      )}
                      {onAddItemToDay && (
                        <button
                          type="button"
                          onClick={() => onAddItemToDay(card.client, selectedDate)}
                          className="rounded-lg border border-[#810100]/30 bg-[#810100]/10 px-3 py-2.5 text-xs font-medium text-[#fca5a5] transition hover:bg-[#810100]/20"
                        >
                          + Create new item
                        </button>
                      )}
                    </div>
                  )}

                  {selectedDayShoots.map((entry) => (
                    <CalendarEvent
                      key={entry.id}
                      card={entry}
                      onClick={(clickedCard) => {
                        if (clickedCard.isShootSession) {
                          handleCalendarEventClick(clickedCard);
                          return;
                        }
                        onOpenCard?.(clickedCard);
                      }}
                      compact
                      hideClient={!showAllShoots}
                    />
                  ))}

                  {!selectedDate && allVisibleSessions.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-500">
                      {showAllShoots
                        ? 'No shoots scheduled yet.'
                        : `No other shoots on ${card.client}'s schedule yet.`}
                    </p>
                  )}

                  {!selectedDate &&
                    allVisibleSessions.map((entry) => (
                      <CalendarEvent
                        key={entry.id}
                        card={entry}
                        onClick={(clickedCard) => handleCalendarEventClick(clickedCard)}
                        compact
                        hideClient={!showAllShoots}
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
                Set shoot date
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
