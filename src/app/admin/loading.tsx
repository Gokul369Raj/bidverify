export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="bg-[var(--accent)] text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-lg animate-pulse" />
          <div className="space-y-1"><div className="h-4 w-48 bg-white/20 rounded animate-pulse" /><div className="h-2.5 w-32 bg-white/10 rounded animate-pulse" /></div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
        </div>
        <div className="h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
        <div className="h-40 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
