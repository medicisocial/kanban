import { useMemo, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import ClientAvatar from './ClientAvatar';
import ReferenceVideoLink from './clientPortal/ReferenceVideoLink';
import {
  btnGhostClass,
  btnPrimaryClass,
  mobileActionRowClass,
  mobileCardClass,
  mobileMetaClass,
  surfacePanelClass,
  tableCellClass,
  tableHeaderClass,
  tableRowClass,
} from './clientPortal/clientPortalUi';
import { contentTypeLabelProps } from '../utils/contentTypeColors';

export default function IdeaVaultTable({
  ideas,
  onEdit,
  onSchedule,
  onDelete,
  readOnly = false,
  hideClientColumn = false,
}) {
  const { getClientColor } = useClientsContext();
  const [expandedId, setExpandedId] = useState(null);

  const sorted = useMemo(
    () =>
      [...ideas].sort((a, b) => {
        const clientCompare = (a.client || '').localeCompare(b.client || '');
        if (clientCompare !== 0) return clientCompare;
        return (b.reviewedAt || b.createdAt || 0) - (a.reviewedAt || a.createdAt || 0);
      }),
    [ideas],
  );

  if (sorted.length === 0) {
    return (
      <div className={`${surfacePanelClass} px-4 py-16 text-center`}>
        <p className="text-sm text-white/45">
          {readOnly
            ? 'No approved concepts waiting for a shoot day.'
            : 'No approved concepts in the bank yet.'}
        </p>
        <p className="mt-2 text-xs text-white/35">
          {readOnly
            ? 'When your team approves ideas, they appear here until scheduled on a shoot.'
            : 'When clients approve concepts, they land in the bank until you schedule them on a shoot.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`${surfacePanelClass} overflow-hidden`}>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-xs text-white/45">
          {sorted.length} concept{sorted.length === 1 ? '' : 's'}{' '}
          {readOnly ? 'ready to schedule' : 'in the bank'}
        </p>
      </div>

      <div className="md:hidden">
        {sorted.map((idea) => {
          const expanded = expandedId === idea.id;
          const typeStyle = getContentTypeStyle(idea.contentType);
          return (
            <div key={idea.id} className={mobileCardClass}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : idea.id)}
                className="w-full text-left font-medium text-white"
              >
                {idea.title || 'Untitled idea'}
              </button>
              {idea.description && !expanded && (
                <p className="mt-1 line-clamp-2 text-xs text-white/40">{idea.description}</p>
              )}
              {idea.referenceVideo && (
                <div className="mt-2">
                  <ReferenceVideoLink url={idea.referenceVideo} compact />
                </div>
              )}
              <div className={mobileMetaClass}>
                {idea.contentType && (
                  <span {...contentTypeLabelProps(typeStyle, 'uppercase tracking-wider')}>
                    {idea.contentType}
                  </span>
                )}
                {!hideClientColumn && <span className="text-white/70">{idea.client}</span>}
              </div>
              {!readOnly && (
              <div className={mobileActionRowClass}>
                <button
                  type="button"
                  onClick={() => onSchedule?.(idea)}
                  className={`${btnPrimaryClass} min-h-10 flex-1 px-3 py-2 text-[11px]`}
                >
                  Add to shoot
                </button>
                <button
                  type="button"
                  onClick={() => onEdit?.(idea)}
                  className={`${btnGhostClass} min-h-10 flex-1 text-[11px]`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(idea)}
                  className={`${btnGhostClass} min-h-10 flex-1 text-[11px] text-rose-300/80`}
                >
                  Delete
                </button>
              </div>
              )}
              {expanded && (
                <div className="mt-3 border border-white/10 bg-white/[0.02] p-3 text-sm text-white/70">
                  {idea.description && <p>{idea.description}</p>}
                  {idea.clientComment && (
                    <p className="mt-2 text-xs text-white/50">Client note: {idea.clientComment}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="w-[32%]"><span className={tableHeaderClass}>Title</span></th>
              <th className="w-[14%]"><span className={tableHeaderClass}>Reference</span></th>
              <th className="w-[12%]"><span className={tableHeaderClass}>Type</span></th>
              {!hideClientColumn && (
                <th className="w-[16%]"><span className={tableHeaderClass}>Client</span></th>
              )}
              {!readOnly && (
                <th className="w-[26%]"><span className={tableHeaderClass}>Actions</span></th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((idea) => {
              const clientColor = getClientColor(idea.client);
              const typeStyle = getContentTypeStyle(idea.contentType);
              return (
                <tr key={idea.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <p className="font-medium text-white">{idea.title || 'Untitled idea'}</p>
                    {idea.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-white/40">{idea.description}</p>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <ReferenceVideoLink url={idea.referenceVideo} />
                  </td>
                  <td className={`${tableCellClass} text-xs uppercase tracking-wider text-white/55`}>
                    {idea.contentType || '—'}
                  </td>
                  {!hideClientColumn && (
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-2">
                      <ClientAvatar client={idea.client} size="md" color={clientColor} />
                      <span className="truncate text-xs text-white/70">{idea.client}</span>
                    </div>
                  </td>
                  )}
                  {!readOnly && (
                  <td className={tableCellClass}>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSchedule?.(idea)}
                        className={`${btnPrimaryClass} px-2.5 py-1.5 text-[10px]`}
                      >
                        Add to shoot
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit?.(idea)}
                        className={`${btnGhostClass} text-[10px] uppercase tracking-wider`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(idea)}
                        className={`${btnGhostClass} text-[10px] uppercase tracking-wider text-rose-300/80 hover:text-rose-200`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
