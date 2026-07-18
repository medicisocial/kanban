import { readFileSync } from 'fs';
import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { buildNavBadgeCounts } = await vite.ssrLoadModule('/src/utils/workspaceHome.js');

const summary = {
  toCreateCount: 2,
  shootsTodayCount: 1,
  editingCount: 3,
  editorInReviewCount: 1,
  accountManagerTaskCount: 7,
  inReviewCount: 2,
  needsSchedulingCount: 2,
  needPostDateCount: 2,
  storiesTodayCount: 1,
  openAdminTasksCount: 4,
  pendingIdeasCount: 5,
};

const allBadges = buildNavBadgeCounts(summary, 0);
assert(allBadges['todo-creator'] === 2, 'creator nav badge matches To Create queue');
assert(allBadges['todo-editor'] === 4, 'editor nav badge combines editing and review queues');
assert(allBadges['todo-account'] === 7, 'account manager nav badge uses all AM queues');
assert(allBadges['todo-admin'] === 4, 'administrative nav badge matches open admin tasks');

const scopedBadges = buildNavBadgeCounts(summary, 0, ['creator', 'editor']);
assert(scopedBadges['todo-creator'] === 2, 'visible creator role keeps badge');
assert(scopedBadges['todo-editor'] === 4, 'visible editor role keeps badge');
assert(!('todo-account' in scopedBadges), 'hidden account role has no badge');
assert(!('todo-admin' in scopedBadges), 'hidden admin role has no badge');

const navSource = readFileSync(
  new URL('../src/components/clientPortal/AdminConsoleLayout.jsx', import.meta.url),
  'utf8',
);
assert(navSource.includes("id: 'todo-creator'"), 'sidebar includes Content Creator role');
assert(navSource.includes("id: 'todo-editor'"), 'sidebar includes Editor role');
assert(navSource.includes("id: 'todo-account'"), 'sidebar includes Account Manager role');
assert(navSource.includes("id: 'todo-admin'"), 'Admin includes Administrative Tasks');
assert(navSource.includes("{ id: 'team', label: 'Staff'"), 'staff management route is retained');
assert(!navSource.includes("{ id: 'todo', label: 'Team tasks'"), 'generic Team tasks nav is removed');

const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(shellSource.includes("view.startsWith('todo-')"), 'synthetic task nav IDs map to todo view');
assert(
  shellSource.includes("activeView === 'todo' ? `todo-${tasksRole}`"),
  'selected task role drives active sidebar state',
);
assert(shellSource.includes('visibleTaskTabs={visibleCompanyTaskTabs}'), 'sidebar respects role visibility');

const tasksSource = readFileSync(new URL('../src/components/CompanyTasks.jsx', import.meta.url), 'utf8');
assert(tasksSource.includes('{!embedded && ('), 'embedded role pages hide redundant role tabs');
assert(tasksSource.includes("admin: 'Administrative Tasks'"), 'administrative page has direct title');
assert(tasksSource.includes('onOpenShoot={onOpenShoot}'), 'Content Creator tab receives shoot navigation');
assert(tasksSource.includes('onAddCard={onAddToCreateCard}'), 'Content Creator receives To Create add handler');
assert(tasksSource.includes('onAddCard={onAddEditingCard}'), 'Editors receive Needs editing add handler');

const creatorSource = readFileSync(
  new URL('../src/components/ContentCreatorTodo.jsx', import.meta.url),
  'utf8',
);
assert(creatorSource.includes('Go to shoot'), 'Content Creator cards expose Go to shoot');
assert(creatorSource.includes('onOpenShoot(task.card)'), 'Content Creator shoot button opens the card shoot');
assert(creatorSource.includes('+ Add card'), 'Content Creator exposes Add card control');
assert(
  creatorSource.includes('taskActionBtnClass'),
  'Content Creator card actions use compact team-card button styling',
);
assert(!creatorSource.includes('Make one-off'), 'Content Creator cards do not expose Make one-off');
assert(!creatorSource.includes('onConvertToOneOff'), 'Content Creator does not wire one-off conversion');
assert(
  !tasksSource.includes('onConvertToOneOff'),
  'CompanyTasks does not pass convert-to-one-off into Content Creator',
);
assert(
  shellSource.includes('onConvertCardToOneOff') && shellSource.includes('buildOneOffConversionUpdates'),
  'AppShell still converts Vault To Create cards to one-offs in place',
);
assert(
  shellSource.includes("handleNavigate('shoot'") && shellSource.includes('onOpenShoot={(card)'),
  'AppShell wires Content Creator shoot navigation',
);
assert(
  shellSource.includes("addCard('shoot'") && shellSource.includes("addCard('editing'"),
  'AppShell wires manual add into To Create and Needs editing',
);

await vite.close();
console.log('test-team-role-navigation: ok');
