# Frontend SPA Architect — Generalized Skill File

> Focus: Single-page application architecture patterns, URL-param routing, context hierarchy composition, lazy loading strategies, modal/overlay management, and component patterns applicable to any SPA project.

---

## 1. Routing Without React Router

### Pattern: URL-Param Based Routing

Instead of a routing library, encode the current view in URL query parameters:

```
URL: https://app.example.com?view=dashboard&id=abc123

Parse:  const view = new URLSearchParams(location.search).get('view')
Push:   history.pushState({ view: 'dashboard' }, '', '?view=dashboard')
```

### Why Skip React Router

| Reason | Explanation |
|---|---|
| **Avoid dependency** | React Router is heavy (12KB+). For simple SPAs, URL params suffice. |
| **Direct URL control** | No route-matching surprises — you explicitly control what's shown. |
| **Easy to test** | Components receive params, not route match objects. |
| **No nested routing complexity** | One level of routing via query params. |

### Implementation

```typescript
type GateView = 'dashboard' | 'settings' | 'profile' | 'admin';

// Parse current view from URL
function parseGateView(): GateView | null {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (isValidView(view)) return view as GateView;
  return null;
}

// Navigate (push history entry)
function pushGateHistory(view: GateView, params?: Record<string, string>) {
  const query = new URLSearchParams(window.location.search);
  query.set('view', view);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      query.set(key, value);
    }
  }
  history.pushState({ view }, '', `?${query.toString()}`);
}

// Root component
function App() {
  const [currentView, setCurrentView] = useState(() => parseGateView());

  useEffect(() => {
    const onPop = () => setCurrentView(parseGateView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <GateViewContext.Provider value={currentView}>
      {renderView(currentView)}
    </GateViewContext.Provider>
  );
}
```

### Auth Gate Integration

```
Check if user is authenticated:
  YES → render current view
  NO  → redirect to ?login=1 (or ?signup=1&plan=xxx)

Public pages (landing, pricing) render without auth.
```

---

## 2. Context Hierarchy Composition

### Provider Layering

```
<AuthProvider>              ← Authentication (session, login, logout)
  <SyncProvider>            ← Data sync state (online/offline, bootstrap, errors)
    <ThemeProvider>         ← UI theme (light/dark, branding)
      <DataProvider>        ← Application data cache
        <UIProvider>        ← UI state (modals, toasts, sidebar)
          <AppShell />      ← Shell renders current view
```

### Provider Design Rules

```
1. Each provider has ONE responsibility
2. Providers don't depend on siblings (only parents)
3. The deepest provider (UIProvider) signals state changes via callbacks, not context
4. Memoize context values to prevent cascading re-renders:
     const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
```

### Context Value Pattern

```typescript
// GOOD: minimal, memoized, stable references
interface AuthContextValue {
  readonly isAuthenticated: boolean;
  readonly user: User | null;
  readonly login: (email: string, password: string) => Promise<AuthResult>;
  readonly logout: () => void;
}

// BAD: entire state object, changes on every render
const AuthContext = createContext(authState); // ← changes too frequently
```

### Context Composition vs Prop Drilling

```
Global state (auth, theme, sync status) → Context
Page state (current view, selected item) → Component state (useState)
Scoped data (list filters, form input)   → Local state
Everything else                          → Props
```

---

## 3. Lazy Loading Strategies

### Component Splitting

```typescript
import { lazy } from 'react';

// Standard lazy load
const Dashboard = lazy(() => import('./Dashboard'));
const Settings = lazy(() => import('./Settings'));

// Lazy load with retry on failure
function lazyWithRetry(importFn: () => Promise<any>, retries = 2) {
  return lazy(() =>
    importFn().catch((error) => {
      if (retries <= 0) throw error;
      console.warn(`Lazy load failed, retrying... (${retries} left)`);
      return lazyWithRetry(importFn, retries - 1).then(m => ({ default: m }));
    })
  );
}
```

### Fallback Strategy

```typescript
// Global fallback for route-level splits
<Suspense fallback={<FullPageSpinner />}>
  {renderView(currentView)}
</Suspense>

// Local fallback for component-level splits
<div className="card">
  <Suspense fallback={<CardSkeleton />}>
    <ExpensiveChart />
  </Suspense>
</div>
```

### Splitting Decisions

| Granularity | When to Split | Example |
|---|---|---|
| **Route/View** | Always split on view boundaries | Dashboard, Settings, Admin |
| **Component** | Heavy third-party libs, charts, editors | Code editor, date picker, rich text |
| **Utility** | Never split utilities (tiny + synchronous) | date formatters, validators |

---

## 4. Modal/Overlay System

### Single-Modal Pattern (Recommended)

Instead of a modal manager or a modal per component, use a **single state variable**.

```typescript
// Type-safe modal state
type ModalConfig =
  | { type: 'editCard'; cardId: string }
  | { type: 'confirmDelete'; itemId: string }
  | { type: 'createUser'; defaultRole?: string }
  | null;  // no modal open

function MyApp() {
  const [modal, setModal] = useState<ModalConfig>(null);

  return (
    <>
      <button onClick={() => setModal({ type: 'createUser' })}>
        Add User
      </button>

      {/* All modals rendered here, only one open at a time */}
      {modal?.type === 'editCard' && (
        <EditCardModal cardId={modal.cardId} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'confirmDelete' && (
        <ConfirmDeleteModal
          itemId={modal.itemId}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'createUser' && (
        <CreateUserModal
          defaultRole={modal.defaultRole}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
```

