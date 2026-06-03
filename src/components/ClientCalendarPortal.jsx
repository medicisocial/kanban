import { useState, useEffect, useMemo } from 'react';
import { getContentTypeStyle } from '../constants';
import { contentTypeLabelProps } from '../utils/contentTypeColors';
import { useClientsContext } from '../context/ClientsContext';
import { stripInternalCardsForClientPortal } from '../utils/clientPortalAuth';
import {
  getDefaultCalendarDate,
  addWeeks,
  addMonths,
  groupCardsByDate,
  getCalendarPosts,
  getCalendarStories,
  getContentCalendarCards,
  buildStoryCalendarByDate,
  formatRecurrenceDays,
  hasStoryRecurrence,
} from '../utils/calendar';
import { parseCalendarShareHash, mergePortalCalendarCards } from '../utils/calendarShare';
import CalendarWeekView from './CalendarWeekView';
import CalendarMonthView from './CalendarMonthView';
import CardTitleLink from './CardTitleLink';
import { formatTime } from '../utils';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import SharePortalShell from './clientPortal/SharePortalShell';
import CalendarZoomControls, { CalendarZoomViewport } from './CalendarZoomControls';
import { useCalendarZoom, CALENDAR_ZOOM_STORAGE_KEYS } from '../hooks/useCalendarZoom';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass, glassSegmentClass } from './clientPortal/clientPortalUi';

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
        className={`${surfacePanelClass} w-full max-w-md p-5 shadow-2xl`}
        style={{ borderTopColor: typeStyle.border, borderTopWidth: '3px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Content</p>
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
            <dd className="text-right text-[#f9f6f2]">{formattedDate}</dd>
          </div>
          {card.dueTime && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Time</dt>
              <dd className="text-right text-[#f9f6f2]">{formatTime(card.dueTime)}</dd>
            </div>
          )}
          {hasStoryRecurrence(card) && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Repeats</dt>
              <dd className="text-right text-[#f9f6f2]">Every {formatRecurrenceDays(card.storyRecurrenceDays)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Type</dt>
            <dd {...contentTypeLabelProps(typeStyle, 'font-medium text-right')}>{card.contentType}</dd>
          </div>
        </dl>

        {card.notes && (
          <p className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-400">{card.notes}</p>
        )}

        {card.dropboxLink && (
          <a
            href={card.dropboxLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnPrimaryClass} mt-4 flex w-full items-center justify-center gap-2 py-2.5 text-[11px]`}
          >
            View in Dropbox ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function ClientCalendarPortal({ client, cards, embedded = false, hideSectionHeader = false }) {
  const { getClientColor } = useClientsContext();
  const [focusDate, setFocusDate] = useState(() => getDefaultCalendarDate());
  const [viewMode, setViewMode] = useState('month');
  const [selectedCard, setSelectedCard] = useState(null);
  const { zoom, defaultZoom, setZoom } = useCalendarZoom(CALENDAR_ZOOM_STORAGE_KEYS.content);

  const visibleCards = useMemo(() => {
    const snapshot = parseCalendarShareHash();
    const calendarCards = stripInternalCardsForClientPortal(getContentCalendarCards(cards));
    return mergePortalCalendarCards(calendarCards, client, snapshot).filter((c) => c.client === client);
  }, [cards, client]);

  const clientColor = getClientColor(client);
  const totalOnCalendar = visibleCards.length;

  const cardsByDate = useMemo(() => {
    const posts = getCalendarPosts(visibleCards);
    const stories = getCalendarStories(visibleCards);
    const postsByDate = groupCardsByDate(posts);
    const storiesByDate = buildStoryCalendarByDate(stories, focusDate, viewMode);
    const merged = { ...postsByDate };
    for (const [dateKey, dayStories] of Object.entries(storiesByDate)) {
      merged[dateKey] = [...(merged[dateKey] || []), ...dayStories];
    }
    const sortDayCards = (a, b) => {
      const byTime = (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
      if (byTime !== 0) return byTime;
      return (a.title || '').localeCompare(b.title || '');
    };
    for (const dateKey of Object.keys(merged)) {
      merged[dateKey].sort(sortDayCards);
    }
    return merged;
  }, [visibleCards, focusDate, viewMode]);

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

  const navBtnClass = `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`;

  const viewTabClass = (active) =>
    `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
      active ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
    }`;

  const calendarBody = (
    <>
      {!embedded && (
        <p className="mb-4 text-sm text-white/45">
          {totalOnCalendar} item{totalOnCalendar === 1 ? '' : 's'} on your content calendar.
        </p>
      )}

      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${embedded ? '' : ''}`}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrev} className={navBtnClass}>
            ← {viewMode === 'week' ? 'Prev Week' : 'Prev Month'}
          </button>
          <button type="button" onClick={goToday} className={navBtnClass}>
            Today
          </button>
          <button type="button" onClick={goNext} className={navBtnClass}>
            {viewMode === 'week' ? 'Next Week' : 'Next Month'} →
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarZoomControls
            zoom={zoom}
            defaultZoom={defaultZoom}
            onZoomChange={setZoom}
            embedded
          />
          <div className={`${glassSegmentClass} flex p-0.5 ${embedded ? '' : 'rounded-lg'}`}>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={viewTabClass(viewMode === 'month')}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={viewTabClass(viewMode === 'week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className={`${surfacePanelClass} p-4`}>
        <CalendarZoomViewport zoom={zoom}>
          {viewMode === 'week' ? (
            <CalendarWeekView
              focusDate={focusDate}
              cardsByDate={cardsByDate}
              onCardClick={setSelectedCard}
              hideClient
              clientPortal
            />
          ) : (
            <CalendarMonthView
              focusDate={focusDate}
              cardsByDate={cardsByDate}
              onCardClick={setSelectedCard}
              onDayClick={handleDayClick}
              hideClient
              clientPortal
              maxVisibleCards={5}
            />
          )}
        </CalendarZoomViewport>
      </div>
    </>
  );

  if (embedded) {
    const content = (
      <>
        {calendarBody}
        {selectedCard && (
          <ClientCalendarDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
        )}
      </>
    );

    if (hideSectionHeader) {
      return content;
    }

    return (
      <section>
        <ClientPortalSectionHeader
          title="Content Calendar"
          description={`${totalOnCalendar} item${totalOnCalendar === 1 ? '' : 's'} across your publishing calendar.`}
        />
        {content}
      </section>
    );
  }

  return (
    <SharePortalShell title="Content calendar" client={client} clientColor={clientColor}>
      {calendarBody}
      {selectedCard && (
        <ClientCalendarDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </SharePortalShell>
  );
}
