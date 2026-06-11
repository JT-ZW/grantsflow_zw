export default function DashboardLoading() {
  return (
    <div className="space-y-5 pb-12 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-gray-200" />
          <div className="h-4 w-64 rounded-lg bg-gray-100" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${i === 0 ? "col-span-2 sm:col-span-1" : ""} h-28 rounded-2xl bg-gray-200`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-36 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 h-64 rounded-2xl bg-gray-200" />
        <div className="h-64 rounded-2xl bg-gray-200" />
      </div>
    </div>
  );
}
