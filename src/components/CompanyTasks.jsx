import { useEffect, useState } from 'react';
import { useStaffWorkspaceScope } from '../hooks/useStaffWorkspaceScope';
import EditorTodo from './EditorTodo';
import AccountManagerTodo from './AccountManagerTodo';
import AdminTodo from './AdminTodo';
import ContentCreatorTodo from './ContentCreatorTodo';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass, glassSegmentClass } from './clientPortal/clientPortalUi';

export default function CompanyTasks({
  cards,
  adminTasks,
  clientFilter,
  embedded = false,
  initialRole = 'creator',
  onRoleChange,
  onAddOneOffTask,
  onDeleteOneOffTask,
  onAddAdminTask,
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
  onNavigate,
  onPlanPostDate,
}) {
  const { visibleCompanyTaskTabs } = useStaffWorkspaceScope();
  const [activeRole, setActiveRole] = useState(initialRole);

  useEffect(() => {
    setActiveRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    if (!visibleCompanyTaskTabs.includes(activeRole)) {
      setActiveRole(visibleCompanyTaskTabs[0] || 'editor');
    }
  }, [visibleCompanyTaskTabs, activeRole]);

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
      <div
        className={`${glassSegmentClass} mb-5 flex w-fit flex-wrap gap-0.5 p-0.5 ${
          embedded ? '' : 'mx-auto mb-6 justify-center'
        }`}
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

      {activeRole === 'creator' && (
        <ContentCreatorTodo
          cards={cards}
          clientFilter={clientFilter}
          onOpenCard={onOpenCard}
          onHandoff={onHandoff}
          onNavigate={onNavigate}
        />
      )}

      {activeRole === 'editor' && (
        <EditorTodo
          embedded
          cards={cards}
          clientFilter={clientFilter}
          onAddOneOffTask={onAddOneOffTask}
          onDeleteOneOffTask={onDeleteOneOffTask}
          onOpenCard={onOpenCard}
          onSubmitForReview={onSubmitForReview}
          onApproveReview={onApproveReview}
          onSendBackForEditing={onSendBackForEditing}
          onMoveTask={onMoveTask}
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
        />
      )}

      {activeRole === 'admin' && (
        <AdminTodo
          embedded
          adminTasks={adminTasks}
          clientFilter={clientFilter}
          onAddAdminTask={onAddAdminTask}
          onToggleAdminTaskComplete={onToggleAdminTaskComplete}
          onDeleteAdminTask={onDeleteAdminTask}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader title="Team tasks" compact />
        {content}
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
      {content}
    </div>
  );
}
