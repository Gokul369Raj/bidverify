export default function TendersLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      <div className="h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
      {[1,2,3].map(i => <div key={i} className="h-32 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
    </div>
  );
}
