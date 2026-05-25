export default function Navbar({ search, onSearchChange, activeView, onViewChange, onSignOut }) {
  const tabClass = (view) =>
    `rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ${
      activeView === view
        ? "bg-[#810100] text-white"
        : "text-gray-400 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-black/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#810100] to-[#a00000] shadow-lg shadow-[#810100]/20">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div>
            <h1 className="font-serif text-base font-semibold tracking-tight text-white sm:text-lg">
              Medici Social
            </h1>
            <p className="hidden text-xs text-white/50 sm:block">Client Pipeline</p>
          </div>
        </div>

        <div className="flex overflow-x-auto rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button type="button" onClick={() => onViewChange("ideas")} className={tabClass("ideas")}>
            Ideas
          </button>
          <button type="button" onClick={() => onViewChange("board")} className={tabClass("board")}>
            Board
          </button>
          <button type="button" onClick={() => onViewChange("calendar")} className={tabClass("calendar")}>
            Calendar
          </button>
          <button type="button" onClick={() => onViewChange("todo")} className={tabClass("todo")}>
            Tasks
          </button>
          <button type="button" onClick={() => onViewChange("shoot")} className={tabClass("shoot")}>
            Shoot Schedule
          </button>
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 outline-none transition focus:border-[#810100]/50 focus:ring-1 focus:ring-[#810100]/30"
          />
        </div>

        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-400 transition hover:border-white/20 hover:text-white"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
