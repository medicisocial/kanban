import { useEffect, useState, useCallback } from 'react';
import { useStaffWorkspaceScope } from '../hooks/useStaffWorkspaceScope';
import { useClientEmailSend } from '../hooks/useClientEmailSend';
import { buildContentReviewSharePayload } from '../utils/contentReviewShare';
import EditorTodo from './EditorTodo';
import AccountManagerTodo from './AccountManagerTodo';
import AdminTodo from './AdminTodo';
import ContentCreatorTodo from './ContentCreatorTodo';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, glassSegmentClass } from './clientPortal/clientPortalUi';

const ROLE_LABELS = {
  creator: 'Content Creator',
  editor: 'Editors',
  account: 'Account Managers',
  admin: 'Administrative Tasks',
};

export default function CompanyTasks({
  cards,
  ideas = [],
  adminTasks,
  clientFilter,
  embedded = false,
  initialRole = 'creator',
  onRoleChange,
  onAddOneOffTask,
  onDeleteOneOffTask,
  onAddToCreateCard,
  onAddEditingCard,
  onAddAdminTask,
  onUpdateAdminTask,
  onToggleAdminTaskComplete,
  onDeleteAdminTask,
  onOpenCard,
  onUpdateCard,
  onMarkScheduled,
  onMarkPosted,
  onSubmitForReview,
  onApproveReview,
  onSendBackForEditing,
  onMoveTask,
  onHandoff,
  onReturnToVault,
  onNavigate,
  onOpenShoot,
  onPlanPostDate,
}) {
  const { visibleCompanyTaskTabs } = useStaffWorkspaceScope();
  const [activeRole, setActiveRole] = useState(initialRole);
  const { openSend, modal: shareEmailModal } = useClientEmailSend('review');
  const [shareError, setShareError] = useState('');

  const handleShareWithClient = useCallback((task) => {
    const card = task?.card ?? cards.find((entry) => entry.id === task?.cardId);
    const client = task?.client || card?.client;
    if (!card || !client) {
      setShareError('Could not share — this task is missing card or client info.');
      return;
    }
    try {
      setShareError('');
      openSend(buildContentReviewSharePayload(client, [card]));
    } catch (err) {
      setShareError(err?.message || 'Could not open the share email dialog.');
    }
  }, [cards, openSend]);

  useEffect(() => {
    setActiveRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    if (!visibleCompanyTaskTabs.includes(activeRole)) {
      const fallbackRole = visibleCompanyTaskTabs[0] || 'editor';
      setActiveRole(fallbackRole);
      onRoleChange?.(fallbackRole);
    }
  }, [visibleCompanyTaskTabs, activeRole, onRoleChange]);

  const selectRole = (role) => {
    setActiveRole(role);
    onRoleChange?.(role);
  };

  const tabClass = (role) =>
    embedded
      ? `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
          activeRole === role ? `${btnPrimaryClass} py-1.5` : 'text-white/45 hover:text-white'
        }`
      : `rounded-md px-3 py-1.5 text-sm font-medium transition ${
          activeRole === role ? 'bg-[#810100] text-white' : 'text-gray-400 hover:text-white'
        }`;

  const content = (
    <>
      {!embedded && (
        <div
          className={`${glassSegmentClass} mx-auto mb-6 flex w-fit flex-wrap justify-center gap-0.5 p-0.5`}
        >
        {visibleCompanyTaskTabs.includes('creator') && (
          <button type="button" onClick={() => selectRole('creator')} className={tabClass('creator')}>
            Content creators
          </button>
        )}
        {visibleCompanyTaskTabs.includes('editor') && (
          <button type="button" onClick={() => selectRole('editor')} className={tabClass('editor')}>
            Editors
          </button>
        )}
        {visibleCompanyTaskTabs.includes('account') && (
          <button type="button" onClick={() => selectRole('account')} className={tabClass('account')}>
            Account managers
          </button>
        )}
        {visibleCompanyTaskTabs.includes('admin') && (
          <button type="button" onClick={() => selectRole('admin')} className={tabClass('admin')}>
            Administrative
          </button>
        )}
        </div>
      )}

      {activeRole === 'creator' && (
        <ContentCreatorTodo
          cards={cards}
          ideas={ideas}
          clientFilter={clientFilter}
          onAddCard={onAddToCreateCard}
          onOpenCard={onOpenCard}
          onOpenShoot={onOpenShoot}
          onHandoff={onHandoff}
          onReturnToVault={onReturnToVault}
          onNavigate={onNavigate}
        />
      )}

      {activeRole === 'editor' && (
        <EditorTodo
          embedded
          cards={cards}
          clientFilter={clientFilter}
          onAddCard={onAddEditingCard}
          onAddOneOffTask={onAddOneOffTask}
          onDeleteOneOffTask={onDeleteOneOffTask}
          onOpenCard={onOpenCard}
          onSubmitForReview={onSubmitForReview}
          onApproveReview={onApproveReview}
          onSendBackForEditing={onSendBackForEditing}
          onMoveTask={onMoveTask}
          onShareWithClient={handleShareWithClient}
        />
      )}

      {activeRole === 'account' && (
        <AccountManagerTodo
          embedded
          cards={cards}
          clientFilter={clientFilter}
          onOpenCard={onOpenCard}
          onUpdateCard={onUpdateCard}
          onMarkScheduled={onMarkScheduled}
          onMarkPosted={onMarkPosted}
          onApproveReview={onApproveReview}
          onMoveTask={onMoveTask}
          onSendBackForEditing={onSendBackForEditing}
          onPlanPostDate={onPlanPostDate}
          onShareWithClient={handleShareWithClient}
        />
      )}

      {activeRole === 'admin' && (
        <AdminTodo
          embedded
          adminTasks={adminTasks}
          clientFilter={clientFilter}
          onAddAdminTask={onAddAdminTask}
          onUpdateAdminTask={onUpdateAdminTask}
          onToggleAdminTaskComplete={onToggleAdminTaskComplete}
          onDeleteAdminTask={onDeleteAdminTask}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader title={ROLE_LABELS[activeRole] || 'Team tasks'} compact />
        {shareError && (
          <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
            {shareError}
          </p>
        )}
        {content}
        {shareEmailModal}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-semibold text-white">Company tasks</h1>
        <p className="mt-1 text-sm text-gray-400">
          Worklists for creators, editors, account managers, and administrative work.
        </p>
      </div>
      {shareError && (
        <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
          {shareError}
        </p>
      )}
      {content}
      {shareEmailModal}
    </div>
  );
}
