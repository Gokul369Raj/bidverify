export default function OfficerLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-6" aria-busy="true">
      <div className="skeleton h-8 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
      <div className="skeleton h-72 rounded-xl" />
    </div>
  );
}
