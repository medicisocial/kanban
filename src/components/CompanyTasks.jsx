import { useState } from 'react';
import EditorTodo from './EditorTodo';
import AccountManagerTodo from './AccountManagerTodo';
import AdminTodo from './AdminTodo';

export default function CompanyTasks({
  cards,
  taskOrder,
  adminTasks,
  search,
  clientFilter,
  onAddOneOffTask,
  onDeleteOneOffTask,
  onAddAdminTask,
  onToggleAdminTaskComplete,
  onDeleteAdminTask,
  onOpenCard,
  onSyncTaskOrder,
  onSetTaskOrder,
  onReorderTasks,
  onResetTaskOrder,
  onSchedulePost,
  onMarkPosted,
  onSubmitForReview,
  onSendBackForEditing,
}) {
  const [activeRole, setActiveRole] = useState('editor');

  const tabClass = (role) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      activeRole === role ? 'bg-[#810100] text-white' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-white">Company tasks</h1>
        <p className="mt-1 text-sm text-gray-400">
          Worklists for editors, account managers, and administrative work.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap rounded-lg border border-white/10 bg-white/5 p-0.5 w-fit gap-0.5">
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

      {activeRole === 'editor' && (
        <EditorTodo
          embedded
          cards={cards}
          taskOrder={taskOrder}
          search={search}
          clientFilter={clientFilter}
          onAddOneOffTask={onAddOneOffTask}
          onDeleteOneOffTask={onDeleteOneOffTask}
          onOpenCard={onOpenCard}
          onSubmitForReview={onSubmitForReview}
          onSendBackForEditing={onSendBackForEditing}
          onSyncTaskOrder={onSyncTaskOrder}
          onSetTaskOrder={onSetTaskOrder}
          onReorderTasks={onReorderTasks}
          onResetTaskOrder={onResetTaskOrder}
        />
      )}

      {activeRole === 'account' && (
        <AccountManagerTodo
          cards={cards}
          search={search}
          clientFilter={clientFilter}
          onOpenCard={onOpenCard}
          onSchedulePost={onSchedulePost}
          onMarkPosted={onMarkPosted}
        />
      )}

      {activeRole === 'admin' && (
        <AdminTodo
          embedded
          adminTasks={adminTasks}
          search={search}
          clientFilter={clientFilter}
          onAddAdminTask={onAddAdminTask}
          onToggleAdminTaskComplete={onToggleAdminTaskComplete}
          onDeleteAdminTask={onDeleteAdminTask}
        />
      )}
    </div>
  );
}
