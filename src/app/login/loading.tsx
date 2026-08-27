export default function LoginLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm space-y-4">
        <div className="h-8 w-32 bg-[var(--surface-2)] rounded-lg mx-auto animate-pulse" />
        <div className="h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
        <div className="h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
        <div className="h-12 bg-[var(--accent)] rounded-xl animate-pulse opacity-50" />
      </div>
    </div>
  );
}
