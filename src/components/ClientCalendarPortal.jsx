import { useState, useEffect, useMemo } from 'react';
import { PLATFORM_ICON, getContentTypeStyle } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import {
  getDefaultCalendarDate,
  addWeeks,
  addMonths,
  groupCardsByDate,
  getScheduledPosts,
  getScheduledStories,
  buildStoryCalendarByDate,
  formatRecurrenceDays,
  hasStoryRecurrence,
} from '../utils/calendar';
import { parseCalendarShareHash, mergePortalCalendarCards } from '../utils/calendarShare';
import CalendarWeekView from './CalendarWeekView';
import CalendarMonthView from './CalendarMonthView';
import CardTitleLink from './CardTitleLink';
import { formatTime } from '../utils';

function ClientCalendarDetail({ card, onClose }) {
  const typeStyle = getContentTypeStyle(card.contentType);

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

  const formattedDate = card.dueDate
    ? new Date(`${card.dueDate}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e2130] p-5 shadow-2xl"
        style={{ borderTopColor: typeStyle.border, borderTopWidth: '3px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Scheduled post</p>
            <CardTitleLink
              title={card.title}
              dropboxLink={card.dropboxLink}
              className="mt-1 text-lg font-semibold text-white"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Date</dt>
            <dd className="text-right text-gray-200">{formattedDate}</dd>
          </div>
          {card.dueTime && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Time</dt>
              <dd className="text-right text-gray-200">{formatTime(card.dueTime)}</dd>
            </div>
          )}
          {hasStoryRecurrence(card) && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Repeats</dt>
              <dd className="text-right text-gray-200">Every {formatRecurrenceDays(card.storyRecurrenceDays)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Type</dt>
            <dd className={`font-medium ${typeStyle.label}`}>{card.contentType}</dd>
          </div>
          {card.assignedTo && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Team</dt>
              <dd className="text-gray-200">{PLATFORM_ICON} {card.assignedTo}</dd>
            </div>
          )}
        </dl>

        {card.notes && (
          <p className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-400">{card.notes}</p>
        )}

        {card.dropboxLink && (
          <a
            href={card.dropboxLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            View content ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function ClientCalendarPortal({ client, cards }) {
  const { getClientColor } = useClientsContext();
  const [localCards, setLocalCards] = useState([]);
  const [focusDate, setFocusDate] = useState(() => getDefaultCalendarDate());
  const [viewMode, setViewMode] = useState('month');
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    const snapshot = parseCalendarShareHash();
    const scheduled = cards.filter((c) => c.columnId === 'scheduled');
    const merged = mergePortalCalendarCards(scheduled, client, snapshot);
    setLocalCards(merged.filter((c) => c.client === client));
  }, [cards, client]);

  const cardsByDate = useMemo(() => {
    const posts = getScheduledPosts(localCards);
    const stories = getScheduledStories(localCards);
    const postsByDate = groupCardsByDate(posts);
    const storiesByDate = buildStoryCalendarByDate(stories, focusDate, viewMode);
    const merged = { ...postsByDate };
    for (const [dateKey, dayStories] of Object.entries(storiesByDate)) {
      merged[dateKey] = [...(merged[dateKey] || []), ...dayStories];
      merged[dateKey].sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));
    }
    return merged;
  }, [localCards, focusDate, viewMode]);
  const clientColor = getClientColor(client);
  const totalScheduled = localCards.length;

  const goPrev = () => {
    setFocusDate((d) => (viewMode === 'week' ? addWeeks(d, -1) : addMonths(d, -1)));
  };

  const goNext = () => {
    setFocusDate((d) => (viewMode === 'week' ? addWeeks(d, 1) : addMonths(d, 1)));
  };

  const goToday = () => setFocusDate(new Date());

  const handleDayClick = (day) => {
    setFocusDate(day);
    setViewMode('week');
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <header className="border-b border-white/5 bg-[#0f1117]/95 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[1800px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Medici Social</p>
            <h1 className="text-lg font-semibold text-white">Content Calendar</h1>
            <p className="text-sm" style={{ color: clientColor }}>{client}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6">
        <p className="mb-4 text-sm text-gray-400">
          {totalScheduled} scheduled post{totalScheduled === 1 ? '' : 's'} — your content only, no other clients.
        </p>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              ← {viewMode === 'week' ? 'Prev Week' : 'Prev Month'}
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              {viewMode === 'week' ? 'Next Week' : 'Next Month'} →
            </button>
          </div>

          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                viewMode === 'month'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                viewMode === 'week'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Week
            </button>
          </div>
        </div>

        {viewMode === 'week' ? (
          <CalendarWeekView
            focusDate={focusDate}
            cardsByDate={cardsByDate}
            onCardClick={setSelectedCard}
            hideClient
          />
        ) : (
          <CalendarMonthView
            focusDate={focusDate}
            cardsByDate={cardsByDate}
            onCardClick={setSelectedCard}
            onDayClick={handleDayClick}
            hideClient
          />
        )}
      </main>

      {selectedCard && (
        <ClientCalendarDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
