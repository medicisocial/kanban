import { useState, useMemo } from 'react';
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
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, btnSecondaryClass, inputClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ShootDay({
  cards,
  clientFilter,
  search,
  plans,
  onCardClick,
  onUpdateCard,
  onAddShootItem,
  getPlan,
  onUpdatePlan,
  onEnsurePlan,
  onRemoveFromSchedule,
  onRemoveClientShoot,
  embedded = false,
}) {
  const { clients } = useClientsContext();
  const [focusDate, setFocusDate] = useState(() => getDefaultShootDate());
  const [viewMode, setViewMode] = useState('month');
  const [shootModal, setShootModal] = useState(null);

  const dateKey = toDateKey(focusDate);

  const visibleShootCards = useMemo(
    () => filterCards(getShootCards(cards), { client: clientFilter, search }),
    [cards, clientFilter, search],
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
    () => groupShootDayClients(shootCards, dateKey, getPlan, plans, clients),
    [shootCards, dateKey, getPlan, plans, clients],
  );

  const planClientsForDay = useMemo(
    () => getPlanClientsForDate(plans, dateKey, clients),
    [plans, dateKey, clients],
  );

  const hasShootDay = shootCards.length > 0 || planClientsForDay.length > 0;

  const goPrev = () => {
    setFocusDate((d) => (viewMode === 'day' ? addDays(d, -1) : addMonths(d, -1)));
  };

  const goNext = () => {
    setFocusDate((d) => (viewMode === 'day' ? addDays(d, 1) : addMonths(d, 1)));
  };

  const goToday = () => setFocusDate(getDefaultShootDate());

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
              onChange={(e) => setFocusDate(inputValueToDate(e.target.value))}
              className={`${inputClass} w-auto text-xs`}
            />
          )}
        </div>

        <div className={`flex border border-white/10 bg-white/[0.03] p-0.5 ${embedded ? '' : 'rounded-lg bg-white/5'}`}>
          <button
            type="button"
            onClick={() => setShootModal({ mode: viewMode === 'day' ? 'item' : 'day' })}
            className={embedded ? `${btnPrimaryClass} px-4 py-1.5 text-[11px]` : 'rounded-lg bg-[#810100] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#a00000]'}
          >
            + {viewMode === 'day' ? 'Add item' : 'Add client shoot'}
          </button>
          <div className="mx-1 w-px bg-white/10" />
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
            ? 'Click any day to open it, or add a client shoot manually.'
            : 'Add items here or set a Shoot Date on any card.'}
        </p>
      )}

      <div className={embedded ? `${surfacePanelClass} p-4` : ''}>
        {viewMode === 'day' ? (
          <ShootDayDetail
            focusDate={focusDate}
            dateKey={dateKey}
            clientGroups={clientGroups}
            shootCount={shootCards.length}
            hasShootDay={hasShootDay}
            onCardClick={onCardClick}
            onUpdateCard={onUpdateCard}
            onAddShootDay={() => setShootModal({ mode: 'day' })}
            onAddShootItem={() => setShootModal({ mode: 'item' })}
            onAddShootItemForClient={(client) => setShootModal({ mode: 'item', client })}
            getPlan={getPlan}
            onUpdatePlan={onUpdatePlan}
            onRemoveFromSchedule={onRemoveFromSchedule}
            onRemoveClientShoot={onRemoveClientShoot}
          />
        ) : (
          <ShootDayMonthView
            focusDate={focusDate}
            shootsByDate={shootsByDate}
            plans={plans}
            onDayClick={handleDayClick}
            getPlan={getPlan}
          />
        )}
      </div>

      {shootModal && (
        <AddShootDayModal
          mode={shootModal.mode}
          defaultDate={dateKey}
          defaultClient={shootModal.client || clientFilter}
          onClose={() => setShootModal(null)}
          onAddDay={({ client, shootDate }) => {
            onEnsurePlan(client, shootDate);
            setFocusDate(inputValueToDate(shootDate));
            setViewMode('day');
          }}
          onAddItem={(data) => {
            onAddShootItem(data);
            setFocusDate(inputValueToDate(data.shootDate));
            setViewMode('day');
          }}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Shoot Schedule"
          description="Plan production days, assign clients, and manage shoot-day content across the pipeline."
        />
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
