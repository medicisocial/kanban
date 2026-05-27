import { useEffect, useState } from 'react';
import EditorTodo from './EditorTodo';
import AccountManagerTodo from './AccountManagerTodo';
import AdminTodo from './AdminTodo';
import ContentCreatorTodo from './ContentCreatorTodo';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import { btnPrimaryClass } from './clientPortal/clientPortalUi';

export default function CompanyTasks({
  cards,
  adminTasks,
  clientFilter,
  embedded = false,
  initialRole = 'creator',
  onAddOneOffTask,
  onDeleteOneOffTask,
  onAddAdminTask,
  onToggleAdminTaskComplete,
  onDeleteAdminTask,
  onOpenCard,
  onMarkScheduled,
  onMarkPosted,
  onSubmitForReview,
  onApproveReview,
  onSendBackForEditing,
  onMoveTask,
  onHandoff,
  onNavigate,
}) {
  const [activeRole, setActiveRole] = useState(initialRole);

  useEffect(() => {
    setActiveRole(initialRole);
  }, [initialRole]);

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
        className={
          embedded
            ? 'mb-5 flex flex-wrap border border-white/10 bg-white/[0.03] p-0.5 w-fit gap-0.5'
            : 'mb-6 flex flex-wrap justify-center rounded-lg border border-white/10 bg-white/5 p-0.5 w-fit gap-0.5 mx-auto'
        }
      >
        <button type="button" onClick={() => setActiveRole('creator')} className={tabClass('creator')}>
          Content creators
        </button>
        <button type="button" onClick={() => setActiveRole('editor')} className={tabClass('editor')}>
          Editors
        </button>
        <button type="button" onClick={() => setActiveRole('account')} className={tabClass('account')}>
          Account managers
        </button>
        <button type="button" onClick={() => setActiveRole('admin')} className={tabClass('admin')}>
          Administrative
        </button>
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
          cards={cards}
          clientFilter={clientFilter}
          onOpenCard={onOpenCard}
          onMarkScheduled={onMarkScheduled}
          onMarkPosted={onMarkPosted}
          onApproveReview={onApproveReview}
          onMoveTask={onMoveTask}
          onSendBackForEditing={onSendBackForEditing}
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
        <ClientPortalSectionHeader
          title="Team tasks"
          description="Content creator, editor, account manager, and administrative worklists across all clients."
        />
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