### Rules for Modal State

```
1. ONE modal state variable at the app level
2. Modals close when navigating (clear modal in view transition)
3. Data flows INTO the modal via the type/params, never via context
4. Modal onClose is always the close handler
5. Avoid nested modals (modal on top of modal)
```

### Overlay Composition

```typescript
// Overlay stack (sidebar, drawer, popover, tooltip)
const overlayStack = [
  { id: 'sidebar', type: 'slide-in', component: <Sidebar /> },
  { id: 'drawer', type: 'drawer', component: <FiltersDrawer /> },
  { id: 'modal', type: 'modal', component: <DeleteConfirmModal /> },
];

// Only the top overlay is interactive
// Lower overlays are dimmed / inert
```

---

## 5. Component Patterns

### Container vs Presentational

```
Container components:
  - Access context, hooks, state
  - Compose data and pass down
  - File: UserListPage.jsx

Presentational components:
  - Receive props, render UI
  - No context or data fetching
  - File: UserCard.jsx, UserTable.jsx
```

### Common Component Types

```typescript
// Page — top-level view, matches a route
function DashboardPage() {
  const { user } = useAuth();
  const { data } = useDashboardData();
  return <DashboardUI user={user} data={data} />;
}

// Card — self-contained content unit
function StatCard({ title, value, trend }: StatCardProps) {
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <p>{value}</p>
      {trend && <TrendIndicator trend={trend} />}
    </div>
  );
}

// Form Section — group of related inputs
function UserProfileSection() {
  return (
    <fieldset>
      <legend>Profile</legend>
      <NameInput />
      <EmailInput />
      <AvatarUpload />
    </fieldset>
  );
}

// Shell — layout wrapper
function AppShell({ header, sidebar, main }: ShellProps) {
  return (
    <div className="app-shell">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{main}</main>
    </div>
  );
}
```

---

## 6. Data Flow Architecture

### Unidirectional Data Flow

```
User action → Component calls context method
  → Context calls API utility
    → API utility fetches/updates server
      → Context updates state
        → Component re-renders
```

### State Categories

| Category | Where | Example |
|---|---|---|
| **Server data** (cached) | Context, custom hooks | User list, dashboard stats |
| **UI state** | Component state | Modal open, tab selected |
| **Auth state** | Auth context | Current user, session |
| **Sync state** | Sync context | Online/offline, last sync |
| **Form state** | Local state | Input values, validation |

---

## 7. Code Organization

### Feature-Based Structure (Recommended)

```
src/
  features/
    dashboard/
      DashboardPage.jsx
      DashboardCard.jsx
      useDashboardData.js
    users/
      UserListPage.jsx
      UserCard.jsx
      useUsers.js
    settings/
      SettingsPage.jsx
      ProfileSection.jsx
      useProfileSettings.js
  shared/           # (or components/ for older convention)
    Button.jsx
    Modal.jsx
    Spinner.jsx
  context/
    AuthContext.jsx
    ThemeContext.jsx
  hooks/
    useLocalStorage.js
    useDebounce.js
  utils/
    formatters.js
    validators.js
```

### File Naming Convention

```
Pages:    DashboardPage.jsx, UserListPage.jsx
Hooks:    useDashboardData.js, useUsers.js
Context:  AuthContext.jsx, ThemeContext.jsx
Utils:    formatters.js, validators.js
Types:    types.ts, dashboard.types.ts
Test:     UserListPage.test.jsx, useUsers.test.js
```

---

## 8. Performance Patterns

### Memoization Rules

```
useMemo:  Computed values from expensive operations
useCallback: Stable function references for child components / dependency arrays
React.memo: Pure components that re-render only when props change

Don't memoize: Simple operations, components with trivial render cost
Do memoize: Lists, charts, components with complex children
```

### Common Performance Anti-Patterns

| Anti-pattern | Fix |
|---|---|
| New object/array on every render in context value | `useMemo` on context value |
| Inline arrow functions as component props | `useCallback` for handlers |
| Expensive calculation in render body | `useMemo` or move to hook |
| All state in one giant context | Split into focused contexts |
| Re-rendering entire tree on input change | Isolate input state in form components |

---

## 9. Error Boundaries

```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Boundary caught:', error, info.componentStack);
    // Report to error tracking service
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Force remount of children
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <h2>Something went wrong</h2>
          <button onClick={this.handleRetry}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Where to Place Error Boundaries

```
1. Top of app — catch anything unhandled
2. Per view/page — so one broken page doesn't kill others
3. Around third-party widgets — isolate failures
```

---

## 10. Implementation Checklist for New SPA

- [ ] Choose routing strategy (URL params vs router library)
- [ ] Design context hierarchy (order matters)
- [ ] Set up lazy loading with retry for route-level splits
- [ ] Implement single-modal system
- [ ] Create AppShell layout wrapper
- [ ] Set up error boundary hierarchy
- [ ] Define state categories and their locations
- [ ] Choose component organization (feature-based vs type-based)
- [ ] Set up memoization strategy
- [ ] Implement auth gate at app root