export default function BidderRootLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      <div className="h-4 w-72 bg-[var(--surface-2)] rounded animate-pulse" />
      <div className="mt-6 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />)}
      </div>
    </div>
  );
}
