export default function AwardeePortalLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded-lg bg-gray-200" />
        <div className="h-7 w-56 rounded-lg bg-gray-200" />
        <div className="h-4 w-40 rounded-lg bg-gray-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-gray-200" />
      <div className="h-80 rounded-2xl bg-gray-200" />
    </div>
  );
}
