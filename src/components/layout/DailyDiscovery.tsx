export function DailyDiscovery({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      aria-label="Daily 1on1 discovery"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3"
    >
      <div>
        <h2 className="text-sm font-semibold">Daily 1on1</h2>
        {!compact && <p className="mt-1 text-sm text-slate-300">Guess today’s players and vote on the matchup.</p>}
      </div>
      <a
        href="/1on1"
        className="inline-flex min-h-11 items-center rounded-md border border-orange-500/60 px-3 text-sm font-semibold text-orange-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
      >
        {compact ? "Play Daily 1on1" : "Play Today’s 1on1"}
      </a>
    </aside>
  );
}
