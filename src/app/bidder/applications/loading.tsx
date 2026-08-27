export default function ApplicationsLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="h-10 w-56 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      {[1,2,3].map(i => <div key={i} className="h-28 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
    </div>
  );
}
