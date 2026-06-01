import { useState, useMemo } from 'react';
import {
  getDefaultCalendarDate,
  addWeeks,
  addMonths,
  groupCalendarCardsByDate,
  getCalendarPosts,
  getCalendarStories,
  buildStoryCalendarByDate,
  toDateKey,
} from '../utils/calendar';
import { filterCards } from '../utils';
import CalendarWeekView from './CalendarWeekView';
import CalendarMonthView from './CalendarMonthView';
import CalendarSharePanel from './CalendarSharePanel';
import AddCalendarPostModal from './AddCalendarPostModal';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass, glassSegmentClass } from './clientPortal/clientPortalUi';

export default function Calendar({
  cards,
  clientFilter,
  getPlan,
  onCardClick,
  onShootSessionClick,
  onAddCalendarPost,
  onRemoveFromCalendar,
  onMoveCalendarPost,
  embedded = false,
}) {
  const [focusDate, setFocusDate] = useState(() => getDefaultCalendarDate());
  const [calendarTab, setCalendarTab] = useState('posts');
  const [viewMode, setViewMode] = useState('month');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDefaults, setAddDefaults] = useState({ dueDate: '' });

  const isStories = calendarTab === 'stories';

  const visibleCards = useMemo(() => {
    const planned = isStories ? getCalendarStories(cards) : getCalendarPosts(cards);
    return filterCards(planned, { client: clientFilter });
  }, [cards, clientFilter, isStories]);

  const cardsByDate = useMemo(() => {
    if (isStories) {
      return buildStoryCalendarByDate(visibleCards, focusDate, viewMode);
    }
    return groupCalendarCardsByDate(visibleCards, getPlan);
  }, [visibleCards, isStories, focusDate, viewMode, getPlan]);

  const handleCalendarClick = (entry) => {
    if (entry?.isShootSession) {
      onShootSessionClick?.(entry);
      return;
    }
    onCardClick?.(entry);
  };

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

  const openAddModal = (dueDate = toDateKey(focusDate)) => {
    setAddDefaults({ dueDate });
    setShowAddModal(true);
  };

  const navBtnClass = embedded
    ? `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`
    : 'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white';

  const tabBtnClass = (tab) => {
    const active = calendarTab === tab;
    if (embedded) {
      return `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
        active ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
      }`;
    }
    return `rounded-md px-4 py-1.5 text-sm font-medium transition ${
      active ? 'bg-[#810100] text-white' : 'text-gray-400 hover:text-white'
    }`;
  };

  const viewBtnClass = (mode) => {
    const active = viewMode === mode;
    if (embedded) {
      return `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
        active ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
      }`;
    }
    return `rounded-md px-4 py-1.5 text-sm font-medium transition ${
      active ? 'bg-[#810100] text-white' : 'text-gray-400 hover:text-white'
    }`;
  };

  const addBtnClass = embedded
    ? `${btnPrimaryClass} px-4 py-1.5 text-[11px]`
    : 'rounded-lg bg-[#810100] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#a00000]';

  const overviewLabel = isStories ? 'stories' : 'content';

  const calendarBody = (
    <>
      <CalendarSharePanel cards={cards} clientFilter={clientFilter} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className={`${glassSegmentClass} flex p-0.5 ${embedded ? '' : 'rounded-lg'}`}>
          <button type="button" onClick={() => setCalendarTab('posts')} className={tabBtnClass('posts')}>
            Content
          </button>
          <button type="button" onClick={() => setCalendarTab('stories')} className={tabBtnClass('stories')}>
            Stories
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
          <button type="button" onClick={() => openAddModal()} className={addBtnClass}>
            + {isStories ? 'Add story' : 'Add post'}
          </button>
          <div className={`${glassSegmentClass} flex p-0.5 ${embedded ? '' : 'rounded-lg'}`}>
            <button type="button" onClick={() => setViewMode('month')} className={viewBtnClass('month')}>
              Month
            </button>
            <button type="button" onClick={() => setViewMode('week')} className={viewBtnClass('week')}>
              Week
            </button>
          </div>
        </div>
      </div>

      {!embedded && (
        <p className="mb-4 text-xs text-gray-500">
          {isStories
            ? 'Stories live on the calendar only — removing one deletes it entirely.'
            : 'Plan reels, carousels, and static posts by month — items in Editing or Scheduled appear here.'}
        </p>
      )}

      <div className={embedded ? `${surfacePanelClass} p-4` : ''}>
        {viewMode === 'week' ? (
          <CalendarWeekView
            focusDate={focusDate}
            cardsByDate={cardsByDate}
            onCardClick={handleCalendarClick}
            onAddPost={openAddModal}
            onRemoveFromCalendar={onRemoveFromCalendar}
            onMoveCalendarPost={onMoveCalendarPost}
            overviewLabel={overviewLabel}
          />
        ) : (
          <CalendarMonthView
            focusDate={focusDate}
            cardsByDate={cardsByDate}
            onCardClick={handleCalendarClick}
            onDayClick={handleDayClick}
            onRemoveFromCalendar={onRemoveFromCalendar}
            onMoveCalendarPost={onMoveCalendarPost}
            overviewLabel={overviewLabel}
          />
        )}
      </div>

      {showAddModal && (
        <AddCalendarPostModal
          defaultDate={addDefaults.dueDate}
          defaultClient={clientFilter}
          defaultContentType={isStories ? 'Story' : 'Reel'}
          lockContentType={isStories}
          onClose={() => setShowAddModal(false)}
          onAdd={onAddCalendarPost}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Content Calendar"
          description={
            isStories
              ? 'Schedule and manage recurring stories across all clients.'
              : 'Plan reels, carousels, and static posts — items in Editing or Scheduled appear here.'
          }
        />
        {calendarBody}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6">
      {calendarBody}
    </div>
  );
}
