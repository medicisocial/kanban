import { useCallback, useMemo, useState } from 'react';
import { getContentTypeStyle, isOneOffProjectCard } from '../constants';
import { contentTypeLabelProps } from '../utils/contentTypeColors';
import {
  METRIC_FIELDS,
  METRIC_FIELD_LABELS,
  normalizeCardMetrics,
  currentYearMonth,
  shiftYearMonth,
  formatYearMonthLabel,
  getMetricsCardsForMonth,
  sumCardMetrics,
  countMetricsContentTypes,
} from '../utils/cardMetrics';
import { downloadMetricsPdf } from '../utils/metricsPdf';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { IconChevronLeft, IconChevronRight } from './clientPortal/ClientPortalIcons';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

function MonthNav({ monthLabel, onPrev, onNext, onToday }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        className="rounded p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
        aria-label="Previous month"
      >
        <IconChevronLeft />
      </button>
      <h2 className="min-w-[9rem] text-center text-base font-semibold text-white">{monthLabel}</h2>
      <button
        type="button"
        onClick={onNext}
        className="rounded p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
        aria-label="Next month"
      >
        <IconChevronRight />
      </button>
      <button
        type="button"
        onClick={onToday}
        className={`${btnSecondaryClass} ml-1 px-2.5 py-1 text-[10px]`}
      >
        This month
      </button>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className={`${surfacePanelClass} px-4 py-3`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function publishDateLabel(card) {
  if (isOneOffProjectCard(card)) {
    return String(card.dueDate || card.shootDate || '—');
  }
  return String(card.dueDate || '—');
}

export default function MetricsPage({ cards = [], clientFilter = 'all', onOpenCard }) {
  const [selectedMonth, setSelectedMonth] = useState(() => currentYearMonth());
  const [pdfBusy, setPdfBusy] = useState(false);

  const goPrev = useCallback(() => setSelectedMonth((m) => shiftYearMonth(m, -1)), []);
  const goNext = useCallback(() => setSelectedMonth((m) => shiftYearMonth(m, 1)), []);
  const goToday = useCallback(() => setSelectedMonth(currentYearMonth()), []);

  const monthCards = useMemo(
    () => getMetricsCardsForMonth(cards, { monthKey: selectedMonth, client: clientFilter }),
    [cards, selectedMonth, clientFilter],
  );

  const contentCounts = useMemo(() => countMetricsContentTypes(monthCards), [monthCards]);
  const engagement = useMemo(() => sumCardMetrics(monthCards), [monthCards]);

  const handleDownloadPdf = useCallback(async () => {
    setPdfBusy(true);
    try {
      await downloadMetricsPdf({
        cards: monthCards,
        monthKey: selectedMonth,
        clientFilter,
      });
    } finally {
      setPdfBusy(false);
    }
  }, [monthCards, selectedMonth, clientFilter]);

  return (
    <section>
      <ClientPortalSectionHeader
        title="Metrics"
        description="Monthly content mix and engagement for calendar posts. Enter numbers on each card’s Metrics tab."
      >
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfBusy}
          className={`${btnPrimaryClass} px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {pdfBusy ? 'Downloading…' : 'Download PDF'}
        </button>
      </ClientPortalSectionHeader>

      <MonthNav
        monthLabel={formatYearMonthLabel(selectedMonth)}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
      />

      {monthCards.length === 0 ? (
        <div className={`${surfacePanelClass} px-5 py-10 text-center`}>
          <p className="text-sm text-white/50">
            No dated calendar posts for {formatYearMonthLabel(selectedMonth)}.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
              This month overview — content mix
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Reels" value={contentCounts.reels} />
              <StatTile label="Carousels / Statics" value={contentCounts.carouselStatics} />
              <StatTile label="Total posts" value={contentCounts.total} />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
              Engagement overview
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {METRIC_FIELDS.map((field) => (
                <StatTile
                  key={field}
                  label={METRIC_FIELD_LABELS[field]}
                  value={engagement[field] || 0}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
              Each post broken down
            </h3>
            <div className={`${surfacePanelClass} overflow-x-auto`}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-3 py-3 font-medium">Client</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Publish</th>
                    {METRIC_FIELDS.map((field) => (
                      <th key={field} className="px-3 py-3 font-medium tabular-nums">
                        {METRIC_FIELD_LABELS[field]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthCards.map((card) => {
                    const metrics = normalizeCardMetrics(card);
                    const typeStyle = getContentTypeStyle(card.contentType);
                    return (
                      <tr
                        key={card.id}
                        className="cursor-pointer border-b border-white/[0.06] transition hover:bg-white/[0.04]"
                        onClick={() => onOpenCard?.(card, { tab: 'metrics' })}
                      >
                        <td className="max-w-[14rem] truncate px-4 py-3 font-medium text-white">
                          {card.title || 'Untitled'}
                        </td>
                        <td className="px-3 py-3 text-white/70">{card.client || '—'}</td>
                        <td className="px-3 py-3">
                          <span
                            {...contentTypeLabelProps(
                              typeStyle,
                              'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium',
                            )}
                          >
                            {card.contentType || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-white/60">
                          {publishDateLabel(card)}
                        </td>
                        {METRIC_FIELDS.map((field) => (
                          <td key={field} className="px-3 py-3 tabular-nums text-white/80">
                            {metrics[field] || 0}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
