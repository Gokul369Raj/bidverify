export default function DocumentsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-[var(--surface)] border border-[var(--border)] rounded-lg animate-pulse" />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
    </div>
  );
}
