import { useState, useMemo, useEffect } from 'react';
import { filterCards } from '../utils';
import {
  getDefaultShootDate,
  getCardsForShootDate,
  groupShootDayClients,
  groupCardsByShootDate,
  getShootCards,
  getPlanClientsForDate,
  addDays,
  addMonths,
  toDateKey,
  dateKeyToInputValue,
  inputValueToDate,
} from '../utils/shootDay';
import { useClientsContext } from '../context/ClientsContext';
import ShootDayDetail from './ShootDayDetail';
import ShootDayMonthView from './ShootDayMonthView';
import AddShootDayModal from './AddShootDayModal';
import CalendarZoomControls, { CalendarZoomViewport } from './CalendarZoomControls';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { useCalendarZoom, CALENDAR_ZOOM_STORAGE_KEYS } from '../hooks/useCalendarZoom';
import { btnPrimaryClass, btnSecondaryClass, inputClass, surfacePanelClass, glassSegmentClass } from './clientPortal/clientPortalUi';

export default function ShootDay({
  cards,
  ideas = [],
  clientFilter,
  plans,
  onCardClick,
  onUpdateCard,
  onAddShootItem,
  onAddCardsToShoot,
  getPlan,
  onUpdatePlan,
  onEnsurePlan,
  onRemoveFromSchedule,
  onReturnToVault,
  onRemoveClientShoot,
  embedded = false,
  focusRequest,
  onMoveClientShootDay,
  onNavigate,
  onHandoff,
}) {
  const { clients } = useClientsContext();
  const [focusDate, setFocusDate] = useState(() => getDefaultShootDate());
  const [viewMode, setViewMode] = useState('month');
  const [shootModal, setShootModal] = useState(null);
  const [pinnedClient, setPinnedClient] = useState(null);
  const { zoom, defaultZoom, setZoom } = useCalendarZoom(CALENDAR_ZOOM_STORAGE_KEYS.shoots);

  useEffect(() => {
    if (!focusRequest?.dateKey) return;
    setFocusDate(inputValueToDate(focusRequest.dateKey));
    setViewMode('day');
    if (focusRequest.client) {
      setPinnedClient(focusRequest.client);
    }
  }, [focusRequest?.dateKey, focusRequest?.token, focusRequest?.client]);

  const dateKey = toDateKey(focusDate);

  const visiblePlans = useMemo(() => {
    if (!clientFilter || clientFilter === 'all') return plans;
    const filtered = {};
    for (const [key, plan] of Object.entries(plans || {})) {
      if (plan?.client === clientFilter) filtered[key] = plan;
    }
    return filtered;
  }, [plans, clientFilter]);

  const visibleShootCards = useMemo(
    () => filterCards(getShootCards(cards), { client: clientFilter }),
    [cards, clientFilter],
  );

  const shootsByDate = useMemo(
    () => groupCardsByShootDate(visibleShootCards),
    [visibleShootCards],
  );

  const shootCards = useMemo(
    () => getCardsForShootDate(visibleShootCards, dateKey),
    [visibleShootCards, dateKey],
  );

  const clientGroups = useMemo(
    () => groupShootDayClients(shootCards, dateKey, getPlan, visiblePlans, clients),
    [shootCards, dateKey, getPlan, visiblePlans, clients],
  );

  const planClientsForDay = useMemo(
    () => getPlanClientsForDate(visiblePlans, dateKey, clients),
    [visiblePlans, dateKey, clients],
  );

  const hasShootDay = shootCards.length > 0 || planClientsForDay.length > 0;

  const goPrev = () => {
    setFocusDate((d) => (viewMode === 'day' ? addDays(d, -1) : addMonths(d, -1)));
  };

  const goNext = () => {
    setFocusDate((d) => (viewMode === 'day' ? addDays(d, 1) : addMonths(d, 1)));
  };

  const goToday = () => setFocusDate(getDefaultShootDate());

  const handleFocusDateChange = (value) => {
    const nextDateKey = value;
    if (!nextDateKey || nextDateKey === dateKey) return;

    if (viewMode === 'day' && hasShootDay && onMoveClientShootDay) {
      const moveClient =
        pinnedClient || (clientGroups.length === 1 ? clientGroups[0].client : null);
      if (moveClient) {
        onMoveClientShootDay(moveClient, dateKey, nextDateKey);
        return;
      }
    }

    setFocusDate(inputValueToDate(nextDateKey));
  };

  const handleDayClick = (day) => {
    setFocusDate(day);
    setViewMode('day');
  };

  const navBtnClass = embedded
    ? `${btnSecondaryClass} px-3 py-1.5 text-[11px] normal-case tracking-normal`
    : 'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white';

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

  const shootBody = (
    <>
      {embedded && viewMode === 'day' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`${btnSecondaryClass} py-1.5 text-[11px] normal-case tracking-normal`}
          >
            ← Month calendar
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('calendars')}
              className={`${btnSecondaryClass} py-1.5 text-[11px] normal-case tracking-normal`}
            >
              Calendars
            </button>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={goPrev} className={navBtnClass}>
            ← {viewMode === 'day' ? 'Prev Day' : 'Prev Month'}
          </button>
          <button type="button" onClick={goToday} className={navBtnClass}>
            Today
          </button>
          <button type="button" onClick={goNext} className={navBtnClass}>
            {viewMode === 'day' ? 'Next Day' : 'Next Month'} →
          </button>
          {viewMode === 'day' && (
            <input
              type="date"
              value={dateKeyToInputValue(focusDate)}
              onChange={(e) => handleFocusDateChange(e.target.value)}
              className={`${inputClass} w-auto text-xs`}
              title={
                hasShootDay && (pinnedClient || clientGroups.length === 1)
                  ? 'Change shoot date'
                  : 'View another day'
              }
            />
          )}
        </div>

        <div className={`${glassSegmentClass} flex items-center p-0.5 ${embedded ? '' : 'rounded-lg'}`}>
          <CalendarZoomControls
            zoom={zoom}
            defaultZoom={defaultZoom}
            onZoomChange={setZoom}
            embedded={embedded}
          />
          <div className="mx-1 w-px self-stretch bg-white/10" />
          <button
            type="button"
            onClick={() => setShootModal({ mode: viewMode === 'day' ? 'item' : 'day' })}
            className={embedded ? `${btnPrimaryClass} px-4 py-1.5 text-[11px]` : 'rounded-lg bg-[#810100] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#a00000]'}
          >
            + {viewMode === 'day' ? 'Add item' : 'Add client shoot'}
          </button>
          <div className="mx-1 w-px self-stretch bg-white/10" />
          <button type="button" onClick={() => setViewMode('month')} className={viewBtnClass('month')}>
            Month
          </button>
          <button type="button" onClick={() => setViewMode('day')} className={viewBtnClass('day')}>
            Day
          </button>
        </div>
      </div>

      {!embedded && (
        <p className="mb-4 text-xs text-gray-500">
          {viewMode === 'month'
            ? 'Click a day to open it. Hover a client name and click × to delete that shoot.'
            : 'Add multiple reels or items per client shoot — use + New item or + From board.'}
        </p>
      )}

      <div className={embedded ? `${surfacePanelClass} p-4` : ''}>
        <CalendarZoomViewport zoom={zoom}>
          {viewMode === 'day' ? (
            <ShootDayDetail
              focusDate={focusDate}
              dateKey={dateKey}
              clientGroups={clientGroups}
              shootCount={shootCards.length}
              hasShootDay={hasShootDay}
              cards={cards}
              ideas={ideas}
              onCardClick={onCardClick}
              onUpdateCard={onUpdateCard}
              onAddShootDay={() => setShootModal({ mode: 'day' })}
              onAddShootItem={() => setShootModal({ mode: 'item' })}
              onAddShootItemForClient={(client) => setShootModal({ mode: 'item', client, lockFields: true })}
              onAddCardsToShoot={onAddCardsToShoot}
              getPlan={getPlan}
              onUpdatePlan={onUpdatePlan}
              onRemoveFromSchedule={onRemoveFromSchedule}
              onReturnToVault={onReturnToVault}
              onRemoveClientShoot={onRemoveClientShoot}
              onMoveClientShootDay={onMoveClientShootDay}
              onHandoff={onHandoff}
            />
          ) : (
            <ShootDayMonthView
              focusDate={focusDate}
              shootsByDate={shootsByDate}
              plans={visiblePlans}
              onDayClick={handleDayClick}
              getPlan={getPlan}
              onRemoveClientShoot={onRemoveClientShoot}
            />
          )}
        </CalendarZoomViewport>
      </div>

      {shootModal && (
        <AddShootDayModal
          mode={shootModal.mode}
          defaultDate={dateKey}
          defaultClient={shootModal.client || clientFilter}
          lockClient={Boolean(shootModal.lockFields && shootModal.client)}
          lockDate={Boolean(shootModal.lockFields)}
          onClose={() => setShootModal(null)}
          onAddDay={({ client, shootDate }) => {
            onEnsurePlan(client, shootDate);
            setFocusDate(inputValueToDate(shootDate));
            setViewMode('day');
          }}
          onAddItem={(data, options) => {
            onAddShootItem(data, options);
            setFocusDate(inputValueToDate(data.shootDate));
            setViewMode('day');
            if (!options?.addAnother) {
              setShootModal(null);
            }
          }}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Scheduled shoots"
          description="Plan on-set days, assign clients, and manage content scheduled for each session."
        >
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className={`${btnSecondaryClass} py-1.5 text-[11px] normal-case tracking-normal`}
            >
              ← Overview
            </button>
          )}
        </ClientPortalSectionHeader>
        {shootBody}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
      {shootBody}
    </div>
  );
}
